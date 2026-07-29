import type {
  ShangshufangReviewMemorial,
  ShangshufangSourceLabel,
  ShangshufangTaskStatusResponse,
} from '@/lib/jiqun-api';
import { departmentNameCn } from '@/lib/contracts/dept';
import { isCanonicalProjectionEnabled } from '@/lib/courtos/canonical-projection-rollout';
import type { EdictRow, EdictView } from './edict-content';

export interface CanonicalMemorialViewResult {
  kind: 'formal' | 'candidate' | 'direct' | 'vetoed' | 'waiting';
  view: EdictView | null;
  shouldRetry: boolean;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function sourceTone(source: ShangshufangSourceLabel): 'green' | 'amber' | 'red' | 'blue' {
  if (source === 'LIVE' || source === 'LIVE_SWARM') return 'green';
  if (source === 'MIXED') return 'blue';
  if (source === 'FALLBACK') return 'red';
  return 'amber';
}

function gateState(memorial: ShangshufangReviewMemorial): 'passed' | 'blocked' | 'unknown' {
  if (memorial.quality_gate.passed === true || memorial.quality_gate.status.toLowerCase() === 'passed') return 'passed';
  if (memorial.quality_gate.passed === false || /block|fail|reject/.test(memorial.quality_gate.status.toLowerCase())) return 'blocked';
  return 'unknown';
}

function departmentRows(memorial: ShangshufangReviewMemorial): string[] {
  if (memorial.department_memorials?.length) {
    return memorial.department_memorials.map((item) => {
      const details = unique([
        item.summary,
        ...item.evidence.map((evidence) => `证据：${evidence.summary}`),
        ...item.missing_evidence.map((gap) => `缺证：${gap}`),
        ...item.risks.map((risk) => `风险：${risk}`),
        item.next_order ? `后令：${item.next_order}` : undefined,
      ]);
      return `${departmentNameCn(item.department_id)} ${item.signal} / ${item.verdict}\n${details.join('\n')}`;
    });
  }
  return memorial.ministry_outputs.map((item) =>
    `${departmentNameCn(item.department)}：${item.opinion}`,
  );
}

function buildView(input: {
  taskId: string;
  status: ShangshufangTaskStatusResponse;
  memorial: ShangshufangReviewMemorial;
  sourceLabel: ShangshufangSourceLabel;
  kind: 'formal' | 'candidate' | 'direct' | 'vetoed';
}): EdictView {
  const { taskId, status, memorial, sourceLabel, kind } = input;
  const review = status.review;
  const report = text(memorial.executive_summary) ?? text(memorial.summary);
  const risks = unique([...(memorial.risk_register ?? []), ...memorial.risk_flags]);
  const gaps = unique([
    ...(memorial.missing_evidence ?? []),
    ...memorial.evidence_gaps,
    ...(memorial.swarm_brief_for_junjichu?.missing_evidence ?? []),
  ]);
  const nextAction = text(memorial.next_order)
    ?? text(memorial.swarm_brief_for_junjichu?.recommended_next_action)
    ?? text(memorial.next_best_action);
  const conflicts = memorial.conflict_summary.map((item) => item.summary).filter(Boolean);
  const decisions = memorial.decision_options
    .filter((option) => option.enabled)
    .map((option) => `${option.label}：${option.reason}`);
  const departments = departmentRows(memorial);
  const gate = gateState(memorial);
  const blockers = unique([
    ...(memorial.quality_gate.blocking_issues ?? []),
    ...(memorial.swarm_quality_result?.blocking_reasons ?? []),
  ]);
  const warnings = unique([
    ...(memorial.quality_gate.warnings ?? []),
    ...(memorial.swarm_quality_result?.warnings ?? []),
  ]);
  const trace = review?.loop_trace_id ?? memorial.swarm_trace_id;
  const rows: EdictRow[] = [
    { label: '所议', body: status.task.raw_question },
  ];
  if (report) rows.push({ label: kind === 'vetoed' ? '门下省封驳缘由' : '军机处总回报', body: report });
  if (departments.length) rows.push({ label: '各司汇报', body: departments.join('\n') });
  // 'vetoed' 的 conflict_summary 只有一条 type: "human_signoff" 记录，内容
  // 跟上面"门下省封驳缘由"那行完全重复(后端两处塞的是同一段 reason_summary)，
  // 不是真的部门间分歧——封驳发生在任何部门会审之前，压根没有"部门"可冲突。
  // 沿用"部门冲突"这个标签会跟标题/reporter 犯同一种编造错误，这里不重复渲染。
  if (conflicts.length && kind !== 'vetoed') {
    rows.push({ label: '部门冲突', body: conflicts.join('\n') });
  }
  if (memorial.verdict || decisions.length) {
    rows.push({ label: kind === 'candidate' ? '候选建议' : '决策建议', body: unique([memorial.verdict, ...decisions]).join('\n') });
  }
  if (risks.length || gaps.length) {
    rows.push({
      label: '风险与缺证',
      body: [...risks.map((risk) => `风险：${risk}`), ...gaps.map((gap) => `缺证：${gap}`)].join('\n'),
    });
  }
  if (nextAction) rows.push({ label: '行动建议', body: nextAction });
  if (gate !== 'unknown') {
    rows.push({
      label: '质门',
      body: [gate === 'passed' ? '通过' : '阻断', ...blockers, ...warnings].join('\n'),
    });
  }
  rows.push({
    label: '来源',
    body: [sourceLabel, `案号：${taskId}`, review?.review_id ? `review：${review.review_id}` : null, trace ? `trace：${trace}` : null]
      .filter(Boolean)
      .join('\n'),
  });

  // 'vetoed'(门下省封驳)不能沿用 'candidate' 的"候选会审"措辞——那个词暗示
  // 军机处已经召集部门、产出了初步意见，只是质门没过。封驳恰恰是在任何部门
  // 会审之前就被拦下，ministry_outputs 永远是空的，说"候选会审"是编造了一段
  // 没发生过的会审过程，违反运行事实(2026-07-18)。
  const title = kind === 'formal'
    ? '圣旨正文'
    : kind === 'direct'
      ? '简单任务回执'
      : kind === 'vetoed'
        ? '门下省封驳'
        : '候选会审 · 质门阻断';
  const subtitle = kind === 'formal'
    ? '正式奏折 · 待皇上裁决'
    : kind === 'direct'
      ? '后端直接回执'
      : kind === 'vetoed'
        ? '未进入军机处会审 · 需人工确认'
        : '候选结果 · 不构成正式圣裁';
  return {
    id: `shangshufang-canonical:${kind}:${taskId}:${status.formal_memorial?.id ?? review?.review_id ?? 'pending'}`,
    title,
    subtitle,
    question: status.task.raw_question,
    meta: {
      // 封驳的意见来自门下省的路由前置审议，不是军机处会审出的结论——
      // 沿用"军机处"当 reporter 同样是编造了一段没发生过的会审。
      reporter: kind === 'vetoed' ? '门下省' : '军机处',
      priority: gate === 'blocked' ? 'urgent' : 'high',
      badges: [
        { label: sourceLabel, tone: sourceTone(sourceLabel) },
        {
          label: kind === 'formal'
            ? '正式奏折'
            : kind === 'direct'
              ? '简单回执'
              : kind === 'vetoed'
                ? '封驳/未会审'
                : '候选/阻断',
          tone: kind === 'formal' ? 'green' : 'amber',
        },
      ],
    },
    rows,
    seal: kind === 'formal' ? 'imperial' : kind === 'direct' ? 'chancellor' : 'secret',
  };
}

/** Selects only explicit backend outcomes; incomplete terminal reads deliberately request a retry. */
export function projectCanonicalMemorialView(
  taskId: string,
  status: ShangshufangTaskStatusResponse,
  options: { enabled?: boolean } = {},
): CanonicalMemorialViewResult {
  if (!(options.enabled ?? isCanonicalProjectionEnabled())) {
    return { kind: 'waiting', view: null, shouldRetry: false };
  }
  if (status.formal_memorial?.memorial) {
    return {
      kind: 'formal',
      view: buildView({
        taskId,
        status,
        memorial: status.formal_memorial.memorial,
        sourceLabel: status.formal_memorial.source_label,
        kind: 'formal',
      }),
      shouldRetry: false,
    };
  }

  const candidate = status.review?.memorial ?? null;
  if (status.task.status === 'direct_completed' && candidate) {
    return {
      kind: 'direct',
      view: buildView({ taskId, status, memorial: candidate, sourceLabel: candidate.source_label, kind: 'direct' }),
      shouldRetry: false,
    };
  }
  if ((status.task.status === 'awaiting_evidence' || status.task.status === 'edict_recorded') && candidate) {
    return {
      kind: 'candidate',
      view: buildView({ taskId, status, memorial: candidate, sourceLabel: candidate.source_label, kind: 'candidate' }),
      shouldRetry: false,
    };
  }
  // menxia_veto_pending 不识别时 view 会是 null，调用方(confirmedEdictToView)
  // 会退回 awaitingRealMemorialView 那个"还在处理中"的占位视图，但门下省封驳
  // 之后永远不会再有轮询/新事件，用户会一直卡在"处理中"画面上、误以为流程
  // 还活着(2026-07-18 实测复现)。用独立的 'vetoed' kind，不是 'candidate'
  // ——'candidate' 的"候选会审"措辞暗示军机处已经召集部门产出初步意见，而
  // 封驳恰恰是在任何部门会审之前就被拦下(ministry_outputs 永远是空的)，
  // 沿用 'candidate' 的措辞会编造一段没发生过的会审过程。
  if (status.task.status === 'menxia_veto_pending' && candidate) {
    return {
      kind: 'vetoed',
      view: buildView({ taskId, status, memorial: candidate, sourceLabel: candidate.source_label, kind: 'vetoed' }),
      shouldRetry: false,
    };
  }
  return { kind: 'waiting', view: null, shouldRetry: true };
}

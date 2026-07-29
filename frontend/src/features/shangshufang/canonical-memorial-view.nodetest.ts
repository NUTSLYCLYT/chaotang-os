import assert from 'node:assert/strict';
import test from 'node:test';

import type { ShangshufangReviewMemorial, ShangshufangTaskStatusResponse } from '@/lib/jiqun-api';
import { projectCanonicalMemorialView } from './canonical-memorial-view';

function memorial(marker: string, sparse = false): ShangshufangReviewMemorial {
  return {
    title: `${marker} title`,
    verdict: `${marker} verdict`,
    summary: `${marker} summary`,
    ministry_outputs: sparse ? [] : [{
      department: 'finance',
      focus: `${marker} focus`,
      opinion: `${marker} opinion`,
      status: 'completed',
      source_label: 'LIVE',
    }],
    conflict_summary: sparse ? [] : [{
      type: 'explicit',
      summary: `${marker} conflict`,
      departments: ['finance', 'works'],
      source_label: 'LIVE',
    }],
    evidence_gaps: sparse ? [] : [`${marker} gap`],
    risk_flags: sparse ? [] : [`${marker} risk`],
    decision_options: sparse ? [] : [{
      action: 'request_evidence',
      label: `${marker} option`,
      reason: `${marker} reason`,
      enabled: true,
    }],
    next_best_action: sparse ? '' : `${marker} next`,
    source_label: 'LIVE',
    quality_gate: {
      passed: sparse ? undefined : false,
      status: sparse ? '' : 'blocked',
      reasons: sparse ? [] : [`${marker} reason`],
      blocking_issues: sparse ? [] : [`${marker} blocker`],
      warnings: [],
      human_signoff_required: !sparse,
    },
  };
}

function status(input: {
  taskStatus?: string;
  review?: ShangshufangReviewMemorial | null;
  formal?: ShangshufangReviewMemorial | null;
  loopTraceId?: string;
}): ShangshufangTaskStatusResponse {
  const review = input.review === undefined ? memorial('review') : input.review;
  const formal = input.formal ?? null;
  return {
    task: {
      task_id: 'task-1',
      status: input.taskStatus ?? (formal ? 'awaiting_decision' : 'awaiting_evidence'),
      raw_question: 'canonical question',
      draft_edict: null,
      source_label: 'LIVE',
      risk_flags: [],
      known_facts: [],
      unknown_gaps: [],
      recommended_departments: [],
      created_at: '2026-07-16T00:00:00Z',
      updated_at: '2026-07-16T00:01:00Z',
    },
    review: review ? {
      review_id: 'review-1',
      loop_trace_id: input.loopTraceId,
      review_status: 'completed',
      routing_plan: {
        ministry_candidates: ['finance'],
        selected_departments: ['finance'],
        swarm_plan: [],
        route_reason: 'canonical route',
        source_label: 'LIVE',
      },
      ministry_outputs: review.ministry_outputs,
      conflict_summary: review.conflict_summary,
      memorial: review,
      created_at: '2026-07-16T00:00:00Z',
      updated_at: '2026-07-16T00:01:00Z',
    } : null,
    formal_memorial: formal ? {
      id: 'formal-1',
      task_id: 'task-1',
      review_id: 'review-1',
      swarm_run_id: 'run-1',
      quality_result_id: 'quality-1',
      status: 'ready_for_decision',
      source_label: 'LIVE_SWARM',
      memorial: formal,
      content_hash: 'hash',
      created_at: '2026-07-16T00:02:00Z',
    } : null,
    execution_status: null,
  };
}

function body(result: ReturnType<typeof projectCanonicalMemorialView>, label: string): string | undefined {
  return result.view?.rows.find((row) => row.label === label)?.body;
}

test('formal snapshot wins over review and uses the formal outer source label', () => {
  const result = projectCanonicalMemorialView('task-1', status({
    review: memorial('review'),
    formal: { ...memorial('formal'), source_label: 'MIXED' },
  }));

  assert.equal(result.kind, 'formal');
  assert.equal(result.shouldRetry, false);
  assert.equal(body(result, '军机处总回报'), 'formal summary');
  assert.equal(body(result, '来源'), 'LIVE_SWARM\n案号：task-1\nreview：review-1');
  assert.equal(JSON.stringify(result.view).includes('review summary'), false);
});

test('awaiting evidence is an explicit blocked candidate, never a formal sacred decision', () => {
  const result = projectCanonicalMemorialView('task-1', status({ taskStatus: 'awaiting_evidence' }));

  assert.equal(result.kind, 'candidate');
  assert.equal(result.shouldRetry, false);
  assert.match(result.view?.title ?? '', /候选/);
  assert.equal(result.view?.seal, 'secret');
  assert.equal(result.view?.rows.some((row) => row.label === '圣裁'), false);
  assert.match(body(result, '质门') ?? '', /阻断/);
});

test('menxia veto pending is its own honest kind, not a silent stuck-waiting view or a fabricated council review', () => {
  // 2026-07-18 实测复现两轮问题:① 改这条前没有分支识别 menxia_veto_pending,
  // view 落回 null,调用方(confirmedEdictToView)会退回"还在处理中"的占位
  // 视图，但门下省封驳之后永远不会再有轮询/新事件，用户会一直卡在"处理中"
  // 画面，误以为流程还活着/已经成功。② 第一次修复复用了 'candidate' kind，
  // 但"候选会审"措辞暗示军机处已经召集部门产出初步意见——封驳恰恰是在任何
  // 部门会审之前就被拦下，编造了一段没发生过的会审过程。这里锁住：view 非
  // 空、不再轮询、且标题/来源都诚实说"封驳"而不是"候选会审"。
  const result = projectCanonicalMemorialView('task-1', status({ taskStatus: 'menxia_veto_pending' }));

  assert.equal(result.kind, 'vetoed');
  assert.notEqual(result.view, null);
  assert.equal(result.shouldRetry, false);
  assert.match(result.view?.title ?? '', /封驳/);
  assert.equal(result.view?.title?.includes('候选'), false);
  assert.equal(result.view?.meta?.reporter, '门下省');
  assert.equal(result.view?.seal, 'secret');
  assert.match(body(result, '质门') ?? '', /阻断/);
  // 2026-07-18 第三轮:conflict_summary 非空(合成 fixture 里也带一条)本来会
  // 触发"部门冲突"行，但封驳发生在任何部门会审之前，压根没有部门可冲突——
  // 这行必须不出现，不能靠"内容凑巧对"侥幸过关。
  assert.equal(result.view?.rows.some((row) => row.label === '部门冲突'), false);
});

test('direct completed displays the backend receipt unchanged', () => {
  const result = projectCanonicalMemorialView('task-1', status({ taskStatus: 'direct_completed' }));

  assert.equal(result.kind, 'direct');
  assert.equal(result.shouldRetry, false);
  assert.match(result.view?.title ?? '', /简单任务回执/);
  assert.equal(body(result, '军机处总回报'), 'review summary');
});

test('edict recorded with a returned memorial displays the backend candidate instead of staying in dispatch wait', () => {
  const result = projectCanonicalMemorialView('task-1', status({ taskStatus: 'edict_recorded' }));

  assert.equal(result.kind, 'candidate');
  assert.equal(result.shouldRetry, false);
  assert.notEqual(result.view, null);
  assert.equal(body(result, '军机处总回报'), 'review summary');
});

test('object risk register entries from the backend do not break candidate projection', () => {
  const result = projectCanonicalMemorialView('task-1', status({
    taskStatus: 'edict_recorded',
    review: {
      ...memorial('review'),
      risk_register: [{
        risk: '预付比例过高',
        severity: '高',
        reason: '付款节点需要重设',
      }] as unknown as string[],
    },
  }));

  assert.equal(result.kind, 'candidate');
  assert.equal(result.shouldRetry, false);
  assert.match(body(result, '风险与缺证') ?? '', /预付比例过高/);
});

test('empty backend arrays do not become no-risk, no-conflict, or passed claims', () => {
  const result = projectCanonicalMemorialView('task-1', status({ review: memorial('empty', true) }));
  const text = JSON.stringify(result.view);

  assert.equal(text.includes('无风险'), false);
  assert.equal(text.includes('暂无冲突'), false);
  assert.equal(text.includes('通过'), false);
  assert.equal(result.view?.rows.some((row) => row.label === '风险与缺证'), false);
});

test('terminal-looking status without a memorial keeps polling instead of stopping empty', () => {
  const result = projectCanonicalMemorialView('task-1', status({
    taskStatus: 'awaiting_decision',
    review: null,
    formal: null,
  }));

  assert.equal(result.kind, 'waiting');
  assert.equal(result.view, null);
  assert.equal(result.shouldRetry, true);
});

test('trace is shown only when the backend supplied one', () => {
  const withoutTrace = projectCanonicalMemorialView('task-1', status({}));
  const withTrace = projectCanonicalMemorialView('task-1', status({ loopTraceId: 'trace-real' }));

  assert.equal(body(withoutTrace, '来源')?.includes('trace：'), false);
  assert.match(body(withTrace, '来源') ?? '', /trace：trace-real/);
});

test('rollout off degrades to a terminal safe waiting view', () => {
  const result = projectCanonicalMemorialView(
    'task-1',
    status({ formal: memorial('formal') }),
    { enabled: false },
  );

  assert.equal(result.kind, 'waiting');
  assert.equal(result.view, null);
  assert.equal(result.shouldRetry, false);
});

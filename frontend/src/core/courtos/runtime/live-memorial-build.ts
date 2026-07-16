/**
 * 飞轮点火 · 纯构建层（2026-07-02 · 会审正确版）——「从 C 栈真结果构建奏折」。
 *
 * 拆成无 server-only 依赖的纯函数,可离线单测(不依赖真 LLM/DB)。桥接层
 * live-memorial-bridge.ts 跑真闭环拿到 ministryReview/imperialReport 后调本层构建 memorial。
 *
 * 核心不变量(deming·最重要):**诚实是整个奏折信封的不变量,不是单字段属性**——
 * memorial 顶层 source_label 必须 == 所有 nested source_label
 * (department_memorials[]/evidence_chain[]/quality_gate/ministry_outputs/conflict_summary/draft_edict...)。
 * 上一版半覆盖(顶层 LIVE、各部卡 FALLBACK)被会审判 CRITICAL。本层做法:
 *   ① 内容全从真数据(ministryReview.cards / imperialReport)重建;
 *   ② source_label 全用同一个 reviewSource 变量;
 *   ③ 收尾 stampSourceLabelDeep 深度戳平所有 source_label —— 不变量天然成立、可证。
 */
import type { ShangshufangReviewMemorial, ShangshufangSourceLabel } from '@/lib/jiqun-api';
import type { MinistryReviewResult, MinistryVerdict, MinistryId } from '../ministries/ministry-types.ts';
import { mergeHonestSource } from '../../../lib/reality/merge-source.ts';
import { MINISTRY_TO_AGENT_CODE } from '@/lib/contracts/dept';

/** Neutral compatibility shape retained for the archived live-memorial builder tests. */
export interface LegacyImperialReportProjection {
  verdict: MinistryVerdict;
  oneSentence: string;
  risks: string[];
  nextAction: string;
  yushitaiWarnings?: string[];
  qualityGate: { warnings: string[] };
}

/**
 * 六部 MinistryId(本特性 SSOT)↔ 部门码(contracts/agent.ts Tier0)。
 * 铁律2:单一映射,禁静默回退。真码见 src/lib/contracts/agent.ts。
 */
export const MINISTRY_TO_DEPT_CODE: Record<MinistryId, string> = MINISTRY_TO_AGENT_CODE;

/** 圣裁枚举 → 奏折 sacred_judgement(中文)。诚实:FALLBACK/DEMO 不会走到这(见桥接层 isRecallableSource 门)。 */
export const VERDICT_TO_JUDGEMENT: Record<MinistryVerdict, NonNullable<ShangshufangReviewMemorial['sacred_judgement']>> = {
  APPROVE: '采纳',
  NEED_EVIDENCE: '补证',
  RECHECK: '复核',
  REJECT: '驳回',
};

/**
 * 是否真点亮 = 整链真(LIVE / LIVE_SWARM)。
 * 诚实(铁律13.2.3):MIXED(部分降级)/FALLBACK/DEMO 一律 false —— 半真不当全真,别给启发式盖真章。
 */
export function computeLiveFlag(reviewSource: ShangshufangSourceLabel): boolean {
  return reviewSource === 'LIVE' || reviewSource === 'LIVE_SWARM';
}

/**
 * 是否值得沉淀进召回池(飞轮点火判据)= 非 FALLBACK/DEMO(即 LIVE/LIVE_SWARM/MIXED)。
 * 与 recall-guard.NON_RECALLABLE_SOURCES 同口径:MIXED(部分真)诚实标 MIXED 后可召回,不当全真但也不丢。
 * 这解开"门太严→真实会审基本 MIXED→永不点火"的死结:MIXED 也重建奏折(全字段统一 MIXED,不变量成立)。
 */
export function isRecallableSource(reviewSource: ShangshufangSourceLabel): boolean {
  return reviewSource !== 'FALLBACK' && reviewSource !== 'DEMO';
}

/**
 * 诚实再门控(会审 CRITICAL 修正):把**拟旨 + 奏折 + 六部会审**三步源标一起合并,再判是否点亮。
 *
 * 关键:六部会审里任一部真 agent 超时/失败会回退 heuristic(该卡 FALLBACK),或 selector 选中非真部
 * (personnel/ritual/war 恒 FALLBACK)→ ministryReview.sourceLabel 降级为 MIXED/FALLBACK。若只用
 * 拟旨+奏折两步判 live(旧 bug),会把这些 heuristic 卡强戳 LIVE —— 正是上一版被 BLOCK 的"盖真章"。
 * 必须把 ministrySource 折进合并,任一降级则整体不点亮 → 回退启发式 base(诚实)。
 *
 * SSOT:合并一律走 mergeHonestSource(铁律2),不自建平行 merge。纯函数,可单测。
 */
export function reconcileLiveDecision(
  refineSource: string | undefined | null,
  reportSource: string | undefined | null,
  ministrySource: string | undefined | null,
): { finalSource: ShangshufangSourceLabel; live: boolean } {
  const finalSource = mergeHonestSource([refineSource, reportSource, ministrySource]) as ShangshufangSourceLabel;
  return { finalSource, live: computeLiveFlag(finalSource) };
}

/**
 * 深度戳平:返回一份把每一处 `source_label` 都设成 src 的深拷贝(不可变,不改入参)。
 * 这是不变量的兜底证明——无论上游遗漏哪层,信封里绝不残留异源标。
 */
export function stampSourceLabelDeep<T>(value: T, src: ShangshufangSourceLabel): T {
  if (Array.isArray(value)) {
    return value.map((item) => stampSourceLabelDeep(item, src)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = key === 'source_label' ? src : stampSourceLabelDeep(val, src);
    }
    return out as unknown as T;
  }
  return value;
}

/** 收集一份奏折里全部 source_label(测试/审计用:断言不变量)。 */
export function collectSourceLabels(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectSourceLabels(item, acc);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'source_label' && typeof val === 'string') acc.push(val);
      else collectSourceLabels(val, acc);
    }
  }
  return acc;
}

export interface BuildLiveMemorialContext {
  reviewSource: ShangshufangSourceLabel;
  refinedIntent: string;
  ministryReview: MinistryReviewResult;
  imperialReport: LegacyImperialReportProjection;
  needsHumanConfirmation: boolean;
}

/**
 * 从 C 栈真结果全量重建 memorial 诚实信封。纯函数,可单测。
 *
 * 前置约束:仅在 isRecallableSource(reviewSource)===true 时调用(LIVE/LIVE_SWARM/MIXED,桥接层保证)。
 * 不变量:返回值里全部 source_label === reviewSource(内容重建 + stampSourceLabelDeep 双保险)。
 * MIXED 时同样全字段统一标 MIXED —— 诚实说"混合来源",不冒充 LIVE,也不丢进 FALLBACK 空转。
 */
export function buildLiveMemorial(
  base: ShangshufangReviewMemorial,
  ctx: BuildLiveMemorialContext,
): ShangshufangReviewMemorial {
  const { reviewSource: src, refinedIntent, ministryReview, imperialReport, needsHumanConfirmation } = ctx;

  const departmentMemorials = ministryReview.cards.map((card) => ({
    schema_version: 'DepartmentOpinionV1' as const,
    task_id: ministryReview.taskId,
    department_id: MINISTRY_TO_DEPT_CODE[card.ministryId] ?? card.ministryId,
    signal: card.signal,
    verdict: card.verdict,
    summary: card.synthesis || card.ruling,
    // C 栈会审无逐条证据条目;留空(诚实:不编证据)。
    evidence: [] as NonNullable<ShangshufangReviewMemorial['department_memorials']>[number]['evidence'],
    missing_evidence: card.missingEvidence,
    risks: card.deputyRisks,
    next_order: card.conditionsToProceed[0] ?? imperialReport.nextAction,
    human_confirmation_required: card.needsHumanConfirmation,
    source_label: src,
  }));

  const ministryOutputs = ministryReview.cards.map((card) => ({
    department: MINISTRY_TO_DEPT_CODE[card.ministryId] ?? card.ministryId,
    focus: card.disputeFocus || card.synthesis,
    opinion: card.ruling || card.synthesis,
    status: 'completed',
    source_label: src,
  }));

  const conflictSummary = ministryReview.conflicts.map((conflict) => ({
    type: 'ministry_conflict',
    summary: conflict.summary,
    departments: conflict.between.map((id) => MINISTRY_TO_DEPT_CODE[id] ?? id),
    source_label: src,
  }));

  // 事实链沿用 base(皇上原问/已知事实),仅改源标为 src(同一次真运行 → 诚实一致)。
  const evidenceChain = (base.evidence_chain ?? []).map((item) => ({ ...item, source_label: src }));

  const missingEvidence = ministryReview.missingEvidence;
  const risks = imperialReport.risks;
  const judgement = VERDICT_TO_JUDGEMENT[imperialReport.verdict] ?? base.sacred_judgement;

  const blockingIssues = imperialReport.yushitaiWarnings ?? [];
  const gatePassed = imperialReport.verdict === 'APPROVE' && blockingIssues.length === 0;
  const qualityGate: ShangshufangReviewMemorial['quality_gate'] = {
    schema_version: 'QualityGateResultV1',
    task_id: ministryReview.taskId,
    passed: gatePassed,
    blocking_issues: blockingIssues,
    warnings: imperialReport.qualityGate.warnings ?? [],
    gate_results: [],
    human_confirmation_required: needsHumanConfirmation,
    status: gatePassed ? 'passed' : 'blocked',
    reasons: blockingIssues,
    human_signoff_required: needsHumanConfirmation,
    source_label: src,
  };

  const memorial: ShangshufangReviewMemorial = {
    ...base,
    sacred_judgement: judgement,
    executive_summary: imperialReport.oneSentence || refinedIntent || base.executive_summary,
    summary: imperialReport.oneSentence || base.summary,
    // UI 契约:memorial.verdict 沿用中文圣裁(与 base 一致,ShangshufangPage 直接读)。
    verdict: judgement ?? base.verdict,
    department_memorials: departmentMemorials,
    evidence_chain: evidenceChain,
    missing_evidence: missingEvidence,
    evidence_gaps: missingEvidence,
    risk_register: risks,
    risk_flags: risks,
    conflict_summary: conflictSummary,
    ministry_outputs: ministryOutputs,
    next_order: imperialReport.nextAction || base.next_order,
    human_confirmation_required: needsHumanConfirmation,
    quality_gate: qualityGate,
    source_label: src,
  };

  // 不变量兜底:深度戳平所有 source_label = src(含 draft_edict / swarm_trace_summary 等 base 残留层)。
  return stampSourceLabelDeep(memorial, src);
}

import type {
  ShangshufangDecisionTaskSummary,
  ShangshufangDraftEdict,
  ShangshufangReviewMemorial,
  ShangshufangRoutingPlan,
  ShangshufangSourceLabel,
} from '@/lib/jiqun-api';
import {
  buildShallowDepartmentOpinionsV1,
  loadCourtDepartmentRegistry,
  selectRegistryDepartments,
} from '../../core/courtos/departments/registry.ts';
import { loopTraceIdForTask } from '../../core/courtos/loop-trace.ts';
import type { EvoMapEventV1 } from '../../core/courtos/evomap/evomap.ts';
import { runCourtSwarmRuntime } from '../../core/courtos/runtime/swarm-runtime.ts';
import type { UnifiedLoopResult } from '../../core/courtos/unified/unified-types.ts';

export type LocalDecisionStatus =
  | 'awaiting_emperor_confirm'
  | 'reviewing'
  | 'awaiting_decision'
  | 'awaiting_evidence'
  | 'followuping'
  | 'rechecking'
  | 'adopted'
  | 'archived'
  | 'rejected'
  | 'failed_with_recovery';

export type LocalDecisionAction = 'adopt' | 'request_evidence' | 'recheck' | 'reject' | 'followup';
export type LocalSacredJudgement = '采纳' | '补证' | '复核' | '驳回' | '追问';
export type AdaptiveReviewDepth = 'shallow' | 'standard' | 'deep';

export function localStatusAfterDecisionAction(action: LocalDecisionAction): LocalDecisionStatus {
  if (action === 'adopt') return 'archived';
  if (action === 'reject') return 'rejected';
  if (action === 'recheck') return 'rechecking';
  if (action === 'followup') return 'followuping';
  return 'awaiting_evidence';
}

export function shouldArchiveLocalDecision(action: LocalDecisionAction): boolean {
  return action === 'adopt';
}

export interface AdaptiveComplexityResult {
  review_depth: AdaptiveReviewDepth;
  complexity_score: number;
  complexity_reasons: string[];
}

export interface HumanConfirmationRecord {
  confirmed_at: string;
  explanation: string;
  risks: string[];
  missing_evidence: string[];
  source_label: ShangshufangSourceLabel;
}

export interface LocalDecisionEntry {
  action: LocalDecisionAction;
  reason: string;
  human_confirmed: boolean;
  human_confirmation_record?: HumanConfirmationRecord;
  followup_question?: string;
  inherited_context?: {
    parent_task_id: string;
    raw_question: string;
    memorial_next_order?: string;
    missing_evidence: string[];
    risk_register: string[];
  };
  decided_at: string;
  source_label: ShangshufangSourceLabel;
}

export interface ShiguanArchiveRecordV1 {
  schema_version: 'ShiguanArchiveRecordV1';
  archive_id: string;
  task_id: string;
  loop_trace_id?: string;
  original_question: string;
  draft_edict: ShangshufangDraftEdict;
  memorial: ShangshufangReviewMemorial;
  emperor_decision: {
    schema_version: 'EmperorDecisionV1';
    task_id: string;
    memorial_id: string;
    action: 'adopt' | 'request_evidence' | 'request_recheck' | 'reject' | 'follow_up';
    reason: string;
    followup_question?: string;
    human_confirmed: boolean;
    human_confirmation_note?: string;
    source_label: ShangshufangSourceLabel;
  };
  human_confirmation_record?: HumanConfirmationRecord;
  reusable_lessons: string[];
  synthetic: boolean;
  source_label: ShangshufangSourceLabel;
  created_at: string;
}

export interface LocalDecisionRecord {
  source: 'courtos_local_shangshufang';
  trace_id: string;
  loop_trace_id?: string;
  task_id: string;
  user_id?: string;
  raw_question: string;
  status: LocalDecisionStatus;
  draft_edict: ShangshufangDraftEdict;
  routing_plan?: ShangshufangRoutingPlan;
  memorial?: ShangshufangReviewMemorial;
  unified_loop?: UnifiedLoopResult;
  decisions?: LocalDecisionEntry[];
  archive_record?: ShiguanArchiveRecordV1;
  evomap_events?: EvoMapEventV1[];
  archive_hints?: Array<{
    id: string;
    original_question: string;
    verdict?: string;
    source_label?: string;
    created_at: string;
    reusable_lessons: string[];
    retrospectiveStatus?: string;
  }>;
  created_at: string;
  updated_at: string;
}

const HIGH_RISK_KEYWORDS = ['正式报价', '合同', '付款', '股权', '签字', '承诺', '预付款', '独家', '法律责任'];

function normalizeQuestion(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function hasFinanceIntent(question: string): boolean {
  return /户部|预算|ROI|成本|报价|金额|现金流|回款|付款|预付|预付款|毛利|投资|请款|审批|财务/.test(question);
}

function hasSalesIntent(question: string): boolean {
  return /客户|销售|市场|渠道|成交|商机|正式报价|报价|合作|采购意向/.test(question);
}

function hasLegalIntent(question: string): boolean {
  return /合同|法务|合规|签字|盖章|正式报价|承诺|独家|违约|预付|预付款|股权|法律责任/.test(question);
}

function addOnce(items: string[], item: string): void {
  if (!items.includes(item)) items.push(item);
}

function inferDecisionType(question: string): string {
  if (/正式报价|报价|成本|ROI|预算|付款/.test(question)) return '报价与投入判断';
  if (/合同|股权|签字|法务|合规|独家/.test(question)) return '合同与风险判断';
  if (/招聘|负责人|组织|绩效|团队|岗位/.test(question)) return '组织与人员判断';
  if (/客户|销售|市场|渠道|合作|招商/.test(question)) return '客户推进判断';
  return '经营决策判断';
}

function inferKnownFacts(question: string): string[] {
  const facts = [`用户原问：${question}`];
  if (question.includes('客户')) facts.push('事项涉及客户沟通或客户推进');
  if (question.includes('正式报价')) facts.push('事项涉及正式报价边界');
  if (question.includes('合同')) facts.push('事项涉及合同或签署风险');
  if (question.includes('招聘')) facts.push('事项涉及岗位与组织承接');
  return unique(facts);
}

function inferUnknownGaps(question: string): string[] {
  const gaps = ['可归档证据链'];
  if (/正式报价|报价/.test(question)) gaps.push('报价依据', '授权记录', '报价有效期');
  if (/客户|销售|大客户/.test(question)) gaps.push('客户决策链', '客户需求范围');
  if (/合同|签字|股权/.test(question)) gaps.push('合同条款', '法务复核记录', '人工确认记录');
  if (/招聘|负责人|岗位/.test(question)) gaps.push('岗位目标', '预算范围', '第一责任人');
  if (includesAny(question, HIGH_RISK_KEYWORDS)) gaps.push('人工确认记录');
  return unique(gaps);
}

function inferSuggestedPerspectives(question: string): string[] {
  return selectRegistryDepartments({ question }).map((department) => department.protocol_id ?? department.id);
}

function inferRiskFlags(question: string): string[] {
  const flags = HIGH_RISK_KEYWORDS.filter((keyword) => question.includes(keyword));
  if (flags.length > 0) flags.unshift('需人工确认');
  return unique(flags);
}

function quoteMissingEvidence(question: string): string[] {
  if (/正式报价|报价/.test(question)) {
    return ['成本', '毛利', '付款条件', '报价有效期', '审批人', '客户需求确认'];
  }
  return inferUnknownGaps(question).filter((item) => item !== '可归档证据链' && item !== '人工确认记录');
}

function quoteRiskRegister(question: string): string[] {
  const risks: string[] = [];
  if (/正式报价|报价/.test(question)) risks.push('对外承诺风险', '报价依据不足');
  if (/合同|签字|法律责任/.test(question)) risks.push('合同或签署责任风险');
  if (/付款|预付款/.test(question)) risks.push('付款条件和现金回收风险');
  if (/股权/.test(question)) risks.push('股权承诺和治理边界风险');
  return unique([...risks, ...inferRiskFlags(question).filter((item) => item !== '需人工确认')]);
}

export function assessAdaptiveComplexity(params: {
  question: string;
  missingEvidence: string[];
  riskFlags: string[];
  selectedDepartments: string[];
}): AdaptiveComplexityResult {
  const reasons: string[] = [];
  let score = 0;
  const question = params.question;
  if (/正式报价|合同|股权|签字|承诺|独家|法律责任/.test(question)) {
    score += 45;
    reasons.push('命中高风险经营/法律关键词');
  }
  if (/付款|预付款|现金流|回款|成本|毛利|报价有效期/.test(question)) {
    score += 20;
    reasons.push('涉及财务、现金或报价边界');
  }
  if (/[0-9]+(\.[0-9]+)?\s*(万|亿|万美元|万元|元|%)/.test(question)) {
    score += 15;
    reasons.push('包含金额或比例信号');
  }
  if (/招聘|负责人|组织|岗位|绩效|团队|审批人|DRI/.test(question)) {
    score += 12;
    reasons.push('涉及组织或责任承接');
  }
  if (params.missingEvidence.length >= 4) {
    score += 15;
    reasons.push('证据缺口较多');
  } else if (params.missingEvidence.length > 0) {
    score += 8;
    reasons.push('存在证据缺口');
  }
  if (params.selectedDepartments.length >= 5) {
    score += 10;
    reasons.push('需要多部门会审');
  }
  if (params.riskFlags.includes('需人工确认')) {
    score += 20;
    reasons.push('需要 human signoff');
  }
  if (reasons.length === 0) reasons.push('低风险单点问题');
  const review_depth: AdaptiveReviewDepth = score >= 60 ? 'deep' : score >= 20 ? 'standard' : 'shallow';
  return { review_depth, complexity_score: score, complexity_reasons: reasons };
}

export function buildLocalDraftEdict(params: {
  taskId: string;
  rawQuestion: string;
  sourceLabel?: ShangshufangSourceLabel;
}): ShangshufangDraftEdict {
  const question = normalizeQuestion(params.rawQuestion);
  const suggestedPerspectives = inferSuggestedPerspectives(question);
  const unknownGaps = inferUnknownGaps(question);
  const knownFacts = inferKnownFacts(question);
  const riskFlags = inferRiskFlags(question);
  if (hasFinanceIntent(question)) {
    addOnce(suggestedPerspectives, 'hubu_cfo');
    unknownGaps.push('成本边界', '付款条件', '现金流影响', '预算审批记录');
    knownFacts.push('事项涉及户部财务、预算、报价或现金流判断');
  }
  if (hasSalesIntent(question)) {
    addOnce(suggestedPerspectives, 'bingbu_sales');
    unknownGaps.push('客户决策链', '客户需求范围');
  }
  if (hasLegalIntent(question)) {
    addOnce(suggestedPerspectives, 'xingbu_legal_risk');
    unknownGaps.push('人工确认记录');
  }
  if (question.includes('正式报价')) addOnce(riskFlags, '正式报价');
  if (/预付|预付款/.test(question)) addOnce(riskFlags, '预付款');
  if (/合同|股权|签字|承诺|独家|付款|预付|预付款|正式报价/.test(question)) addOnce(riskFlags, '闇€浜哄伐纭');
  return {
    schema_version: 'DraftEdictV1',
    task_id: params.taskId,
    original_question: question,
    refined_edict: `请军机处围绕“${question}”汇集各司与各部门信息，形成总回报；再由丞相分析资料，给出决策建议和下一步行动建议。`,
    decision_type: inferDecisionType(question),
    known_facts: unique(knownFacts),
    unknown_gaps: unique(unknownGaps),
    suggested_perspectives: suggestedPerspectives,
    recommended_departments: suggestedPerspectives,
    risk_flags: unique(riskFlags),
    expected_output: ['军机处总回报', '各司汇报', '丞相分析', '决策建议', '行动建议', '证据', '风险', '质门', '来源'],
    expected_memorial_format: ['军机处总回报', '各司汇报', '丞相分析', '决策建议', '行动建议', '证据', '风险', '质门', '来源'],
    emperor_confirmation_question: '是否确认正式下旨？',
    source_label: params.sourceLabel ?? 'FALLBACK',
  };
}

function mapEmperorDecisionAction(action: LocalDecisionAction): ShiguanArchiveRecordV1['emperor_decision']['action'] {
  if (action === 'recheck') return 'request_recheck';
  if (action === 'followup') return 'follow_up';
  return action;
}

function reusableLessonsForArchive(record: LocalDecisionRecord, decision: LocalDecisionEntry): string[] {
  const memorial = record.memorial;
  const lessons = [
    memorial?.next_order ? `后令：${memorial.next_order}` : '',
    memorial?.missing_evidence?.length ? `同类先补：${memorial.missing_evidence.slice(0, 6).join('、')}` : '',
    memorial?.risk_register?.length ? `同类风险：${memorial.risk_register.slice(0, 4).join('、')}` : '',
    record.draft_edict.source_label === 'FALLBACK'
      ? 'FALLBACK 案卷只能作为缺口、流程和复核参考，不得作为真实结论依据'
      : '',
    record.draft_edict.source_label === 'DEMO'
      ? 'DEMO 案卷不得进入真实裁决，只能作为样板流程参考'
      : '',
    decision.action === 'reject' && decision.reason ? `驳回原因：${decision.reason}` : '',
  ];
  return lessons.filter(Boolean);
}

export function buildShiguanArchiveRecordV1(
  record: LocalDecisionRecord,
  decision: LocalDecisionEntry,
  createdAt: string,
): ShiguanArchiveRecordV1 {
  if (!record.memorial) throw new Error('memorial_required_for_archive');
  return {
    schema_version: 'ShiguanArchiveRecordV1',
    archive_id: `archive_${record.task_id}`,
    task_id: record.task_id,
    loop_trace_id: record.loop_trace_id ?? loopTraceIdForTask(record.task_id),
    original_question: record.raw_question,
    draft_edict: record.draft_edict,
    memorial: record.memorial,
    emperor_decision: {
      schema_version: 'EmperorDecisionV1',
      task_id: record.task_id,
      memorial_id: record.memorial.task_id ?? `memorial_${record.task_id}`,
      action: mapEmperorDecisionAction(decision.action),
      reason: decision.reason,
      followup_question: decision.followup_question,
      human_confirmed: decision.human_confirmed,
      human_confirmation_note: decision.human_confirmation_record?.explanation,
      source_label: decision.source_label,
    },
    human_confirmation_record: decision.human_confirmation_record,
    reusable_lessons: reusableLessonsForArchive(record, decision),
    synthetic: record.draft_edict.source_label === 'FALLBACK' || record.draft_edict.source_label === 'DEMO',
    source_label: record.draft_edict.source_label,
    created_at: createdAt,
  };
}

export function evaluateLocalDraft(draft: ShangshufangDraftEdict) {
  const failed: string[] = [];
  if (!draft.original_question) failed.push('original_question_missing');
  if (!draft.refined_edict) failed.push('refined_edict_missing');
  if (!draft.source_label) failed.push('source_label_missing');
  if ((draft.known_facts.length + draft.unknown_gaps.length) === 0) failed.push('evidence_or_gap_missing');
  if (draft.risk_flags.includes('需人工确认') && !draft.unknown_gaps.includes('人工确认记录')) {
    failed.push('human_confirmation_gap_missing');
  }
  return {
    suite: 'courtos_goal2_shangshufang_draft',
    passed: failed.length === 0,
    score: failed.length === 0 ? 1 : Math.max(0, 1 - failed.length * 0.2),
    failed,
  };
}

export function buildLocalRoutingPlan(draft: ShangshufangDraftEdict): ShangshufangRoutingPlan {
  const registry = loadCourtDepartmentRegistry();
  const taskId = draft.task_id ?? `task_${Date.now()}`;
  const selectedDepartments = draft.suggested_perspectives ?? draft.recommended_departments;
  const complexity = assessAdaptiveComplexity({
    question: draft.original_question,
    missingEvidence: draft.unknown_gaps,
    riskFlags: draft.risk_flags,
    selectedDepartments,
  });
  const swarmRuntime = runCourtSwarmRuntime({
    taskId,
    reviewDepth: complexity.review_depth,
    sourceLabel: draft.source_label,
    selectedDepartments,
    registry,
  });
  const outputSourceLabel = swarmRuntime.trace.source_label;
  return {
    schema_version: 'ReviewPlanV1',
    task_id: taskId,
    ministry_candidates: selectedDepartments,
    selected_departments: selectedDepartments,
    selection_reasons: Object.fromEntries(
      selectedDepartments.map((department) => [department, `registry route + ${complexity.review_depth} review`]),
    ),
    review_depth: complexity.review_depth,
    complexity_score: complexity.complexity_score,
    complexity_reasons: complexity.complexity_reasons,
    swarm_plan: swarmRuntime.trace.requested_bundles.map((bundle) => ({
      department: bundle,
      focus: swarmRuntime.trace.findings.find((finding) => finding.includes(bundle)) ?? '蜂群深挖占位',
      status: swarmRuntime.trace.status,
    })),
    swarm_required: swarmRuntime.swarm_required,
    swarm_trace_required: swarmRuntime.swarm_trace_required,
    swarm_bundles: swarmRuntime.swarm_bundles,
    swarm_runtime_status: swarmRuntime.trace.status,
    swarm_missing_capabilities: swarmRuntime.trace.missing_capabilities,
    swarm_trace_summary: swarmRuntime.trace,
    route_reason: `自适应复杂度：${complexity.review_depth}；${complexity.complexity_reasons.join('；')}。${swarmRuntime.trace.user_visible_summary}`,
    source_label: outputSourceLabel,
  };
}

export function buildMinimalMemorialV1(taskId: string, draft: ShangshufangDraftEdict): ShangshufangReviewMemorial {
  const registry = loadCourtDepartmentRegistry();
  const departmentEntries = selectRegistryDepartments({ question: draft.original_question, registry });
  const selectedProtocols = new Set(draft.suggested_perspectives ?? draft.recommended_departments ?? []);
  for (const entry of registry) {
    if (selectedProtocols.has(entry.protocol_id) || selectedProtocols.has(entry.id)) {
      if (!departmentEntries.some((item) => item.id === entry.id)) departmentEntries.push(entry);
    }
  }
  const departments = departmentEntries.map((department) => department.id);
  const complexity = assessAdaptiveComplexity({
    question: draft.original_question,
    missingEvidence: draft.unknown_gaps,
    riskFlags: draft.risk_flags,
    selectedDepartments: departments,
  });
  const swarmRuntime = runCourtSwarmRuntime({
    taskId,
    reviewDepth: complexity.review_depth,
    sourceLabel: draft.source_label,
    selectedDepartments: departments,
    registry,
  });
  const humanSignoff = draft.risk_flags.includes('需人工确认');
  const question = draft.original_question;
  const missingEvidence = unique([...quoteMissingEvidence(question), ...draft.unknown_gaps.filter((item) => item === '人工确认记录')]);
  const riskRegister = quoteRiskRegister(question);
  const sourceLabel = swarmRuntime.trace.source_label;
  const judgement: LocalSacredJudgement = missingEvidence.length > 0 ? '补证' : humanSignoff ? '复核' : '补证';
  const judgementForGate: string = judgement;
  const nextOrder = /正式报价|报价/.test(question)
    ? '先补齐报价依据，再决定是否发正式报价'
    : '先补齐证据链和责任边界，再决定是否进入正式裁决';
  const evidenceChain = draft.known_facts.map((fact, index) => ({
    schema_version: 'EvidenceItemV1' as const,
    id: `evidence_${taskId}_${index + 1}`,
    label: index === 0 ? '皇上原问' : '已知事实',
    summary: fact,
    reliability: 'medium' as const,
    source_label: sourceLabel,
  }));
  const departmentMemorials = buildShallowDepartmentOpinionsV1({
    taskId,
    question,
    knownFacts: draft.known_facts,
    sourceLabel,
    registry,
  }).map((opinion) => ({
    ...opinion,
    missing_evidence: unique([...opinion.missing_evidence, ...missingEvidence]),
    risks: unique([...opinion.risks, ...riskRegister]),
    next_order: nextOrder,
    human_confirmation_required: opinion.human_confirmation_required || humanSignoff,
  }));
  const gateResults = [
    {
      id: 'source_label_required',
      passed: Boolean(sourceLabel),
      message: `source_label=${sourceLabel}`,
    },
    {
      id: 'no_fallback_as_final_certainty',
      passed: sourceLabel !== 'FALLBACK' || judgementForGate !== '采纳',
      message: 'FALLBACK 不得作为最终确定性采纳依据',
    },
    {
      id: 'evidence_or_gap_required',
      passed: evidenceChain.length > 0 || missingEvidence.length > 0,
      message: '奏折必须展示证据或缺口',
    },
    {
      id: 'high_risk_requires_human_confirmation',
      passed: !humanSignoff || missingEvidence.includes('人工确认记录'),
      message: '高风险事项采纳前必须人工确认',
    },
    {
      id: 'live_swarm_requires_trace_id',
      passed: sourceLabel !== 'LIVE_SWARM' || Boolean(swarmRuntime.trace.trace_id),
      message: 'LIVE_SWARM 必须有真实 swarm trace_id',
    },
    {
      id: 'missing_capability_must_be_disclosed',
      passed: swarmRuntime.trace.missing_capabilities.length === 0 || swarmRuntime.trace.user_visible_summary.length > 0,
      message: '缺少真实蜂群能力时必须披露',
    },
  ];
  const blockingIssues = [
    ...(sourceLabel === 'FALLBACK' ? ['FALLBACK 仅可形成补证/复核建议，不得作为最终确定性依据'] : []),
    ...(missingEvidence.length ? ['存在证据缺口'] : []),
    ...(humanSignoff ? ['高风险事项需人工确认'] : []),
    ...(swarmRuntime.trace.missing_capabilities.length ? ['蜂群深挖未执行：缺少真实 trace_id 或 live adapter'] : []),
  ];
  const qualityGate = {
    schema_version: 'QualityGateResultV1' as const,
    task_id: taskId,
    passed: blockingIssues.length === 0,
    blocking_issues: blockingIssues,
    warnings: sourceLabel === 'DEMO' ? ['DEMO 不得进入真实裁决'] : [],
    gate_results: gateResults,
    human_confirmation_required: humanSignoff,
    status: blockingIssues.length === 0 ? 'passed' : 'blocked',
    reasons: blockingIssues,
    human_signoff_required: humanSignoff,
    source_label: sourceLabel,
  };
  return {
    schema_version: 'MemorialV1',
    task_id: taskId,
    sacred_judgement: judgement,
    executive_summary:
      /正式报价|报价/.test(question)
        ? `客户要求正式报价，复杂度为 ${complexity.review_depth}；当前缺成本、毛利、付款条件、报价有效期、审批人与客户需求确认；建议补证或复核，不应直接发正式报价。`
        : `围绕“${question}”已形成 ${complexity.review_depth} 奏折；当前应先处理证据缺口和风险边界。`,
    department_memorials: departmentMemorials,
    evidence_chain: evidenceChain,
    missing_evidence: missingEvidence,
    risk_register: riskRegister,
    conflict_summary: [
      {
        type: 'evidence_vs_action',
        summary: '用户希望推进动作，但当前证据链不足以支持确定性采纳。',
        departments,
        source_label: sourceLabel,
      },
    ],
    next_order: nextOrder,
    review_depth: complexity.review_depth,
    complexity_score: complexity.complexity_score,
    complexity_reasons: complexity.complexity_reasons,
    swarm_trace_summary: swarmRuntime.trace,
    swarm_trace_id: swarmRuntime.trace.trace_id,
    quality_gate: qualityGate,
    human_confirmation_required: humanSignoff,
    source_label: sourceLabel,
    title: draft.refined_edict,
    verdict: judgement,
    summary:
      /正式报价|报价/.test(question)
        ? `最小奏折建议：补证或复核。风险为对外承诺风险、报价依据不足。复杂度：${complexity.review_depth}。`
        : `最小奏折已生成，复杂度：${complexity.review_depth}，等待皇上采纳、补证、复核、驳回或追问。`,
    draft_edict: draft,
    ministry_outputs: departments.map((department) => ({
      department,
      focus: departmentMemorials.find((item) => item.department_id === department)?.summary ?? '最小参审意见',
      opinion: departmentMemorials.find((item) => item.department_id === department)?.summary ?? '最小参审意见',
      status: 'completed',
      source_label: draft.source_label,
    })),
    evidence_gaps: missingEvidence,
    risk_flags: riskRegister,
    decision_options: [
      { action: 'adopt', label: '采纳', reason: '采纳当前奏折建议', enabled: true },
      { action: 'request_evidence', label: '补证', reason: '当前仍有证据缺口', enabled: missingEvidence.length > 0 },
      { action: 'recheck', label: '复核', reason: '要求军机处复核当前判断', enabled: true },
      { action: 'reject', label: '驳回', reason: '当前奏折不被采纳，需记录原因', enabled: true },
      { action: 'followup', label: '追问', reason: '继承当前任务上下文继续追问', enabled: true },
    ],
    next_best_action: missingEvidence.length > 0 ? 'request_evidence' : 'recheck',
  };
}

export function toDecisionTaskSummary(record: LocalDecisionRecord): ShangshufangDecisionTaskSummary {
  return {
    task_id: record.task_id,
    loop_trace_id: record.loop_trace_id ?? loopTraceIdForTask(record.task_id),
    status: record.status,
    raw_question: record.raw_question,
    draft_edict: record.draft_edict,
    source_label: record.draft_edict.source_label,
    risk_flags: record.draft_edict.risk_flags,
    known_facts: record.draft_edict.known_facts,
    unknown_gaps: record.draft_edict.unknown_gaps,
    recommended_departments: record.draft_edict.suggested_perspectives ?? record.draft_edict.recommended_departments,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export function readLocalDecisionRecord(result: unknown): LocalDecisionRecord | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
  const record = (result as Record<string, unknown>).shangshufangDecision;
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const source = (record as Record<string, unknown>).source;
  if (source !== 'courtos_local_shangshufang') return null;
  const decision = record as LocalDecisionRecord;
  return {
    ...decision,
    loop_trace_id: decision.loop_trace_id ?? loopTraceIdForTask(decision.task_id),
  };
}

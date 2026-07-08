import type { SourceLabel } from '../types';
import { mergeSourceLabels } from '../source-label.ts';
import type { DepartmentOpinion, IntelligencePack, UnifiedDraftEdict } from '../unified/unified-types.ts';
import type {
  GongbuCTOCPOOfficeLoopInput,
  GongbuCTOCPOOfficeLoopResult,
  GongbuCTOCPOOpinion,
  GongbuConfidence,
  GongbuCrossDepartmentReview,
  GongbuDeliveryEvidence,
  GongbuDeliveryQuestionType,
  GongbuDepartmentWorkOrder,
  GongbuGeneratedArtifact,
  GongbuPosition,
  GongbuQualityGateResult,
  GongbuSubOfficeId,
  GongbuSubOfficeOpinion,
} from './gongbu-types.ts';

const SUB_OFFICE_NAMES: Record<GongbuSubOfficeId, string> = {
  cto_cpo_chief: '工部尚书',
  solution_architecture: '方案司',
  bom_supply_chain: '物料司',
  schedule_capacity: '进度司',
  quality_acceptance: '质量司',
  field_implementation: '现场司',
  delivery_operations: '交付司',
  delivery_commitment_gate: '承诺司',
};

const CORE_FORBIDDEN_ACTIONS = [
  '自动承诺固定交期',
  '自动发送交付承诺',
  '自动锁定供应商',
  '自动下采购单',
  '自动变更 MVP 范围',
  '自动发布验收标准',
  '自动确认交付完成',
  '自动对客户承诺产能或技术能力',
];

function hasAny(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items.filter(Boolean))];
}

function makeEvidence(title: string, sourceLabel: SourceLabel): GongbuDeliveryEvidence {
  return {
    title,
    sourceType: sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO' ? 'FALLBACK' : 'USER_INPUT',
    usable: sourceLabel !== 'DEMO',
    confidence: sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM' ? '高' : '中',
  };
}

function makeTypedEvidence(
  title: string,
  sourceType: GongbuDeliveryEvidence['sourceType'],
  sourceLabel: SourceLabel,
  sourceRef?: string,
): GongbuDeliveryEvidence {
  return {
    title,
    sourceType,
    sourceRef,
    usable: sourceType !== 'FALLBACK' && sourceLabel !== 'DEMO',
    confidence: sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM' ? '高' : '中',
  };
}

export function classifyGongbuDeliveryQuestion(text: string): GongbuDeliveryQuestionType {
  if (hasAny(text, ['储能', '冷库', '硬件', '设备项目', '施工'])) return 'STORAGE_OR_HARDWARE_PROJECT';
  if (hasAny(text, ['BOM', '物料', '供应链', '供应商', '采购', '库存', '替代料'])) return 'BOM_SUPPLY_CHAIN';
  if (hasAny(text, ['30天', '30 天', '固定交期', '一定交付', '按时交付', '交付承诺', '承诺交付'])) return 'DELIVERY_COMMITMENT';
  if (hasAny(text, ['交期', '排期', '里程碑', '产能', '工期', '上线日期', '资源'])) return 'SCHEDULE_CAPACITY';
  if (hasAny(text, ['验收', '测试', '质检', '质量', '缺陷', 'SLA', '稳定性', '上线'])) return 'QUALITY_ACCEPTANCE';
  if (hasAny(text, ['现场', '部署', '实施', '安装', '并网', '客户环境', '安全'])) return 'FIELD_IMPLEMENTATION';
  if (hasAny(text, ['MVP', '第一版', '范围', '需求', '变更', '加需求'])) return hasAny(text, ['变更', '加需求']) ? 'SCOPE_CHANGE' : 'MVP_SCOPE';
  if (hasAny(text, ['技术上', '技术方案', '架构', '开发', '可行性', '功能'])) return 'TECHNICAL_FEASIBILITY';
  if (hasAny(text, ['延期', '复盘', '下次怎么避免', '为什么'])) return 'DELIVERY_REVIEW';
  return 'OTHER_DELIVERY_RISK';
}

export function selectGongbuSubOffices(type: GongbuDeliveryQuestionType, text: string): GongbuSubOfficeId[] {
  const selected = new Set<GongbuSubOfficeId>(['cto_cpo_chief']);
  const add = (...ids: GongbuSubOfficeId[]) => ids.forEach((id) => selected.add(id));

  switch (type) {
    case 'STORAGE_OR_HARDWARE_PROJECT':
      add('solution_architecture', 'bom_supply_chain', 'schedule_capacity', 'quality_acceptance', 'field_implementation', 'delivery_commitment_gate');
      break;
    case 'BOM_SUPPLY_CHAIN':
      add('bom_supply_chain', 'schedule_capacity', 'delivery_commitment_gate');
      break;
    case 'TECHNICAL_FEASIBILITY':
      add('solution_architecture', 'quality_acceptance');
      break;
    case 'MVP_SCOPE':
      add('solution_architecture', 'delivery_operations');
      break;
    case 'SCHEDULE_CAPACITY':
      add('schedule_capacity', 'delivery_operations');
      break;
    case 'QUALITY_ACCEPTANCE':
      add('quality_acceptance', 'delivery_operations');
      break;
    case 'FIELD_IMPLEMENTATION':
      add('field_implementation', 'schedule_capacity');
      break;
    case 'DELIVERY_COMMITMENT':
      add('delivery_commitment_gate', 'schedule_capacity', 'quality_acceptance');
      break;
    case 'SCOPE_CHANGE':
      add('solution_architecture', 'delivery_operations', 'schedule_capacity');
      break;
    case 'DELIVERY_REVIEW':
      add('delivery_operations', 'schedule_capacity', 'bom_supply_chain');
      break;
    default:
      add('solution_architecture', 'delivery_operations');
  }

  if (hasAny(text, ['BOM', '设备', '物料', '供应商', '采购'])) selected.add('bom_supply_chain');
  if (hasAny(text, ['交期', '30天', '30 天', '产能', '排期'])) selected.add('schedule_capacity');
  if (hasAny(text, ['验收', '测试', '质量', '缺陷'])) selected.add('quality_acceptance');
  if (hasAny(text, ['现场', '施工', '安装', '并网', '安全'])) selected.add('field_implementation');
  if (hasAny(text, ['承诺', '对外', '客户口径', '一定交付'])) selected.add('delivery_commitment_gate');
  return [...selected];
}

function requiredDeliveryEvidence(type: GongbuDeliveryQuestionType): string[] {
  const base = ['需求范围', '负责人', '证据材料'];
  if (type === 'STORAGE_OR_HARDWARE_PROJECT') return [...base, 'BOM', '设备报价', '交期', '现场条件', '验收标准'];
  if (type === 'BOM_SUPPLY_CHAIN') return [...base, 'BOM', '关键物料', '供应商报价', '交期证明', '替代方案'];
  if (type === 'TECHNICAL_FEASIBILITY') return [...base, '技术约束', '验证数据', '验收标准'];
  if (type === 'MVP_SCOPE') return [...base, '需求清单', '优先级', '验收标准'];
  if (type === 'SCHEDULE_CAPACITY') return [...base, '关键路径', '产能', '资源计划', '外部依赖'];
  if (type === 'QUALITY_ACCEPTANCE') return [...base, '验收标准', '测试计划', '缺陷记录'];
  if (type === 'FIELD_IMPLEMENTATION') return [...base, '现场勘查', '客户环境', '安全要求', '施工条件'];
  if (type === 'DELIVERY_COMMITMENT') return [...base, 'BOM', '交期依据', '产能', '验收标准', '授权口径'];
  if (type === 'SCOPE_CHANGE') return [...base, '变更内容', '影响评估', '客户确认'];
  if (type === 'DELIVERY_REVIEW') return [...base, '原计划', '实际里程碑', '延期原因', '责任链'];
  return base;
}

function hasExplicitEvidence(text: string, item: string): boolean {
  const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(已有|有了|已经有|已提供|提供了|已上传|上传了|已确认|确认了|已锁定|锁定了|明确).{0,12}${escaped}|${escaped}.{0,12}(已有|有了|已经有|已提供|提供了|已上传|上传了|已确认|确认了|已锁定|锁定了|明确)`).test(text);
}

function inferMissingEvidence(text: string, required: string[]): string[] {
  return required.filter((item) => !hasExplicitEvidence(text, item));
}

function inferCrossDepartmentReviews(type: GongbuDeliveryQuestionType, text: string, deliveryCommitmentRisk: boolean): GongbuCrossDepartmentReview[] {
  const reviews: GongbuCrossDepartmentReview[] = [];
  if (hasAny(text, ['成本', '采购价', '报价', '付款', '预算', 'ROI']) || type === 'BOM_SUPPLY_CHAIN') reviews.push('finance');
  if (hasAny(text, ['合同', '承诺', '正式', '供应商锁定', '下采购单', '交付义务', '答应']) || type === 'DELIVERY_COMMITMENT' || deliveryCommitmentRisk) reviews.push('justice');
  if (hasAny(text, ['客户', '销售', '客户催', '客户要求', 'demo'])) reviews.push('war');
  if (hasAny(text, ['客户口径', '对外', '怎么回复', '宣传', '销售想告诉客户', '答应']) || deliveryCommitmentRisk) reviews.push('ritual');
  if (hasAny(text, ['负责人', '资源', '团队', '产能', '变更', '范围'])) reviews.push('personnel');
  if (hasAny(text, ['供应商说', '并网', '现场情况', '政策'])) reviews.push('jinyiwei');
  return unique(reviews);
}

function hasDeliveryCommitmentRisk(type: GongbuDeliveryQuestionType, text: string): boolean {
  return type === 'DELIVERY_COMMITMENT'
    || hasAny(text, ['承诺', '一定交付', '固定交期', '30天', '30 天', '按时交付', '客户要求', '正式方案', '验收完成', '锁定供应商']);
}

function generatedArtifactTypes(type: GongbuDeliveryQuestionType): string[] {
  if (type === 'STORAGE_OR_HARDWARE_PROJECT') return ['BOM 缺口清单', '交付可行性报告', '验收标准草案'];
  if (type === 'BOM_SUPPLY_CHAIN') return ['BOM 缺口清单', '供应链风险清单', '供应商补证清单'];
  if (type === 'TECHNICAL_FEASIBILITY') return ['技术方案审查意见', '测试计划大纲'];
  if (type === 'MVP_SCOPE') return ['MVP 范围卡', '变更控制单'];
  if (type === 'SCHEDULE_CAPACITY') return ['交期风险清单', '产能评估清单', '里程碑计划草案'];
  if (type === 'QUALITY_ACCEPTANCE') return ['验收标准草案', '测试计划大纲', '质量风险清单'];
  if (type === 'FIELD_IMPLEMENTATION') return ['现场勘查清单', '施工/部署前置条件清单'];
  if (type === 'DELIVERY_COMMITMENT') return ['客户交付口径草稿', '不可承诺事项清单', '高风险人工确认弹窗文案'];
  if (type === 'SCOPE_CHANGE') return ['变更控制单', 'MVP 范围卡'];
  if (type === 'DELIVERY_REVIEW') return ['交付复盘卡', '里程碑计划草案'];
  return ['跨部门复核单'];
}

function buildGongbuLoopText(params: {
  confirmedEdict: UnifiedDraftEdict;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: GongbuDepartmentWorkOrder;
}): string {
  const { confirmedEdict, intelligencePack, departmentWorkOrder } = params;
  return [
    confirmedEdict.originalQuestion,
    confirmedEdict.refinedQuestion,
    confirmedEdict.decisionType,
    ...confirmedEdict.knownFacts,
    departmentWorkOrder?.focusQuestion,
    ...(departmentWorkOrder?.requiredEvidence ?? []),
    ...(departmentWorkOrder?.expectedOutputs ?? []),
    ...(intelligencePack?.facts ?? []),
    ...(intelligencePack?.evidenceBasis ?? []),
  ].filter(Boolean).join('\n');
}

function collectGongbuLoopEvidence(params: {
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: GongbuDepartmentWorkOrder;
  sourceLabel: SourceLabel;
}): GongbuDeliveryEvidence[] {
  const evidence: GongbuDeliveryEvidence[] = [];
  if (params.intelligencePack) {
    for (const fact of params.intelligencePack.facts) evidence.push(makeTypedEvidence(`锦衣卫事实：${fact}`, 'TOOL_RESULT', params.intelligencePack.sourceLabel));
    for (const basis of params.intelligencePack.evidenceBasis) evidence.push(makeTypedEvidence(`锦衣卫证据：${basis}`, 'TOOL_RESULT', params.intelligencePack.sourceLabel));
  }
  if (params.departmentWorkOrder?.focusQuestion) {
    evidence.push(makeTypedEvidence(`军机处工部工单：${params.departmentWorkOrder.focusQuestion}`, 'USER_INPUT', params.departmentWorkOrder.sourceLabel ?? params.sourceLabel));
  }
  return evidence;
}

function buildSubOfficeOpinion(params: {
  officeId: GongbuSubOfficeId;
  type: GongbuDeliveryQuestionType;
  text: string;
  missingEvidence: string[];
  deliveryCommitmentRisk: boolean;
  crossDepartmentReviews: GongbuCrossDepartmentReview[];
  sourceLabel: SourceLabel;
}): GongbuSubOfficeOpinion {
  const { officeId, missingEvidence, deliveryCommitmentRisk, crossDepartmentReviews, sourceLabel } = params;
  const evidenceUsed = [makeEvidence('用户原始问题', sourceLabel)];
  const officeMissingEvidence: string[] = [];
  const risks: string[] = [];
  const requiredCrossReviews: GongbuCrossDepartmentReview[] = [];
  let finding = `${SUB_OFFICE_NAMES[officeId]}要求保留证据链，不能把目标交期包装成承诺交期。`;
  let nextBestAction = '先补齐工部交付证据并进入军机处合奏';

  if (officeId === 'solution_architecture') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /需求|范围|技术|验证|验收|优先级/.test(item)));
    finding = officeMissingEvidence.length ? '技术方案或 MVP 范围缺证，不能确认能力边界。' : '方案范围可进入技术复核。';
    risks.push('方案范围不清', '技术能力被过度承诺');
    nextBestAction = '先补需求范围、技术约束和验收标准';
  }
  if (officeId === 'bom_supply_chain') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /BOM|物料|供应商|报价|交期|替代/.test(item)));
    requiredCrossReviews.push(...crossDepartmentReviews.filter((item) => item === 'finance' || item === 'justice'));
    finding = officeMissingEvidence.length ? 'BOM、供应链或供应商交期缺证，不能锁定交付承诺。' : 'BOM 与供应链可进入采购/交期复核。';
    risks.push('供应链缺口', '长周期物料风险');
    nextBestAction = '先补 BOM、供应商报价、交期证明和替代方案';
  }
  if (officeId === 'schedule_capacity') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /交期|关键路径|产能|资源|外部依赖|里程碑/.test(item)));
    requiredCrossReviews.push(...crossDepartmentReviews.filter((item) => item === 'personnel' || item === 'war'));
    finding = officeMissingEvidence.length ? '关键路径、产能或资源未确认，不能承诺固定日期。' : '排期可进入里程碑复核。';
    risks.push('交期不可控', '产能不足');
    nextBestAction = '先补关键路径、产能和资源计划';
  }
  if (officeId === 'quality_acceptance') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /验收|测试|缺陷|质量|SLA/.test(item)));
    finding = officeMissingEvidence.length ? '验收标准或测试计划缺失，不能确认交付完成。' : '质量与验收口径可进入复核。';
    risks.push('验收争议风险', '质量风险');
    nextBestAction = '先补验收标准、测试计划和缺陷记录';
  }
  if (officeId === 'field_implementation') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /现场|客户环境|安全|施工|并网|安装/.test(item)));
    requiredCrossReviews.push(...crossDepartmentReviews.filter((item) => item === 'jinyiwei' || item === 'justice'));
    finding = officeMissingEvidence.length ? '现场条件、施工或安全材料不足，不能确认实施可行。' : '现场实施可进入施工条件复核。';
    risks.push('现场条件不明', '安全/许可风险');
    nextBestAction = '先补现场勘查、客户环境和安全要求';
  }
  if (officeId === 'delivery_operations') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /负责人|原计划|实际里程碑|延期|责任链|变更|客户确认/.test(item)));
    requiredCrossReviews.push(...crossDepartmentReviews.filter((item) => item === 'personnel' || item === 'finance'));
    finding = '交付运作必须明确责任、变更边界和复盘证据。';
    risks.push('交付责任不清', '变更失控');
    nextBestAction = '先补交付计划、责任链和变更影响评估';
  }
  if (officeId === 'delivery_commitment_gate') {
    officeMissingEvidence.push(...missingEvidence);
    requiredCrossReviews.push(...crossDepartmentReviews.filter((item) => item === 'justice' || item === 'ritual' || item === 'war'));
    finding = deliveryCommitmentRisk ? '命中对外交付承诺风险，只能生成待审口径，不得自动外发。' : '当前未命中高风险交付承诺，但仍需保留证据链。';
    risks.push(...(deliveryCommitmentRisk ? ['对外交付承诺风险'] : []));
    nextBestAction = deliveryCommitmentRisk ? '先完成刑部、礼部和人工确认' : '进入军机处合奏';
  }
  if (officeId === 'cto_cpo_chief') {
    officeMissingEvidence.push(...missingEvidence);
    requiredCrossReviews.push(...crossDepartmentReviews);
    finding = officeMissingEvidence.length ? '工部尚书判断：缺交付证据，不能形成确定性交付结论。' : '工部尚书判断：可进入军机处合奏，但对外承诺仍需人工确认。';
    risks.push(...(officeMissingEvidence.length ? ['交付证据不足'] : []), ...(deliveryCommitmentRisk ? ['交付承诺需人工确认'] : []));
    nextBestAction = officeMissingEvidence[0] ? `先补${officeMissingEvidence[0]}` : '进入军机处合奏';
  }

  const requiresHumanConfirmation = deliveryCommitmentRisk || requiredCrossReviews.includes('justice');
  const position: GongbuPosition = officeMissingEvidence.length ? '补证' : requiresHumanConfirmation ? '复核' : '准奏';
  return {
    officeId,
    officeName: SUB_OFFICE_NAMES[officeId],
    position,
    finding,
    evidenceUsed,
    missingEvidence: unique(officeMissingEvidence),
    risks: unique(risks),
    forbiddenCommitments: CORE_FORBIDDEN_ACTIONS,
    requiredCrossReviews: unique(requiredCrossReviews),
    requiresHumanConfirmation,
    nextBestAction,
    sourceLabel,
    source_label: sourceLabel,
  };
}

function synthesizePosition(subOpinions: GongbuSubOfficeOpinion[], sourceLabel: SourceLabel): GongbuPosition {
  if (sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO') return '补证';
  if (subOpinions.some((item) => item.requiresHumanConfirmation)) return '复核';
  if (subOpinions.some((item) => item.missingEvidence.length > 0)) return '补证';
  return '准奏';
}

function buildNextAction(position: GongbuPosition, missingEvidence: string[], crossReviews: GongbuCrossDepartmentReview[]): string {
  if (missingEvidence.length > 0) return `先补齐${missingEvidence.slice(0, 4).join('、')}`;
  if (crossReviews.length > 0) return `先完成${crossReviews.slice(0, 3).join('、')}跨部门复核`;
  if (position === '复核') return '先完成工部人工确认和军机处合奏';
  return '进入军机处合奏';
}

function buildGeneratedArtifacts(params: {
  type: GongbuDeliveryQuestionType;
  sourceLabel: SourceLabel;
  forbiddenActions: string[];
  humanConfirmationRequired: boolean;
  crossDepartmentReviews: GongbuCrossDepartmentReview[];
}): GongbuGeneratedArtifact[] {
  const status: GongbuGeneratedArtifact['status'] = params.humanConfirmationRequired
    ? 'needs_human_review'
    : params.crossDepartmentReviews.length > 0
      ? 'needs_cross_review'
      : 'draft';
  return generatedArtifactTypes(params.type).map((type) => ({
    type,
    title: `${type}（工部草稿）`,
    status,
    content: '仅供军机处合奏和人工复核使用，不得作为自动承诺交期、锁定供应商、确认验收或外发客户口径依据。',
    forbiddenActions: params.forbiddenActions,
    requiresHumanConfirmation: params.humanConfirmationRequired,
    requiresCrossReview: params.crossDepartmentReviews,
    sourceLabel: params.sourceLabel,
  }));
}

export function runGongbuCTOCPOOfficeReview(params: {
  text: string;
  sourceLabel?: SourceLabel;
  extraEvidenceUsed?: GongbuDeliveryEvidence[];
  extraMissingEvidence?: string[];
}): GongbuCTOCPOOpinion {
  const sourceLabel = params.sourceLabel ?? 'MIXED';
  const text = params.text.trim();
  const deliveryQuestionType = classifyGongbuDeliveryQuestion(text);
  const requiredSubOffices = selectGongbuSubOffices(deliveryQuestionType, text);
  const deliveryCommitmentRisk = hasDeliveryCommitmentRisk(deliveryQuestionType, text);
  const missingEvidence = unique([
    ...inferMissingEvidence(text, requiredDeliveryEvidence(deliveryQuestionType)),
    ...(params.extraMissingEvidence ?? []),
  ]);
  const crossDepartmentReviews = inferCrossDepartmentReviews(deliveryQuestionType, text, deliveryCommitmentRisk);
  const subOfficeOpinions = requiredSubOffices.map((officeId) => buildSubOfficeOpinion({
    officeId,
    type: deliveryQuestionType,
    text,
    missingEvidence,
    deliveryCommitmentRisk,
    crossDepartmentReviews,
    sourceLabel,
  }));
  const ctoCpoPosition = synthesizePosition(subOfficeOpinions, sourceLabel);
  const riskRegister = unique(subOfficeOpinions.flatMap((item) => item.risks));
  const humanConfirmationRequired = deliveryCommitmentRisk
    || crossDepartmentReviews.includes('justice')
    || sourceLabel === 'FALLBACK'
    || sourceLabel === 'DEMO';
  const evidenceUsed = unique([...(params.extraEvidenceUsed ?? []), makeEvidence('用户原始问题', sourceLabel)]);
  const generatedArtifacts = buildGeneratedArtifacts({
    type: deliveryQuestionType,
    sourceLabel,
    forbiddenActions: CORE_FORBIDDEN_ACTIONS,
    humanConfirmationRequired,
    crossDepartmentReviews,
  });
  const recommendedNextAction = buildNextAction(ctoCpoPosition, missingEvidence, crossDepartmentReviews);
  const confidence: GongbuConfidence = sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM'
    ? (missingEvidence.length ? '中' : '高')
    : missingEvidence.length > 2 ? '低' : '中';

  return {
    department: '工部',
    ctoCpoPosition,
    confidence,
    executiveSummary: ctoCpoPosition === '补证'
      ? '工部当前只能输出交付风险和补证清单，缺少 BOM、交期、验收、现场或供应链证据。'
      : '工部认为可进入交付复核，但任何固定交期、客户承诺、供应商锁定或验收确认都必须人工确认。',
    deliveryQuestionType,
    deliveryCommitmentRisk,
    requiredSubOffices,
    subOfficeOpinions,
    evidenceUsed,
    missingEvidence,
    assumptions: missingEvidence.length ? ['缺证阶段只能输出风险、补证和待审草稿。'] : [],
    riskRegister,
    forbiddenActions: CORE_FORBIDDEN_ACTIONS,
    crossDepartmentReviews,
    recommendedNextAction,
    generatedArtifactsAvailable: generatedArtifacts.map((item) => item.type),
    generatedArtifacts,
    questionsForEmperor: missingEvidence[0] ? [`是否先补充「${missingEvidence[0]}」再进入工部复核？`] : [],
    humanConfirmationRequired,
    sourceLabel,
    source_label: sourceLabel,
  };
}

export function runGongbuCTOCPOOfficeLoopV1(params: GongbuCTOCPOOfficeLoopInput): GongbuCTOCPOOfficeLoopResult {
  const labels: SourceLabel[] = [params.sourceLabel ?? params.confirmedEdict.sourceLabel, params.confirmedEdict.sourceLabel];
  if (params.intelligencePack) labels.push(params.intelligencePack.sourceLabel);
  if (params.departmentWorkOrder?.sourceLabel) labels.push(params.departmentWorkOrder.sourceLabel);
  const sourceLabel = mergeSourceLabels(labels);
  const text = buildGongbuLoopText(params);
  const extraEvidenceUsed = collectGongbuLoopEvidence({
    intelligencePack: params.intelligencePack,
    departmentWorkOrder: params.departmentWorkOrder,
    sourceLabel,
  });
  const extraMissingEvidence = unique([
    ...(params.confirmedEdict.unknownGaps ?? []),
    ...(params.intelligencePack?.missingEvidence ?? []),
    ...(params.departmentWorkOrder?.requiredEvidence ?? []),
  ]);
  const opinion = runGongbuCTOCPOOfficeReview({ text, sourceLabel, extraEvidenceUsed, extraMissingEvidence });
  return {
    loopId: 'gongbu_cto_cpo_delivery_office_loop_v1',
    opinion,
    qualityGate: evaluateGongbuQualityGate(opinion),
  };
}

export function evaluateGongbuQualityGate(opinion: GongbuCTOCPOOpinion): GongbuQualityGateResult {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const gateResults: GongbuQualityGateResult['gateResults'] = [];
  const addGate = (gate: string, status: 'pass' | 'block' | 'warn' | 'n/a', detail: string) => {
    gateResults.push({ gate, status, detail });
    if (status === 'block') blockingIssues.push(gate);
    if (status === 'warn') warnings.push(gate);
  };

  addGate('source_label_required', opinion.sourceLabel && opinion.source_label ? 'pass' : 'block', '工部输出必须带 sourceLabel/source_label。');
  addGate('evidence_or_gap_required', opinion.evidenceUsed.length > 0 || opinion.missingEvidence.length > 0 ? 'pass' : 'block', '每个交付结论必须有证据或缺口。');
  addGate('no_delivery_commitment_without_bom_and_schedule', opinion.deliveryCommitmentRisk && (opinion.missingEvidence.includes('BOM') || opinion.missingEvidence.some((item) => /交期|交期依据/.test(item))) ? 'warn' : 'pass', '缺 BOM 或交期依据不得承诺交付。');
  addGate('no_fixed_date_without_capacity_and_dependencies', opinion.deliveryCommitmentRisk && opinion.missingEvidence.some((item) => /产能|关键路径|外部依赖/.test(item)) ? 'warn' : 'pass', '固定日期必须有产能、关键路径和依赖证据。');
  addGate('formal_delivery_commitment_requires_xingbu_review', opinion.deliveryCommitmentRisk && !opinion.crossDepartmentReviews.includes('justice') ? 'block' : opinion.deliveryCommitmentRisk ? 'pass' : 'n/a', '正式交付承诺必须刑部复核。');
  addGate('price_or_cost_claim_requires_hubu_review', opinion.crossDepartmentReviews.includes('finance') ? 'pass' : opinion.deliveryQuestionType === 'BOM_SUPPLY_CHAIN' ? 'warn' : 'n/a', '成本、采购价或报价必须户部复核。');
  addGate('customer_timeline_requires_war_review', opinion.crossDepartmentReviews.includes('war') ? 'pass' : opinion.deliveryCommitmentRisk ? 'warn' : 'n/a', '客户时间线和推进节奏需兵部复核。');
  addGate('scope_change_requires_personnel_or_owner_review', opinion.deliveryQuestionType === 'SCOPE_CHANGE' && !opinion.crossDepartmentReviews.includes('personnel') ? 'block' : opinion.deliveryQuestionType === 'SCOPE_CHANGE' ? 'pass' : 'n/a', '范围变更必须确认负责人和承接。');
  addGate('acceptance_requires_test_plan_and_acceptance_criteria', opinion.deliveryQuestionType === 'QUALITY_ACCEPTANCE' && (opinion.missingEvidence.includes('验收标准') || opinion.missingEvidence.includes('测试计划')) ? 'warn' : 'pass', '验收必须有标准和测试计划。');
  addGate('supplier_lock_requires_contract_and_supply_evidence', opinion.forbiddenActions.includes('自动锁定供应商') ? 'pass' : 'block', '不能自动锁定供应商。');
  addGate('safety_or_compliance_risk_requires_human_confirmation', opinion.riskRegister.some((item) => /安全|许可/.test(item)) && !opinion.humanConfirmationRequired ? 'block' : 'pass', '安全或许可风险必须人工确认。');
  addGate('no_auto_external_delivery_commitment', opinion.forbiddenActions.includes('自动发送交付承诺') ? 'pass' : 'block', '不得自动外发交付承诺。');
  addGate('high_risk_requires_human_confirmation', opinion.deliveryCommitmentRisk && !opinion.humanConfirmationRequired ? 'block' : opinion.deliveryCommitmentRisk ? 'pass' : 'n/a', '高风险交付承诺必须人工确认。');
  addGate('one_primary_delivery_next_action_required', opinion.recommendedNextAction ? 'pass' : 'block', '工部分奏必须有唯一下一步。');
  addGate('fallback_cannot_be_final_delivery_basis', (opinion.sourceLabel === 'FALLBACK' || opinion.sourceLabel === 'DEMO') && opinion.ctoCpoPosition === '准奏' ? 'block' : opinion.sourceLabel === 'FALLBACK' || opinion.sourceLabel === 'DEMO' ? 'warn' : 'pass', 'FALLBACK/DEMO 不得作为最终交付依据。');

  const signal = blockingIssues.length > 0 || opinion.ctoCpoPosition === '驳回'
    ? 'RED'
    : opinion.ctoCpoPosition === '复核' || opinion.humanConfirmationRequired
      ? 'RED'
      : opinion.ctoCpoPosition === '补证' || warnings.length > 0
        ? 'YELLOW'
        : opinion.sourceLabel === 'FALLBACK' || opinion.sourceLabel === 'DEMO'
          ? 'GRAY'
          : 'GREEN';
  const verdict = signal === 'RED' ? 'RECHECK' : signal === 'GREEN' ? 'APPROVE' : 'NEED_EVIDENCE';

  return {
    passed: blockingIssues.length === 0 && signal !== 'RED',
    signal,
    verdict,
    gateResults,
    blockingIssues: unique(blockingIssues),
    warnings: unique(warnings),
    humanConfirmationRequired: opinion.humanConfirmationRequired,
    sourceLabel: opinion.sourceLabel,
  };
}

export function buildGongbuDepartmentOpinion(params: {
  draftEdict: UnifiedDraftEdict;
  sourceLabel: SourceLabel;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: GongbuDepartmentWorkOrder;
}): DepartmentOpinion {
  const result = runGongbuCTOCPOOfficeLoopV1({
    confirmedEdict: params.draftEdict,
    intelligencePack: params.intelligencePack,
    departmentWorkOrder: params.departmentWorkOrder,
    sourceLabel: params.sourceLabel,
  });
  const gongbuOpinion = result.opinion;
  const gate = result.qualityGate;
  return {
    departmentId: 'works',
    signal: gate.signal,
    verdict: gate.verdict,
    summary: `工部 CTO/CPO Delivery Office：${gongbuOpinion.ctoCpoPosition}。${gongbuOpinion.executiveSummary}`,
    evidence: gongbuOpinion.evidenceUsed.map((item) => item.title),
    missingEvidence: gongbuOpinion.missingEvidence,
    risks: unique([...gongbuOpinion.riskRegister, ...gate.blockingIssues, ...gate.warnings]),
    nextAction: gongbuOpinion.recommendedNextAction,
    needsHumanConfirmation: gongbuOpinion.humanConfirmationRequired || gate.signal === 'RED',
    sourceLabel: gongbuOpinion.sourceLabel,
    gongbuOpinion,
  };
}

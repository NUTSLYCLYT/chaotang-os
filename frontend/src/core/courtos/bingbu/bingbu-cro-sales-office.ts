import type { SourceLabel } from '../types';
import { mergeSourceLabels } from '../source-label.ts';
import type { DepartmentOpinion, IntelligencePack, UnifiedDraftEdict } from '../unified/unified-types.ts';
import type {
  BingbuCROOpinion,
  BingbuCROPosition,
  BingbuCROSalesOfficeLoopInput,
  BingbuCROSalesOfficeLoopResult,
  BingbuCrossDepartmentReview,
  BingbuDepartmentWorkOrder,
  BingbuGeneratedArtifact,
  BingbuQualityGateResult,
  BingbuSalesRevenueQuestionType,
  BingbuSubOfficeId,
  BingbuSubOfficeReview,
  SalesEvidenceItem,
} from './bingbu-types.ts';

export const SUB_OFFICE_NAMES: Record<BingbuSubOfficeId, string> = {
  cro_chief: '兵部尚书',
  gtm_strategy: '布阵司',
  opportunity_pipeline: '商机司',
  key_account_attack: '攻坚司',
  pricing_deal_desk: '价策司',
  channel_partner: '渠道司',
  sales_revops: '销运司',
  customer_success_growth: '客成司',
};

function hasAny(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function makeEvidence(title: string, sourceLabel: SourceLabel, sourceType: SalesEvidenceItem['sourceType'] = 'USER_INPUT'): SalesEvidenceItem {
  return {
    title,
    sourceType: sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO' ? 'FALLBACK' : sourceType,
    usable: sourceLabel !== 'DEMO' && sourceType !== 'FALLBACK',
    confidence: sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM' ? '高' : '中',
  };
}

export function classifyBingbuSalesRevenueQuestion(text: string): BingbuSalesRevenueQuestionType {
  if (hasAny(text, ['复盘', '为什么输', '为什么赢', '被打回', 'Win/Loss', 'win/loss'])) return 'WIN_LOSS_REVIEW';
  if (hasAny(text, ['forecast', '预测', 'pipeline 健康', '销售漏斗', 'quota', 'CRM 质量'])) return 'FORECAST_REVIEW';
  if (hasAny(text, ['续约', '复购', '客户成功', 'QBR', '满意度', '老客户'])) return 'CUSTOMER_SUCCESS_GROWTH';
  if (hasAny(text, ['渠道', '代理', '经销', '伙伴', '分成', '独家', '客户归属'])) return 'CHANNEL_PARTNER';
  if (hasAny(text, ['谈判', '压价', '异议', 'ROI', '收益', '竞品更便宜', '竞品报价', '客户怎么回复', '回复客户'])) return 'NEGOTIATION_STRATEGY';
  if (hasAny(text, ['报价', '正式报价', '折扣', '八折', '底价', '毛利', '付款条件'])) return 'QUOTE_STRATEGY';
  if (hasAny(text, ['大客户', '重点客户', '决策链', '关键人', '多线程', '攻关', '客户策略'])) return 'ACCOUNT_STRATEGY';
  if (hasAny(text, ['提成', '销售组织', '招聘销售', '销售负责人', '激励', 'AI 销售', 'AI Sales', '自动发消息'])) return 'SALES_ORG_EXECUTION';
  if (hasAny(text, ['线索', '展会', '有没有预算', '有预算', '预算是否可信', '是否值得跟', '要不要继续跟'])) return 'LEAD_QUALIFICATION';
  return 'OPPORTUNITY_REVIEW';
}

export function selectBingbuSubOffices(type: BingbuSalesRevenueQuestionType, text: string): BingbuSubOfficeId[] {
  const selected = new Set<BingbuSubOfficeId>(['cro_chief']);
  const add = (...ids: BingbuSubOfficeId[]) => ids.forEach((id) => selected.add(id));

  switch (type) {
    case 'LEAD_QUALIFICATION':
      add('opportunity_pipeline', 'key_account_attack');
      break;
    case 'OPPORTUNITY_REVIEW':
      add('opportunity_pipeline', 'sales_revops');
      break;
    case 'ACCOUNT_STRATEGY':
      add('gtm_strategy', 'key_account_attack', 'opportunity_pipeline');
      break;
    case 'QUOTE_STRATEGY':
      add('pricing_deal_desk', 'opportunity_pipeline');
      break;
    case 'NEGOTIATION_STRATEGY':
      add('key_account_attack', 'pricing_deal_desk');
      break;
    case 'CHANNEL_PARTNER':
      add('channel_partner', 'pricing_deal_desk');
      break;
    case 'FORECAST_REVIEW':
      add('sales_revops', 'opportunity_pipeline');
      break;
    case 'WIN_LOSS_REVIEW':
      add('sales_revops', 'pricing_deal_desk', 'opportunity_pipeline');
      break;
    case 'CUSTOMER_SUCCESS_GROWTH':
      add('customer_success_growth', 'key_account_attack');
      break;
    case 'SALES_ORG_EXECUTION':
      add('sales_revops', 'cro_chief');
      break;
  }

  if (hasAny(text, ['GTM', 'ICP', '新产品', '区域', '行业'])) selected.add('gtm_strategy');
  if (hasAny(text, ['渠道', '代理', '伙伴', '独家'])) selected.add('channel_partner');
  if (hasAny(text, ['续约', '复购', '交付价值'])) selected.add('customer_success_growth');
  return [...selected];
}

function requiredSalesEvidence(type: BingbuSalesRevenueQuestionType): string[] {
  switch (type) {
    case 'LEAD_QUALIFICATION':
      return ['客户画像', '需求来源', '预算来源', '决策权限', '时间线'];
    case 'OPPORTUNITY_REVIEW':
      return ['商机阶段', '阶段证据', 'sales_owner', '阻塞点', '下一步触发条件'];
    case 'ACCOUNT_STRATEGY':
      return ['客户决策链', '关键人', '需求范围', '竞争态势', '下一次会议目标'];
    case 'QUOTE_STRATEGY':
      return ['客户确认需求范围', '成本表', '毛利边界', '付款条件', '报价有效期'];
    case 'NEGOTIATION_STRATEGY':
      return ['客户异议原文', '可让步边界', '交换条件', '不可承诺事项'];
    case 'CHANNEL_PARTNER':
      return ['渠道资质', '分成模型', '客户归属规则', '渠道协议', '冲突处理规则'];
    case 'FORECAST_REVIEW':
      return ['pipeline 阶段', '阶段证据', '预计回款', '风险商机', 'CRM 更新时间'];
    case 'WIN_LOSS_REVIEW':
      return ['历史报价', '客户反馈', '输赢原因证据', '下次避免动作'];
    case 'CUSTOMER_SUCCESS_GROWTH':
      return ['交付价值证据', '客户反馈', '续约日期', '复购机会', '风险信号'];
    case 'SALES_ORG_EXECUTION':
      return ['负责人', '目标拆解', '激励方案', '执行节奏', '审批人'];
  }
}

function inferMissingEvidence(text: string, required: string[]): string[] {
  return required.filter((item) => !text.includes(item));
}

function inferSalesOwnerOrGap(text: string): string {
  if (/owner|负责人|销售负责|DRI|销售/.test(text)) return '已有销售负责人线索，需确认授权和任务边界';
  return 'owner_gap: 缺 sales_owner / DRI';
}

function inferOpportunityStageOrGap(text: string): string {
  if (/线索|展会/.test(text)) return '线索阶段';
  if (/报价|正式报价|折扣|压价/.test(text)) return '报价/谈判阶段，需阶段证据';
  if (/合同|框架协议|签约/.test(text)) return '合同推进阶段，需刑部复核';
  if (/续约|复购/.test(text)) return '客户成功/续约阶段';
  if (/商机阶段|阶段/.test(text)) return '已有阶段描述，需证据校验';
  return 'stage_gap: 缺 opportunity_stage / 阶段证据';
}

function inferCustomerClaims(text: string): string[] {
  const claims: string[] = [];
  if (/客户.*预算|有预算/.test(text)) claims.push('客户预算声明');
  if (/客户.*承诺|口头承诺|客户确认/.test(text)) claims.push('客户承诺/确认声明');
  if (/客户.*要求|客户要|客户问/.test(text)) claims.push('客户需求或问题声明');
  return claims;
}

function inferCrossReviews(text: string, type: BingbuSalesRevenueQuestionType): BingbuCrossDepartmentReview[] {
  const reviews: BingbuCrossDepartmentReview[] = [];
  const add = (...ids: BingbuCrossDepartmentReview[]) => reviews.push(...ids);
  if (/正式报价|报价单|发报价/.test(text)) add('finance', 'justice');
  if (/折扣|底价|毛利|压价/.test(text)) add('finance');
  if (/ROI|收益|回报|增收/.test(text)) add('finance', 'justice', 'ritual');
  if (/合同|协议|独家|付款|违约|框架协议/.test(text)) add('justice');
  if (/客户.*预算|客户.*承诺|客户确认|采购意向|口头承诺/.test(text)) add('jinyiwei', 'justice');
  if (/竞品|行业第一|市场排名|竞品攻击/.test(text)) add('jinyiwei', 'ritual', 'justice');
  if (/交期|交付能力|技术能力|产能/.test(text)) add('works', 'justice', 'ritual');
  if (/提成|销售组织|招聘销售|销售负责人|quota|激励/.test(text)) add('personnel', 'finance');
  if (type === 'CHANNEL_PARTNER') add('finance', 'justice');
  if (/客户消息|客户回复|自动发消息|AI 销售|AI Sales/.test(text)) add('ritual', 'justice');
  return unique(reviews);
}

function isHighRiskSalesAction(text: string, crossReviews: BingbuCrossDepartmentReview[]): boolean {
  return /正式报价|折扣|底价|ROI|收益|合同|协议|独家|付款|客户承诺|客户确认|竞品|交期|AI 销售|自动发消息/.test(text)
    || crossReviews.includes('justice')
    || crossReviews.includes('ritual');
}

function buildSubOfficeReview(params: {
  officeId: BingbuSubOfficeId;
  type: BingbuSalesRevenueQuestionType;
  text: string;
  missingEvidence: string[];
  crossReviews: BingbuCrossDepartmentReview[];
  sourceLabel: SourceLabel;
}): BingbuSubOfficeReview {
  const { officeId, type, text, missingEvidence, crossReviews, sourceLabel } = params;
  const highRisk = isHighRiskSalesAction(text, crossReviews);
  const position: BingbuCROPosition = highRisk
    ? '复核'
    : missingEvidence.length > 2
      ? '补证'
      : '推进';
  return {
    officeId,
    officeName: SUB_OFFICE_NAMES[officeId],
    position,
    finding: `${SUB_OFFICE_NAMES[officeId]}判断该问题属于 ${type}，当前应先锁定证据、责任人和唯一下一步。`,
    evidenceUsed: [makeEvidence('用户原始销售问题', sourceLabel)],
    missingEvidence: missingEvidence.slice(0, 4),
    risks: [
      ...(highRisk ? ['高风险销售动作需要跨部门复核和人工确认'] : []),
      ...(missingEvidence.length ? ['缺证不得包装成确定性客户承诺或成交判断'] : []),
    ],
    requiredCrossReviews: crossReviews,
    requiresHumanConfirmation: highRisk,
    onePrimarySalesAction: missingEvidence[0] ? `补齐${missingEvidence[0]}` : '安排下一次客户推进动作并记录 CRM',
    sourceLabel,
    source_label: sourceLabel,
  };
}

function buildArtifact(params: {
  type: string;
  crossReviews: BingbuCrossDepartmentReview[];
  highRisk: boolean;
  sourceLabel: SourceLabel;
}): BingbuGeneratedArtifact {
  return {
    type: params.type,
    title: params.type,
    status: params.highRisk || params.crossReviews.length ? 'needs_cross_review' : 'draft',
    content: `${params.type}草案，仅供内部审查，不得自动外发。`,
    maySendExternally: false,
    requiresHumanConfirmation: params.highRisk,
    requiresCrossReview: params.crossReviews,
    sourceLabel: params.sourceLabel,
  };
}

function artifactTypesFor(type: BingbuSalesRevenueQuestionType, text: string): string[] {
  if (type === 'QUOTE_STRATEGY') return ['报价前检查清单', '报价策略草案'];
  if (type === 'NEGOTIATION_STRATEGY') return [/竞品/.test(text) ? '竞品 battlecard' : '谈判策略', '客户回复草稿'];
  if (type === 'ACCOUNT_STRATEGY') return ['大客户攻坚计划', '客户会议计划', '客户决策链图'];
  if (type === 'FORECAST_REVIEW') return ['Pipeline 风险表', 'Forecast 解释卡'];
  if (type === 'WIN_LOSS_REVIEW') return ['Win/Loss 复盘'];
  if (type === 'CHANNEL_PARTNER') return ['渠道伙伴计划', '渠道政策草案'];
  if (type === 'CUSTOMER_SUCCESS_GROWTH') return ['续约/复购计划', '客户成功 QBR 大纲'];
  if (type === 'SALES_ORG_EXECUTION') return ['销售周会 agenda', 'CRM 更新建议'];
  return ['客户跟进方案', '销售下一步行动卡'];
}

export function runBingbuCROSalesOfficeReview(params: {
  text: string;
  sourceLabel: SourceLabel;
  extraEvidenceUsed?: SalesEvidenceItem[];
  extraMissingEvidence?: string[];
}): BingbuCROOpinion {
  const type = classifyBingbuSalesRevenueQuestion(params.text);
  const requiredEvidence = requiredSalesEvidence(type);
  const missingEvidence = unique([
    ...inferMissingEvidence(params.text, requiredEvidence),
    ...(params.extraMissingEvidence ?? []),
  ]);
  const crossReviews = inferCrossReviews(params.text, type);
  const highRisk = isHighRiskSalesAction(params.text, crossReviews);
  const requiredSubOffices = selectBingbuSubOffices(type, params.text);
  const position: BingbuCROPosition = highRisk
    ? '复核'
    : missingEvidence.length > 2
      ? '补证'
      : '推进';
  const evidenceUsed = unique([
    makeEvidence('用户原始销售问题', params.sourceLabel),
    ...(params.extraEvidenceUsed ?? []),
  ]);
  const subOfficeReviews = requiredSubOffices.map((officeId) => buildSubOfficeReview({
    officeId,
    type,
    text: params.text,
    missingEvidence,
    crossReviews,
    sourceLabel: params.sourceLabel,
  }));
  const artifactTypes = artifactTypesFor(type, params.text);

  return {
    department: '兵部',
    position,
    confidence: params.sourceLabel === 'LIVE' || params.sourceLabel === 'LIVE_SWARM' ? '高' : '中',
    executiveSummary: highRisk
      ? '该销售动作涉及报价、承诺、对外表达或法律风险，兵部建议先升维复核，不得自动外发。'
      : '兵部建议围绕商机阶段、证据缺口、负责人和唯一下一步推进。',
    salesRevenueQuestionType: type,
    salesOwnerOrGap: inferSalesOwnerOrGap(params.text),
    opportunityStageOrGap: inferOpportunityStageOrGap(params.text),
    requiredSubOffices,
    subOfficeReviews,
    evidenceUsed,
    missingEvidence,
    customerClaims: inferCustomerClaims(params.text),
    riskRegister: unique([
      ...(highRisk ? ['高风险销售动作必须人工确认'] : []),
      ...(crossReviews.includes('finance') ? ['报价、折扣、ROI 或分成需要户部复核'] : []),
      ...(crossReviews.includes('justice') ? ['合同、承诺、独家、付款或正式报价需要刑部复核'] : []),
      ...(crossReviews.includes('ritual') ? ['对外客户消息或竞品表达需要礼部审辞'] : []),
      ...(crossReviews.includes('jinyiwei') ? ['客户承诺或竞品声明需要锦衣卫来源核验'] : []),
      ...(missingEvidence.length ? ['缺证不得转成确定性成交结论'] : []),
    ]),
    forbiddenActions: [
      '自动发送客户消息',
      '自动发送正式报价',
      '自动承诺价格/折扣/交期/ROI/收益',
      '自动签署合同/渠道协议/独家协议',
    ],
    crossDepartmentReviews: crossReviews,
    onePrimarySalesAction: missingEvidence[0] ? `补齐${missingEvidence[0]}` : '确认客户下一步会议和内部 owner',
    generatedArtifactsAvailable: artifactTypes,
    generatedArtifacts: artifactTypes.map((artifactType) => buildArtifact({
      type: artifactType,
      crossReviews,
      highRisk,
      sourceLabel: params.sourceLabel,
    })),
    questionsForEmperor: missingEvidence.slice(0, 2).map((item) => `是否已有${item}？`),
    humanConfirmationRequired: highRisk,
    maySendExternally: false,
    sourceLabel: params.sourceLabel,
    source_label: params.sourceLabel,
  };
}

function buildBingbuLoopText(params: {
  confirmedEdict: UnifiedDraftEdict;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: BingbuDepartmentWorkOrder;
}): string {
  return [
    params.confirmedEdict.originalQuestion,
    params.confirmedEdict.refinedQuestion,
    params.confirmedEdict.decisionType,
    ...params.confirmedEdict.knownFacts,
    params.departmentWorkOrder?.focusQuestion,
    ...(params.departmentWorkOrder?.requiredEvidence ?? []),
    ...(params.departmentWorkOrder?.expectedOutputs ?? []),
    ...(params.intelligencePack?.facts ?? []),
    ...(params.intelligencePack?.evidenceBasis ?? []),
  ].filter(Boolean).join('\n');
}

function collectBingbuLoopEvidence(params: {
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: BingbuDepartmentWorkOrder;
  sourceLabel: SourceLabel;
}): SalesEvidenceItem[] {
  const evidence: SalesEvidenceItem[] = [];
  for (const fact of params.intelligencePack?.facts ?? []) {
    evidence.push(makeEvidence(`锦衣卫事实：${fact}`, params.intelligencePack?.sourceLabel ?? params.sourceLabel, 'TOOL_RESULT'));
  }
  for (const basis of params.intelligencePack?.evidenceBasis ?? []) {
    evidence.push(makeEvidence(`锦衣卫证据：${basis}`, params.intelligencePack?.sourceLabel ?? params.sourceLabel, 'TOOL_RESULT'));
  }
  if (params.departmentWorkOrder?.focusQuestion) {
    evidence.push(makeEvidence(`军机处兵部工单：${params.departmentWorkOrder.focusQuestion}`, params.departmentWorkOrder.sourceLabel ?? params.sourceLabel));
  }
  return evidence;
}

export function runBingbuCROSalesOfficeLoopV1(params: BingbuCROSalesOfficeLoopInput): BingbuCROSalesOfficeLoopResult {
  const labels: SourceLabel[] = [params.sourceLabel ?? params.confirmedEdict.sourceLabel, params.confirmedEdict.sourceLabel];
  if (params.intelligencePack) labels.push(params.intelligencePack.sourceLabel);
  if (params.departmentWorkOrder?.sourceLabel) labels.push(params.departmentWorkOrder.sourceLabel);
  const sourceLabel = mergeSourceLabels(labels);
  const opinion = runBingbuCROSalesOfficeReview({
    text: buildBingbuLoopText(params),
    sourceLabel,
    extraEvidenceUsed: collectBingbuLoopEvidence({
      intelligencePack: params.intelligencePack,
      departmentWorkOrder: params.departmentWorkOrder,
      sourceLabel,
    }),
    extraMissingEvidence: unique([
      ...(params.confirmedEdict.unknownGaps ?? []),
      ...(params.intelligencePack?.missingEvidence ?? []),
      ...(params.departmentWorkOrder?.requiredEvidence ?? []),
    ]),
  });
  return {
    loopId: 'bingbu_cro_sales_office_loop_v1',
    opinion,
    qualityGate: evaluateBingbuQualityGate(opinion),
  };
}

export function evaluateBingbuQualityGate(opinion: BingbuCROOpinion): BingbuQualityGateResult {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const gateResults: BingbuQualityGateResult['gateResults'] = [];
  const addGate = (gate: string, status: 'pass' | 'block' | 'warn' | 'n/a', detail: string) => {
    gateResults.push({ gate, status, detail });
    if (status === 'block') blockingIssues.push(gate);
    if (status === 'warn') warnings.push(gate);
  };

  addGate('source_label_required', opinion.sourceLabel && opinion.source_label ? 'pass' : 'block', '兵部输出必须带 sourceLabel/source_label。');
  addGate('evidence_or_gap_required', opinion.evidenceUsed.length > 0 || opinion.missingEvidence.length > 0 ? 'pass' : 'block', '销售结论必须有证据或缺口。');
  addGate('sales_owner_or_gap_required', opinion.salesOwnerOrGap ? 'pass' : 'block', '必须有 sales_owner 或 owner_gap。');
  addGate('opportunity_stage_requires_evidence', opinion.opportunityStageOrGap ? 'pass' : 'block', '必须有 opportunity_stage 或 stage_gap。');
  addGate('customer_claims_require_source', opinion.customerClaims.length > 0 && !opinion.crossDepartmentReviews.includes('jinyiwei') ? 'block' : opinion.customerClaims.length > 0 ? 'pass' : 'n/a', '客户承诺、预算或确认必须锦衣卫核验。');
  addGate('formal_quote_requires_hubu_and_xingbu_review', opinion.salesRevenueQuestionType === 'QUOTE_STRATEGY' && (!opinion.crossDepartmentReviews.includes('finance') || !opinion.crossDepartmentReviews.includes('justice')) ? 'block' : opinion.salesRevenueQuestionType === 'QUOTE_STRATEGY' ? 'pass' : 'n/a', '正式报价必须户部和刑部复核。');
  addGate('competitor_claims_require_jinyiwei_evidence', opinion.riskRegister.some((item) => item.includes('竞品')) && !opinion.crossDepartmentReviews.includes('jinyiwei') ? 'block' : opinion.riskRegister.some((item) => item.includes('竞品')) ? 'pass' : 'n/a', '竞品声明必须锦衣卫证据。');
  addGate('no_price_or_delivery_commitment_without_review', opinion.forbiddenActions.includes('自动承诺价格/折扣/交期/ROI/收益') ? 'pass' : 'block', '不得未经复核承诺价格或交期。');
  addGate('no_auto_send_customer_message', opinion.maySendExternally === false && opinion.forbiddenActions.includes('自动发送客户消息') ? 'pass' : 'block', '不得自动发送客户消息。');
  addGate('one_primary_sales_action_required', opinion.onePrimarySalesAction ? 'pass' : 'block', '必须输出唯一销售下一步。');
  addGate('high_risk_requires_human_confirmation', opinion.humanConfirmationRequired || opinion.crossDepartmentReviews.length === 0 ? 'pass' : 'warn', '高风险销售动作必须人工确认。');
  addGate('fallback_cannot_be_final_sales_basis', (opinion.sourceLabel === 'FALLBACK' || opinion.sourceLabel === 'DEMO') && opinion.position === '推进' ? 'block' : opinion.sourceLabel === 'FALLBACK' || opinion.sourceLabel === 'DEMO' ? 'warn' : 'pass', 'FALLBACK/DEMO 不得作为最终销售依据。');

  const signal = blockingIssues.length > 0
    ? 'RED'
    : opinion.position === '复核' || opinion.humanConfirmationRequired
      ? 'RED'
      : opinion.position === '补证' || warnings.length > 0
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

export function buildBingbuDepartmentOpinion(params: {
  draftEdict: UnifiedDraftEdict;
  sourceLabel: SourceLabel;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: BingbuDepartmentWorkOrder;
}): DepartmentOpinion {
  const result = runBingbuCROSalesOfficeLoopV1({
    confirmedEdict: params.draftEdict,
    intelligencePack: params.intelligencePack,
    departmentWorkOrder: params.departmentWorkOrder,
    sourceLabel: params.sourceLabel,
  });
  const warOpinion = result.opinion;
  const gate = result.qualityGate;
  return {
    departmentId: 'war',
    signal: gate.signal,
    verdict: gate.verdict,
    summary: `兵部 CRO / Sales / RevOps Office：${warOpinion.position}。${warOpinion.executiveSummary}`,
    evidence: warOpinion.evidenceUsed.map((item) => item.title),
    missingEvidence: warOpinion.missingEvidence,
    risks: unique([...warOpinion.riskRegister, ...gate.blockingIssues, ...gate.warnings]),
    nextAction: warOpinion.onePrimarySalesAction,
    needsHumanConfirmation: warOpinion.humanConfirmationRequired || gate.signal === 'RED',
    sourceLabel: warOpinion.sourceLabel,
    warOpinion,
  };
}

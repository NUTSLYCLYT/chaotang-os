import type { SourceLabel } from '../types';
import { mergeSourceLabels } from '../source-label.ts';
import type { DepartmentOpinion, IntelligencePack, UnifiedDraftEdict } from '../unified/unified-types.ts';
import type {
  HubuCFOOfficeLoopInput,
  HubuCFOOfficeLoopResult,
  HubuCFOOpinion,
  HubuCFOPosition,
  HubuDepartmentWorkOrder,
  HubuFinanceEvidence,
  HubuFinanceMetric,
  HubuFinanceQuestionType,
  HubuQualityGateResult,
  HubuSubOfficeId,
  HubuSubOfficeOpinion,
} from './hubu-types.ts';

export type HubuDepartmentOpinion = DepartmentOpinion & {
  cfoOpinion: HubuCFOOpinion;
};

const SUB_OFFICE_NAMES: Record<HubuSubOfficeId, string> = {
  cfo_chief: '户部尚书',
  fpna_budget: '度支司',
  treasury_cash: '金库司',
  controller_books: '计簿司',
  cost_pricing: '价本司',
  investment_review: '投审司',
  audit_control: '稽核司',
};

function hasAny(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function makeEvidence(title: string, sourceLabel: SourceLabel): HubuFinanceEvidence {
  return {
    title,
    sourceType: sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO' ? 'FALLBACK' : 'USER_INPUT',
    usable: sourceLabel !== 'DEMO',
    confidence: sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM' ? '高' : '中',
  };
}

function makeTypedEvidence(
  title: string,
  sourceType: HubuFinanceEvidence['sourceType'],
  sourceLabel: SourceLabel,
  sourceRef?: string,
): HubuFinanceEvidence {
  return {
    title,
    sourceType,
    sourceRef,
    usable: sourceType !== 'FALLBACK' && sourceLabel !== 'DEMO',
    confidence: sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM' ? '高' : '中',
  };
}

function missingMetric(metric: string, meaningForEmperor: string): HubuFinanceMetric {
  return { metric, value: null, status: 'missing', meaningForEmperor };
}

function assumptionMetric(metric: string, meaningForEmperor: string): HubuFinanceMetric {
  return { metric, value: '待测算', status: 'assumption', meaningForEmperor };
}

export function classifyHubuFinanceQuestion(text: string): HubuFinanceQuestionType {
  if (hasAny(text, ['复盘', '月结', '经营报表', '预算偏差'])) return '经营复盘';
  if (hasAny(text, ['合同', '签约', '违约金', '收入确认'])) return '合同财务条款审查';
  if (hasAny(text, ['正式报价', '报价', '底价', '毛利'])) return '报价审查';
  if (hasAny(text, ['投资', '合作', '项目推进', '立项', '并购', 'ROI', 'NPV', 'IRR'])) return '投资评审';
  if (hasAny(text, ['预算', '费用上限', '资源申请'])) return '预算审批';
  if (hasAny(text, ['现金流', '现金', '资金安全', '资金缺口'])) return '现金流判断';
  if (hasAny(text, ['成本', '毛利', '利润'])) return '成本毛利分析';
  if (hasAny(text, ['回款', '账期', '应收', '应付'])) return '回款与账期判断';
  if (hasAny(text, ['融资', '借款', '授信', '还款'])) return '融资/借款判断';
  if (hasAny(text, ['采购', '供应商', '付款'])) return '采购付款判断';
  if (hasAny(text, ['招聘', '薪酬', '负责人', '岗位'])) return '招聘/组织成本判断';
  if (hasAny(text, ['异常', '舞弊', '重复付款', '审计'])) return '异常风险审计';
  return '其他财务问题';
}

export function selectHubuSubOffices(type: HubuFinanceQuestionType, text: string): HubuSubOfficeId[] {
  const selected = new Set<HubuSubOfficeId>(['cfo_chief']);
  const add = (...ids: HubuSubOfficeId[]) => ids.forEach((id) => selected.add(id));

  switch (type) {
    case '报价审查':
      add('cost_pricing', 'treasury_cash', 'audit_control');
      break;
    case '投资评审':
      add('investment_review', 'fpna_budget', 'treasury_cash', 'audit_control');
      break;
    case '预算审批':
      add('fpna_budget', 'treasury_cash', 'audit_control');
      break;
    case '现金流判断':
      add('treasury_cash', 'fpna_budget');
      break;
    case '成本毛利分析':
      add('cost_pricing', 'controller_books');
      break;
    case '回款与账期判断':
      add('treasury_cash', 'audit_control');
      break;
    case '合同财务条款审查':
      add('treasury_cash', 'controller_books', 'audit_control');
      break;
    case '融资/借款判断':
      add('treasury_cash', 'investment_review', 'audit_control');
      break;
    case '采购付款判断':
      add('fpna_budget', 'treasury_cash', 'audit_control');
      break;
    case '招聘/组织成本判断':
      add('fpna_budget', 'treasury_cash', 'investment_review');
      break;
    case '经营复盘':
      add('fpna_budget', 'controller_books', 'cost_pricing');
      break;
    case '异常风险审计':
      add('audit_control', 'controller_books', 'treasury_cash');
      break;
    default:
      add('fpna_budget', 'treasury_cash', 'audit_control');
  }

  if (hasAny(text, ['合同', '股权', '签字', '正式报价', '预付款', '付款'])) selected.add('audit_control');
  if (hasAny(text, ['报价', '成本', '毛利'])) selected.add('cost_pricing');
  if (hasAny(text, ['现金', '回款', '付款', '账期'])) selected.add('treasury_cash');
  return [...selected];
}

function requiredFinanceEvidence(type: HubuFinanceQuestionType): string[] {
  switch (type) {
    case '报价审查':
      return ['成本表', '目标毛利率', '付款条件', '报价有效期'];
    case '投资评审':
      return ['投入预算', '现金消耗测算', 'ROI 假设', '最坏情况', '止损点'];
    case '预算审批':
      return ['预算归属', '负责人', '预算上限', '现金影响'];
    case '现金流判断':
      return ['现金余额', '13 周现金流预测', '回款计划', '付款计划'];
    case '成本毛利分析':
      return ['成本明细', '目标毛利率', '费用归属', '核算口径'];
    case '回款与账期判断':
      return ['客户付款条件', '账期', '回款责任人', '逾期风险'];
    case '合同财务条款审查':
      return ['付款条款', '收入确认依据', '违约金条款', '发票/税务口径'];
    case '融资/借款判断':
      return ['资金用途', '还款来源', '资金成本', '偿债风险'];
    case '采购付款判断':
      return ['采购预算', '合同/订单依据', '付款审批权限', '供应商信用'];
    case '招聘/组织成本判断':
      return ['薪酬预算', '回本逻辑', '试用期止损条件', '现金影响'];
    case '经营复盘':
      return ['预算 vs 实际', '管理报表', '现金复盘', '毛利桥'];
    case '异常风险审计':
      return ['审批记录', '付款凭证', '异常金额说明', '责任人'];
    default:
      return ['财务依据', '现金影响', '负责人', '审批依据'];
  }
}

function inferMissingEvidence(text: string, required: string[]): string[] {
  return required.filter((item) => !text.includes(item));
}

function buildHubuLoopText(params: {
  confirmedEdict: UnifiedDraftEdict;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: HubuDepartmentWorkOrder;
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
  ]
    .filter(Boolean)
    .join('\n');
}

function collectHubuLoopEvidence(params: {
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: HubuDepartmentWorkOrder;
  sourceLabel: SourceLabel;
}): HubuFinanceEvidence[] {
  const { intelligencePack, departmentWorkOrder, sourceLabel } = params;
  const evidence: HubuFinanceEvidence[] = [];
  if (intelligencePack) {
    for (const fact of intelligencePack.facts) {
      evidence.push(makeTypedEvidence(`锦衣卫事实：${fact}`, 'TOOL_RESULT', intelligencePack.sourceLabel));
    }
    for (const basis of intelligencePack.evidenceBasis) {
      evidence.push(makeTypedEvidence(`锦衣卫证据：${basis}`, 'TOOL_RESULT', intelligencePack.sourceLabel));
    }
  }
  if (departmentWorkOrder?.focusQuestion) {
    evidence.push(makeTypedEvidence(`军机处户部工单：${departmentWorkOrder.focusQuestion}`, 'USER_INPUT', departmentWorkOrder.sourceLabel ?? sourceLabel));
  }
  return evidence;
}

function buildSubOfficeOpinion(params: {
  officeId: HubuSubOfficeId;
  type: HubuFinanceQuestionType;
  text: string;
  missingEvidence: string[];
  sourceLabel: SourceLabel;
}): HubuSubOfficeOpinion {
  const { officeId, type, text, missingEvidence, sourceLabel } = params;
  const evidenceUsed = [makeEvidence('用户原始问题', sourceLabel)];
  const assumptions: string[] = [];
  const risks: string[] = [];
  const keyNumbers: HubuFinanceMetric[] = [];
  let finding = `${SUB_OFFICE_NAMES[officeId]}要求保留证据链后再形成确定财务结论。`;

  if (officeId === 'cost_pricing') {
    const gaps = missingEvidence.filter((item) => ['成本表', '目标毛利率', '付款条件', '报价有效期', '成本明细'].includes(item));
    keyNumbers.push(missingMetric('目标毛利率', '没有目标毛利率，无法判断报价底线。'));
    finding = gaps.length
      ? '缺少成本、目标毛利或报价有效期，不能发正式报价。'
      : '成本和报价边界已有基础，可进入报价复核。';
    risks.push(...(gaps.length ? ['毛利失真', '报价底线不清'] : []));
    return { officeId, officeName: SUB_OFFICE_NAMES[officeId], position: gaps.length ? '补证' : '复核', finding, evidenceUsed, missingEvidence: gaps, assumptions, risks, keyNumbers };
  }

  if (officeId === 'treasury_cash') {
    const gaps = missingEvidence.filter((item) => /现金|回款|付款|账期|资金|付款条件/.test(item));
    keyNumbers.push(missingMetric('三个月现金影响', '没有现金影响表，无法判断现金能不能扛住。'));
    finding = gaps.length ? '现金影响、回款或付款节奏未锁定。' : '现金与付款节奏已有基础，但仍需归档。';
    risks.push(...(gaps.length ? ['现金流压力不可见', '回款不确定'] : []));
    return { officeId, officeName: SUB_OFFICE_NAMES[officeId], position: gaps.length ? '补证' : '复核', finding, evidenceUsed, missingEvidence: gaps, assumptions, risks, keyNumbers };
  }

  if (officeId === 'investment_review') {
    const gaps = missingEvidence.filter((item) => /投入|ROI|最坏|止损|回收|现金消耗/.test(item));
    keyNumbers.push(assumptionMetric('ROI / 回收期', 'ROI 当前只能作为假设，不能作为事实。'));
    assumptions.push('收益、转化率、回款周期需要以真实材料复核。');
    finding = gaps.length ? '投资案缺少 ROI 假设、最坏情况或止损点。' : '投资评审材料较完整，可进入情景复核。';
    risks.push(...(gaps.length ? ['收益被高估', '止损点缺失'] : []));
    return { officeId, officeName: SUB_OFFICE_NAMES[officeId], position: gaps.length ? '补证' : '复核', finding, evidenceUsed, missingEvidence: gaps, assumptions, risks, keyNumbers };
  }

  if (officeId === 'fpna_budget') {
    const gaps = missingEvidence.filter((item) => /预算|负责人|现金影响|预测|实际/.test(item));
    keyNumbers.push(missingMetric('预算占用', '没有预算归属，无法判断是否挤占其他优先事项。'));
    finding = gaps.length ? '预算归属、负责人或滚动预测不完整。' : '预算视角可进入复核。';
    risks.push(...(gaps.length ? ['预算挤占不可见', '责任归属不清'] : []));
    return { officeId, officeName: SUB_OFFICE_NAMES[officeId], position: gaps.length ? '补证' : '复核', finding, evidenceUsed, missingEvidence: gaps, assumptions, risks, keyNumbers };
  }

  if (officeId === 'controller_books') {
    const gaps = missingEvidence.filter((item) => /收入确认|核算|费用|账务|报表|发票/.test(item));
    keyNumbers.push(missingMetric('核算口径', '收入、成本和费用归属必须有账务或文件依据。'));
    finding = gaps.length ? '核算、收入确认或费用归属依据不足。' : '核算依据可支持进入复核。';
    risks.push(...(gaps.length ? ['账实不一致', '利润口径失真'] : []));
    return { officeId, officeName: SUB_OFFICE_NAMES[officeId], position: gaps.length ? '补证' : '复核', finding, evidenceUsed, missingEvidence: gaps, assumptions, risks, keyNumbers };
  }

  if (officeId === 'audit_control') {
    const highRisk = hasAny(text, ['正式报价', '合同', '股权', '付款', '预付款', '采购', '签字', '违约金']);
    const gaps = missingEvidence.filter((item) => /审批|权限|合同|付款|负责人|记录|凭证/.test(item));
    finding = highRisk ? '命中财务红线，需保留审批和人工确认记录。' : '未命中硬红线，但仍需可审计依据。';
    risks.push(...(highRisk ? ['财务红线', '审批责任风险'] : []), ...(gaps.length ? ['内控证据不足'] : []));
    return { officeId, officeName: SUB_OFFICE_NAMES[officeId], position: highRisk ? '复核' : gaps.length ? '补证' : '准奏', finding, evidenceUsed, missingEvidence: gaps, assumptions, risks, keyNumbers };
  }

  return { officeId, officeName: SUB_OFFICE_NAMES[officeId], position: '复核', finding, evidenceUsed, missingEvidence: [], assumptions, risks, keyNumbers };
}

function synthesizePosition(subOpinions: HubuSubOfficeOpinion[], sourceLabel: SourceLabel): HubuCFOPosition {
  if (sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO') return '补证';
  if (subOpinions.some((item) => item.position === '驳回')) return '驳回';
  if (subOpinions.some((item) => item.missingEvidence.length > 0)) return '补证';
  if (subOpinions.some((item) => item.risks.includes('财务红线'))) return '复核';
  return '准奏';
}

function buildNextAction(type: HubuFinanceQuestionType, missingEvidence: string[], position: HubuCFOPosition): string {
  if (position === '复核') return '先完成财务红线复核和人工确认';
  if (missingEvidence.length > 0) return `先补齐${missingEvidence.slice(0, 4).join('、')}`;
  if (type === '报价审查') return '进入报价复核并限定报价有效期';
  if (type === '投资评审') return '进入 ROI 情景复核并设定止损点';
  return '进入军机处合奏';
}

export function runHubuCFOOfficeReview(params: {
  text: string;
  sourceLabel?: SourceLabel;
  extraEvidenceUsed?: HubuFinanceEvidence[];
  extraMissingEvidence?: string[];
}): HubuCFOOpinion {
  const sourceLabel = params.sourceLabel ?? 'MIXED';
  const text = params.text.trim();
  const financeQuestionType = classifyHubuFinanceQuestion(text);
  const requiredSubOffices = selectHubuSubOffices(financeQuestionType, text);
  const requiredEvidence = requiredFinanceEvidence(financeQuestionType);
  const missingEvidence = unique([
    ...inferMissingEvidence(text, requiredEvidence),
    ...(params.extraMissingEvidence ?? []),
  ]);
  const subOfficeOpinions = requiredSubOffices.map((officeId) => buildSubOfficeOpinion({
    officeId,
    type: financeQuestionType,
    text,
    missingEvidence,
    sourceLabel,
  }));
  const cfoPosition = synthesizePosition(subOfficeOpinions, sourceLabel);
  const riskRegister = unique(subOfficeOpinions.flatMap((item) => item.risks));
  const assumptions = unique(subOfficeOpinions.flatMap((item) => item.assumptions));
  const keyNumbers = subOfficeOpinions.flatMap((item) => item.keyNumbers);
  const recommendedNextAction = buildNextAction(financeQuestionType, missingEvidence, cfoPosition);
  const confidence: HubuCFOOpinion['confidence'] = sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM'
    ? (missingEvidence.length ? '中' : '高')
    : missingEvidence.length > 2 ? '低' : '中';
  const humanConfirmationRequired = hasAny(text, ['合同', '股权', '重大付款', '预付款', '正式报价', '签字']);

  return {
    department: '户部',
    cfoPosition,
    confidence,
    executiveSummary: cfoPosition === '准奏'
      ? '户部认为财务边界基本成立，可进入下一步，但必须保留证据链。'
      : cfoPosition === '复核'
        ? '户部不建议直接放行，需先完成财务红线复核和人工确认。'
        : '户部当前建议补证：关键数字、现金影响或审批依据仍不足。',
    financeQuestionType,
    requiredSubOffices,
    keyNumbers,
    subOfficeOpinions,
    evidenceUsed: unique([...(params.extraEvidenceUsed ?? []), makeEvidence('用户原始问题', sourceLabel)]),
    missingEvidence,
    assumptions,
    riskRegister,
    recommendedNextAction,
    questionsForEmperor: missingEvidence[0] ? [`是否先补充「${missingEvidence[0]}」再进入正式裁决？`] : [],
    humanConfirmationRequired,
    sourceLabel,
  };
}

export function runHubuCFOOfficeLoopV1(params: HubuCFOOfficeLoopInput): HubuCFOOfficeLoopResult {
  const labels: SourceLabel[] = [
    params.sourceLabel ?? params.confirmedEdict.sourceLabel,
    params.confirmedEdict.sourceLabel,
  ];
  if (params.intelligencePack) labels.push(params.intelligencePack.sourceLabel);
  if (params.departmentWorkOrder?.sourceLabel) labels.push(params.departmentWorkOrder.sourceLabel);
  const sourceLabel = mergeSourceLabels(labels);
  const text = buildHubuLoopText(params);
  const extraEvidenceUsed = collectHubuLoopEvidence({
    intelligencePack: params.intelligencePack,
    departmentWorkOrder: params.departmentWorkOrder,
    sourceLabel,
  });
  const extraMissingEvidence = unique([
    ...(params.confirmedEdict.unknownGaps ?? []),
    ...(params.intelligencePack?.missingEvidence ?? []),
  ]);
  const opinion = runHubuCFOOfficeReview({
    text,
    sourceLabel,
    extraEvidenceUsed,
    extraMissingEvidence,
  });
  return {
    loopId: 'hubu_cfo_office_loop_v1',
    opinion,
    qualityGate: evaluateHubuQualityGate(opinion),
  };
}

export function evaluateHubuQualityGate(opinion: HubuCFOOpinion): HubuQualityGateResult {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (!opinion.sourceLabel) blockingIssues.push('source_label_required');
  if ((opinion.sourceLabel === 'FALLBACK' || opinion.sourceLabel === 'DEMO') && opinion.cfoPosition === '准奏') {
    blockingIssues.push('no_fallback_or_demo_financial_approval');
  }
  if (opinion.missingEvidence.length > 0 && opinion.cfoPosition === '准奏') {
    blockingIssues.push('no_financial_certainty_without_numbers');
  }
  if (['报价审查', '投资评审', '预算审批', '采购付款判断', '招聘/组织成本判断', '合同财务条款审查'].includes(opinion.financeQuestionType)) {
    const cashVisible = opinion.keyNumbers.some((item) => item.metric.includes('现金')) || opinion.missingEvidence.some((item) => item.includes('现金') || item.includes('付款') || item.includes('回款'));
    if (!cashVisible) warnings.push('cash_risk_must_be_visible');
  }
  if (opinion.financeQuestionType === '报价审查') {
    for (const required of ['成本表', '目标毛利率', '付款条件', '报价有效期']) {
      if (opinion.missingEvidence.includes(required)) warnings.push(`formal_quote_requires_${required}`);
    }
  }
  if (opinion.financeQuestionType === '投资评审') {
    for (const required of ['ROI 假设', '最坏情况', '止损点']) {
      if (opinion.missingEvidence.includes(required)) warnings.push(`investment_requires_${required}`);
    }
  }

  const signal = blockingIssues.length > 0 || opinion.cfoPosition === '复核'
    ? 'RED'
    : opinion.cfoPosition === '补证'
      ? 'YELLOW'
      : opinion.sourceLabel === 'FALLBACK' || opinion.sourceLabel === 'DEMO'
        ? 'GRAY'
        : 'GREEN';
  const verdict = signal === 'RED' ? 'RECHECK' : signal === 'GREEN' ? 'APPROVE' : 'NEED_EVIDENCE';

  return {
    passed: blockingIssues.length === 0 && signal !== 'RED',
    signal,
    verdict,
    blockingIssues,
    warnings,
  };
}

export function buildHubuDepartmentOpinion(params: {
  draftEdict: UnifiedDraftEdict;
  sourceLabel: SourceLabel;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: HubuDepartmentWorkOrder;
}): DepartmentOpinion {
  const result = runHubuCFOOfficeLoopV1({
    confirmedEdict: params.draftEdict,
    intelligencePack: params.intelligencePack,
    departmentWorkOrder: params.departmentWorkOrder,
    sourceLabel: params.sourceLabel,
  });
  const cfoOpinion = result.opinion;
  const gate = result.qualityGate;
  return {
    departmentId: 'finance',
    signal: gate.signal,
    verdict: gate.verdict,
    summary: `户部 CFO Office：${cfoOpinion.cfoPosition}。${cfoOpinion.executiveSummary}`,
    evidence: cfoOpinion.evidenceUsed.map((item) => item.title),
    missingEvidence: cfoOpinion.missingEvidence,
    risks: unique([...cfoOpinion.riskRegister, ...gate.blockingIssues, ...gate.warnings]),
    nextAction: cfoOpinion.recommendedNextAction,
    needsHumanConfirmation: cfoOpinion.humanConfirmationRequired || gate.signal === 'RED',
    sourceLabel: cfoOpinion.sourceLabel,
    cfoOpinion,
  };
}

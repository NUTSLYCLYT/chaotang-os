import type { SourceLabel } from '../types';
import { mergeSourceLabels } from '../source-label.ts';
import type { DepartmentOpinion, IntelligencePack, UnifiedDraftEdict } from '../unified/unified-types.ts';
import type {
  XingbuCLOCCOOfficeLoopInput,
  XingbuCLOCCOOfficeLoopResult,
  XingbuCLOCCOOpinion,
  XingbuConfidence,
  XingbuCrossDepartmentReview,
  XingbuDepartmentWorkOrder,
  XingbuGeneratedArtifact,
  XingbuLegalEvidence,
  XingbuLegalRiskQuestionType,
  XingbuPosition,
  XingbuQualityGateResult,
  XingbuSubOfficeId,
  XingbuSubOfficeOpinion,
} from './xingbu-types.ts';

const SUB_OFFICE_NAMES: Record<XingbuSubOfficeId, string> = {
  clo_cco_chief: '刑部尚书',
  contract_office: '契约司',
  corporate_governance: '公司司',
  compliance: '合规司',
  dispute_litigation: '争讼司',
  employment_law: '劳法司',
  ip_confidentiality: '知产司',
  legal_operations: '法运司',
};

const CORE_FORBIDDEN_ACTIONS = [
  '自动签约',
  '自动盖章',
  '自动发送合同',
  '自动发送正式报价',
  '自动对外承诺',
  '自动解除劳动关系',
  '自动发送律师函',
  '自动起诉或申请仲裁',
];

function hasAny(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items.filter(Boolean))];
}

function makeEvidence(title: string, sourceLabel: SourceLabel): XingbuLegalEvidence {
  return {
    title,
    sourceType: sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO' ? 'FALLBACK' : 'USER_INPUT',
    usable: sourceLabel !== 'DEMO',
    confidence: sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM' ? '高' : '中',
  };
}

function makeTypedEvidence(
  title: string,
  sourceType: XingbuLegalEvidence['sourceType'],
  sourceLabel: SourceLabel,
  sourceRef?: string,
): XingbuLegalEvidence {
  return {
    title,
    sourceType,
    sourceRef,
    usable: sourceType !== 'FALLBACK' && sourceLabel !== 'DEMO',
    confidence: sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM' ? '高' : '中',
  };
}

export function classifyXingbuLegalRiskQuestion(text: string): XingbuLegalRiskQuestionType {
  if (hasAny(text, ['AI agent', 'AI Agent', '蜂群', '自动生成', '客户邮件', '对外材料'])) return 'AI_AGENT_EXTERNAL_OUTPUT';
  if (hasAny(text, ['正式报价', '对外承诺', '客户确认函', '承诺收益', '保证收益', '保底收益'])) return 'FORMAL_QUOTE_OR_EXTERNAL_COMMITMENT';
  if (hasAny(text, ['股权', '分红', '对赌', '投融资', '董事会', '章程', '股东', '合伙人退出', '控制权'])) return 'CORPORATE_GOVERNANCE';
  if (hasAny(text, ['律师函', '诉讼', '仲裁', '争议', '索赔', '催收', '拖欠付款', '证据保全'])) return 'DISPUTE_LITIGATION';
  if (hasAny(text, ['劳动合同', '辞退', '解除', '降薪', '调岗', '员工处分', '员工纠纷', '竞业', '劳动仲裁', '提成'])) return 'EMPLOYMENT_LAW';
  if (hasAny(text, ['商标', '版权', '著作权', '专利', '商业秘密', 'NDA', '保密', '知识产权'])) return 'IP_CONFIDENTIALITY';
  if (hasAny(text, ['印章', '盖章', '签字', '签署权限', '授权代表', '审批流', '外部律师', '法务复核'])) return 'LEGAL_OPERATIONS';
  if (hasAny(text, ['付款', '预付款', '退款', '保证金', '违约金', '担保'])) return 'PAYMENT_OR_PENALTY';
  if (hasAny(text, ['合规', '监管', '行业许可', '牌照', '反商业贿赂', '制度', '红线', '政府沟通'])) return 'COMPLIANCE_REVIEW';
  if (hasAny(text, ['合同', '合作协议', '独家', '客户确认', '签约', '签合同', 'NDA'])) return 'CONTRACT_REVIEW';
  return 'OTHER_LEGAL_RISK';
}

export function selectXingbuSubOffices(type: XingbuLegalRiskQuestionType, text: string): XingbuSubOfficeId[] {
  const selected = new Set<XingbuSubOfficeId>(['clo_cco_chief']);
  const add = (...ids: XingbuSubOfficeId[]) => ids.forEach((id) => selected.add(id));

  switch (type) {
    case 'CONTRACT_REVIEW':
      add('contract_office', 'legal_operations');
      break;
    case 'FORMAL_QUOTE_OR_EXTERNAL_COMMITMENT':
      add('contract_office', 'compliance', 'legal_operations');
      break;
    case 'CORPORATE_GOVERNANCE':
      add('corporate_governance', 'legal_operations');
      break;
    case 'COMPLIANCE_REVIEW':
      add('compliance');
      break;
    case 'DISPUTE_LITIGATION':
      add('dispute_litigation', 'legal_operations');
      break;
    case 'EMPLOYMENT_LAW':
      add('employment_law', 'legal_operations');
      break;
    case 'IP_CONFIDENTIALITY':
      add('ip_confidentiality', 'legal_operations');
      break;
    case 'LEGAL_OPERATIONS':
      add('legal_operations');
      break;
    case 'PAYMENT_OR_PENALTY':
      add('contract_office', 'legal_operations');
      break;
    case 'AI_AGENT_EXTERNAL_OUTPUT':
      add('compliance', 'contract_office', 'legal_operations');
      break;
    default:
      add('contract_office', 'legal_operations');
  }

  if (hasAny(text, ['股权', '分红', '对赌', '投融资', '合伙人退出'])) selected.add('corporate_governance');
  if (hasAny(text, ['辞退', '劳动', '降薪', '调岗', '竞业', '提成'])) selected.add('employment_law');
  if (hasAny(text, ['律师函', '诉讼', '仲裁', '索赔', '催收'])) selected.add('dispute_litigation');
  if (hasAny(text, ['商标', '版权', '专利', 'NDA', '保密', '商业秘密'])) selected.add('ip_confidentiality');
  if (hasAny(text, ['合规', '监管', '牌照', '保证收益', '保底收益'])) selected.add('compliance');
  if (hasAny(text, ['签字', '盖章', '印章', '授权', '审批'])) selected.add('legal_operations');
  return [...selected];
}

function requiredLegalEvidence(type: XingbuLegalRiskQuestionType, text: string): string[] {
  const base = ['适用地区/司法辖区', '交易主体信息', '证据材料'];
  if (type === 'CONTRACT_REVIEW') return [...base, '合同正文或材料原文', '授权记录'];
  if (type === 'FORMAL_QUOTE_OR_EXTERNAL_COMMITMENT') return [...base, '报价依据', '报价有效期', '授权记录', '承诺边界'];
  if (type === 'CORPORATE_GOVERNANCE') return [...base, '章程', '股权表', '董事会/股东会决议', '投资条款'];
  if (type === 'COMPLIANCE_REVIEW') return [...base, '适用行业监管口径', '政策/许可材料', '红线依据'];
  if (type === 'DISPUTE_LITIGATION') return [...base, '合同/订单', '付款记录', '沟通记录', '证据保全清单'];
  if (type === 'EMPLOYMENT_LAW') return [...base, '劳动合同', '绩效记录', '制度依据', '书面沟通记录'];
  if (type === 'IP_CONFIDENTIALITY') return [...base, '权属证据', 'NDA/保密范围', '创作或转让记录'];
  if (type === 'LEGAL_OPERATIONS') return [...base, '授权矩阵', '审批记录', '印章/签署规则'];
  if (type === 'PAYMENT_OR_PENALTY') return [...base, '合同/订单依据', '付款审批权限', '付款/违约金条款'];
  if (type === 'AI_AGENT_EXTERNAL_OUTPUT') return [...base, '输出内容样本', '人工复核记录', '权限边界'];
  if (hasAny(text, ['独家'])) return [...base, '独家范围', '期限', '违约责任', '退出机制', '授权记录'];
  return base;
}

function inferMissingEvidence(text: string, required: string[]): string[] {
  return required.filter((item) => !text.includes(item));
}

function inferCrossDepartmentReviews(type: XingbuLegalRiskQuestionType, text: string): XingbuCrossDepartmentReview[] {
  const reviews: XingbuCrossDepartmentReview[] = [];
  if (type === 'FORMAL_QUOTE_OR_EXTERNAL_COMMITMENT' || hasAny(text, ['正式报价', '客户确认函', '承诺收益', '保证收益', '保底收益'])) {
    reviews.push('finance', 'war');
  }
  if (type === 'PAYMENT_OR_PENALTY' || hasAny(text, ['付款', '预付款', '退款', '保证金', '违约金', '担保'])) reviews.push('finance');
  if (type === 'EMPLOYMENT_LAW' || hasAny(text, ['辞退', '解除', '降薪', '调岗', '劳动仲裁', '提成'])) reviews.push('personnel');
  if (type === 'AI_AGENT_EXTERNAL_OUTPUT') reviews.push('jinyiwei', 'ritual');
  if (type === 'CORPORATE_GOVERNANCE' || hasAny(text, ['股权', '分红', '对赌', '投融资'])) reviews.push('finance');
  if (hasAny(text, ['客户', '销售', '独家', '报价'])) reviews.push('war');
  if (hasAny(text, ['交期', '交付', '技术能力'])) reviews.push('works');
  return unique(reviews);
}

function generatedArtifactTypes(type: XingbuLegalRiskQuestionType): string[] {
  if (type === 'CONTRACT_REVIEW') return ['合同风险清单', '合同条款审查意见', '签署权限检查清单', '合同补证清单'];
  if (type === 'FORMAL_QUOTE_OR_EXTERNAL_COMMITMENT') return ['正式报价法律风险提示', '对外承诺风险清单', '客户沟通限制话术'];
  if (type === 'CORPORATE_GOVERNANCE') return ['股权条款风险清单', '股东/合伙人决策事项清单'];
  if (type === 'PAYMENT_OR_PENALTY') return ['付款/违约金/保证金风险清单', '法务复核单'];
  if (type === 'EMPLOYMENT_LAW') return ['劳动风险证据清单', 'PIP / 辞退前法律风险清单'];
  if (type === 'DISPUTE_LITIGATION') return ['律师函/争议事项材料清单', '诉讼/仲裁证据保全清单'];
  if (type === 'IP_CONFIDENTIALITY') return ['NDA / 保密协议审查清单', '知识产权归属检查清单'];
  if (type === 'LEGAL_OPERATIONS') return ['印章/签署授权审批单', '外部律师委托事项清单'];
  return ['法务复核单', '高风险人工确认弹窗文案'];
}

function inferForbiddenActions(type: XingbuLegalRiskQuestionType, text: string): string[] {
  const actions = [...CORE_FORBIDDEN_ACTIONS];
  if (type === 'CORPORATE_GOVERNANCE') actions.push('自动接受股权、分红、对赌或合伙人退出条款');
  if (type === 'IP_CONFIDENTIALITY') actions.push('自动提交知识产权注册', '自动披露商业秘密');
  if (hasAny(text, ['付款', '预付款', '退款'])) actions.push('自动付款/退款/收取保证金');
  return unique(actions);
}

function buildXingbuLoopText(params: {
  confirmedEdict: UnifiedDraftEdict;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: XingbuDepartmentWorkOrder;
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

function collectXingbuLoopEvidence(params: {
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: XingbuDepartmentWorkOrder;
  sourceLabel: SourceLabel;
}): XingbuLegalEvidence[] {
  const { intelligencePack, departmentWorkOrder, sourceLabel } = params;
  const evidence: XingbuLegalEvidence[] = [];
  if (intelligencePack) {
    for (const fact of intelligencePack.facts) evidence.push(makeTypedEvidence(`锦衣卫事实：${fact}`, 'TOOL_RESULT', intelligencePack.sourceLabel));
    for (const basis of intelligencePack.evidenceBasis) evidence.push(makeTypedEvidence(`锦衣卫证据：${basis}`, 'TOOL_RESULT', intelligencePack.sourceLabel));
  }
  if (departmentWorkOrder?.focusQuestion) {
    evidence.push(makeTypedEvidence(`军机处刑部工单：${departmentWorkOrder.focusQuestion}`, 'USER_INPUT', departmentWorkOrder.sourceLabel ?? sourceLabel));
  }
  return evidence;
}

function buildSubOfficeOpinion(params: {
  officeId: XingbuSubOfficeId;
  type: XingbuLegalRiskQuestionType;
  text: string;
  missingEvidence: string[];
  jurisdictionOrScopeGap: boolean;
  crossDepartmentReviews: XingbuCrossDepartmentReview[];
  forbiddenActions: string[];
  sourceLabel: SourceLabel;
}): XingbuSubOfficeOpinion {
  const { officeId, type, text, missingEvidence, jurisdictionOrScopeGap, crossDepartmentReviews, forbiddenActions, sourceLabel } = params;
  const evidenceUsed = [makeEvidence('用户原始问题', sourceLabel)];
  const officeMissingEvidence: string[] = [];
  const risks: string[] = [];
  const assumptions: string[] = [];
  const officeCrossReviews: XingbuCrossDepartmentReview[] = [];
  let finding = `${SUB_OFFICE_NAMES[officeId]}要求保留证据链，不得自动执行不可逆法律动作。`;
  let position: XingbuPosition = missingEvidence.length ? '补证' : '复核';
  let nextBestAction = '先补齐法务证据并进入人工复核';

  if (officeId === 'contract_office') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /合同|报价|承诺|授权|独家|违约|主体/.test(item)));
    officeCrossReviews.push(...crossDepartmentReviews.filter((item) => item === 'finance' || item === 'war'));
    finding = officeMissingEvidence.length ? '缺少合同/报价/授权/承诺边界材料，不能签署或外发。' : '合同与承诺边界可进入条款复核。';
    risks.push('对外承诺风险', ...(officeMissingEvidence.length ? ['合同来源不足'] : []));
    nextBestAction = '先补合同正文、授权记录和承诺边界';
  }

  if (officeId === 'corporate_governance') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /章程|股权|董事会|股东会|投资|主体/.test(item)));
    officeCrossReviews.push(...crossDepartmentReviews.filter((item) => item === 'finance'));
    finding = '股权、分红、对赌或退出事项属于不可逆治理风险，必须复核。';
    risks.push('公司治理风险', '控制权/退出风险');
    nextBestAction = '先补章程、股权表、决议和投资条款';
  }

  if (officeId === 'compliance') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /适用地区|监管|政策|许可|红线|行业/.test(item)));
    finding = officeMissingEvidence.length ? '适用地区、行业监管或政策依据不足，不得给确定合规结论。' : '合规范围已有基础，可进入红线复核。';
    risks.push(...(officeMissingEvidence.length ? ['监管口径不明'] : []));
    nextBestAction = '先确认适用地区、行业和监管口径';
  }

  if (officeId === 'dispute_litigation') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /合同|付款|沟通|证据保全|订单/.test(item)));
    finding = '争议事项必须先做证据保全，不能自动发送律师函或起诉。';
    risks.push('争议升级风险', '证据保全不足');
    nextBestAction = '先建立证据保全清单并决定是否外部律师复核';
  }

  if (officeId === 'employment_law') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /劳动|绩效|制度|书面|沟通|员工/.test(item)));
    officeCrossReviews.push('personnel');
    finding = '劳动动作不可逆，必须联动吏部并保留劳动证据链。';
    risks.push('劳动仲裁风险', '员工敏感信息风险');
    nextBestAction = '先补劳动合同、绩效记录、制度依据和书面沟通';
  }

  if (officeId === 'ip_confidentiality') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /权属|NDA|保密|创作|转让|商业秘密/.test(item)));
    finding = '知识产权和保密事项不能在权属不清时确认归属或披露。';
    risks.push('知识产权归属风险', '商业秘密泄露风险');
    nextBestAction = '先补权属证据、NDA/保密范围和授权材料';
  }

  if (officeId === 'legal_operations') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /授权|审批|印章|签署|主体|矩阵/.test(item)));
    finding = '签字、盖章、审批和外部律师协同必须有授权矩阵和审批记录。';
    risks.push('签署权限风险', '法务运营不可审计');
    nextBestAction = '先补审批记录、授权矩阵和签署/印章规则';
  }

  if (officeId === 'clo_cco_chief') {
    officeMissingEvidence.push(...missingEvidence);
    officeCrossReviews.push(...crossDepartmentReviews);
    finding = jurisdictionOrScopeGap
      ? '刑部尚书判断：缺适用地区、主体或证据范围，不能形成确定法律结论。'
      : '刑部尚书判断：可形成法务复核意见，但仍需人工确认后执行。';
    risks.push(...(jurisdictionOrScopeGap ? ['法律适用范围不明'] : []), '不可逆动作风险');
    nextBestAction = jurisdictionOrScopeGap ? '先补适用地区、主体信息和材料原文' : '进入人工确认和军机处合奏';
  }

  if (jurisdictionOrScopeGap) assumptions.push('缺少适用地区、主体信息或材料原文时，刑部只输出风险判断和补证清单。');
  const requiresHumanConfirmation = type !== 'OTHER_LEGAL_RISK' || jurisdictionOrScopeGap || crossDepartmentReviews.length > 0;
  if (requiresHumanConfirmation && position !== '补证') position = '复核';
  if (officeMissingEvidence.length > 0) position = '补证';

  return {
    officeId,
    officeName: SUB_OFFICE_NAMES[officeId],
    position,
    finding,
    evidenceUsed,
    missingEvidence: unique(officeMissingEvidence),
    jurisdictionOrScopeGap,
    assumptions,
    risks: unique(risks),
    forbiddenActions,
    requiresCrossReview: unique(officeCrossReviews),
    requiresHumanConfirmation,
    nextBestAction,
    sourceLabel,
    source_label: sourceLabel,
  };
}

function synthesizePosition(subOpinions: XingbuSubOfficeOpinion[], sourceLabel: SourceLabel): XingbuPosition {
  if (sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO') return '补证';
  if (subOpinions.some((item) => item.risks.includes('公司治理风险') || item.risks.includes('争议升级风险'))) return '复核';
  if (subOpinions.some((item) => item.missingEvidence.length > 0)) return '补证';
  return '复核';
}

function buildNextAction(position: XingbuPosition, missingEvidence: string[], crossReviews: XingbuCrossDepartmentReview[]): string {
  if (missingEvidence.length > 0) return `先补齐${missingEvidence.slice(0, 4).join('、')}`;
  if (crossReviews.length > 0) return `先完成${crossReviews.slice(0, 3).join('、')}跨部门复核和人工确认`;
  if (position === '复核') return '先完成刑部人工确认和军机处合奏';
  return '进入军机处合奏';
}

function buildGeneratedArtifacts(params: {
  type: XingbuLegalRiskQuestionType;
  sourceLabel: SourceLabel;
  forbiddenActions: string[];
  humanConfirmationRequired: boolean;
  crossDepartmentReviews: XingbuCrossDepartmentReview[];
}): XingbuGeneratedArtifact[] {
  const status: XingbuGeneratedArtifact['status'] = params.humanConfirmationRequired
    ? 'needs_human_review'
    : params.crossDepartmentReviews.length > 0
      ? 'needs_cross_review'
      : 'draft';
  return generatedArtifactTypes(params.type).map((type) => ({
    type,
    title: `${type}（刑部草稿）`,
    status,
    content: '仅供军机处合奏和人工复核使用，不得作为自动签署、盖章、外发或起诉依据。',
    forbiddenActions: params.forbiddenActions,
    requiresHumanConfirmation: params.humanConfirmationRequired,
    requiresCrossReview: params.crossDepartmentReviews,
    sourceLabel: params.sourceLabel,
  }));
}

export function runXingbuCLOCCOOfficeReview(params: {
  text: string;
  sourceLabel?: SourceLabel;
  extraEvidenceUsed?: XingbuLegalEvidence[];
  extraMissingEvidence?: string[];
}): XingbuCLOCCOOpinion {
  const sourceLabel = params.sourceLabel ?? 'MIXED';
  const text = params.text.trim();
  const legalRiskQuestionType = classifyXingbuLegalRiskQuestion(text);
  const requiredSubOffices = selectXingbuSubOffices(legalRiskQuestionType, text);
  const missingEvidence = unique([
    ...inferMissingEvidence(text, requiredLegalEvidence(legalRiskQuestionType, text)),
    ...(params.extraMissingEvidence ?? []),
  ]);
  const jurisdictionOrScopeGap = missingEvidence.some((item) => /适用地区|司法辖区|交易主体|主体信息|合同正文|材料原文|证据材料/.test(item));
  const crossDepartmentReviews = inferCrossDepartmentReviews(legalRiskQuestionType, text);
  const forbiddenActions = inferForbiddenActions(legalRiskQuestionType, text);
  const subOfficeOpinions = requiredSubOffices.map((officeId) => buildSubOfficeOpinion({
    officeId,
    type: legalRiskQuestionType,
    text,
    missingEvidence,
    jurisdictionOrScopeGap,
    crossDepartmentReviews,
    forbiddenActions,
    sourceLabel,
  }));
  const cloCcoPosition = synthesizePosition(subOfficeOpinions, sourceLabel);
  const riskRegister = unique(subOfficeOpinions.flatMap((item) => item.risks));
  const assumptions = unique(subOfficeOpinions.flatMap((item) => item.assumptions));
  const humanConfirmationRequired = legalRiskQuestionType !== 'OTHER_LEGAL_RISK'
    || crossDepartmentReviews.length > 0
    || jurisdictionOrScopeGap
    || sourceLabel === 'FALLBACK'
    || sourceLabel === 'DEMO';
  const evidenceUsed = unique([...(params.extraEvidenceUsed ?? []), makeEvidence('用户原始问题', sourceLabel)]);
  const generatedArtifacts = buildGeneratedArtifacts({
    type: legalRiskQuestionType,
    sourceLabel,
    forbiddenActions,
    humanConfirmationRequired,
    crossDepartmentReviews,
  });
  const recommendedNextAction = buildNextAction(cloCcoPosition, missingEvidence, crossDepartmentReviews);
  const confidence: XingbuConfidence = sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM'
    ? (missingEvidence.length ? '中' : '高')
    : missingEvidence.length > 2 ? '低' : '中';

  return {
    department: '刑部',
    cloCcoPosition,
    confidence,
    executiveSummary: cloCcoPosition === '补证'
      ? '刑部当前只能输出风险和补证清单，缺少适用地区、主体、材料原文或授权证据。'
      : '刑部认为可进入法务复核，但任何签署、盖章、报价、辞退、律师函或诉讼动作都必须人工确认。',
    legalRiskQuestionType,
    jurisdictionOrScopeGap,
    requiredSubOffices,
    subOfficeOpinions,
    evidenceUsed,
    missingEvidence,
    assumptions,
    riskRegister,
    forbiddenActions,
    crossDepartmentReviews,
    recommendedNextAction,
    generatedArtifactsAvailable: generatedArtifacts.map((item) => item.type),
    generatedArtifacts,
    questionsForEmperor: missingEvidence[0] ? [`是否先补充「${missingEvidence[0]}」再进入刑部复核？`] : [],
    externalCounselRecommended: hasAny(text, ['诉讼', '仲裁', '股权', '对赌', '重大合同', '监管', '律师函']),
    humanConfirmationRequired,
    sourceLabel,
    source_label: sourceLabel,
  };
}

export function runXingbuCLOCCOOfficeLoopV1(params: XingbuCLOCCOOfficeLoopInput): XingbuCLOCCOOfficeLoopResult {
  const labels: SourceLabel[] = [params.sourceLabel ?? params.confirmedEdict.sourceLabel, params.confirmedEdict.sourceLabel];
  if (params.intelligencePack) labels.push(params.intelligencePack.sourceLabel);
  if (params.departmentWorkOrder?.sourceLabel) labels.push(params.departmentWorkOrder.sourceLabel);
  const sourceLabel = mergeSourceLabels(labels);
  const text = buildXingbuLoopText(params);
  const extraEvidenceUsed = collectXingbuLoopEvidence({
    intelligencePack: params.intelligencePack,
    departmentWorkOrder: params.departmentWorkOrder,
    sourceLabel,
  });
  const extraMissingEvidence = unique([
    ...(params.confirmedEdict.unknownGaps ?? []),
    ...(params.intelligencePack?.missingEvidence ?? []),
    ...(params.departmentWorkOrder?.requiredEvidence ?? []),
  ]);
  const opinion = runXingbuCLOCCOOfficeReview({ text, sourceLabel, extraEvidenceUsed, extraMissingEvidence });
  return {
    loopId: 'xingbu_clo_cco_office_loop_v1',
    opinion,
    qualityGate: evaluateXingbuQualityGate(opinion),
  };
}

export function evaluateXingbuQualityGate(opinion: XingbuCLOCCOOpinion): XingbuQualityGateResult {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const gateResults: XingbuQualityGateResult['gateResults'] = [];
  const addGate = (gate: string, status: 'pass' | 'block' | 'warn' | 'n/a', detail: string) => {
    gateResults.push({ gate, status, detail });
    if (status === 'block') blockingIssues.push(gate);
    if (status === 'warn') warnings.push(gate);
  };

  addGate('source_label_required', opinion.sourceLabel && opinion.source_label ? 'pass' : 'block', '刑部输出必须带 sourceLabel/source_label。');
  addGate('evidence_or_gap_required', opinion.evidenceUsed.length > 0 || opinion.missingEvidence.length > 0 ? 'pass' : 'block', '每个结论必须有证据或缺口。');
  addGate('no_legal_certainty_without_jurisdiction_and_evidence', opinion.jurisdictionOrScopeGap && opinion.cloCcoPosition === '准奏' ? 'block' : opinion.jurisdictionOrScopeGap ? 'warn' : 'pass', '缺适用地区、主体或证据时不得确定性准奏。');
  addGate('high_risk_requires_human_confirmation', opinion.humanConfirmationRequired ? 'pass' : opinion.legalRiskQuestionType === 'OTHER_LEGAL_RISK' ? 'n/a' : 'block', '高风险法律事项必须人工确认。');
  addGate('no_contract_signing_without_contract_source', opinion.legalRiskQuestionType === 'CONTRACT_REVIEW' && opinion.missingEvidence.includes('合同正文或材料原文') ? 'warn' : 'pass', '无合同正文不得建议签署。');
  addGate('no_external_commitment_without_authority', opinion.legalRiskQuestionType === 'FORMAL_QUOTE_OR_EXTERNAL_COMMITMENT' && opinion.missingEvidence.includes('授权记录') ? 'warn' : 'pass', '对外承诺必须有授权记录。');
  addGate('equity_or_governance_requires_corporate_review', opinion.legalRiskQuestionType === 'CORPORATE_GOVERNANCE' && !opinion.requiredSubOffices.includes('corporate_governance') ? 'block' : 'pass', '股权治理必须公司司复核。');
  addGate('payment_or_penalty_requires_hubu_review', opinion.crossDepartmentReviews.includes('finance') ? 'pass' : opinion.legalRiskQuestionType === 'PAYMENT_OR_PENALTY' ? 'block' : 'n/a', '付款、违约金、保证金必须户部复核。');
  addGate('labor_action_requires_libu_review', opinion.crossDepartmentReviews.includes('personnel') ? 'pass' : opinion.legalRiskQuestionType === 'EMPLOYMENT_LAW' ? 'block' : 'n/a', '劳动动作必须吏部复核。');
  addGate('dispute_requires_evidence_preservation', opinion.legalRiskQuestionType === 'DISPUTE_LITIGATION' && !opinion.missingEvidence.includes('证据保全清单') ? 'pass' : opinion.legalRiskQuestionType === 'DISPUTE_LITIGATION' ? 'warn' : 'n/a', '争议事项必须列证据保全清单。');
  addGate('ip_or_confidentiality_requires_ip_review', opinion.legalRiskQuestionType === 'IP_CONFIDENTIALITY' && !opinion.requiredSubOffices.includes('ip_confidentiality') ? 'block' : 'pass', '知产保密必须知产司复核。');
  addGate('seal_or_signature_requires_authority_check', opinion.requiredSubOffices.includes('legal_operations') ? 'pass' : opinion.legalRiskQuestionType === 'LEGAL_OPERATIONS' ? 'block' : 'n/a', '签署/印章必须法运司复核。');
  addGate('privacy_sensitive_data_guard', opinion.riskRegister.some((item) => /员工|客户|供应商|商业秘密|争议/.test(item)) ? 'warn' : 'pass', '敏感材料必须记录权限与来源。');
  addGate('no_irreversible_legal_action_without_approval', opinion.forbiddenActions.length > 0 ? 'pass' : 'block', '禁止自动执行不可逆法律动作。');
  addGate('fallback_cannot_be_final_legal_basis', (opinion.sourceLabel === 'FALLBACK' || opinion.sourceLabel === 'DEMO') && opinion.cloCcoPosition === '准奏' ? 'block' : opinion.sourceLabel === 'FALLBACK' || opinion.sourceLabel === 'DEMO' ? 'warn' : 'pass', 'FALLBACK/DEMO 不得作为最终法律依据。');

  const signal = blockingIssues.length > 0 || opinion.cloCcoPosition === '驳回'
    ? 'RED'
    : opinion.cloCcoPosition === '复核' || opinion.humanConfirmationRequired
      ? 'RED'
      : opinion.cloCcoPosition === '补证' || warnings.length > 0
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

export function buildXingbuDepartmentOpinion(params: {
  draftEdict: UnifiedDraftEdict;
  sourceLabel: SourceLabel;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: XingbuDepartmentWorkOrder;
}): DepartmentOpinion {
  const result = runXingbuCLOCCOOfficeLoopV1({
    confirmedEdict: params.draftEdict,
    intelligencePack: params.intelligencePack,
    departmentWorkOrder: params.departmentWorkOrder,
    sourceLabel: params.sourceLabel,
  });
  const xingbuOpinion = result.opinion;
  const gate = result.qualityGate;
  return {
    departmentId: 'justice',
    signal: gate.signal,
    verdict: gate.verdict,
    summary: `刑部 CLO/CCO Office：${xingbuOpinion.cloCcoPosition}。${xingbuOpinion.executiveSummary}`,
    evidence: xingbuOpinion.evidenceUsed.map((item) => item.title),
    missingEvidence: xingbuOpinion.missingEvidence,
    risks: unique([...xingbuOpinion.riskRegister, ...gate.blockingIssues, ...gate.warnings]),
    nextAction: xingbuOpinion.recommendedNextAction,
    needsHumanConfirmation: xingbuOpinion.humanConfirmationRequired || gate.signal === 'RED',
    sourceLabel: xingbuOpinion.sourceLabel,
    xingbuOpinion,
  };
}

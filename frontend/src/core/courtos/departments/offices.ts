import type { SourceLabel } from '../types.ts';
import type { CourtDepartmentRegistryEntry, DepartmentOpinionV1 } from './registry.ts';

export interface DepartmentOfficeProfile {
  id: string;
  department_id: string;
  title: string;
  evidence_inputs: string[];
  risk_model: string[];
  output_schema: 'DepartmentOpinionV1';
}

export interface OfficeReviewInput {
  taskId: string;
  question: string;
  knownFacts: string[];
  sourceLabel: SourceLabel;
  entry: CourtDepartmentRegistryEntry;
}

const OFFICE_PROFILES: Record<string, DepartmentOfficeProfile> = {
  jinyiwei_intelligence_office: {
    id: 'jinyiwei_intelligence_office',
    department_id: 'jinyiwei',
    title: '锦衣卫 Intelligence Office',
    evidence_inputs: ['信源', '客户需求确认', '旧案', '时间戳', '可引用材料'],
    risk_model: ['无来源判断', '旧案误引', '客户需求未确认'],
    output_schema: 'DepartmentOpinionV1',
  },
  hubu_cfo_office: {
    id: 'hubu_cfo_office',
    department_id: 'finance',
    title: '户部 CFO Office',
    evidence_inputs: ['成本', '毛利', '付款条件', '报价有效期', '现金流影响', '审批预算'],
    risk_model: ['报价依据不足', '毛利被压穿', '回款条件不明', '现金流错配'],
    output_schema: 'DepartmentOpinionV1',
  },
  bingbu_cro_sales_office: {
    id: 'bingbu_cro_sales_office',
    department_id: 'war',
    title: '兵部 CRO / Sales / RevOps Office',
    evidence_inputs: ['客户阶段', '客户决策链', '需求范围', '预算确认', '下一步触发点'],
    risk_model: ['客户阶段未确认', '报价策略无依据', '对外承诺越界'],
    output_schema: 'DepartmentOpinionV1',
  },
  libu_chro_cao_office: {
    id: 'libu_chro_cao_office',
    department_id: 'personnel',
    title: '吏部 CHRO / CAO Office',
    evidence_inputs: ['第一责任人', '审批人', 'RACI', '里程碑', '交接记录'],
    risk_model: ['责任人缺失', '审批链不清', '执行节奏不可控'],
    output_schema: 'DepartmentOpinionV1',
  },
  xingbu_clo_cco_office: {
    id: 'xingbu_clo_cco_office',
    department_id: 'justice',
    title: '刑部 CLO / CCO Office',
    evidence_inputs: ['合同正文或材料原文', '适用地区/司法辖区', '交易主体信息', '授权记录', '承诺边界', '人工确认记录'],
    risk_model: ['对外承诺风险', '授权记录不足', '不可逆法律动作'],
    output_schema: 'DepartmentOpinionV1',
  },
  rites_cmo_cco_office: {
    id: 'rites_cmo_cco_office',
    department_id: 'ritual',
    title: '礼部 CMO / CCO Office',
    evidence_inputs: ['客户回复话术', '禁用表达', '品牌口径', '发布范围', '客户确认'],
    risk_model: ['过度承诺', '对外口径不一致', '品牌与法务边界冲突'],
    output_schema: 'DepartmentOpinionV1',
  },
  gongbu_cto_cpo_delivery_office: {
    id: 'gongbu_cto_cpo_delivery_office',
    department_id: 'works',
    title: '工部 CTO / CPO / Delivery Office',
    evidence_inputs: ['BOM', '交期', '验收标准', '供应链锁定', '现场条件'],
    risk_model: ['固定交期不可证', '验收条件缺失', '供应链未锁定'],
    output_schema: 'DepartmentOpinionV1',
  },
};

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function missingInputs(profile: DepartmentOfficeProfile, question: string, knownFacts: string[]): string[] {
  const haystack = [question, ...knownFacts].join('\n');
  return profile.evidence_inputs.filter((input) => !haystack.includes(input));
}

function matchedRisks(profile: DepartmentOfficeProfile, question: string): string[] {
  if (profile.department_id === 'jinyiwei') {
    return ['无来源判断', '客户需求未确认'].filter(() => /报价|客户|合作|合同|竞品/.test(question));
  }
  if (profile.department_id === 'finance') {
    return ['报价依据不足', '回款条件不明'].filter(() => /报价|付款|成本|毛利|现金流|预算|ROI/.test(question));
  }
  if (profile.department_id === 'war') {
    return ['客户阶段未确认', '报价策略无依据'].filter(() => /客户|报价|合作|销售|商机|渠道/.test(question));
  }
  if (profile.department_id === 'personnel') {
    return ['责任人缺失', '审批链不清'].filter(() => /审批人|负责人|报价|执行|招聘|DRI/.test(question));
  }
  if (profile.department_id === 'justice') {
    return ['对外承诺风险', '授权记录不足'].filter(() => /正式报价|合同|承诺|股权|签字|付款|独家/.test(question));
  }
  if (profile.department_id === 'ritual') {
    return ['过度承诺', '对外口径不一致'].filter(() => /客户|话术|报价|招商|宣传|邮件|ROI/.test(question));
  }
  if (profile.department_id === 'works') {
    return ['固定交期不可证', '验收条件缺失'].filter(() => /交付|交期|验收|BOM|供应链|设备|施工/.test(question));
  }
  return [];
}

export function getDepartmentOfficeProfile(profileId: string | undefined): DepartmentOfficeProfile | null {
  return profileId ? OFFICE_PROFILES[profileId] ?? null : null;
}

export function listDepartmentOfficeProfiles(): DepartmentOfficeProfile[] {
  return Object.values(OFFICE_PROFILES);
}

// 边界(2026-07-03 阶段3 侦察)：本函数是"部门意见"三引擎里的 #2(A栈深 office·keyword regex)，
// 用自己的 OFFICE_PROFILES，**不调** C栈真 office(buildBingbuDepartmentOpinion 等)。与 #1(registry
// 浅桩)、#3(C栈 unified office)并存不是重复 bug——见 registry.ts buildShallowDepartmentOpinionsV1 边界注。
export function buildDeepOfficeOpinionV1(input: OfficeReviewInput): DepartmentOpinionV1 | null {
  const profile = getDepartmentOfficeProfile(input.entry.office_profile);
  if (!profile) return null;

  const missing = missingInputs(profile, input.question, input.knownFacts);
  const risks = matchedRisks(profile, input.question);
  const highRisk = risks.length > 0 && /正式报价|合同|股权|签字|承诺|付款|预付款|固定交期|外发/.test(input.question);
  const evidenceFacts = input.knownFacts.length > 0 ? input.knownFacts : [`用户原问：${input.question}`];
  const evidence = evidenceFacts.map((fact, index) => ({
    schema_version: 'EvidenceItemV1' as const,
    id: `office_evidence_${input.taskId}_${input.entry.id}_${index + 1}`,
    label: index === 0 ? '皇上原问' : '已知事实',
    summary: fact,
    reliability: 'medium' as const,
    source_label: input.sourceLabel,
  }));

  return {
    schema_version: 'DepartmentOpinionV1',
    task_id: input.taskId,
    department_id: input.entry.id,
    signal: highRisk ? 'YELLOW' : missing.length > 0 ? 'YELLOW' : 'GREEN',
    verdict: missing.length > 0 ? 'NEED_EVIDENCE' : highRisk ? 'RECHECK' : 'APPROVE',
    summary: `${profile.title} 深度意见：证据输入看 ${profile.evidence_inputs.slice(0, 4).join('、')}；风险模型看 ${profile.risk_model.slice(0, 3).join('、')}。`,
    evidence,
    missing_evidence: missing,
    risks: unique(risks),
    next_order: missing.length > 0 ? `先补齐${missing.slice(0, 4).join('、')}` : '可进入质量门复核',
    human_confirmation_required: highRisk,
    source_label: input.sourceLabel,
  };
}

export function buildDeepOfficeOpinionsV1(params: {
  taskId: string;
  question: string;
  knownFacts: string[];
  sourceLabel: SourceLabel;
  entries: CourtDepartmentRegistryEntry[];
}): DepartmentOpinionV1[] {
  return params.entries
    .map((entry) =>
      buildDeepOfficeOpinionV1({
        taskId: params.taskId,
        question: params.question,
        knownFacts: params.knownFacts,
        sourceLabel: params.sourceLabel,
        entry,
      }),
    )
    .filter((opinion): opinion is DepartmentOpinionV1 => Boolean(opinion));
}

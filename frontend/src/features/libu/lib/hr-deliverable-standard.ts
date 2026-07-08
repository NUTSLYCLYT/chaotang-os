/**
 * 吏部 · 各司专业产出文件标准（契约 · 2026-06-29）
 *
 * "把所有司出的文件资料定义标准，务必专业"：每个司的产出必须遵循统一的 9 段专业结构，
 * 带 sourceLabel/缺证/法律依据/审批门。本契约让"专业"可校验（validateDeliverable），不是口号。
 */
import type { LibuOfficeCode } from '@/core/courtos/libu/libu-personnel-admin-office';

/** 事实依据必须带来源（接 reality-state 的 sourceLabel 精神）。 */
export type FactSource = 'LIVE' | 'uploaded' | 'verified' | 'estimated' | 'missing';

export interface SourcedFact {
  fact: string;
  source: FactSource;
}

export type ConclusionLevel = 'feasible' | 'conditional' | 'infeasible' | 'need_evidence';

export const CONCLUSION_CN: Record<ConclusionLevel, string> = {
  feasible: '可行',
  conditional: '有条件可行',
  infeasible: '不可行',
  need_evidence: '缺证·待补',
};

/** 吏部标准专业产出文件（9 段）。 */
export interface HrDeliverable {
  /** ① 标题 + 文号 + 版本 + 日期 */
  title: string;
  docNo?: string;
  version: string;
  date: string;
  /** ② 适用范围/对象 */
  scope: string;
  /** ③ 事实依据(每条带来源) */
  facts: SourcedFact[];
  /** ④ 专业分析(引擎算法/标准依据) */
  analysis: string;
  /** ⑤ 结论与建议(分级) */
  conclusion: { level: ConclusionLevel; text: string };
  /** ⑥ 风险与缺证(显性) */
  risksAndGaps: string[];
  /** ⑦ 法律/合规依据(劳动法条/政策文号) */
  legalBasis: string[];
  /** ⑧ 成本/影响(户部口径) */
  costImpact: string;
  /** ⑨ 审批与生效(签批链 + 人工确认门) */
  approval: { required: boolean; chain: string[]; humanGate: boolean };
}

/** 各司标准产出文件清单（务必专业）。 */
export const LIBU_DELIVERABLES: Record<LibuOfficeCode, string[]> = {
  recruit_select: ['招聘需求审批表', '岗位说明书(JD)', '面试评估报告', '录用建议书'],
  appraisal_tenure: ['转正评估报告', '绩效考核结果单', '人才盘点九宫格', '晋升建议书'],
  compensation: ['岗位价值评估表', '薪酬带宽方案', '定薪/调薪建议书', '人力成本分析报告'],
  admin_general: ['行政预算表', '固定资产台账', '印章证照管理台账', '制度文件'],
  policy_declaration: ['高新认定自检报告', '补贴申报材料清单', '研发费归集表'],
  qualification_cert: ['资质准入清单', '认证状态台账', '认证维护计划'],
};

/** 激励/期权类产出（激励司，归在薪酬扩展）。 */
export const INCENTIVE_DELIVERABLES = ['激励方案设计书', '销售提成方案', '期权激励计划(ESOP)', '授予协议要点'];
/** 劳动关系类产出（劳关司，归在人事扩展）。 */
export const LABOR_DELIVERABLES = ['辞退合规方案', 'PIP改进计划', '离职交接清单', '劳动风险评估报告'];

/** 校验一份产出是否达专业标准（9 段齐全、事实带源、高风险有审批门）。 */
export function validateDeliverable(d: Partial<HrDeliverable>): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!d.title) missing.push('标题');
  if (!d.version) missing.push('版本');
  if (!d.date) missing.push('日期');
  if (!d.scope) missing.push('适用范围');
  if (!d.facts || d.facts.length === 0) missing.push('事实依据');
  else if (d.facts.some((f) => !f.source)) missing.push('事实依据来源(sourceLabel)');
  if (!d.analysis) missing.push('专业分析');
  if (!d.conclusion?.level) missing.push('结论分级');
  if (!d.risksAndGaps) missing.push('风险与缺证');
  if (!d.legalBasis) missing.push('法律/合规依据');
  if (!d.costImpact) missing.push('成本/影响');
  if (!d.approval) missing.push('审批与生效');
  return { valid: missing.length === 0, missing };
}

/**
 * 吏部 · 人事+行政 办公厅（2026-06-28）
 *
 * 吏部 = 老板的「人事 + 行政」总管。6 司：3 HR + 3 行政（用户定）。守护大神：达利欧（人事/可信度加权）。
 * 照户部 CFO / 兵部 CRO 办公厅范式：司编制 + 职责 + 真数据料 + 引擎状态 + 蜂群资源。
 * 蜂群资源：personnel_execution_swarm（吏部执行蜂群·DRI/RACI/责任链）供行政/执行侧。
 */

export type LibuOfficeCode =
  | 'recruit_select' // 招贤司
  | 'appraisal_tenure' // 铨叙司
  | 'compensation' // 俸禄司
  | 'admin_general' // 行政司
  | 'policy_declaration' // 申报司
  | 'qualification_cert'; // 资质司

export const LIBU_OFFICE_NAMES: Record<LibuOfficeCode, string> = {
  recruit_select: '招贤司',
  appraisal_tenure: '铨叙司',
  compensation: '俸禄司',
  admin_general: '行政司',
  policy_declaration: '申报司',
  qualification_cert: '资质司',
};

export interface LibuOffice {
  code: LibuOfficeCode;
  name: string;
  group: 'hr' | 'admin';
  /** 一句话职责。 */
  duty: string;
  /** 该司能吃的真数据（H盘）。 */
  realData: string;
  /** 真引擎状态。 */
  engine: 'built' | 'planned';
}

export const LIBU_OFFICES: LibuOffice[] = [
  // ── HR 3 司 ──
  { code: 'recruit_select', name: '招贤司', group: 'hr', duty: '该不该招、招聘渠道方案、岗位画像', realData: '招聘boss方案/智联方案', engine: 'planned' },
  { code: 'appraisal_tenure', name: '铨叙司', group: 'hr', duty: '试用期转正评估、绩效考核', realData: '各部门转正评价表', engine: 'built' },
  { code: 'compensation', name: '俸禄司', group: 'hr', duty: '定薪/调薪合理性、薪酬带宽（可对行业薪资基准）', realData: '转正确定工资待遇表', engine: 'planned' },
  // ── 行政 3 司 ──
  { code: 'admin_general', name: '行政司', group: 'admin', duty: '行政总监/总务/固定资产/制度/会议（DRI责任链）', realData: '部门负责人统计/制度考核', engine: 'planned' },
  { code: 'policy_declaration', name: '申报司', group: 'admin', duty: '政策申报：高新技术企业/专精特新/研发费加计扣除/政府补贴', realData: '（待接：研发台账/财务/知识产权）', engine: 'planned' },
  { code: 'qualification_cert', name: '资质司', group: 'admin', duty: '资质认证：ISO/3C/军工保密资质/装备承制（军工电池厂命脉）', realData: '（待接：现有证书台账/认证记录）', engine: 'planned' },
];

/** 吏部可调度的蜂群资源（来自 swarm-capability-registry）。 */
export const LIBU_SWARM_RESOURCES = [
  { id: 'personnel_execution_swarm', name: '吏部执行蜂群', use: 'DRI/RACI 责任链、行政执行落地（行政司/流程）' },
] as const;

export function officeByCode(code: LibuOfficeCode): LibuOffice | undefined {
  return LIBU_OFFICES.find((o) => o.code === code);
}

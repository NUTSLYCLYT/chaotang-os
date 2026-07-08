/**
 * 刑部 · 法务风控编制 8 司花名册（纯函数 · 2026-06-28）
 *
 * 镜像兵部 roster 结构(id/name/role/duty),补齐刑部"具备法务风控所有岗位"的可见证明。
 * 刑部当下无 core 引擎,故本表即刑部司名 SSOT(铁律2);有真引擎的司标 engine,余为骨架(诚实:不冒充已接真)。
 * 真引擎已落地:合同审查司 = clause-risk + clause-history + clause-report(条款扫描/史馆踩坑率/合规报告)。
 */

export type XingbuOfficeId =
  | 'chief'
  | 'contract_review'
  | 'compliance_audit'
  | 'risk_control'
  | 'evidence_gate'
  | 'policy'
  | 'dispute'
  | 'ip';

export interface XingbuOfficeRole {
  id: XingbuOfficeId;
  /** 朝堂司名(本表为 SSOT)。 */
  name: string;
  /** 真实法务/风控岗位。 */
  role: string;
  /** 职责一句话。 */
  duty: string;
  /** 该司的能力/skill 配置(运行态:本命方法+数据源,非 Claude skill)。 */
  skill: string;
  /** 复用的已建骨架件(为空=待建)。 */
  reuses: string[];
  /** 是否已接真引擎(诚实:false=骨架,待建)。 */
  engine: boolean;
}

/** 8 司展示顺序(尚书居首,余按"审—合规—风控—缺证—制度—争议—知产")。 */
export const XINGBU_OFFICE_ORDER: XingbuOfficeId[] = [
  'chief',
  'contract_review',
  'compliance_audit',
  'risk_control',
  'evidence_gate',
  'policy',
  'dispute',
  'ip',
];

export const XINGBU_ROSTER: Record<XingbuOfficeId, XingbuOfficeRole> = {
  chief: { id: 'chief', name: '刑部尚书', role: '法务风控总负责', duty: '总揽合规、统筹各司、对高危事项行使一票否决', skill: '统筹调度 + 高危一票否决(L0-L4 人工门)', reuses: ['governance/gate'], engine: false },
  contract_review: { id: 'contract_review', name: '合同审查司', role: '合同法务', duty: '逐条扫风险条款+缺证,出可下载合规审查报告(带法条)', skill: '条款风险扫描 + 史馆踩坑率 + 合规报告(带《民法典》法条)', reuses: ['clause-risk', 'clause-history', 'clause-report'], engine: true },
  compliance_audit: { id: 'compliance_audit', name: '合规稽查司', role: '合规专员', duty: '对照法规/监管要求查合规缺口', skill: '法规库比对查合规缺口(待接法规库)', reuses: [], engine: false },
  risk_control: { id: 'risk_control', name: '风控司', role: '风险经理', duty: '风险矩阵、敞口评估、尾部风险', skill: '风险矩阵 + 敞口评分 + 尾部风险(待建)', reuses: [], engine: false },
  evidence_gate: { id: 'evidence_gate', name: '缺证核查司', role: '证据审核', duty: '查证据链完整性,缺证打回(决策环缺证门)', skill: '证据链完整性核查 + 缺证打回(脏情报安全门)', reuses: ['evidence-gate', 'evidence-classify', 'isUsableByDept'], engine: true },
  policy: { id: 'policy', name: '制度司', role: '制度专员', duty: '内部制度/政策起草与一致性核查', skill: '制度一致性核查(待建)', reuses: [], engine: false },
  dispute: { id: 'dispute', name: '争议处置司', role: '诉讼/仲裁', duty: '纠纷预案、争议解决路径、止损', skill: '争议预案 + 史馆判例 base rate(接 reference-class)', reuses: ['reference-class'], engine: false },
  ip: { id: 'ip', name: '知识产权司', role: '知产法务', duty: '知产归属、侵权风险、保护策略', skill: '知产归属核查 + 侵权风险扫描(待建)', reuses: [], engine: false },
};

/** 刑部主题色（帝青绿·单一真相源，4 个组件共享）。 */
export const ACCENT = '#3DD68C';

/** 已接真引擎的司数 / 总司数(诚实展示"几真几骨架")。 */
export function xingbuEngineStats(): { real: number; total: number } {
  const all = Object.values(XINGBU_ROSTER);
  return { real: all.filter((o) => o.engine).length, total: all.length };
}

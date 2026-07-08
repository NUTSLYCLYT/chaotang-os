/**
 * 吏部自适应复杂度运行时（v0 第一刀）。
 *
 * 把 config/libu_complexity_profiles.yaml 的两件事从 yaml 声明变成可执行代码路径：
 *   1. determineLibuMode —— 按员工数映射 5 个模式 + 默认展示深度（"分层表面"）。
 *   2. applyEscalationRules —— 高风险自动升维（"风险地板"），与公司规模/模式无关，用户不可绕过。
 *
 * Andy Grove 原则：地板必须是引擎里一条任何 tier 都绕不过的代码路径，不是 UI/yaml 配置项。
 */

export type LibuMode =
  | 'founder_assistant'
  | 'small_team_hr'
  | 'growth_hrd'
  | 'chro_cao'
  | 'group_enterprise';

export type LibuView = 'brief' | 'management_detail' | 'professional_detail';

export interface LibuModeResult {
  mode: LibuMode;
  defaultView: LibuView;
  exposeSubOfficeStructure: boolean;
  headcountBand: string;
}

/** 按员工数映射 5 模式（与 config/libu_complexity_profiles.yaml 一致；边界归更大模式）。 */
export function determineLibuMode(employeeCount: number): LibuModeResult {
  if (employeeCount <= 10) {
    return { mode: 'founder_assistant', defaultView: 'brief', exposeSubOfficeStructure: false, headcountBand: '1-10' };
  }
  if (employeeCount <= 50) {
    return { mode: 'small_team_hr', defaultView: 'management_detail', exposeSubOfficeStructure: false, headcountBand: '10-50' };
  }
  if (employeeCount <= 200) {
    return { mode: 'growth_hrd', defaultView: 'management_detail', exposeSubOfficeStructure: true, headcountBand: '50-200' };
  }
  if (employeeCount <= 1000) {
    return { mode: 'chro_cao', defaultView: 'professional_detail', exposeSubOfficeStructure: true, headcountBand: '200-1000' };
  }
  return { mode: 'group_enterprise', defaultView: 'professional_detail', exposeSubOfficeStructure: true, headcountBand: '1000+' };
}

interface EscalationRule {
  id: string;
  patterns: string[];
  involve: string[];
  humanConfirmation?: boolean;
}

/** 8 条高风险升维规则（地板，与 mode/规模无关）。 */
const ESCALATION_RULES: EscalationRule[] = [
  { id: 'termination_or_discipline_always_escalate', patterns: ['辞退', '解除', '开除', '处分', '降级', '调岗', '降薪'], involve: ['employee_relations', 'justice'], humanConfirmation: true },
  { id: 'compensation_always_involve_hubu', patterns: ['薪酬', '调薪', '奖金', '提成', '年终奖'], involve: ['total_rewards', 'finance'] },
  { id: 'labor_risk_always_involve_xingbu', patterns: ['劳动风险', '纠纷', '竞业', '仲裁', '投诉', '离职谈判'], involve: ['employee_relations', 'justice'] },
  { id: 'sales_role_always_involve_bingbu', patterns: ['销售负责人', '大客户销售', '销售岗位', '招.{0,6}销售', '销售.{0,4}提成'], involve: ['talent_acquisition', 'war'] },
  { id: 'admin_cost_always_involve_hubu', patterns: ['行政采购', '行政费用', '搬.{0,2}办公室', '搬迁', '租赁'], involve: ['admin_operations', 'finance'] },
  { id: 'lease_or_contract_admin_always_involve_xingbu', patterns: ['租赁合同', '行政合同', '证照', '印章'], involve: ['admin_operations', 'justice'] },
  { id: 'ai_agent_role_always_involve_junjichu_and_xingbu', patterns: ['AI ?Agent', 'AI ?agent', '蜂群岗位', 'AI ?劳动力'], involve: ['junjichu', 'justice', 'jinyiwei'], humanConfirmation: true },
  { id: 'privacy_sensitive_data_requires_permission_guard', patterns: ['健康', '纪律', '离职意向', '个人隐私', '投诉', '薪酬'], involve: [] },
];

/** 用户不可绕过的风险地板（与公司规模无关）。 */
export const NON_NEGOTIABLE_FLOOR: readonly string[] = [
  'high_risk_requires_human_confirmation',
  'xingbu_review_for_labor_risk',
  'hubu_review_for_compensation_or_admin_cost',
  'source_label_required',
  'evidence_or_gap_required',
  'privacy_sensitive_data_guard',
];

export interface EscalationResult {
  escalationApplied: string[];
  involvedDepartments: string[];
  humanConfirmationRequired: boolean;
  lockedFloor: readonly string[];
}

/**
 * 应用高风险自动升维。命中即强制叠加对应子司/部门复核，用户不可关闭。
 * 与 determineLibuMode 的结果无关：小公司也照样升维。
 */
export function applyEscalationRules(text: string): EscalationResult {
  const t = text ?? '';
  const applied: string[] = [];
  const involved = new Set<string>();
  let human = false;
  for (const rule of ESCALATION_RULES) {
    if (rule.patterns.some((p) => new RegExp(p, 'i').test(t))) {
      applied.push(rule.id);
      for (const dept of rule.involve) involved.add(dept);
      if (rule.humanConfirmation) human = true;
    }
  }
  return {
    escalationApplied: applied,
    involvedDepartments: [...involved],
    humanConfirmationRequired: human,
    lockedFloor: NON_NEGOTIABLE_FLOOR,
  };
}

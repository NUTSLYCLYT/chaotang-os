import type { DepartmentCapability, UnifiedDepartmentId } from './unified-types.ts';

export const DEPARTMENT_REGISTRY: Record<UnifiedDepartmentId, DepartmentCapability> = {
  jinyiwei: {
    id: 'jinyiwei',
    name: '锦衣卫',
    modernRole: '信息 / 调研 / 事实核验 / 证据包',
    mission: '先行核查事实、来源、旧案和证据缺口。',
    enabled: true,
    category: 'intelligence',
    triggerKeywords: ['情报', '调研', '事实', '证据', '来源', '竞品', '政策', '客户需求', '历史记录'],
    requiredEvidence: ['信源', '时间', '证据位置'],
    highRiskKeywords: [],
    outputContract: 'IntelligencePackV1',
    sourceLabelRequired: true,
  },
  finance: {
    id: 'finance',
    name: '户部',
    modernRole: '财务 / 投资 / ROI / 成本 / 报价 / 现金流',
    mission: '判断投入、报价依据、成本边界、现金流和 ROI 是否成立。',
    enabled: true,
    category: 'finance',
    triggerKeywords: ['预算', 'ROI', '成本', '报价', '利润', '现金流', '回款', '投资', '付款', '资源'],
    requiredEvidence: ['报价依据', '成本边界', '付款节点', '回款假设'],
    highRiskKeywords: ['重大付款', '预付款', '付款'],
    outputContract: 'DepartmentOpinionV1',
    sourceLabelRequired: true,
  },
  war: {
    id: 'war',
    name: '兵部',
    modernRole: '销售 / 客户 / 渠道 / 成交路径 / 报价策略',
    mission: '判断客户意图、成交路径、竞争态势和推进策略。',
    enabled: true,
    category: 'growth',
    triggerKeywords: ['客户', '销售', '渠道', '成交', '报价策略', '竞争', '机会', '试点', '合作'],
    requiredEvidence: ['客户决策链', '需求范围', '预算确认', '下一步触发点'],
    highRiskKeywords: ['对外承诺', '保证收益'],
    outputContract: 'DepartmentOpinionV1',
    sourceLabelRequired: true,
  },
  personnel: {
    id: 'personnel',
    name: '吏部',
    modernRole: 'HR / 组织 / 人员 / 职责 / 绩效 / 执行承接',
    mission: '判断负责人、审批人、协同部门和执行节奏是否明确。',
    enabled: true,
    category: 'organization',
    triggerKeywords: ['负责人', '审批人', '组织', '人员', '职责', '执行', '协同', 'DRI', '里程碑', '90天'],
    requiredEvidence: ['第一责任人', '审批人', '时间节点', '协同部门'],
    highRiskKeywords: [],
    outputContract: 'DepartmentOpinionV1',
    sourceLabelRequired: true,
  },
  justice: {
    id: 'justice',
    name: '刑部',
    modernRole: 'CLO / General Counsel / CCO / Legal Operations / 法务 / 合规 / 合同 / 股权 / 印章 / 争议',
    mission: '拦截合同、股权、付款、正式报价、对外承诺、劳动、知产、合规、印章和诉讼等不可逆法律风险。',
    enabled: true,
    category: 'risk',
    triggerKeywords: ['合同', '协议', '股权', '分红', '对赌', '合规', '法务', '签字', '盖章', '印章', '正式报价', '承诺', '独家', '违约', '预付款', '退款', '保证金', '辞退', '降薪', '调岗', '竞业', '律师函', '诉讼', '仲裁', '索赔', '商标', '版权', '专利', '商业秘密', 'NDA', '监管', '牌照'],
    requiredEvidence: ['合同正文或材料原文', '适用地区/司法辖区', '交易主体信息', '授权记录', '承诺边界', '人工确认记录'],
    highRiskKeywords: ['合同', '股权', '分红', '对赌', '正式报价', '承诺', '独家', '违约', '预付款', '退款', '保证金', '签字', '盖章', '印章', '辞退', '降薪', '调岗', '律师函', '诉讼', '仲裁', '竞业', 'NDA'],
    outputContract: 'DepartmentOpinionV1',
    sourceLabelRequired: true,
  },
  ritual: {
    id: 'ritual',
    name: '礼部',
    modernRole: 'CMO / CCO / 品牌传播 / 客户表达 / 招商材料 / 公关舆情 / 对外内容质门',
    mission: '判断对外表达是否服务经营目标、是否可信、是否安全、是否需要跨部门复核。',
    enabled: true,
    category: 'communication',
    triggerKeywords: ['话术', '品牌', '宣传', '邮件', '会议', '对外表达', '招商', '官网', 'PPT', 'Pitch Deck', '公关', '媒体', '舆情', '危机', '展会', '社媒', '客户回复', '销售材料', '竞品回应'],
    requiredEvidence: ['受众', '目标', '渠道', '主口径', '事实依据', '禁用表达', '客户确认或授权'],
    highRiskKeywords: ['保证收益', 'ROI承诺', '正式报价', '交期承诺', '合同承诺', '独家', '媒体声明', '危机回应', '竞品攻击', '客户案例公开', '行业第一'],
    outputContract: 'DepartmentOpinionV1',
    sourceLabelRequired: true,
  },
  works: {
    id: 'works',
    name: '工部',
    modernRole: 'CTO / CPO / 交付 / BOM / 供应链 / 验收 / 对外交付承诺质门',
    mission: '判断技术方案、产品范围、BOM、供应链、交期、现场条件、验收和交付承诺是否成立。',
    enabled: true,
    category: 'delivery',
    triggerKeywords: ['技术', '产品', 'MVP', 'BOM', '设备', '施工', '交付', '供应链', '验收', '开发', '交期', '产能', '现场', '并网', '质量', '测试', '上线'],
    requiredEvidence: ['BOM', '交期', '验收标准', '供应链锁定', '现场条件'],
    highRiskKeywords: ['固定交期', '交付承诺', '一定交付', '30天交付', '供应商锁定', '验收完成'],
    outputContract: 'DepartmentOpinionV1',
    sourceLabelRequired: true,
  },
};

export function listDepartments(options: { enabledOnly?: boolean } = {}): DepartmentCapability[] {
  const all = Object.values(DEPARTMENT_REGISTRY);
  return options.enabledOnly ? all.filter((department) => department.enabled) : all;
}

export function getDepartment(id: UnifiedDepartmentId): DepartmentCapability {
  return DEPARTMENT_REGISTRY[id];
}

export function enabledDepartmentIds(): UnifiedDepartmentId[] {
  return listDepartments({ enabledOnly: true }).map((department) => department.id);
}

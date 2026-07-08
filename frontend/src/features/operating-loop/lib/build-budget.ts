export type BuildBudgetRisk = 'low' | 'medium' | 'high' | 'critical';
export type BuildBudgetStatus = 'pending_review' | 'approved' | 'needs_rework';

export interface DepartmentBuildBudget {
  id: string;
  title: string;
  targetDept: string;
  ownerDept: string;
  status: BuildBudgetStatus;
  requestedBudget: string;
  estimatedRoi: string;
  paybackWindow: string;
  cashflowPressure: string;
  priority: 'P0' | 'P1' | 'P2';
  riskLevel: BuildBudgetRisk;
  recommendation: string;
  command: string;
  acceptanceCriteria: string[];
  assignedWindows: {
    product: string;
    engineering: string;
    integration: string;
    review: string;
  };
}

export const RISK_LABEL: Record<BuildBudgetRisk, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '紧急',
};

export const STATUS_LABEL: Record<BuildBudgetStatus, string> = {
  pending_review: '待批',
  approved: '已准',
  needs_rework: '退回补充',
};

export const BUILD_BUDGET_SUMMARY = {
  totalRequested: '42.6 万',
  approvedThisWeek: '18.0 万',
  pendingCount: 3,
  avgRoi: '2.8x',
  cashReserve: '71%',
  recommendation: '先批户部预算中台和工部 Workflow，看板类扩展等验收后再投入。',
};

export const DEPARTMENT_BUILD_BUDGETS: DepartmentBuildBudget[] = [
  {
    id: 'build-hubu-v1',
    title: '建设户部经营预算中台 v1',
    targetDept: '户部',
    ownerDept: '工部',
    status: 'pending_review',
    requestedBudget: '16.8 万',
    estimatedRoi: '3.2x',
    paybackWindow: '30 天',
    cashflowPressure: '中',
    priority: 'P0',
    riskLevel: 'medium',
    recommendation: '批准首期，限定 3 个面板和 1 条军机处立项链路，验收后再扩展。',
    command:
      '让军机处立项建设户部经营预算中台 v1，预算上限 16.8 万，必须交付建设预算、待批项目、ROI 风险和现金流压力四个面板。',
    acceptanceCriteria: [
      '/departments 正常显示建设预算面板',
      '至少 3 个待批建设项目具备预算、ROI、风险和建议动作',
      '至少 1 个项目可跳转军机处立项',
      'npm run build 通过',
    ],
    assignedWindows: {
      product: 'Claude C',
      engineering: 'Codex D',
      integration: 'Codex B',
      review: 'Claude A',
    },
  },
  {
    id: 'build-gongbu-workflow',
    title: '工部 Workflow 建设中台',
    targetDept: '工部',
    ownerDept: '工部',
    status: 'approved',
    requestedBudget: '18.0 万',
    estimatedRoi: '4.1x',
    paybackWindow: '21 天',
    cashflowPressure: '中',
    priority: 'P0',
    riskLevel: 'low',
    recommendation: '继续执行，作为后续部门复制模板。',
    command:
      '让工部继续建设 Workflow 中台，优先沉淀部门建设模板、任务卡、验收标准和模型分工。',
    acceptanceCriteria: [
      '/departments 正常显示建设任务池',
      'Workflow 状态能覆盖 PRD、技术方案、开发、QA、归档',
      '每个建设任务能分配给 Claude、Codex、次级模型或人工',
      '建设模板可复制到户部、史馆、锦衣卫',
    ],
    assignedWindows: {
      product: 'Claude A',
      engineering: 'Codex B',
      integration: 'Codex B',
      review: 'Claude C',
    },
  },
  {
    id: 'build-jinyiwei-intel',
    title: '锦衣卫风险雷达二期',
    targetDept: '锦衣卫',
    ownerDept: '工部',
    status: 'needs_rework',
    requestedBudget: '22.4 万',
    estimatedRoi: '1.6x',
    paybackWindow: '60 天',
    cashflowPressure: '高',
    priority: 'P1',
    riskLevel: 'high',
    recommendation: '暂缓大投入，先要求补齐数据源、告警口径和误报处理方案。',
    command:
      '要求锦衣卫风险雷达二期补充数据源、告警口径、误报处理和验收样例，暂缓进入开发。',
    acceptanceCriteria: [
      '列明外部情报数据源和刷新频率',
      '定义高/中/低风险告警口径',
      '提供误报处理和人工复核流程',
      '通过户部 ROI 复核后再开工',
    ],
    assignedWindows: {
      product: 'Claude C',
      engineering: 'Codex D',
      integration: 'Codex B',
      review: 'Claude A',
    },
  },
  {
    id: 'build-shiguan-review',
    title: '史馆复盘归档模板',
    targetDept: '史馆',
    ownerDept: '工部',
    status: 'pending_review',
    requestedBudget: '7.8 万',
    estimatedRoi: '2.4x',
    paybackWindow: '14 天',
    cashflowPressure: '低',
    priority: 'P1',
    riskLevel: 'low',
    recommendation: '可随户部中台并行，小投入换取后续复用记忆。',
    command:
      '让史馆建设复盘归档模板，沉淀目标、过程、结果、证据、风险、评分和下次建议。',
    acceptanceCriteria: [
      '复盘模板包含目标、过程、结果、证据、风险、评分和下次建议',
      '能从建设任务语义进入归档',
      '归档内容可反哺次日上书房建议',
      '页面不破坏现有史馆视觉',
    ],
    assignedWindows: {
      product: 'Claude A',
      engineering: 'Codex B',
      integration: 'Codex B',
      review: 'Claude C',
    },
  },
];

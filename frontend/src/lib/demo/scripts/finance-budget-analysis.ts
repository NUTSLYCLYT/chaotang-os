/**
 * 朝堂 OS V2 · 演示剧本 DEMO-010 · 财务预算超支分析
 *
 * 触发词：'预算超支' / '财务管控' / '研发超支'
 */

import type { DemoScript } from '../demo-scripts';

export const financeBudgetAnalysisScript: DemoScript = {
  id: 'demo_finance_budget_analysis',
  name: '财务预算超支分析',
  description: '90 秒 · 财务庄园预算管控研判 · Q3 研发预算超支原因分析',
  category: 'analysis',
  defaultTitle: 'Q3 研发预算超支原因分析与管控',
  defaultRawCommand: '研发部门 Q3 预算已超支 23%，找出原因并制定管控方案',

  plan: {
    intent: '识别为财务预算管控类密旨，调度户部与工部协同。策略：户部深度分析超支原因与财务影响 → 工部评估研发项目优先级与资源重配方案。',
    taskType: 'analysis',
    departments: ['hu_bu', 'gong_bu'],
    aggregationStrategy: 'merge',
    escalationFlags: ['budget_overrun', 'financial_control'],
    subtasks: [
      {
        id: 'st_1',
        description: '分析 Q3 研发预算超支原因与成本结构',
        assignedDepartment: 'hu_bu',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_2',
        description: '评估研发项目优先级与资源重新配置方案',
        assignedDepartment: 'gong_bu',
        dependsOn: ['st_1'],
        priority: 2,
      },
    ],
  },

  departmentOutputs: [
    {
      department: 'hu_bu',
      subtaskId: 'st_1',
      summary: '户部分析：Q3 研发超支 23%，主要来源于三项：人力成本超支 14%（招聘计划提前执行）、云计算资源超支 6%（测试环境未及时回收）、设备采购超支 3%（未按批次采购）。',
      structuredOutput: {
        overrun_pct: 23,
        hr_overrun: 14,
        cloud_overrun: 6,
        equipment_overrun: 3,
        total_amount: 1840000,
      },
      riskFlags: ['人力成本管控失效', '云资源浪费'],
      confidence: 0.91,
    },
    {
      department: 'gong_bu',
      subtaskId: 'st_2',
      summary: '工部评估：当前 12 个研发项目中，4 个为低优先级可暂缓，释放约 620 万元资源。建议暂停 2 个探索性项目，重新聚焦核心产品线。',
      structuredOutput: {
        total_projects: 12,
        deferable_projects: 4,
        releasable_budget: 6200000,
        recommended_cuts: 2,
      },
      riskFlags: ['项目优先级管理缺失'],
      confidence: 0.85,
    },
  ],

  report: {
    executiveSummary: 'Q3 研发预算超支 23%，主要原因为人力提前扩张与云资源浪费。建议暂停 2 个低优先级项目，同时建立月度预算预警机制。',
    coreRecommendations: '户部建议立即启动云资源回收，工部建议暂停 2 个探索性项目，聚焦核心产品线。',
    departmentConclusions: [
      {
        agentCode: 'hu_bu',
        departmentName: '户部',
        summary: '超支 23% 主因人力（14%）+ 云计算（6%），总超支金额约 184 万',
        confidence: 0.91,
        keyPoints: ['人力超支 14%', '云计算超支 6%', '总计 184 万'],
      },
      {
        agentCode: 'gong_bu',
        departmentName: '工部',
        summary: '4 个项目可暂缓，建议暂停 2 个探索项目，释放 620 万预算',
        confidence: 0.85,
        keyPoints: ['可暂缓项目 4 个', '释放预算 620 万', '聚焦核心产品线'],
      },
    ],
    riskWarnings: '发现以下 3 项风险：\n1. 【高】现金流覆盖率接近警戒线\n2. 【中】应收账款集中度过高\n3. 【中】费用归口混乱，ROI 核算失真',
    observatoryForecast: '本案未触发钦天监推演。如需前瞻判断，可追加指令。',
    reviewActions: '建议本周启动云资源专项回收，本月建立预算预警机制，Q4 执行项目优先级重排。',
  },

  timeline: {
    interpretingDelay: 1000,
    planningDelay: 1500,
    perDepartmentDelay: 1500,
    aggregatingDelay: 1800,
  },

  manorReport: {
    task_id: 'demo_finance_budget_analysis',
    domain: 'finance',
    summary:
      '财务体检发现三处隐性压力：应收账款账期平均延长 18 天、现金流覆盖率跌至 1.3x（安全线以下）、部分费用归口混乱导致报表失真。短期内现金流可控，但若大客户账期继续拖延，Q3 将出现短暂流动性紧张窗口，需提前准备应急融资授信。',
    requires_departments: ['hubu', 'shangshu'],
    risks: [
      {
        level: 'high',
        title: '现金流覆盖率跌破 1.5x 安全线',
        mitigation: '启动应急授信申请，同时加强大客户账款催收。',
      },
      {
        level: 'medium',
        title: '应收账款前三大客户集中度超 60%',
        mitigation: '分散客户结构，对头部客户设置账期上限并纳入合同条款。',
      },
      {
        level: 'medium',
        title: '费用归口混乱，ROI 核算失真',
        mitigation: '重新梳理成本中心划分，启动季度财务复盘。',
      },
    ],
    action_cards: [
      {
        title: '应收账款专项核查',
        when: '本周',
        light: 'green',
        why: '现金流安全是公司生命线，优先级最高。',
      },
      {
        title: '应急授信申请',
        when: '两周内',
        light: 'yellow',
        why: '授信周期长，需提前布局，不能等到紧缺时才行动。',
      },
      {
        title: '费用归口整改',
        when: '本月',
        light: 'yellow',
        why: '报表失真将误导所有下游决策。',
      },
      {
        title: '季度财务复盘机制',
        when: '下季度前',
        light: 'green',
        why: '建立长效机制，防止问题积累。',
      },
    ],
  },
};

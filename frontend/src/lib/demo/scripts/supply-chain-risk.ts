/**
 * 朝堂 OS V2 · 演示剧本 DEMO-009 · 供应链风险预警
 *
 * 触发词：'供应商断供' / '供应链风险' / '供应链预警' / '交付延迟'
 */

import type { DemoScript } from '../demo-scripts';

export const supplyChainRiskScript: DemoScript = {
  id: 'demo_supply_chain_risk',
  name: '供应链风险预警',
  description: '90 秒 · 供应链庄园风险研判 · 关键供应商断供风险评估',
  category: 'analysis',
  defaultTitle: '关键供应商断供风险评估',
  defaultRawCommand: '核心供应商可能出现交付延迟，评估影响并给出应对方案',

  plan: {
    intent: '识别为供应链风险类密旨，调度户部、兵部、工部三部协同。策略：户部评估采购影响 → 兵部制定应急备案 → 工部评估替代方案技术可行性。',
    taskType: 'analysis',
    departments: ['hu_bu', 'bing_bu', 'gong_bu'],
    aggregationStrategy: 'weighted_merge',
    escalationFlags: ['supply_disruption', 'time_sensitive'],
    subtasks: [
      {
        id: 'st_1',
        description: '评估供应商交付延迟对采购计划的直接影响',
        assignedDepartment: 'hu_bu',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_2',
        description: '制定断供应急预案与备选供应商方案',
        assignedDepartment: 'bing_bu',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_3',
        description: '评估替代物料技术兼容性与切换周期',
        assignedDepartment: 'gong_bu',
        dependsOn: ['st_1', 'st_2'],
        priority: 2,
      },
    ],
  },

  departmentOutputs: [
    {
      department: 'hu_bu',
      subtaskId: 'st_1',
      summary: '户部评估：若供应商延迟 30 天，将影响 Q3 产能约 18%，直接损失约 280 万元。当前安全库存覆盖仅 11 天，已低于 30 天安全警戒线。',
      structuredOutput: { production_impact: '18%', direct_loss: 280, safety_stock_days: 11 },
      riskFlags: ['安全库存覆盖不足 30 天', '产能影响超过 15%'],
      confidence: 0.86,
    },
    {
      department: 'bing_bu',
      subtaskId: 'st_2',
      summary: '兵部应急预案：已识别 2 家备选供应商，其中 A 供应商可在 14 天内快速切换，但价格溢价约 12%；B 供应商切换周期 21 天，价格持平。',
      structuredOutput: { backup_suppliers: 2, fastest_switch_days: 14, price_premium: '12%' },
      riskFlags: ['备选供应商切换周期较长'],
      confidence: 0.82,
    },
    {
      department: 'gong_bu',
      subtaskId: 'st_3',
      summary: '工部评估：A 供应商物料技术兼容性 92%，需要约 3 天调试；B 供应商物料完全兼容，切换后无需额外调试。建议优先考虑 B 供应商作为备选。',
      structuredOutput: { supplier_a_compat: '92%', supplier_b_compat: '100%', switch_cost: 'low' },
      riskFlags: ['A 供应商需要调试周期'],
      confidence: 0.9,
    },
  ],

  report: {
    executiveSummary: '核心供应商断供风险评级为高，安全库存仅覆盖 11 天，建议立即启动 B 供应商切换预案，同时提升备货至 25-30 天安全水位。',
    coreRecommendations: '兵部建议立即联系 B 供应商，工部确认技术兼容性，户部核准额外采购预算。',
    departmentConclusions: [
      {
        agentCode: 'hu_bu',
        departmentName: '户部',
        summary: 'Q3 产能影响 18%，直接损失 280 万，安全库存覆盖仅 11 天',
        confidence: 0.86,
        keyPoints: ['产能影响 18%', '损失约 280 万', '安全库存 11 天'],
      },
      {
        agentCode: 'bing_bu',
        departmentName: '兵部',
        summary: '已识别 2 家备选供应商，B 供应商最优：21 天切换，价格持平',
        confidence: 0.82,
        keyPoints: ['备选供应商 2 家', 'B 供应商 21 天切换', '无价格溢价'],
      },
      {
        agentCode: 'gong_bu',
        departmentName: '工部',
        summary: 'B 供应商物料完全兼容，切换无需额外调试，技术可行性高',
        confidence: 0.9,
        keyPoints: ['B 供应商兼容性 100%', '切换成本低', '无需调试'],
      },
    ],
    riskWarnings: '发现以下 3 项风险：\n1. 【高】关键物料单一供应商，断供风险高\n2. 【高】安全库存覆盖仅 11 天，低于行业最低标准\n3. 【中】供应商地理集中，系统性风险敞口大',
    observatoryForecast: '本案未触发钦天监推演。如需前瞻判断，可追加指令。',
    reviewActions: '建议本周内启动 B 供应商切换流程，同步提升安全库存至 25 天，本季度完成核心物料双源备份。',
  },

  timeline: {
    interpretingDelay: 1000,
    planningDelay: 1500,
    perDepartmentDelay: 1500,
    aggregatingDelay: 1800,
  },

  manorReport: {
    task_id: 'demo_supply_chain_risk',
    domain: 'supply-chain',
    summary:
      '供应链风险审查发现：3 类关键物料依赖单一供应商（总采购额占比 58%）、备货安全库存覆盖率仅 11 天（目标 30 天）、供应商集中于单一产区导致自然灾害和政策风险敞口大。建议本季度完成核心物料双源备份，并建立滚动库存预警机制。',
    requires_departments: ['gongbu', 'hubu'],
    risks: [
      {
        level: 'high',
        title: '3 类关键物料单一供应商，断供风险高',
        mitigation: '本季度内为每类关键物料开发至少 1 个备选合格供应商。',
      },
      {
        level: 'high',
        title: '安全库存覆盖仅 11 天，低于行业最低标准',
        mitigation: '提升备货至 25-30 天，关键物料建立战略库存。',
      },
      {
        level: 'medium',
        title: '供应商地理集中，系统性风险敞口大',
        mitigation: '引入跨地域供应商，尤其针对受政策影响的敏感品类。',
      },
    ],
    action_cards: [
      {
        title: '关键物料备选供应商开发',
        when: '本季度',
        light: 'red',
        why: '单源断供一旦发生，损失远超开发备选供应商的成本。',
      },
      {
        title: '安全库存提升计划',
        when: '本月',
        light: 'yellow',
        why: '11 天覆盖率是危险警戒线，需尽快提升至安全水位。',
      },
      {
        title: '供应商地理分散策略',
        when: '半年内',
        light: 'yellow',
        why: '系统性风险（地缘、政策、自然灾害）无法靠单一供应商对冲。',
      },
      {
        title: '滚动库存预警机制',
        when: '本月',
        light: 'green',
        why: '建立可视化预警，防止风险积累到临界点才发现。',
      },
    ],
  },
};

/**
 * 朝堂 OS V2 · 演示剧本 #2 · HR 庄园 劳务纠纷场景
 *
 * 触发词：'劳动仲裁' / '加班费' / '员工离职' / '裁员补偿'
 * 90 秒跑完，展示 HR 庄园研判能力作为 LCR-001 法务剧本之外的第二场景
 */

import type { DemoScript } from '../demo-scripts';

export const hrLaborDisputeScript: DemoScript = {
  id: 'demo_hr_labor_dispute',
  name: 'HR 劳务纠纷仲裁（EXP-004）',
  description: '90 秒 · HR 庄园劳动法风险研判 · 劳动仲裁应对策略',
  category: 'analysis',
  defaultTitle: '员工以未支付加班费为由提起劳动仲裁',
  defaultRawCommand: '员工以未支付加班费为由提起劳动仲裁，如何应对？需要评估法律风险与内部合规。',

  plan: {
    intent: '识别为 HR 劳动关系类密旨，调度吏部与户部协同。优先级：紧急（仲裁时效 15 日）。策略：吏部核查证据链 → 户部评估赔偿方案 → 形成和解路径。',
    taskType: 'compliance',
    departments: ['li_bu', 'hu_bu', 'xing_bu'],
    aggregationStrategy: 'sequential',
    escalationFlags: ['labor_dispute', 'time_sensitive'],
    subtasks: [
      {
        id: 'st_1',
        description: '核查员工考勤记录与加班审批单',
        assignedDepartment: 'li_bu',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_2',
        description: '计算应付加班费及潜在赔偿金额',
        assignedDepartment: 'hu_bu',
        dependsOn: ['st_1'],
        priority: 2,
      },
      {
        id: 'st_3',
        description: '出具劳动法合规意见，评估和解方案',
        assignedDepartment: 'xing_bu',
        dependsOn: ['st_1', 'st_2'],
        priority: 3,
      },
    ],
  },

  departmentOutputs: [
    {
      department: 'li_bu',
      subtaskId: 'st_1',
      summary: '核查发现员工在职期间有 38 个工作日存在无审批加班记录，其中 12 天为节假日，按法定标准应支付额外补偿。',
      structuredOutput: { overtime_days: 38, holiday_days: 12, approval_gap: '34%' },
      riskFlags: ['evidence_gap', 'holiday_rate_liability'],
      confidence: 0.88,
    },
    {
      department: 'hu_bu',
      subtaskId: 'st_2',
      summary: '估算应付加班费约 18,600 元，若计入仲裁支持的二倍赔偿金上限为 37,200 元，另需考虑律师费用约 5,000-8,000 元。',
      structuredOutput: { base_overtime: 18600, max_liability: 45200, legal_fee_estimate: 6500 },
      riskFlags: ['double_penalty_risk'],
      confidence: 0.91,
    },
    {
      department: 'xing_bu',
      subtaskId: 'st_3',
      summary: '建议优先以协商和解方式处理，支付基础加班费 + 20% 和解溢价（约 22,320 元），可规避仲裁二倍赔偿风险，同时修订考勤制度，建立书面审批流程。',
      structuredOutput: { settlement_amount: 22320, risk_reduction: '75%', policy_fix: true },
      riskFlags: ['precedent_risk_other_employees'],
      confidence: 0.85,
    },
  ],

  report: {
    executiveSummary: '本次劳动仲裁案件证据链存在缺口，建议以协商和解方式处理，赔付约 22,320 元，规避二倍赔偿风险，同时完善考勤制度防范类似纠纷。',
    coreRecommendations: '立即整理证据 → 启动和解谈判 → 修订考勤制度',
    departmentConclusions: [
      { agentCode: 'li_bu', departmentName: '吏部', summary: '考勤证据存在 34% 缺口，仲裁被动风险高', confidence: 0.88, keyPoints: ['38 天加班记录', '12 天节假日未补偿'] },
      { agentCode: 'hu_bu', departmentName: '户部', summary: '最高赔偿敞口 45,200 元，和解可降至 22,320 元', confidence: 0.91, keyPoints: ['基础加班费 18,600', '律师费预估 6,500'] },
      { agentCode: 'xing_bu', departmentName: '刑部', summary: '和解方案可行，建议本周启动', confidence: 0.85, keyPoints: ['和解溢价 20%', '制度修订建议'] },
    ],
    riskWarnings: '主要风险：仲裁结果可能产生内部先例效应，其他员工效仿索赔。',
    observatoryForecast: '若采用和解方案，90 天内关闭风险概率约 85%；不和解而应诉，胜诉概率约 45%。',
    reviewActions: '和解协议签署后需同步修订《员工手册》加班条款，防止同类索赔。',
  },

  timeline: {
    interpretingDelay: 800,
    planningDelay: 1200,
    perDepartmentDelay: 6000,
    aggregatingDelay: 3000,
  },
};

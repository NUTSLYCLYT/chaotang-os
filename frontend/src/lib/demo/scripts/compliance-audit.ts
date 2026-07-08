/**
 * 朝堂 OS V2 · 演示剧本 DEMO-011 · 合规稽查
 *
 * 触发词：'合规稽查' / '数据合规' / '个人信息保护稽查'
 */

import type { DemoScript } from '../demo-scripts';

export const complianceAuditScript: DemoScript = {
  id: 'demo_compliance_audit',
  name: '合规稽查',
  description: '90 秒 · 合规庄园数据处理稽查 · 个人信息保护合规审查',
  category: 'compliance',
  defaultTitle: '数据处理合规稽查报告',
  defaultRawCommand: '对我们的数据处理流程进行合规稽查，重点检查个人信息保护',

  plan: {
    intent: '识别为数据合规稽查类密旨，调度刑部与吏部协同。策略：刑部核查数据处理合规性 → 吏部评估合规风险与整改优先级。',
    taskType: 'compliance',
    departments: ['xing_bu', 'li_bu'],
    aggregationStrategy: 'merge',
    escalationFlags: ['compliance_audit', 'data_privacy'],
    subtasks: [
      {
        id: 'st_1',
        description: '核查数据收集、存储、共享全流程合规性',
        assignedDepartment: 'xing_bu',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_2',
        description: '评估合规风险等级与整改优先级',
        assignedDepartment: 'li_bu',
        dependsOn: ['st_1'],
        priority: 2,
      },
    ],
  },

  departmentOutputs: [
    {
      department: 'xing_bu',
      subtaskId: 'st_1',
      summary: '刑部核查：数据处理流程存在 3 处个人信息保护法风险点：数据采集未明确授权、第三方共享无 DPA 协议、数据留存超过必要期限。若监管检查，最高面临营业额 4% 罚款。',
      structuredOutput: {
        risk_points: 3,
        max_penalty_pct: 4,
        unauthorized_collection: true,
        no_dpa: true,
        over_retention: true,
      },
      riskFlags: ['未授权数据采集', '第三方共享无 DPA', '数据留存超期'],
      confidence: 0.88,
    },
    {
      department: 'li_bu',
      subtaskId: 'st_2',
      summary: '吏部评估：建议在下一个监管窗口（约 6 周）前完成整改。DPA 协议签署和隐私政策修订为最高优先级，数据留存自动清理为中等优先级。',
      structuredOutput: {
        weeks_to_compliance: 6,
        critical_actions: 2,
        medium_actions: 2,
        compliance_probability: 0.85,
      },
      riskFlags: ['监管窗口紧迫'],
      confidence: 0.86,
    },
  ],

  report: {
    executiveSummary: '数据处理流程存在 3 处个人信息保护法风险，建议 6 周内完成整改，重点处理未授权数据采集与第三方 DPA 协议签署。',
    coreRecommendations: '刑部建议优先下线超范围数据采集，吏部建议两周内完成 DPA 签署，同步修订隐私政策。',
    departmentConclusions: [
      {
        agentCode: 'xing_bu',
        departmentName: '刑部',
        summary: '发现 3 处合规风险点，最高面临营业额 4% 罚款风险',
        confidence: 0.88,
        keyPoints: ['未授权采集', '无 DPA 协议', '留存超期'],
      },
      {
        agentCode: 'li_bu',
        departmentName: '吏部',
        summary: '监管窗口约 6 周，DPA 签署和隐私政策为最高优先级',
        confidence: 0.86,
        keyPoints: ['6 周整改窗口', '2 项紧急行动', '合规概率 85%'],
      },
    ],
    riskWarnings: '发现以下 3 项风险：\n1. 【高】用户数据采集未获明确授权\n2. 【高】第三方数据共享无 DPA 协议\n3. 【中】数据留存超过必要期限',
    observatoryForecast: '本案未触发钦天监推演。如需前瞻判断，可追加指令。',
    reviewActions: '建议两周内完成隐私政策修订与 DPA 签署，一个月内完成数据留存自动清理，季度末建立合规内审机制。',
  },

  timeline: {
    interpretingDelay: 1000,
    planningDelay: 1500,
    perDepartmentDelay: 1500,
    aggregatingDelay: 1800,
  },

  manorReport: {
    task_id: 'demo_compliance_audit',
    domain: 'compliance',
    summary:
      '合规审查发现数据处理流程存在 3 处 GDPR/个人信息保护法风险点：未经明确授权的数据收集、第三方数据共享未签署 DPA 协议、数据留存期限超过业务必要期限。若监管检查发生，最高面临营业额 4% 的罚款。建议在下一个监管窗口（约 6 周）前完成整改。',
    requires_departments: ['libu_hr', 'shangshu', 'xingbu'],
    risks: [
      {
        level: 'high',
        title: '用户数据采集未获明确授权',
        mitigation: '修订隐私政策，补充双重确认授权流程，下线超范围采集。',
      },
      {
        level: 'high',
        title: '第三方数据共享无 DPA 协议',
        mitigation: '立即与主要数据处理商签署 DPA，无法签署者停止数据共享。',
      },
      {
        level: 'medium',
        title: '数据留存超过必要期限',
        mitigation: '设置自动清理策略，按数据类型设定最长留存期。',
      },
    ],
    action_cards: [
      {
        title: '隐私政策修订',
        when: '两周内',
        light: 'red',
        why: '现行政策无法覆盖实际数据处理行为，是最直接的法律敞口。',
      },
      {
        title: 'DPA 协议签署',
        when: '两周内',
        light: 'red',
        why: '未签 DPA 的数据共享在监管检查时将被直接认定为违规。',
      },
      {
        title: '数据留存自动清理',
        when: '一个月内',
        light: 'yellow',
        why: '减少数据泄露风险面，同时符合最小化原则。',
      },
      {
        title: '合规内审机制建立',
        when: '季度末',
        light: 'green',
        why: '主动合规优于被动应对，建立定期内审可显著降低监管风险。',
      },
    ],
    citations: [
      {
        id: 'comp-cit-001',
        code: '《中华人民共和国个人信息保护法》第十三条',
        title: '处理个人信息的合法性基础',
        fullText:
          '符合下列情形之一的，个人信息处理者方可处理个人信息：（一）取得个人的同意；（二）为订立、履行个人作为一方当事人的合同所必要，或者按照依法制定的劳动规章制度和依法签订的集体合同实施人力资源管理所必要...',
      },
      {
        id: 'comp-cit-002',
        code: '《中华人民共和国个人信息保护法》第五十一条',
        title: '处理者安全保护义务',
        fullText:
          '个人信息处理者应当根据个人信息的处理目的、处理方式、个人信息的种类以及对个人权益的影响、可能存在的安全风险等，采取必要措施确保个人信息处理活动符合法律、行政法规的规定。',
      },
    ],
  },
};

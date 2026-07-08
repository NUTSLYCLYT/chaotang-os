/**
 * 朝堂 OS V2 · 演示剧本 DEMO-007 · 法律合同审查
 *
 * 触发词：'合同审查' / '法律风险' / '供应商合同'
 */

import type { DemoScript } from '../demo-scripts';

export const legalContractReviewScript: DemoScript = {
  id: 'demo_legal_contract_review',
  name: '法律合同审查',
  description: '90 秒 · 法律庄园合同风险研判 · 供应商合同法律风险审查',
  category: 'compliance',
  defaultTitle: '供应商合同法律风险审查',
  defaultRawCommand: '帮我审查这份供应商合同，有哪些法律风险点',

  plan: {
    intent: '识别为法务合同审查类密旨，调度刑部与吏部协同。优先级：普通。策略：刑部提取合同条款 → 吏部评估法律风险 → 形成风险清单与建议。',
    taskType: 'compliance',
    departments: ['xing_bu', 'li_bu'],
    aggregationStrategy: 'sequential',
    escalationFlags: ['contract_review', 'legal_risk'],
    subtasks: [
      {
        id: 'st_1',
        description: '提取合同核心条款与关键义务',
        assignedDepartment: 'xing_bu',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_2',
        description: '评估合同法律风险点与合规建议',
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
      summary: '刑部提取：合同涉及交付条款、质量验收标准、违约责任三大核心条款，其中质量验收标准表述模糊，违约责任条款存在对我方不利的举证要求。',
      structuredOutput: { clauses: 3, ambiguous: 1, adverse: 1 },
      riskFlags: ['质量验收标准模糊', '违约举证责任分配不利'],
      confidence: 0.87,
    },
    {
      department: 'li_bu',
      subtaskId: 'st_2',
      summary: '吏部评估：举证责任分配对我方不利，管辖条款存在选择风险，建议本周内发律师函明确立场，并补充证据固化措施。',
      structuredOutput: { risk_level: 'high', action_required: true, priority: 'urgent' },
      riskFlags: ['举证责任风险', '管辖法院选择风险'],
      confidence: 0.85,
    },
  ],

  report: {
    executiveSummary: '供应商合同存在三处法律风险点，其中举证责任分配和质量验收标准表述为高优先级风险，建议本周完成证据固化并发律师函。',
    coreRecommendations: '刑部建议优先固化证据，吏部建议本周发律师函并评估仲裁条款适用性。',
    departmentConclusions: [
      {
        agentCode: 'xing_bu',
        departmentName: '刑部',
        summary: '合同核心条款提取完毕，识别出质量验收标准模糊及违约举证不利两处风险',
        confidence: 0.87,
        keyPoints: ['质量验收标准模糊', '违约责任条款对我方不利'],
      },
      {
        agentCode: 'li_bu',
        departmentName: '吏部',
        summary: '法律风险评估完成，举证责任与管辖条款为主要风险点，建议立即行动',
        confidence: 0.85,
        keyPoints: ['举证责任高风险', '管辖风险中等', '建议本周发律师函'],
      },
    ],
    riskWarnings: '发现以下 3 项风险：\n1. 【高】举证责任分配对我方不利\n2. 【中】管辖法院选择风险\n3. 【低】质量验收标准表述模糊',
    observatoryForecast: '本案未触发钦天监推演。如需前瞻判断，可追加指令。',
    reviewActions: '建议本周内完成证据固化与律师函起草，两周内完成合规自查，避免对方先发制人。',
  },

  timeline: {
    interpretingDelay: 1000,
    planningDelay: 1500,
    perDepartmentDelay: 1500,
    aggregatingDelay: 1800,
  },

  manorReport: {
    task_id: 'demo_legal_contract_review',
    domain: 'legal',
    summary:
      '合同条款存在对我方不利的举证风险，建议优先完成证据固化，本周内发律师函明确立场，并评估仲裁管辖条款的适用性。综合来看，我方具备一定胜诉基础，但需谨慎处理质量验收标准的争议焦点。',
    requires_departments: ['xingbu', 'libu_hr'],
    risks: [
      {
        level: 'high',
        title: '举证责任分配对我方不利，间接证据证明力存疑',
        mitigation: '优先完成证据固化与公证存证，锁定关键交付节点。',
      },
      {
        level: 'medium',
        title: '管辖法院选择若失误将拖慢整体节奏',
        mitigation: '事先确认争议解决条款，优先选择对我方有利的仲裁机构。',
      },
      {
        level: 'low',
        title: '合同质量验收标准表述模糊，对方可能以此为由继续拖延',
        mitigation: '整理合同附件中的验收标准证据，形成书面确认函。',
      },
    ],
    action_cards: [
      { title: '证据固化', when: '今天就做', light: 'green', why: '证据灭失不可逆，这是所有后续动作的地基。' },
      { title: '律师函起草', when: '本周内', light: 'green', why: '正式表明立场，为后续谈判保留关键节点。' },
      { title: '合规自查', when: '本周内', light: 'yellow', why: '在对方反击前先堵上自己的漏洞。' },
      { title: '仲裁可行性评估', when: '两周内', light: 'yellow', why: '提前准备仲裁申请，缩短启动周期。' },
    ],
    citations: [
      {
        id: 'cit-001',
        code: '《中华人民共和国民法典》第五百零九条',
        title: '合同全面履行原则',
        fullText:
          '当事人应当按照约定全面履行自己的义务。当事人应当遵循诚信原则，根据合同的性质、目的和交易习惯履行通知、协助、保密等义务。当事人在履行合同过程中，应当避免浪费资源、污染环境和破坏生态。',
      },
      {
        id: 'cit-002',
        code: '《中华人民共和国民法典》第五百一十条',
        title: '合同漏洞填补规则',
        fullText:
          '合同生效后，当事人就质量、价款或者报酬、履行地点等内容没有约定或者约定不明确的，可以协议补充；不能达成补充协议的，按照合同相关条款或者交易习惯确定。',
      },
      {
        id: 'cit-003',
        code: '《中华人民共和国民法典》第五百七十七条',
        title: '违约责任',
        fullText:
          '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
      },
    ],
  },
};

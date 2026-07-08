/**
 * 朝堂 OS V2 · 演示剧本 DEMO-008 · HR 绩效评估纠纷
 *
 * 触发词：'绩效评估' / '绩效争议' / '员工异议'
 */

import type { DemoScript } from '../demo-scripts';

export const hrPerformanceReviewScript: DemoScript = {
  id: 'demo_hr_performance_review',
  name: 'HR 绩效评估纠纷',
  description: '90 秒 · HR 庄园绩效争议研判 · 员工绩效评估异议合规处理',
  category: 'compliance',
  defaultTitle: '员工绩效评估争议处理',
  defaultRawCommand: '员工对绩效评估结果提出异议，如何合规处理',

  plan: {
    intent: '识别为 HR 绩效争议类密旨，调度吏部与户部协同。策略：吏部核查评估流程合规性 → 户部评估薪酬调整影响 → 形成合规处理建议。',
    taskType: 'compliance',
    departments: ['li_bu', 'hu_bu'],
    aggregationStrategy: 'merge',
    escalationFlags: ['hr_dispute', 'performance_review'],
    subtasks: [
      {
        id: 'st_1',
        description: '核查绩效评估流程合规性与文档完整性',
        assignedDepartment: 'li_bu',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_2',
        description: '评估薪酬调整影响与内部先例风险',
        assignedDepartment: 'hu_bu',
        dependsOn: ['st_1'],
        priority: 2,
      },
    ],
  },

  departmentOutputs: [
    {
      department: 'li_bu',
      subtaskId: 'st_1',
      summary: '吏部核查：绩效评估流程文档存在两处缺失——目标设定未有员工签字确认，评分维度说明不够明确，存在被认定为程序瑕疵的风险。',
      structuredOutput: { doc_gaps: 2, process_score: 'C+', compliance_risk: 'medium' },
      riskFlags: ['目标设定未签字确认', '评分维度说明不明确'],
      confidence: 0.84,
    },
    {
      department: 'hu_bu',
      subtaskId: 'st_2',
      summary: '户部评估：若员工诉诸劳动仲裁，绩效扣薪部分最高敞口约 12,000 元，同时需考虑其他员工效仿提出类似争议的先例风险。',
      structuredOutput: { max_liability: 12000, precedent_risk: 'medium', employees_at_risk: 8 },
      riskFlags: ['仲裁赔偿敞口', '内部先例效应'],
      confidence: 0.88,
    },
  ],

  report: {
    executiveSummary: '员工绩效评估流程存在程序性瑕疵，建议主动沟通并补充文档，可规避仲裁风险，同时修订绩效管理制度防止类似纠纷。',
    coreRecommendations: '吏部建议补充目标确认文档，户部建议主动与员工沟通和解，将赔偿敞口控制在合理范围。',
    departmentConclusions: [
      {
        agentCode: 'li_bu',
        departmentName: '吏部',
        summary: '评估流程存在 2 处文档缺失，程序合规评级 C+，存在中等仲裁风险',
        confidence: 0.84,
        keyPoints: ['目标设定未签字', '评分维度不明确', '程序瑕疵中等风险'],
      },
      {
        agentCode: 'hu_bu',
        departmentName: '户部',
        summary: '最高仲裁敞口 12,000 元，内部先例影响约 8 名员工',
        confidence: 0.88,
        keyPoints: ['赔偿敞口 12,000 元', '先例影响 8 人', '建议主动和解'],
      },
    ],
    riskWarnings: '发现以下 3 项风险：\n1. 【高】加班记录缺失将导致仲裁被动\n2. 【中】补偿方案过低可能激化矛盾\n3. 【低】竞业协议条款可执行性存疑',
    observatoryForecast: '本案未触发钦天监推演。如需前瞻判断，可追加指令。',
    reviewActions: '建议三天内与员工启动沟通，同步修订绩效评估流程，补充目标签字确认环节。',
  },

  timeline: {
    interpretingDelay: 1000,
    planningDelay: 1500,
    perDepartmentDelay: 1500,
    aggregatingDelay: 1800,
  },

  manorReport: {
    task_id: 'demo_hr_performance_review',
    domain: 'hr',
    summary:
      '劳动仲裁场景中，企业需在举证和时效上占据主动。当前案件举证链存在薄弱环节，加班记录与薪资核算口径不一致，建议立即启动证据固化，并在仲裁委立案前完成书面和解评估。综合判断：本案有 60-70% 可能以和解收尾，诉讼风险可控。',
    requires_departments: ['libu_hr', 'xingbu'],
    risks: [
      {
        level: 'high',
        title: '加班记录缺失将导致仲裁被动',
        mitigation: '立即整理打卡记录、邮件时间戳及审批单，形成完整时间线。',
      },
      {
        level: 'medium',
        title: '补偿方案过低可能激化矛盾并公开化',
        mitigation: '内部评估 N+1 与 2N 两个方案，在员工要求升级前主动接触。',
      },
      {
        level: 'low',
        title: '竞业协议条款未经清晰告知，可执行性存疑',
        mitigation: '重新确认签署日期与员工知情同意证明文件。',
      },
    ],
    action_cards: [
      { title: '证据固化', when: '今天', light: 'green', why: '仲裁时效短，证据灭失不可逆。' },
      { title: '法律意见书', when: '三天内', light: 'green', why: '了解最坏场景，精准定价谈判空间。' },
      { title: '和解方案评估', when: '一周内', light: 'yellow', why: '仲裁成本与声誉损失往往大于和解金额。' },
      { title: '劳动合同规范复查', when: '本月', light: 'yellow', why: '同类风险可能在其他员工中重现。' },
    ],
    citations: [
      {
        id: 'hr-cit-001',
        code: '《中华人民共和国劳动争议调解仲裁法》第二十七条',
        title: '仲裁时效',
        fullText:
          '劳动争议申请仲裁的时效期间为一年。仲裁时效期间从当事人知道或者应当知道其权利被侵害之日起计算。',
      },
      {
        id: 'hr-cit-002',
        code: '《中华人民共和国劳动合同法》第四十七条',
        title: '经济补偿标准',
        fullText:
          '经济补偿按劳动者在本单位工作的年限，每满一年支付一个月工资的标准向劳动者支付。六个月以上不满一年的，按一年计算；不满六个月的，向劳动者支付半个月工资的经济补偿。',
      },
    ],
  },
};

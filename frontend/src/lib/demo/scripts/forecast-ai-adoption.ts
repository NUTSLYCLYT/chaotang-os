/**
 * 朝堂 OS V2 · 演示剧本 #5 预测
 *
 * 场景：2027 Q2 AI 企业采纳跃迁推演
 * 亮点：钦天监推演 · 情景树 · 跃迁点预测
 * 时长：60s
 */

import type { DemoScript } from '../demo-scripts';

export const forecastAiAdoptionScript: DemoScript = {
  id: 'demo_forecast_ai_adoption',
  name: '2027 Q2 AI 企业采纳跃迁推演',
  description: '预测类任务：钦天监情景树推演 + 户部经济节奏分析，识别 AI 企业采纳跃迁点',
  category: 'forecast',
  defaultTitle: '2027 Q2 AI 企业采纳跃迁推演',
  defaultRawCommand: '推演一下 2027 年 AI 在中国企业的采纳节奏，什么时候会出现真正的跃迁点',

  plan: {
    intent:
      '识别为战略预测类密旨，调度户部收集历史采纳曲线 + 钦天监推演跃迁情景树。优先级：中（战略预判，无紧迫性）。策略：户部拉历史曲线 → 钦天监识别跃迁条件 → 钦天监推演情景树（依赖前两者）。',
    taskType: 'strategy',
    departments: ['hu_bu', 'qin_tian_jian'],
    aggregationStrategy: 'weighted_merge',
    escalationFlags: ['strategic_forecast', 'scenario_tree_required'],
    subtasks: [
      {
        id: 'st_1',
        description: '收集企业 AI 采纳率历史曲线',
        assignedDepartment: 'hu_bu',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_2',
        description: '识别跃迁前置条件与当前达成率',
        assignedDepartment: 'qin_tian_jian',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_3',
        description: '推演 2025-2028 情景树',
        assignedDepartment: 'qin_tian_jian',
        dependsOn: ['st_1', 'st_2'],
        priority: 2,
      },
    ],
  },

  departmentOutputs: [
    {
      department: 'hu_bu',
      subtaskId: 'st_1',
      summary:
        '户部历史曲线：中国企业 AI 采纳率 2022 年 8%，2023 年 14%，2024 年 23%，2025 Q1 约 31%。增速 2023-2024 显著提升，但大型企业（>500人）采纳率（41%）与中小企业（18%）差距明显，头尾效应显著。',
      structuredOutput: {
        historicalAdoption: [
          { year: '2022', rate: '8%', note: '早期探索阶段' },
          { year: '2023', rate: '14%', note: '政策推动起步' },
          { year: '2024', rate: '23%', note: '大模型普及加速' },
          { year: '2025 Q1', rate: '31%', note: '融合应用阶段' },
        ],
        segmentation: {
          largeEnterprise: '41%（>500人）',
          sme: '18%（<500人）',
          gap: '23pp 头尾差距',
        },
        growthRate: '2024 年同比 +9pp，2023 年 +6pp，加速趋势明显',
        inflectionSignals: ['大模型 API 成本下降 60%（2023-2024）', 'ROI 可量化案例增至 3,400+'],
      },
      riskFlags: ['中小企业采纳率滞后，整体数字可能被大企业拉高'],
      assumptions: ['数据来源：IDC + 艾瑞咨询 + 公开财报', '采纳定义：每月活跃使用 AI 工具 ≥1 个'],
      confidence: 0.84,
    },
    {
      department: 'qin_tian_jian',
      subtaskId: 'st_2',
      summary:
        '钦天监识别跃迁前置条件（共 5 项）：当前已达成 3 项（模型成本可接受、头部成功案例充足、政策支持力度），待达成 2 项（中小企业 ROI 路径清晰度 52%，AI 人才供给充足度 38%）。跃迁触发门槛：需同时达成所有 5 项。',
      structuredOutput: {
        preconditions: [
          { name: '大模型 API 成本可接受', status: '已达成', achievement: '95%', note: '千 tokens 成本降至 ¥0.002' },
          { name: '头部成功案例充足', status: '已达成', achievement: '88%', note: '3,400+ 可量化 ROI 案例' },
          { name: '政策支持力度', status: '已达成', achievement: '82%', note: '国家级 AI 产业政策覆盖' },
          { name: 'SME ROI 路径清晰度', status: '待达成', achievement: '52%', note: '中小企业实施路径仍模糊' },
          { name: 'AI 人才供给充足度', status: '待达成', achievement: '38%', note: '应用型 AI 工程师缺口 40 万' },
        ],
        overallReadiness: '71%（跃迁需 ≥85%）',
        estimatedReadinessDate: '2026 Q3 - 2027 Q1',
        criticalBlocker: 'AI 人才供给是最大瓶颈（达成速度最慢）',
      },
      riskFlags: ['AI 人才缺口是跃迁主要瓶颈', 'SME 路径不清晰延缓整体跃迁'],
      assumptions: ['跃迁定义：企业 AI 采纳率 ≥55%（S 曲线拐点）', '基于 Rogers 创新扩散模型校准'],
      confidence: 0.75,
    },
    {
      department: 'qin_tian_jian',
      subtaskId: 'st_3',
      summary:
        '钦天监推演 2025-2028 情景树：基准情景（50% 概率）跃迁点出现在 2027 Q2，采纳率达 58%；加速情景（25% 概率）2026 Q4 提前跃迁；延迟情景（25% 概率）2028 Q2 才达标。建议按基准情景部署，同时预留加速情景应对资源。',
      structuredOutput: {
        scenarios: [
          {
            name: '加速情景',
            probability: 0.25,
            triggerDate: '2026 Q4',
            adoptionRate: '61%',
            trigger: '人才供给突破 + 监管快速落地',
            businessImpact: '市场窗口提前 2 个季度，先发优势关键',
          },
          {
            name: '基准情景',
            probability: 0.5,
            triggerDate: '2027 Q2',
            adoptionRate: '58%',
            trigger: '人才渐进培养 + SME 路径逐步清晰',
            businessImpact: '主流市场爆发，竞争最激烈阶段',
          },
          {
            name: '延迟情景',
            probability: 0.25,
            triggerDate: '2028 Q2',
            adoptionRate: '56%',
            trigger: '监管趋严或经济周期下行',
            businessImpact: '窗口期延长，但竞争格局也会继续演化',
          },
        ],
        expectedInflectionDate: '2027 Q2（加权期望）',
        recommendedStrategy: '按 2026 Q4 准备，以 2027 Q2 为主战场，2028 Q2 为保守估计',
        keyUncertainties: ['AI 人才政策（最快变量）', '经济周期（最大外部扰动）', '监管框架（合规成本影响 SME）'],
      },
      riskFlags: ['推演不等于预测', '情景树需每季度更新'],
      assumptions: ['基于户部历史曲线 + 钦天监条件达成率', '宏观无重大冲击（战争/金融危机）'],
      confidence: 0.72,
    },
  ],

  report: {
    executiveSummary: `钦天监御前呈报：2027 Q2 AI 企业采纳跃迁推演

臣等已调度户部拉取历史曲线、钦天监识别跃迁条件并推演情景树，现呈核心研判：

跃迁时间窗口：
  · 基准情景（50% 概率）：2027 Q2，采纳率达 58%
  · 加速情景（25% 概率）：2026 Q4 提前触发
  · 延迟情景（25% 概率）：2028 Q2 才到达

当前进度：整体跃迁准备度 71%，缺口 14pp。
最大瓶颈：AI 人才供给不足（达成率 38%），SME ROI 路径不清晰（52%）。

战略建议：按 2026 Q4 备战，以 2027 Q2 为主战场节点。`,

    coreRecommendations: `【钦天监·主线】以 2027 Q2 为主战场，2026 Q3 开始加大市场布局投入，抢占跃迁前窗口

【钦天监·加速准备】同步保留 2026 Q4 加速情景应对资源（25% 概率，不能忽视），保持产品和销售就绪

【户部·中小企业】SME 采纳率滞后 23pp，针对中小企业的 ROI 清晰化方案是跃迁加速器，优先投入

【钦天监·人才】AI 人才缺口是最大瓶颈，建议提前布局培训体系或与高校合作，自建人才供应链`,

    departmentConclusions: [
      {
        agentCode: 'hu_bu',
        departmentName: '户部',
        summary: '采纳率 2025 Q1 达 31%，增速加快，大企业（41%）vs 中小企业（18%）差距显著',
        confidence: 0.84,
        keyPoints: ['2025 Q1 采纳率 31%', '大企业 41% vs SME 18%', '年增速 +9pp 加快'],
      },
      {
        agentCode: 'qin_tian_jian',
        departmentName: '钦天监',
        summary: '跃迁准备度 71%，预计 2027 Q2 基准触发，人才供给是最大瓶颈',
        confidence: 0.73,
        keyPoints: ['跃迁窗口 2027 Q2（50%）', '准备度 71%/85%', '人才缺口 40 万最关键'],
      },
    ],

    riskWarnings: `发现以下 3 项推演风险：
1. 【钦天监】AI 人才缺口 40 万，是跃迁最大瓶颈，若政策无重大突破，达成时间可能延后
2. 【钦天监】延迟情景（25% 概率）若触发，竞争格局将持续演化 1 年，先发优势窗口延长
3. 【户部】中小企业采纳率滞后 23pp，若 SME 市场持续停滞，整体跃迁率将被拉低`,

    observatoryForecast: `钦天监 2025-2028 情景树推演：

加速情景（概率 25%）：
  触发节点：2026 Q4
  触发条件：AI 人才政策重大突破 + 监管框架快速落地
  采纳率：61%
  商业含义：市场窗口提前 2 个季度，先发优势窗口珍贵

基准情景（概率 50%）：
  触发节点：2027 Q2
  触发条件：人才渐进培养 + SME 路径逐步清晰
  采纳率：58%
  商业含义：主流市场爆发，竞争最激烈阶段

延迟情景（概率 25%）：
  触发节点：2028 Q2
  触发条件：监管趋严或经济周期下行
  采纳率：56%
  商业含义：窗口期延长，竞争格局持续演化

加权期望跃迁点：2027 Q2
关键不确定性：AI 人才政策、经济周期、监管框架

注：推演不等于预测，建议每季度更新一次情景树。`,

    reviewActions: `请陛下批示以下事项：

1. 本案核心结论：2027 Q2 是主战场节点（50% 概率），建议从现在开始 6 个月布局。
2. 风险 3 项，主要集中在人才与 SME，建议同步启动专项应对。
3. 若准奏，钦天监将每季度更新情景树，户部跟踪采纳率实际进度。
4. 如需深掘某一情景（如加速情景的产品策略），可单独下达密旨。`,
  },

  timeline: {
    interpretingDelay: 1200,
    planningDelay: 1500,
    perDepartmentDelay: 1800,
    aggregatingDelay: 2000,
  },
};

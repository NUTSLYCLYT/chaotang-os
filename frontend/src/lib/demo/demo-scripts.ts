/**
 * 朝堂 OS V2 · 预录演示剧本
 *
 * 从 V1 apps/api/src/modules/demo-script/scripts/* 迁移而来，
 * 升级为可在前端纯客户端播放的数据结构。
 *
 * 运行时：script-player.ts 会按 timeline 顺序 mutate app-store，
 * 让 /overview 和 /command-center 页面被"点亮"。
 */

import type { AgentCode } from '@/types/agent';
import type { TaskType, AggregationStrategy } from '@/types/task';
import type { DepartmentConclusion } from '@/types/report';
import type { ManorAnalyzeResult } from '@/types/manor';

/* ==========================================================================
   Demo Script 数据结构
   ========================================================================== */

export interface DemoScriptSubtask {
  id: string;
  description: string;
  assignedDepartment: AgentCode;
  dependsOn: string[];
  priority: number;
}

export interface DemoScriptDepartmentOutput {
  department: AgentCode;
  subtaskId: string;
  summary: string;
  structuredOutput: Record<string, unknown>;
  riskFlags: string[];
  confidence: number;
  assumptions?: string[];
}

export interface DemoScriptPlan {
  intent: string;
  taskType: TaskType;
  departments: AgentCode[];
  aggregationStrategy: AggregationStrategy;
  escalationFlags: string[];
  subtasks: DemoScriptSubtask[];
}

export interface DemoScriptReport {
  executiveSummary: string;
  coreRecommendations: string;
  departmentConclusions: DepartmentConclusion[];
  riskWarnings: string;
  observatoryForecast: string;
  reviewActions: string;
}

export interface DemoScriptTimeline {
  /** submitted → interpreting 的延迟 (ms) */
  interpretingDelay: number;
  /** interpreting → planning 的延迟 (ms) */
  planningDelay: number;
  /** 每个部门从 running → completed 的耗时 (ms) */
  perDepartmentDelay: number;
  /** aggregating → report_ready 的延迟 (ms) */
  aggregatingDelay: number;
}

export interface DemoScript {
  id: string;
  name: string;
  description: string;
  category: TaskType;
  defaultTitle: string;
  defaultRawCommand: string;
  plan: DemoScriptPlan;
  departmentOutputs: DemoScriptDepartmentOutput[];
  report: DemoScriptReport;
  timeline: DemoScriptTimeline;
  /** if set, written to task.manorReport at report_ready phase */
  manorReport?: ManorAnalyzeResult;
}

/* ==========================================================================
   剧本 1：2027 战略规划演示
   ========================================================================== */

export const strategy2027Script: DemoScript = {
  id: 'demo_strategy_2027',
  name: '2027 战略规划演示',
  description: '战略类任务全流程：4 部门协同 + 钦天监前瞻推演',
  category: 'strategy',
  defaultTitle: '制定 2027 年新品发布战略',
  defaultRawCommand:
    '制定 2027 年新品发布战略。需要销售数据复盘、技术可行性评估、营销策略制定、未来趋势推演。',

  plan: {
    intent:
      '用户要求制定 2027 年新品发布战略，属战略规划类任务，需户部、工部、礼部、钦天监四部协同完成。',
    taskType: 'strategy',
    departments: ['hu_bu', 'gong_bu', 'li_bu_rites', 'qin_tian_jian'],
    aggregationStrategy: 'weighted_merge',
    escalationFlags: ['strategic_with_forecast', 'multi_department_coordination'],
    subtasks: [
      { id: 'st_1', description: '复盘 Q1-Q2 销售数据并测算 ROI', assignedDepartment: 'hu_bu', dependsOn: [], priority: 1 },
      { id: 'st_2', description: '评估新品技术栈与开发资源', assignedDepartment: 'gong_bu', dependsOn: [], priority: 1 },
      { id: 'st_3', description: '分析目标人群与渠道策略', assignedDepartment: 'li_bu_rites', dependsOn: [], priority: 1 },
      { id: 'st_4', description: '推演 2027 行业趋势与窗口期', assignedDepartment: 'qin_tian_jian', dependsOn: ['st_1', 'st_2', 'st_3'], priority: 2 },
    ],
  },

  departmentOutputs: [
    {
      department: 'hu_bu',
      subtaskId: 'st_1',
      summary: '户部研判：H1 营收 ¥2,480 万，同比 +22%，但毛利率从 34% 降至 30.2%。新品如能维持 35% 毛利率，全年 ROI 约 2.4 倍。',
      structuredOutput: { revenue: '¥2,480万', yoy: '+22%', marginTrend: '34% → 30.2%', projectedROI: '2.4x' },
      riskFlags: ['毛利率连续两个季度下滑'],
      assumptions: ['未考虑汇率波动', '新品定价对标行业 P75'],
      confidence: 0.88,
    },
    {
      department: 'gong_bu',
      subtaskId: 'st_2',
      summary: '工部评估：技术栈复用度 75%，预计开发周期 12 周，需 6 人团队。无明显技术阻塞，建议复用现有微服务架构。',
      structuredOutput: { techRating: 'A-', devWeeks: 12, teamSize: 6, reuseRate: '75%' },
      riskFlags: ['第三方接口依赖未完全验证'],
      assumptions: ['现有团队技能不变', '不引入新基础设施'],
      confidence: 0.85,
    },
    {
      department: 'li_bu_rites',
      subtaskId: 'st_3',
      summary: '礼部市场研判：核心人群锁定 28-38 岁城市新中产，预计触达 320 万。建议主打小红书 + 抖音双渠道，核心主张「专业 × 轻奢 × 懂你」。',
      structuredOutput: {
        targetSize: '320万',
        channels: ['小红书 40%', '抖音 35%', '视频号 15%', '其他 10%'],
        coreMessage: '专业 × 轻奢 × 懂你',
        estimatedCAC: '¥285',
      },
      riskFlags: [],
      assumptions: ['第三方人群数据准确'],
      confidence: 0.82,
    },
    {
      department: 'qin_tian_jian',
      subtaskId: 'st_4',
      summary: '钦天监推演：2026 Q4 - 2027 Q3 为关键窗口。监管趋严概率 85%，AI 技术拐点将于 2027 Q1 出现。建议在 2026 Q4 抢跑，避开 2027 Q3 后的红海周期。',
      structuredOutput: {
        horizon: '2026 Q4 - 2027 Q3',
        windows: [
          { period: '2026 Q4', opportunity: '政策红利窗口', urgency: 'high' },
          { period: '2027 Q1', opportunity: 'AI 技术采纳临界点', urgency: 'medium' },
        ],
        scenarios: [
          { name: '乐观', probability: 0.3, payoff: '+52% 增长' },
          { name: '基准', probability: 0.5, payoff: '+22% 增长' },
          { name: '悲观', probability: 0.2, payoff: '-5% 微跌' },
        ],
        expectedValue: '+22.5% 增长',
        topThreat: '行业 CR3 将从 42% 跃升至 60%，2027 Q3 后窗口关闭',
      },
      riskFlags: ['前瞻威胁: 行业集中度加速提升', '若错过 Q4 窗口，进入门槛大幅提高'],
      assumptions: ['宏观环境无重大冲击', '历史模式参考有效'],
      confidence: 0.7,
    },
  ],

  report: {
    executiveSummary: `陛下御前呈报：制定 2027 年新品发布战略

臣等奉旨研议本案。本案属战略规划类，臣等已调度户部、工部、礼部、钦天监四部协同，并由钦天监推演前瞻。

核心发现：
  · 户部：H1 营收 +22%，但毛利率持续下滑，新品 ROI 测算 2.4x
  · 工部：技术栈复用度 75%，12 周可交付，团队 6 人
  · 礼部：320 万核心人群，建议小红书+抖音双渠道
  · 钦天监：2026 Q4 为关键政策窗口，2027 Q3 后窗口关闭

综合研判：本案具备落地条件，但时间窗口紧迫，需要 Q4 抢跑。`,

    coreRecommendations: `【钦天监】基准情形 +22.5% 增长可期，建议 Q4 抢跑布局，保留悲观情形撤退方案

【户部】严控新品毛利率不低于 35%，避免重蹈 H1 毛利下滑覆辙

【工部】采用复用架构 12 周交付，预留 2 周第三方接口验证

【礼部】小红书+抖音双渠道集中投放，CAC 控制在 ¥285 以内`,

    departmentConclusions: [
      {
        agentCode: 'hu_bu',
        departmentName: '户部',
        summary: 'H1 营收 ¥2,480 万 +22%，毛利率从 34% 降至 30.2%。新品维持 35% 毛利可达 ROI 2.4x。',
        confidence: 0.88,
        keyPoints: ['revenue: ¥2,480万', 'yoy: +22%', 'projectedROI: 2.4x'],
      },
      {
        agentCode: 'gong_bu',
        departmentName: '工部',
        summary: '技术栈复用 75%，12 周交付，6 人团队，A- 评级',
        confidence: 0.85,
        keyPoints: ['techRating: A-', 'devWeeks: 12', 'teamSize: 6'],
      },
      {
        agentCode: 'li_bu_rites',
        departmentName: '礼部',
        summary: '320 万核心人群，主打"专业×轻奢×懂你"，CAC ¥285',
        confidence: 0.82,
        keyPoints: ['targetSize: 320万', 'estimatedCAC: ¥285'],
      },
      {
        agentCode: 'qin_tian_jian',
        departmentName: '钦天监',
        summary: '2026 Q4 政策红利窗口紧迫，期望 +22.5% 增长，警惕行业集中度上升',
        confidence: 0.7,
        keyPoints: ['horizon: 2026 Q4 - 2027 Q3', 'expectedValue: +22.5% 增长'],
      },
    ],

    riskWarnings: `发现以下 4 项风险，请陛下明察：
1. 【户部】毛利率连续两个季度下滑
2. 【工部】第三方接口依赖未完全验证
3. 【钦天监】前瞻威胁：行业集中度加速提升
4. 【钦天监】若错过 Q4 窗口，进入门槛大幅提高`,

    observatoryForecast: `钦天监推演：2026 Q4 - 2027 Q3 为关键窗口。监管趋严概率 85%，AI 技术拐点将于 2027 Q1 出现。

关键窗口：
  · 2026 Q4 — 政策红利窗口 (紧迫度: high)
  · 2027 Q1 — AI 技术采纳临界点 (紧迫度: medium)

概率情景：
  · 乐观情景 (概率 30%): +52% 增长
  · 基准情景 (概率 50%): +22% 增长
  · 悲观情景 (概率 20%): -5% 微跌

期望值: +22.5% 增长

核心威胁：行业 CR3 将从 42% 跃升至 60%，2027 Q3 后窗口关闭`,

    reviewActions: `请陛下批示以下事项：

1. 本案各部研判一致，臣等把握较大，建议陛下准奏推进。
2. 风险共 4 项，主要集中在毛利率与时间窗口，需同步制定应对方案。
3. 时间窗口紧迫（2026 Q4 政策红利期），建议批示后立即启动。
4. 批示后将由史官归档，沉淀为日后参考。`,
  },

  timeline: {
    interpretingDelay: 1500,
    planningDelay: 2000,
    perDepartmentDelay: 1500,
    aggregatingDelay: 2000,
  },
};

/* ==========================================================================
   剧本 2：Q3 经营复盘演示
   ========================================================================== */

export const q3ReviewScript: DemoScript = {
  id: 'demo_q3_review',
  name: 'Q3 经营复盘演示',
  description: '分析类任务：户部主导的财务深度复盘',
  category: 'analysis',
  defaultTitle: 'Q3 经营全面复盘',
  defaultRawCommand: '复盘 Q3 销售、毛利、库存周转，找出关键问题',

  plan: {
    intent: '用户要求复盘 Q3 经营数据，属分析研判类任务，由户部主导深度分析。',
    taskType: 'analysis',
    departments: ['hu_bu'],
    aggregationStrategy: 'merge',
    escalationFlags: [],
    subtasks: [
      { id: 'st_1', description: '收集 Q3 核心财务指标', assignedDepartment: 'hu_bu', dependsOn: [], priority: 1 },
      { id: 'st_2', description: '分析问题并输出结论', assignedDepartment: 'hu_bu', dependsOn: ['st_1'], priority: 2 },
    ],
  },

  departmentOutputs: [
    {
      department: 'hu_bu',
      subtaskId: 'st_1',
      summary: '户部收集 Q3 核心指标：营收 ¥1,420 万 (+18%)，毛利率 31.5%，库存周转 6.8 次/年。',
      structuredOutput: { revenue: '¥1,420万', yoy: '+18%', margin: '31.5%', turnover: '6.8x' },
      riskFlags: [],
      assumptions: ['数据来自内部 ERP'],
      confidence: 0.9,
    },
    {
      department: 'hu_bu',
      subtaskId: 'st_2',
      summary: '户部研判：Q3 营收增长良好，但毛利率较 Q2 下降 0.6pp。核心问题为采购成本上升 12%。建议立即与 Top 3 供应商重谈。',
      structuredOutput: {
        conclusion: 'Q3 营收增长但毛利下滑',
        topIssue: '采购成本上升 12%',
        recommendation: '与 Top 3 供应商立即重谈，目标降本 5%',
      },
      riskFlags: ['采购成本同比 +12%'],
      confidence: 0.87,
    },
  ],

  report: {
    executiveSummary: `陛下御前呈报：Q3 经营全面复盘

臣等奉旨研议本案。已由户部主导深度分析。

核心发现：
  · Q3 营收 ¥1,420 万，同比 +18%，增长良好
  · 毛利率 31.5%，环比下降 0.6pp
  · 主要问题：采购成本上升 12%`,

    coreRecommendations:
      '【户部】立即与 Top 3 供应商重新议价，目标降本 5%。同时启动备选供应商开发，避免单一依赖。',

    departmentConclusions: [
      {
        agentCode: 'hu_bu',
        departmentName: '户部',
        summary: 'Q3 营收 +18%，但采购成本上升 12% 拖累毛利。建议立即重谈供应商。',
        confidence: 0.88,
        keyPoints: ['revenue: ¥1,420万', 'yoy: +18%', 'topIssue: 采购成本上升 12%'],
      },
    ],

    riskWarnings: `发现以下 1 项风险：
1. 【户部】采购成本同比 +12%，需立即应对`,

    observatoryForecast: '本案未触发钦天监推演。如需前瞻判断，可追加指令。',

    reviewActions: `请陛下批示以下事项：

1. 户部研判把握较大，建议陛下准奏推进供应商重谈。
2. 风险 1 项 (采购成本)，需即时应对。
3. 批示后将由史官归档，沉淀为日后参考。`,
  },

  timeline: {
    interpretingDelay: 1000,
    planningDelay: 1200,
    perDepartmentDelay: 1500,
    aggregatingDelay: 1500,
  },
};

/* ==========================================================================
   注册表
   ========================================================================== */

// 主线剧本（DEMO-BIBLE §三 wow moment 唯一来源）
import { nvidiaMainScript } from './scripts/nvidia-main';
import { hrLaborDisputeScript } from './scripts/hr-labor-dispute';
import { healthCheckupScript } from './scripts/health-checkup';
import { intelBriefingScript } from './scripts/intel-briefing';
import { forecastAiAdoptionScript } from './scripts/forecast-ai-adoption';
// 庄园领域剧本 DEMO-007~011
import { legalContractReviewScript } from './scripts/legal-contract-review';
import { hrPerformanceReviewScript } from './scripts/hr-performance-review';
import { supplyChainRiskScript } from './scripts/supply-chain-risk';
import { financeBudgetAnalysisScript } from './scripts/finance-budget-analysis';
import { complianceAuditScript } from './scripts/compliance-audit';

export const DEMO_SCRIPTS: DemoScript[] = [
  nvidiaMainScript,              // 主线
  hrLaborDisputeScript,          // EXP-004: HR 劳务纠纷
  healthCheckupScript,           // 健康：体检解读
  intelBriefingScript,           // 情报：锦衣卫快报
  forecastAiAdoptionScript,      // 预测：AI 采纳跃迁
  strategy2027Script,            // 分支：战略
  q3ReviewScript,                // 分支：复盘
  legalContractReviewScript,     // DEMO-007: 法律合同审查
  hrPerformanceReviewScript,     // DEMO-008: HR 绩效评估纠纷
  supplyChainRiskScript,         // DEMO-009: 供应链风险预警
  financeBudgetAnalysisScript,   // DEMO-010: 财务预算超支分析
  complianceAuditScript,         // DEMO-011: 合规稽查
];

export function getDemoScriptById(id: string): DemoScript | undefined {
  return DEMO_SCRIPTS.find((s) => s.id === id);
}

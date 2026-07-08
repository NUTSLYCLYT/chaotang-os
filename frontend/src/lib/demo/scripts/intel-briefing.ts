/**
 * 朝堂 OS V2 · 演示剧本 #4 情报
 *
 * 场景：锦衣卫昨夜情报快报
 * 亮点：信息差优势 · 锦衣卫全球扫描 + 兵部竞品分析
 * 时长：45s
 */

import type { DemoScript } from '../demo-scripts';

export const intelBriefingScript: DemoScript = {
  id: 'demo_intel_briefing',
  name: '昨夜情报快报 · 锦衣卫24h扫描',
  description: '情报类任务：锦衣卫全球 300+ 信号源扫描 + 兵部竞品专项分析',
  category: 'intel',
  defaultTitle: '昨夜情报快报 · 锦衣卫24h扫描',
  defaultRawCommand: '给我昨晚的情报摘要，重点关注竞品动向和行业政策',

  plan: {
    intent:
      '识别为情报收集类密旨，调度锦衣卫全球扫描 + 兵部竞品专项分析。优先级：高（昨夜动态需当日研判）。策略：锦衣卫扫描全局信号 → 锦衣卫提炼 Top 威胁 → 兵部竞品专项（并行）。',
    taskType: 'analysis',
    departments: ['jin_yi_wei', 'bing_bu'],
    aggregationStrategy: 'merge',
    escalationFlags: ['intel_priority_daily', 'competitive_monitoring'],
    subtasks: [
      {
        id: 'st_1',
        description: '扫描全球 300+ 信号源',
        assignedDepartment: 'jin_yi_wei',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_2',
        description: '提炼 Top 5 威胁情报',
        assignedDepartment: 'jin_yi_wei',
        dependsOn: [],
        priority: 2,
      },
      {
        id: 'st_3',
        description: '竞品动向专项分析',
        assignedDepartment: 'bing_bu',
        dependsOn: [],
        priority: 2,
      },
    ],
  },

  departmentOutputs: [
    {
      department: 'jin_yi_wei',
      subtaskId: 'st_1',
      summary:
        '锦衣卫 24h 全球扫描完成：共扫描 342 条信号源，命中关键词 28 条，识别紧急情报 3 条，需即时研判。',
      structuredOutput: {
        totalSignals: 342,
        keywordHits: 28,
        urgentAlerts: 3,
        sourceBreakdown: {
          media: '行业媒体 142 条',
          social: '社交平台 89 条',
          regulatory: '监管公告 31 条',
          financial: '财经数据 80 条',
        },
        scanTime: '昨日 22:00 - 今日 06:00',
        coverage: '中国、美国、欧盟、东南亚',
      },
      riskFlags: ['3 条紧急情报需当日研判'],
      assumptions: ['信号源时效 <24h', '关键词库已更新至本月版本'],
      confidence: 0.92,
    },
    {
      department: 'jin_yi_wei',
      subtaskId: 'st_2',
      summary:
        '锦衣卫 Top 3 紧急情报：①字节跳动今晨宣布入局企业 AI 赛道（直接竞品威胁）②监管部门对大模型备案开始二轮审查（合规窗口收窄）③某竞品完成 2 亿美元 B 轮融资（竞争烈度升级）。',
      structuredOutput: {
        topAlerts: [
          {
            rank: 1,
            headline: '字节跳动入局企业 AI 赛道',
            time: '今日 08:30',
            urgency: 'critical',
            impact: '直接竞品，资源雄厚，需立即跟踪产品定位',
          },
          {
            rank: 2,
            headline: '监管对大模型备案启动二轮审查',
            time: '昨日 18:00',
            urgency: 'high',
            impact: '合规窗口收窄，建议法务部门 24h 内评估影响',
          },
          {
            rank: 3,
            headline: '某竞品（代号 α）完成 2 亿美元 B 轮',
            time: '昨日 22:00',
            urgency: 'high',
            impact: '竞争烈度升级，可能加速产品迭代节奏',
          },
        ],
        generalTrends: [
          'AI 企业服务赛道融资活跃，Q2 已有 7 起 >5000 万美元融资',
          'B2B SaaS 价格战压力加剧，平均 ARR 折扣率上升 12%',
        ],
      },
      riskFlags: ['字节跳动入局直接威胁', '监管合规风险升级', '竞品融资加速迭代'],
      assumptions: ['情报来源交叉验证 ≥2 个独立信源'],
      confidence: 0.85,
    },
    {
      department: 'bing_bu',
      subtaskId: 'st_3',
      summary:
        '兵部竞品本周动作分析：直接竞品 4 家，本周 2 家调价（均为降价 10-15%，价格战信号），1 家（竞品 α）完成融资，1 家发布新产品（切入中小企业市场）。综合判断：竞争格局正在加速分化，头部玩家融资后将提速。',
      structuredOutput: {
        directCompetitors: 4,
        weeklyActions: [
          {
            competitor: '竞品 β',
            action: '产品降价 12%',
            signal: '价格战，争夺中端市场',
            threat: 'medium',
          },
          {
            competitor: '竞品 γ',
            action: '产品降价 15%',
            signal: '跟随性降价，防御市场份额',
            threat: 'medium',
          },
          {
            competitor: '竞品 α',
            action: '完成 2 亿美元 B 轮融资',
            signal: '资本驱动，将加速研发与销售',
            threat: 'high',
          },
          {
            competitor: '竞品 δ',
            action: '发布中小企业版产品',
            signal: '下沉市场布局，暂不威胁我方核心客群',
            threat: 'low',
          },
        ],
        competitiveIndex: '本周市场竞争烈度指数：7.2/10（环比 +1.1）',
        recommendation: '建议短期内锁定关键客户合同，防止竞品趁融资后挖角',
      },
      riskFlags: ['价格战信号出现', '竞品 α 融资后将提速'],
      assumptions: ['基于公开信息 + 销售一线反馈'],
      confidence: 0.83,
    },
  ],

  report: {
    executiveSummary: `锦衣卫御前快报：昨夜 24h 情报摘要

臣等已扫描全球 342 条信号，识别紧急情报 3 条，现呈核心研判：

今日最高优先级（3 件）：
  · 字节跳动今晨入局企业 AI — 直接竞争，需立即研究其产品定位
  · 大模型备案二轮审查启动 — 合规窗口收窄，法务部门需 24h 内响应
  · 竞品 α 完成 2 亿美元融资 — 竞争烈度升级，预计加速产品迭代

本周竞争格局变化：4 家直接竞品中，2 家降价（价格战），1 家融资提速，1 家下沉中小企。`,

    coreRecommendations: `【锦衣卫·紧急】字节跳动入局情报，建议今日内组织产品 + 销售会议，评估产品定位差异化策略

【锦衣卫·合规】监管二轮审查 24h 内通知法务，评估现有备案材料是否需要补充

【兵部·防御】竞品 α 融资后将加速，建议提前锁定 Top 20 潜在客户合同，防止被挖角

【兵部·价格】竞品 β/γ 降价信号，建议不要跟随，聚焦差异化价值而非价格竞争`,

    departmentConclusions: [
      {
        agentCode: 'jin_yi_wei',
        departmentName: '锦衣卫',
        summary: '扫描 342 条信号，3 条紧急情报：字节入局、监管收紧、竞品融资',
        confidence: 0.88,
        keyPoints: ['扫描 342 条', '紧急情报 3 条', '字节跳动入局最高危'],
      },
      {
        agentCode: 'bing_bu',
        departmentName: '兵部',
        summary: '4 家竞品本周动作密集：2 家降价、1 家融资、1 家新品发布，竞争指数 7.2/10',
        confidence: 0.83,
        keyPoints: ['竞争烈度 7.2/10 +1.1', '2 家降价信号', '竞品 α 融资高危'],
      },
    ],

    riskWarnings: `发现以下 3 项紧急风险：
1. 【锦衣卫】字节跳动入局企业 AI，今晨宣布，资源雄厚，直接威胁
2. 【锦衣卫】监管二轮审查开启，合规窗口收窄，有罚款或下架风险
3. 【兵部】竞品 α 融资 2 亿美元，将加速产品与销售，预计 6 个月内影响显现`,

    observatoryForecast: '本案为日常情报快报，未触发钦天监长期推演。如需对字节跳动入局做 12 个月情景推演，可单独下达密旨。',

    reviewActions: `请陛下批示以下事项：

1. 【今日必须】字节跳动入局：召集产品 + 销售评估会议（建议今日下午）
2. 【24h 内】监管合规：通知法务部门评估备案材料
3. 【本周内】竞品防御：锁定 Top 20 潜在客户合同
4. 若准奏，锦衣卫将持续每日扫描，字节跳动设为重点监控对象。`,
  },

  timeline: {
    interpretingDelay: 600,
    planningDelay: 800,
    perDepartmentDelay: 1000,
    aggregatingDelay: 1200,
  },
};

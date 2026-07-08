/**
 * 朝堂 OS V2 · 演示剧本 #3 健康
 *
 * 场景：陛下本周体检数据解读
 * 亮点：私人助理感 · 太医院主诊 + 钦天监健康窗口推演
 * 时长：60s
 */

import type { DemoScript } from '../demo-scripts';

export const healthCheckupScript: DemoScript = {
  id: 'demo_health_checkup',
  name: '陛下本周体检数据解读',
  description: '健康管理类任务：太医院深度解读 + 钦天监90天窗口推演',
  category: 'health',
  defaultTitle: '陛下本周体检数据解读',
  defaultRawCommand: '本周体检数据出来了，帮我看看有没有需要注意的地方',

  plan: {
    intent:
      '识别为健康管理类密旨，调度太医院主诊 + 钦天监推演健康趋势。优先级：高（陛下龙体要紧）。策略：太医院读数据 → 太医院对比历史 → 钦天监推演 90 天健康窗口。',
    taskType: 'analysis',
    departments: ['tai_yi_yuan', 'qin_tian_jian'],
    aggregationStrategy: 'merge',
    escalationFlags: ['health_priority_high', 'trend_analysis_required'],
    subtasks: [
      {
        id: 'st_1',
        description: '读取本周体检核心指标',
        assignedDepartment: 'tai_yi_yuan',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_2',
        description: '对比历史数据分析趋势',
        assignedDepartment: 'tai_yi_yuan',
        dependsOn: [],
        priority: 2,
      },
      {
        id: 'st_3',
        description: '推演未来 90 天健康窗口',
        assignedDepartment: 'qin_tian_jian',
        dependsOn: ['st_1', 'st_2'],
        priority: 3,
      },
    ],
  },

  departmentOutputs: [
    {
      department: 'tai_yi_yuan',
      subtaskId: 'st_1',
      summary:
        '太医院本周体检核心指标：血压 126/82mmHg（临界偏高），空腹血糖 5.8mmol/L（糖尿病前期临界），BMI 24.3（正常上限），总胆固醇 5.4mmol/L（临界偏高）。',
      structuredOutput: {
        bloodPressure: '126/82 mmHg',
        bloodPressureStatus: '临界偏高（>120/80）',
        fastingGlucose: '5.8 mmol/L',
        glucoseStatus: '糖尿病前期临界（5.6-6.9）',
        bmi: 24.3,
        bmiStatus: '正常上限（18.5-24.9）',
        totalCholesterol: '5.4 mmol/L',
        cholesterolStatus: '临界偏高（<5.2 正常）',
      },
      riskFlags: ['血压临界偏高', '血糖处于糖尿病前期'],
      assumptions: ['数据来自本周正规体检机构', '空腹状态达标（>8h）'],
      confidence: 0.95,
    },
    {
      department: 'tai_yi_yuan',
      subtaskId: 'st_2',
      summary:
        '太医院历史趋势分析：血压过去 4 周连续上升 8%，建议减盐并增加有氧运动；血糖处于糖尿病前期临界值，近 2 个月轻微上升趋势，需重点关注。',
      structuredOutput: {
        bpTrend: '过去 4 周 +8%（连续上升）',
        glucoseTrend: '近 2 月轻微上升，尚在临界线内',
        bmiTrend: '稳定（±0.2 波动）',
        cholesterolTrend: '近 3 月持平，偶发偏高',
        keyConclusion: '血压趋势最值得警惕，建议立即生活方式干预',
        recommendations: ['每日减盐至 <5g', '每周 3 次有氧运动（≥30min）', '减少久坐，每小时起立活动'],
      },
      riskFlags: ['血压连续 4 周上升', '血糖上升趋势须关注'],
      assumptions: ['历史数据来自同一体检机构', '生活习惯无重大变化'],
      confidence: 0.88,
    },
    {
      department: 'qin_tian_jian',
      subtaskId: 'st_3',
      summary:
        '钦天监推演：当前轨迹下，若不干预，90 天后高血压确诊概率 34%，2 型糖尿病风险概率 18%。若立即介入（减盐 + 有氧），90 天后血压回归正常概率 72%，血糖稳定概率 85%。建议立即介入。',
      structuredOutput: {
        horizon: '90 天',
        noInterventionScenario: {
          hypertensionRisk: '34%',
          diabetesRisk: '18%',
          overallHealthScore: '下降 12 分（当前 76/100）',
        },
        interventionScenario: {
          bpNormalProbability: '72%',
          glucoseStableProbability: '85%',
          overallHealthScore: '提升 8 分（预计 84/100）',
        },
        criticalWindow: '30 天内是干预黄金期',
        topRecommendation: '立即开始减盐 + 有氧运动干预，30 天后复查血压',
      },
      riskFlags: ['90 天不干预高血压确诊概率 34%', '干预窗口30天内最优'],
      assumptions: ['基于同龄人群队列数据', '无遗传性高血压家族史纳入'],
      confidence: 0.78,
    },
  ],

  report: {
    executiveSummary: `太医院御前呈报：陛下本周体检数据解读

臣等已调度太医院主诊、钦天监推演，现呈核心研判：

本周体检关注要点（3 项）：
  · 血压 126/82mmHg — 临界偏高，过去 4 周连续上升 8%，趋势警戒
  · 空腹血糖 5.8mmol/L — 糖尿病前期临界值，需保持关注
  · 总胆固醇 5.4mmol/L — 轻微超标，饮食调整可控

好消息：BMI 24.3 正常，无明显器质性异常。整体健康评分 76/100。

钦天监推演：30 天干预窗口，血压回归正常概率 72%。建议立即开始生活方式干预。`,

    coreRecommendations: `【太医院·即时】每日减盐至 5g 以下，停止加工食品与外卖高盐饮食

【太医院·运动】每周 3 次有氧运动（快走/游泳），每次 ≥30 分钟，心率保持 120-140 次/分

【太医院·监测】在家自备血压计，每日晨起测量并记录，连续 2 周数据发给太医院复判

【钦天监·窗口】30 天干预黄金期，若 1 个月后血压仍 >130/85，建议转至专科会诊`,

    departmentConclusions: [
      {
        agentCode: 'tai_yi_yuan',
        departmentName: '太医院',
        summary: '血压临界偏高且连续上升，血糖处糖尿病前期，需立即生活方式干预',
        confidence: 0.92,
        keyPoints: ['血压 126/82 +8% 趋势', '血糖 5.8 临界', 'BMI 24.3 正常'],
      },
      {
        agentCode: 'qin_tian_jian',
        departmentName: '钦天监',
        summary: '不干预 90 天高血压概率 34%，立即干预血压正常概率 72%，30 天是黄金窗口',
        confidence: 0.78,
        keyPoints: ['不干预风险 34%', '干预后改善 72%', '30 天黄金窗口'],
      },
    ],

    riskWarnings: `发现以下 2 项健康风险，请陛下重视：
1. 【太医院】血压过去 4 周连续上升 8%，若趋势不逆转，1 年内高血压确诊概率显著升高
2. 【钦天监】血糖临界值合并血压偏高，代谢综合征前驱特征，需同步管理`,

    observatoryForecast: `钦天监健康推演（90 天窗口）：

当前轨迹（不干预）：
  T+30 天   血压可能升至 130/85，进入 1 期高血压
  T+90 天   高血压确诊概率 34%，血糖持续上升概率 22%
  健康评分  预计从 76 降至 64

干预轨迹（立即开始）：
  T+30 天   血压预计稳定，开始下降趋势
  T+90 天   血压正常概率 72%，血糖稳定概率 85%
  健康评分  预计从 76 升至 84

关键节点：30 天内为干预黄金期，超过 30 天窗口期效果递减。`,

    reviewActions: `请陛下批示以下事项：

1. 太医院研判：血压趋势最值得关注，建议立即开始减盐 + 有氧运动，把握 30 天窗口。
2. 钦天监推演：主动干预可将 90 天风险从 34% 降至 28%，值得优先执行。
3. 若准奏，太医院将在 30 天后自动触发复查提醒，对比趋势变化。
4. 若血压 1 个月内未改善，太医院将升级为专科会诊建议。`,
  },

  timeline: {
    interpretingDelay: 800,
    planningDelay: 1000,
    perDepartmentDelay: 1200,
    aggregatingDelay: 1500,
  },
};

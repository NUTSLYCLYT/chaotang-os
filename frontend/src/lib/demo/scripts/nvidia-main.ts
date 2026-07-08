/**
 * 朝堂 OS V2 · 演示剧本 #1 主线 · NVIDIA 估值研判
 *
 * 这是 DEMO-BIBLE.md §三 定义的核心 Wow Moment 主线剧本。
 * 90 秒，5 个部门多 stream 协同，全 demo 期间使用频率最高。
 *
 * 文本内容来源：docs/demo-scripts/01-nvidia-main.md（人工 polish 过）
 * 时间精度：ms 级
 * 数据真实感：6 真 4 虚（详见 markdown §七 polish 清单）
 *
 * 归属：m8-demo / src/lib/demo/scripts/
 */

import type { DemoScript } from '../demo-scripts';

export const nvidiaMainScript: DemoScript = {
  id: 'demo_nvidia_main',
  name: 'NVIDIA 估值研判（主线）',
  description: '90 秒主线 · 5 部门并行协同 · 多 Agent stream 同步演示',
  category: 'analysis',
  defaultTitle: '分析美股 NVIDIA 估值是否合理，同时扫描全球 AI 监管动态',
  defaultRawCommand:
    'NVIDIA 现在能买吗？需要看估值、政策风险、和行业拐点。',

  plan: {
    intent:
      '识别为分析-投资判断类密旨，调度 5 部协同。优先级：高（三日内决策）。策略：户部主拉数 → 锦衣卫扫风险 → 兵部对标 → 礼部观情绪 → 钦天监推未来。',
    taskType: 'analysis',
    departments: ['hu_bu', 'jin_yi_wei', 'qin_tian_jian', 'bing_bu', 'li_bu_rites'],
    aggregationStrategy: 'weighted_merge',
    escalationFlags: ['high_priority_investment_decision', 'multi_source_validation'],
    subtasks: [
      {
        id: 'st_1',
        description: '拉取 NVIDIA 近 8 季度财报与估值指标',
        assignedDepartment: 'hu_bu',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_2',
        description: '扫描全球 AI 监管 / 出口管制动态',
        assignedDepartment: 'jin_yi_wei',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_3',
        description: '对标 AMD / Google / Intel / 华为等竞品',
        assignedDepartment: 'bing_bu',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_4',
        description: '抓取散户与机构市场情绪',
        assignedDepartment: 'li_bu_rites',
        dependsOn: [],
        priority: 1,
      },
      {
        id: 'st_5',
        description: '推演未来 12 月情景树',
        assignedDepartment: 'qin_tian_jian',
        dependsOn: ['st_1', 'st_3'],
        priority: 2,
      },
    ],
  },

  departmentOutputs: [
    {
      department: 'hu_bu',
      subtaskId: 'st_1',
      summary:
        '户部研判：NVIDIA 近 8 季度营收强劲（约 $39B/季，同比 +78%），但环比增速从 +18% 降至 +12%，增速拐点已现。前向 P/E 约 38x，PEG 约 0.9，估值在贵和合理之间。数据中心业务占比 91%，单一客户依赖警戒。毛利率 75.2%。',
      structuredOutput: {
        latestRevenue: '约 $39B',
        yoy: '+78%',
        qoqGrowthDelta: '从 +18% → +12%',
        forwardPe: '约 38x',
        peg: '约 0.9',
        grossMargin: '75.2%',
        dcConcentration: '91%',
      },
      riskFlags: ['增速拐点已出现', '客户集中度过高'],
      assumptions: ['基于公开 SEC 文件', '未考虑回购影响'],
      confidence: 0.86,
    },
    {
      department: 'jin_yi_wei',
      subtaskId: 'st_2',
      summary:
        '锦衣卫情报：24h 内扫描全球 142 条相关信号。美国商务部 Q2 拟扩大 H100/H200 出口管制范围；欧盟 AI Act 二审通过；中国本土算力采购优先权 +15%；台积电 3nm 良率突破 80%，CoWoS 产能 2026 Q3 翻倍。结论：监管收紧 + 替代方案成熟 = 1-2 季度内有压力窗口。',
      structuredOutput: {
        signalsScanned: 142,
        topRegulatory: ['US export control 扩大', 'EU AI Act 加严', 'CN 本土优先 +15%'],
        supplyChainNote: 'TSMC 3nm 良率 80%, CoWoS 产能将翻倍',
      },
      riskFlags: ['出口管制升级窗口', '替代供应链成熟中'],
      assumptions: ['情报源时效 <24h'],
      confidence: 0.78,
    },
    {
      department: 'bing_bu',
      subtaskId: 'st_3',
      summary:
        '兵部对标：AMD MI300X 推理性价比追至 NVIDIA 的 70-80%；Google TPU v6 内部部署，外卖产能有限；Intel Gaudi 3 在中端市场拿下约 8% 份额；国产替代在中国市场吃下高端禁运空缺。结论：训练端护城河仍在，推理端开始失血——但 6-12 月内不构成决定性威胁。',
      structuredOutput: {
        amdInferenceCatchup: '70-80%',
        googleTpuV6: 'internal only',
        intelGaudi3Share: '~8% 中端',
        moatDurabilityMonths: '18-24',
      },
      riskFlags: ['推理端竞争加剧'],
      assumptions: ['基于公开 benchmark 数据'],
      confidence: 0.82,
    },
    {
      department: 'li_bu_rites',
      subtaskId: 'st_4',
      summary:
        '礼部市场情绪：48h 内 Reddit r/wallstreetbets 讨论量下降，看多/看空比 2.4；"NVDA bubble" 话题热度升温；Q1 末机构持仓中位数 +0.4%，但前 10 大基金净减仓；期权 put/call 比从 0.62 升至 0.88。结论：情绪在转向中性偏谨慎——典型的"涨疲了"阶段。',
      structuredOutput: {
        bullBearRatio: 2.4,
        bubbleTalkTrend: 'rising',
        institutionalFlow: 'top 10 funds reducing',
        optionsSkew: '0.62 → 0.88 (defensive)',
      },
      riskFlags: ['散户兴趣下降', '机构净流出'],
      assumptions: ['公开社交数据'],
      confidence: 0.75,
    },
    {
      department: 'qin_tian_jian',
      subtaskId: 'st_5',
      summary:
        '钦天监推演（先外后内）。【外部视角·史馆 base rate】调出史馆 9 条同类"高估值龙头分批建仓"旧案，7 条 12 月内确有 -15% 级回调窗、分批者胜过追高者（已兑现 7/9），样本厚度：中。【内部视角·这次不同】NVIDIA 数据中心占比 91%、出口管制变量比历史样本更重。【可逆性】分批建仓=双向门(错了能回头)，准度要求低；一次性满仓=单向门，本案不建议。【死法地图】最坏路径：监管+推理替代双压前发→短期 -30%(15%)，但 3 情景皆无崩盘。结论：12 月内大概率 -15% 级机会窗，分批介入。',
      structuredOutput: {
        baseRate: '史馆同类案 9 条·7 条现回调窗·已兑现 7/9·厚度中',
        scenarios: [
          { name: '平台期', probability: 0.6, payoff: '估值压力 -15% ~ -25%' },
          { name: '替代加速', probability: 0.25, payoff: '毛利率回落至 65%' },
          { name: '双压前发(死法)', probability: 0.15, payoff: '短期 -30%' },
        ],
        reversibility: '分批=双向门(推荐) / 满仓=单向门(不建议)',
        forecastBand: '±18%',
        recommendedAction: 'stage_in',
      },
      riskFlags: ['推演不等于事实', '内部视角警告:本案占比集中度高于历史样本'],
      assumptions: ['先外后内:先史馆 base rate 再判这次不同', '宏观无重大冲击'],
      confidence: 0.7,
    },
  ],

  report: {
    executiveSummary: `陛下御前呈报：NVIDIA 估值研判

【一句话】3-12 个月内有 -15% 级别的入场窗口，建议分批建仓而非一次性买入；长线护城河无明显损伤。

臣等已调度 5 部协同研议本案，现呈核心研判：
  · 户部：基本面强劲，估值合理，但增速拐点已现
  · 锦衣卫：监管收紧，1-2 季度内有政策催化的回调窗口
  · 兵部：训练端护城河稳固，推理端 6-12 月内不构成致命威胁
  · 礼部：市场情绪从亢奋转向中性偏谨慎，是"涨疲"而非"恐慌"
  · 钦天监：3 情景皆无崩盘，最大概率路径有 ~18% 波动空间`,

    coreRecommendations: `1. 当前价位不立即追高，预留 50% 仓位等回调
2. 第一档介入价位：当前价 -10%（参考钦天监情景 A 触发线）
3. 第二档：监管收紧落地后的恐慌点（锦衣卫已设警报）
4. 退出条件：若 18 个月后毛利率跌破 70%，部分获利了结
5. 对冲建议：以 NVDA / AMD 1:0.3 配比，对冲推理芯片转移风险`,

    departmentConclusions: [
      {
        agentCode: 'hu_bu',
        departmentName: '户部',
        summary: '基本面强劲，估值合理，但增速拐点已现',
        confidence: 0.86,
        keyPoints: ['营收 ~$39B/季 +78%', 'P/E ~38x', 'DC 占比 91%'],
      },
      {
        agentCode: 'jin_yi_wei',
        departmentName: '锦衣卫',
        summary: '监管收紧 + 替代方案成熟 = 1-2 季度压力窗口',
        confidence: 0.78,
        keyPoints: ['US 出口管制扩大', 'EU AI Act 加严', '替代芯片成熟'],
      },
      {
        agentCode: 'bing_bu',
        departmentName: '兵部',
        summary: '训练端护城河 18-24 月稳固，推理端开始失血',
        confidence: 0.82,
        keyPoints: ['AMD 追至 70-80%', 'Google TPU 内部用', 'Intel ~8% 中端'],
      },
      {
        agentCode: 'li_bu_rites',
        departmentName: '礼部',
        summary: '情绪从亢奋转向中性偏谨慎，"涨疲"而非"恐慌"',
        confidence: 0.75,
        keyPoints: ['散户兴趣降', '机构净流出', 'put/call 升'],
      },
      {
        agentCode: 'qin_tian_jian',
        departmentName: '钦天监',
        summary: '先外后内：史馆 9 条同类案 7 条现回调窗(已兑现7/9)；分批=双向门可回头',
        confidence: 0.7,
        keyPoints: ['史馆base rate 7/9', '分批=双向门', '死法:双压-30%(15%)'],
      },
    ],

    riskWarnings: `⚠️ 高度依赖单一应用场景（数据中心 91%）
⚠️ 出口管制升级是最大不确定性（过去 18 月已发生 3 次）
⚠️ 推理芯片市场分流速度可能快于钦天监模型预期
⚠️ 本研判基于公开信息，未纳入陛下私人持仓偏好与税务考量`,

    observatoryForecast: `12 个月内最可能路径（60% 概率）：
  T+0     当前价位
  T+1Q    监管催化 -8% ~ -12%
  T+2Q    触底回升至 -5% 区间
  T+3Q    Q3 财报指引平稳，回到当前价
  T+4Q    推理需求景气催化，+8% ~ +15%

注：推演不等于事实，仅作为决策参考。`,

    reviewActions: `请陛下批示以下事项：

1. 本案 5 部研判方向一致：分批建仓优于一次性买入
2. 若准奏，锦衣卫将持续监测政策催化点 + 钦天监设触发警报
3. 若询问，可由相关部门深掘任一细节
4. 批示后将由史官归档，并自动召回 3 条相似案例供参考`,
  },

  timeline: {
    // 总时长 ~80 秒（外加 ~10 秒口播 = 90 秒整 wow moment）
    // 严格对齐 DEMO-BIBLE §三 时间锚点
    //
    // T+0s  → T+5s    口播开场（外部）
    // T+5s  → T+10s   interpretingDelay = 5s · 丞相识别 typewriter
    // T+10s → T+15s   planningDelay = 5s · 丞相调度文本 + 5 部依次点亮
    // T+15s → T+40s   running 第一层 4 部 ≈ 25s
    // T+40s → T+55s   running 第二层 1 部（钦天监依赖前面）≈ 15s
    // T+55s → T+85s   aggregatingDelay = 30s · 报告 6 段渐次浮现
    // T+85s → T+90s   批示 + 史馆召回（外部）
    interpretingDelay: 5000,
    planningDelay: 5000,
    perDepartmentDelay: 12000, // 每层 ≈ 13-14s（含 stagger + 进度推进 + 收尾）
    aggregatingDelay: 30000,   // 报告 6 段渐次浮现，给观众阅读时间
  },
};

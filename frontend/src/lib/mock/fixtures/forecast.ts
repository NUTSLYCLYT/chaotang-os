import type { ForecastScenario } from '@/types/forecast'

export const mockForecastScenarios: ForecastScenario[] = [
  {
    id: 'sc_optimistic',
    name: 'optimistic',
    label: '乐观情景',
    probability: 0.28,
    confidence: 0.62,
    timeframe: { start: '2026-04-01', end: '2027-12-31' },
    payoffDescription: '+52% 增长，Q4 抢跑窗口打满',
    riskWindows: [
      { id: 'rw_o1', period: '2026 Q4', opportunity: '政策红利窗口期打开', urgency: 'high' },
      { id: 'rw_o2', period: '2027 Q2', opportunity: 'AI 技术采纳跨越早期', urgency: 'medium' },
    ],
    triggerConditions: [
      { id: 'tc_o1', description: '美联储年底暂缓加息', probability: 0.55, source: 'WSJ / 美联储点阵图' },
      { id: 'tc_o2', description: '欧盟 AI Act 宽松细则落地', probability: 0.42, source: '欧盟委员会公告' },
      { id: 'tc_o3', description: '国内消费回暖', probability: 0.6, source: '统计局 CPI 数据' },
    ],
    preActions: [
      '2026 Q3 提前组建 6 人交付小队',
      '锁定核心供应商 3 年长协',
      '预留品牌营销预算 ¥3000 万',
      '启动海外本地化团队搭建',
    ],
    evidenceIds: ['signal_002', 'signal_006'],
  },
  {
    id: 'sc_base',
    name: 'base',
    label: '基准情景',
    probability: 0.5,
    confidence: 0.75,
    timeframe: { start: '2026-04-01', end: '2027-12-31' },
    payoffDescription: '+22% 稳健增长',
    riskWindows: [
      { id: 'rw_b1', period: '2026 Q4', opportunity: '行业拐点临近', urgency: 'medium' },
      { id: 'rw_b2', period: '2027 Q3', opportunity: '增量市场出清', urgency: 'low' },
    ],
    triggerConditions: [
      { id: 'tc_b1', description: '宏观环境维持现状', probability: 0.7, source: '国家统计局' },
      { id: 'tc_b2', description: '行业 CR3 缓慢上升', probability: 0.65, source: 'IDC 报告' },
    ],
    preActions: [
      '按既定节奏 12 周交付 MVP',
      '双渠道营销预算控制在 ¥2000 万',
      '与 Top 3 供应商重新议价',
      '季度复盘调整策略',
    ],
    evidenceIds: ['signal_001', 'signal_003'],
  },
  {
    id: 'sc_pessimistic',
    name: 'pessimistic',
    label: '悲观情景',
    probability: 0.22,
    confidence: 0.58,
    timeframe: { start: '2026-04-01', end: '2027-12-31' },
    payoffDescription: '-8% 微跌，行业进入收缩周期',
    riskWindows: [
      { id: 'rw_p1', period: '2026 Q4', opportunity: '防御性收缩窗口', urgency: 'high' },
      { id: 'rw_p2', period: '2027 Q2', opportunity: '底部吸筹机会', urgency: 'medium' },
    ],
    triggerConditions: [
      { id: 'tc_p1', description: '美联储延续加息', probability: 0.3, source: 'WSJ' },
      { id: 'tc_p2', description: '地缘冲突升级', probability: 0.25, source: '路透社' },
      { id: 'tc_p3', description: '欧盟合规大幅收紧', probability: 0.35, source: '欧盟官网' },
    ],
    preActions: [
      '冻结非核心岗位招聘',
      '压缩营销预算 50%',
      '延迟非关键产品线',
      '保留 6 个月现金流',
      '建立快速撤退预案',
    ],
    evidenceIds: ['signal_001', 'signal_005', 'signal_011'],
  },
]

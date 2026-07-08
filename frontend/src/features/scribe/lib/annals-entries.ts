/**
 * 史馆 · 大事记数据
 *
 * 每条条目 = 一根竹简（可点击）
 */

export type AnnalsOutcome = 'success' | 'mixed' | 'failure';

export interface AnnalsEntry {
  id: string;
  dateLabel: string;          // "庆元三年" / "2026 · Q1"
  dateRaw: string;            // ISO for sort
  title: string;              // 4-6 字，展示在竹简上（竖排）
  category: '治理' | '执行' | '战略' | '巡察' | '宣发';
  outcome: AnnalsOutcome;
  summary: string;            // 一句话
  detail: string;             // 2-3 句详述
  lessons: string[];          // 3-4 条教训
  tags: string[];
  /** 相关专家/部门 */
  relatedDepartments: string[];
}

export const OUTCOME_META: Record<AnnalsOutcome, { color: string; label: string; glyph: string }> = {
  success: { color: '#3DD68C', label: '成', glyph: '成' },
  mixed:   { color: '#F0C66A', label: '混', glyph: '参' },
  failure: { color: '#F43F5E', label: '败', glyph: '败' },
};

export const ANNALS_ENTRIES: AnnalsEntry[] = [
  {
    id: 'a1',
    dateLabel: '2026 · Q1',
    dateRaw: '2026-03-12',
    title: '并购案拿下',
    category: '战略',
    outcome: 'success',
    summary: '跨境并购案以 1.42× 估值上限成交 · 提前两周锁定标的',
    detail: '户部 + 兵部 + 法衡三路并进，对标的 EBITDA 模型 + 竞对施压同步推进，最终在预算上限内拿下。关键是锦衣卫提前 14 天捕捉到对手流动性变化。',
    lessons: [
      '情报先行：锦衣卫信号触发 → 14 天内完成尽调',
      '法衡同步：评估期就介入合规，不留尾巴',
      '对手流动性监控比标的估值模型更关键',
    ],
    tags: ['M&A', '跨境', '估值'],
    relatedDepartments: ['户部', '兵部', '法衡台', '锦衣卫'],
  },
  {
    id: 'a2',
    dateLabel: '2026 · Q1',
    dateRaw: '2026-02-20',
    title: '大会营销翻',
    category: '宣发',
    outcome: 'failure',
    summary: '发布会宣发节奏断档 · ROI 为负 18%',
    detail: '礼部未与工部同步产品 Demo 节点，视频素材跳票 6 小时，错过主流媒体次日黄金版面。',
    lessons: [
      '宣发节奏必须与产品版本严格挂钩',
      '视频素材 D-3 冻结，不临时改',
      '媒体关系要有 B 计划（备用刊号）',
    ],
    tags: ['宣发', '发布会', '素材'],
    relatedDepartments: ['礼部', '工部'],
  },
  {
    id: 'a3',
    dateLabel: '2026 · Q1',
    dateRaw: '2026-01-30',
    title: '裁员稳过渡',
    category: '治理',
    outcome: 'mixed',
    summary: '10% 精简完成 · 士气下降但绩效未掉',
    detail: '吏部主导分层评估 + 法衡合规复核，三周内完成。士气调研显示留任员工信心下滑 12%，但核心交付 KPI 持平。',
    lessons: [
      '分层评估 + 法衡合规双签最稳',
      '留任员工沟通要提前 2 周准备话术',
      '绩效监测要持续 3 个月才算真过渡',
    ],
    tags: ['组织', 'HR', '合规'],
    relatedDepartments: ['吏部', '法衡台', '监察台'],
  },
  {
    id: 'a4',
    dateLabel: '2025 · Q4',
    dateRaw: '2025-12-05',
    title: '数据中心火',
    category: '执行',
    outcome: 'failure',
    summary: '主机房电力故障 · 服务中断 42 分钟',
    detail: '工部 SRE 响应及时，但缺少跨 AZ 热切演练，手动切换延迟 22 分钟。事后复盘 + 双活改造立项。',
    lessons: [
      '跨 AZ 切换必须每季度实战演练',
      '监控报警路径要有 3 条独立链路',
      '故障复盘 72 小时内必须出改进项',
    ],
    tags: ['SRE', '可用性', '灾备'],
    relatedDepartments: ['工部', '军务台'],
  },
  {
    id: 'a5',
    dateLabel: '2025 · Q3',
    dateRaw: '2025-09-18',
    title: '新市开疆',
    category: '战略',
    outcome: 'success',
    summary: '东南亚市场进入 · Q4 首单 ARR ¥ 840 万',
    detail: '外交台 + 远洋台 + 度支联合推进，选定越南 + 印尼双头进入，获当地合规与渠道背书。',
    lessons: [
      '双头进入分散风险（单点失败可止损）',
      '合规背书比渠道更重要（先拿许可）',
      '第一单优先选战略客户而非最高价',
    ],
    tags: ['出海', '东南亚'],
    relatedDepartments: ['外交台', '远洋台', '度支台'],
  },
  {
    id: 'a6',
    dateLabel: '2025 · Q3',
    dateRaw: '2025-08-22',
    title: '合规过堂',
    category: '巡察',
    outcome: 'mixed',
    summary: '年度审计发现 3 项中等违规 · 全部 30 日内整改',
    detail: '监察台主动发起 → 法衡台协同取证 → 刑部出罚则。整改完成度 100% 但罚款支出 ¥ 120 万。',
    lessons: [
      '主动审计胜于被动触发',
      '整改窗口严控 30 日内',
      '罚款不是终点 · 流程重构才是',
    ],
    tags: ['审计', '合规'],
    relatedDepartments: ['监察台', '法衡台', '刑部'],
  },
  {
    id: 'a7',
    dateLabel: '2025 · Q2',
    dateRaw: '2025-06-10',
    title: '战略撤退',
    category: '战略',
    outcome: 'success',
    summary: '抽身非核心业务 · 止损 ¥ 3,200 万',
    detail: '前兆是 Q1 毛利持续下滑，丞相台定调撤退。外交台处理客户关系，度支处置资产，耗时 45 天。',
    lessons: [
      '战略撤退要有明确触发条件（毛利线）',
      '客户关系优先处理，保留品牌口碑',
      '撤退期 KPI 改为"降损速度"而非增长',
    ],
    tags: ['战略', '止损'],
    relatedDepartments: ['外交台', '度支台'],
  },
  {
    id: 'a8',
    dateLabel: '2025 · Q2',
    dateRaw: '2025-05-08',
    title: '产品大升级',
    category: '执行',
    outcome: 'success',
    summary: '核心产品 v3.0 如期发布 · NPS +14',
    detail: '工部主导 6 周冲刺，礼部同步预热，外交台提前收集 KA 反馈。发布后 30 天 NPS 上升 14 点。',
    lessons: [
      '工程节奏 + 宣发节奏 + 客户预期三同步',
      '提前找 KA 试用比内部测试更能暴露问题',
      'NPS 波动 +14 表明赢得客户信任',
    ],
    tags: ['产品', '发布'],
    relatedDepartments: ['工部', '礼部', '外交台'],
  },
  {
    id: 'a9',
    dateLabel: '2025 · Q1',
    dateRaw: '2025-03-14',
    title: '预算翻倍案',
    category: '治理',
    outcome: 'mixed',
    summary: 'AI 预算拟翻倍 · 三省审议后削减 30%',
    detail: '中书起草方案，门下复核发现 ROI 模型过乐观，尚书最终裁断按 70% 执行并分阶段释放。',
    lessons: [
      '三省复核能有效识别乐观偏误',
      '大额预算分阶段释放 + 里程碑验收',
      'ROI 模型必须 3 人独立复核',
    ],
    tags: ['预算', '治理'],
    relatedDepartments: ['三省', '度支台'],
  },
  {
    id: 'a10',
    dateLabel: '2024 · Q4',
    dateRaw: '2024-12-28',
    title: '年终战役胜',
    category: '执行',
    outcome: 'success',
    summary: '年终销售冲刺 · 超额完成 12%',
    detail: '外交台主攻 + 礼部造势 + 度支让利弹药充足。最后 2 周单周销售破历史记录。',
    lessons: [
      '最后 2 周要有"尾盘弹药"',
      '造势必须提前 45 天启动',
      '让利要有明确上限和时间表',
    ],
    tags: ['销售', '年终'],
    relatedDepartments: ['外交台', '礼部', '度支台'],
  },
  {
    id: 'a11',
    dateLabel: '2024 · Q4',
    dateRaw: '2024-11-15',
    title: '品牌危机战',
    category: '宣发',
    outcome: 'mixed',
    summary: '舆情危机 48 小时控场 · 品牌指数跌 18% 回到 -6%',
    detail: '社交媒体突发争议，礼部 2 小时内出声明，法衡台同步评估风险，72 小时后指数反弹大半。',
    lessons: [
      '舆情响应必须 2 小时内有官方声明',
      '声明要承认 + 行动 + 跟进三段式',
      '与法衡台同步评估避免次生',
    ],
    tags: ['舆情', '危机'],
    relatedDepartments: ['礼部', '法衡台'],
  },
  {
    id: 'a12',
    dateLabel: '2024 · Q3',
    dateRaw: '2024-08-05',
    title: '供应链大考',
    category: '执行',
    outcome: 'failure',
    summary: '关键芯片断供 · Q3 交付延迟 3 周 · 违约金 ¥ 680 万',
    detail: '远洋台过度依赖单一供应商，突发出口管制后无 B 计划。事后建立双源 + 战略储备。',
    lessons: [
      '关键物料必须 ≥ 2 家供应商',
      '战略储备至少 90 天安全线',
      '地缘监控是供应链的第一防线',
    ],
    tags: ['供应链', '断供'],
    relatedDepartments: ['远洋台', '军务台'],
  },
];

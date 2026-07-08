/**
 * 礼部 · 类型契约
 *
 * 品牌传播与客户增长部门的实体类型定义。
 * 第一阶段用种子数据，后续接入 Turso。
 */

/* ── 战役实体 ── */

export type RitesCampaignStatus =
  | 'drafting'
  | 'scheduled'
  | 'in_progress'
  | 'published'
  | 'blocked';

export const RITES_CAMPAIGN_STATUS_LABEL: Record<RitesCampaignStatus, string> = {
  drafting: '草稿',
  scheduled: '待发',
  in_progress: '进行中',
  published: '已发布',
  blocked: '阻塞',
};

export type RitesTone = 'green' | 'amber' | 'red';

export interface RitesCampaign {
  id: string;
  title: string;
  channel: string;
  status: RitesCampaignStatus;
  startDate: string;
  tone: RitesTone;
  detail: string;
  /** 阻塞的依赖部门/资源 */
  dependencies: string[];
}

/* ── 品牌健康总览 ── */

export interface RitesBrandHealth {
  brandHealth: number; // 0-100
  weeklyVolume: number; // 声量（万）
  leadConversion: number; // 线索转化（家）
  sentimentRisk: number; // 舆情风险条数
  contentHitRate: number; // 内容命中率
  recommendation: string;
  generatedAt: string;
  source: 'seed' | 'turso' | 'fallback';
}

/* ── 汇总 ── */

export interface RitesOverview {
  brandHealth: RitesBrandHealth;
  campaigns: RitesCampaign[];
}

/* ── 舆情主题 ── */

export interface RitesSentimentItem {
  id: string;
  topic: string;
  riskLevel: 'low' | 'medium' | 'high';
  detail: string;
  responseTemplate?: string;
}

/* ═══════════ 种子数据 ═══════════ */

export const SEED_CAMPAIGNS: RitesCampaign[] = [
  {
    id: 'camp-xiaohongshu-warmup',
    title: '小红书种草预热',
    channel: '小红书',
    status: 'in_progress',
    startDate: '2026-06-20',
    tone: 'green',
    detail: '21 天种草节奏，覆盖护肤/穿搭/轻奢 3 个垂类，KOL 合作 18 位。',
    dependencies: ['工部 · 产品 Demo 截图', 'CEO 公开信定稿'],
  },
  {
    id: 'camp-tiktok-video',
    title: '抖音短视频战役',
    channel: '抖音',
    status: 'blocked',
    startDate: '2026-06-28',
    tone: 'amber',
    detail: '15s 短视频 8 条，主打「专业 × 轻奢 × 懂你」主张。素材依赖工部截图。',
    dependencies: ['工部 · Demo 截图'],
  },
  {
    id: 'camp-official-launch',
    title: '官网新品发布',
    channel: '官网',
    status: 'drafting',
    startDate: '2026-07-10',
    tone: 'amber',
    detail: 'CEO 公开信 + 产品页 + FAQ 页面。待 CEO 定稿。',
    dependencies: ['CEO 公开信', '礼部口径定稿'],
  },
  {
    id: 'camp-wechat-ka',
    title: 'KA 客户微信触达',
    channel: '微信',
    status: 'scheduled',
    startDate: '2026-07-05',
    tone: 'green',
    detail: '高意向 KA 客户 42 家，个性化触达消息 + 预约演示链路。',
    dependencies: [],
  },
  {
    id: 'camp-linkedin-b2b',
    title: 'LinkedIn B2B 品牌',
    channel: 'LinkedIn',
    status: 'published',
    startDate: '2026-06-01',
    tone: 'green',
    detail: '英文品牌主张 + 技术博客 3 篇，覆盖海外技术决策者。',
    dependencies: [],
  },
  {
    id: 'camp-overseas-qa',
    title: '海外评论区回应',
    channel: '多平台',
    status: 'in_progress',
    startDate: '2026-06-18',
    tone: 'red',
    detail: '海外评论区集中质疑回应模板 + 危机口径。需舆情响应官跟进。',
    dependencies: ['舆情响应官 · 回应模板', '法务审核'],
  },
];

export const SEED_BRAND_HEALTH: RitesBrandHealth = {
  brandHealth: 87,
  weeklyVolume: 320,
  leadConversion: 268,
  sentimentRisk: 2,
  contentHitRate: 76,
  recommendation:
    '品牌健康总体良好，海外评论区集中质疑是当前最大风险点。建议在抖音战役上线前先完成舆情回应口径定稿，避免负面主题扩散。',
  generatedAt: new Date().toISOString(),
  source: 'seed',
};

export const SEED_SENTIMENT: RitesSentimentItem[] = [
  {
    id: 'sent-overseas-doubt',
    topic: '海外评论区集中质疑',
    riskLevel: 'high',
    detail: 'Reddit 与 Twitter 出现多篇质疑定价与数据安全的帖子，尚未形成媒体扩散。',
    responseTemplate: '我们理解社区的关切... [需法务审核后补充]',
  },
  {
    id: 'sent-competitor-launch',
    topic: '竞品新品发布对标',
    riskLevel: 'medium',
    detail: '竞品 A 于 6/12 发布新版，功能列表有 3 项与我们的「差异化」重叠。',
  },
  {
    id: 'sent-pricing-leak',
    topic: '定价泄露讨论',
    riskLevel: 'low',
    detail: '行业内群聊出现定价猜测，误差约 15%，暂未扩散。',
  },
];

export const RITES_OVERVIEW: RitesOverview = {
  brandHealth: SEED_BRAND_HEALTH,
  campaigns: SEED_CAMPAIGNS,
};

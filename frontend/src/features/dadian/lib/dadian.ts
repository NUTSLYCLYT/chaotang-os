/**
 * 朝堂 OS · 大殿页面数据（按 02-dadian 设计稿还原）
 */

// —— 顶部导航 ——
export const NAV_ITEMS = [
  "上书房",
  "大殿",
  "户部",
  "兵部",
  "太医",
  "军机处",
  "锦衣卫",
  "史馆",
  "庄园",
] as const;

export const NAV_ACTIVE = "大殿";

// —— 左侧「朝堂脉搏」指标 ——
export type Trend = "up" | "warn";
export interface PulseMetric {
  label: string;
  value: number;
  unit: string;
  delta: string;
  trend: Trend;
}

// 设计图 02-dadian.png 左侧「朝堂脉搏」4 卡静态值(真实数据缺失时的回落基准,保持版式)
export const PULSE_METRICS: PulseMetric[] = [
  { label: "任务总数", value: 236, unit: "项", delta: "较昨日 +18%", trend: "up" },
  { label: "风险预警", value: 7, unit: "项", delta: "较昨日 +2", trend: "warn" },
  { label: "机遇发现", value: 12, unit: "项", delta: "较昨日 +3", trend: "up" },
  { label: "活跃智囊", value: 128, unit: "个", delta: "较昨日 +16%", trend: "up" },
];

// —— 中央标题 ——
export const HERO = {
  title: "大殿",
  subtitle: "企业AI指挥中枢 · 万务一统",
};

// —— 右侧「下旨」面板 ——
export const TONES = ["常规", "郑重", "严厉", "宽和"] as const;
export const SECRECY = ["公开", "内阁", "密", "机要"] as const;

export const QUICK_SUMMONS = [
  "全体六部",
  "重点会审",
  "紧急商议",
  "专项小组",
  "AI 智囊团",
  "自定义召集",
];

// —— 最新动态 ——
export interface FeedItem {
  depts: string[];
  title: string;
  status: "执行中" | "待审" | "已结";
  time: string;
}

export const FEED: FeedItem[] = [
  {
    depts: ["兵部", "工部"],
    title: "边境防御强化方案",
    status: "执行中",
    time: "10分钟前",
  },
  {
    depts: ["锦衣卫"],
    title: "天象异动分析报告",
    status: "执行中",
    time: "10分钟前",
  },
];

// —— 顶栏右侧时辰 ——
export const REALM_DATE = "2026年 甲辰年 五月初八 巳时";
export const NOTIF_COUNT = 12;

// —— 底部 ——
export const BOTTOM_NOTICE = "史部有新奏章提交，已自动归类待审";

// —— 大殿中央百官点击热区（坐标为占画面的百分比，对准底图人物） ——
export interface Hotspot {
  id: string;
  name: string;
  post: string;
  status: string;
  tone: "green" | "amber" | "blue" | "violet";
  href: string;
  cx: number; // 头顶名牌中心 X（占画面百分比）
  cy: number; // 头顶名牌中心 Y
}

export const MINISTER_HOTSPOTS: Hotspot[] = [
  { id: "gongbu", name: "工部", post: "营造 · 修缮 · 基建", status: "运行中", tone: "green", href: "/departments/gongbu", cx: 21.7, cy: 38.6 },
  { id: "hubu", name: "户部", post: "财政 · 度支 · 资源", status: "报筹中", tone: "amber", href: "/departments/finance", cx: 30.0, cy: 30.4 },
  { id: "shibu", name: "史部", post: "考绩 · 任免 · 文档", status: "运行中", tone: "green", href: "/archive", cx: 34.1, cy: 23.6 },
  { id: "libu", name: "礼部", post: "礼仪 · 公文 · 对外", status: "运行中", tone: "green", href: "/departments/market", cx: 41.6, cy: 26.5 },
  { id: "prime", name: "丞相", post: "总揽 · 会辅 · 裁断", status: "会辅中", tone: "amber", href: "/prime", cx: 50.7, cy: 28.6 },
  { id: "bingbu", name: "兵部", post: "戍卫 · 情势 · 边务", status: "运行中", tone: "green", href: "/departments/ops", cx: 60.7, cy: 26.5 },
  { id: "jinyiwei", name: "锦衣卫", post: "情报 · 侦缉 · 暗访", status: "待命", tone: "blue", href: "/departments", cx: 68.3, cy: 23.6 },
  { id: "qintianjian", name: "钦天监", post: "天象 · 历法 · 预测", status: "已上奏", tone: "violet", href: "/forecast", cx: 73.1, cy: 30.4 },
  { id: "shiguan", name: "史馆", post: "史料 · 起居注 · 典藏", status: "已上奏", tone: "blue", href: "/archive", cx: 79.5, cy: 38.6 },
];

// 官署子页面信息（中央人物热区部门 + 顶部导航部门）
export const BU_INFO: Record<string, { name: string; post: string }> = {
  gongbu: { name: "工部", post: "营造 · 修缮 · 基建" },
  hubu: { name: "户部", post: "财政 · 度支 · 资源" },
  shibu: { name: "史部", post: "考绩 · 任免 · 文档" },
  libu: { name: "礼部", post: "礼仪 · 公文 · 对外" },
  bingbu: { name: "兵部", post: "戍卫 · 情势 · 边务" },
  qintianjian: { name: "钦天监", post: "天象 · 历法 · 预测" },
  jinyiwei: { name: "锦衣卫", post: "情报 · 侦缉 · 暗访" },
  shiguan: { name: "史馆", post: "史料 · 起居注 · 典藏" },
  taiyi: { name: "太医", post: "诊断 · 调摄 · 圣躬" },
  junjichu: { name: "军机处", post: "机要 · 决策 · 调度" },
  zhuangyuan: { name: "庄园", post: "属地 · 产业 · 庶务" },
};

// 顶部导航跳转映射（中文名 → 路由）
export const NAV_HREF: Record<string, string> = {
  大殿: "/",
  上书房: "/shangshufang",
  户部: "/bu/hubu",
  兵部: "/bu/departments/ops",
  太医: "/bu/taiyi",
  军机处: "/bu/junjichu",
  锦衣卫: "/bu/jinyiwei",
  史馆: "/bu/shiguan",
  庄园: "/bu/zhuangyuan",
};

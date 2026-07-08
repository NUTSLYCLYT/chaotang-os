/**
 * 朝堂 OS V2 · 路由注册表
 *
 * 单一事实来源：所有导航、面包屑、页面标题、侧栏链接都从这里读取
 * 修改路由必须同时改这里 + app/(dashboard)/* 实际目录
 */

export type RoutePriority = 'P0' | 'P1' | 'P2';

/**
 * 真实功能档位（决定 SideNav 显示分组 + v0/v1 标记）
 *
 * green   后端真能跑, 用户随便点
 * yellow  后端有, 稳定性 / 样本量不足, 演示为主
 * red     后端基建空 / 无对应 agent, mock 演示
 * geek    极客后台, SideNav 不显示, URL 直访彩蛋 (/jiqun/*)
 */
export type RouteTier = 'green' | 'yellow' | 'red' | 'geek';

export interface RouteDef {
  /** 路由路径（App Router 完整路径，不含 route group） */
  path: string;
  /** 中文显示名 */
  label: string;
  /** 英文副标 */
  sublabel: string;
  /** 一句话介绍（tooltip / meta） */
  description: string;
  /** lucide 图标名（由 SideNav 映射成组件） */
  icon: string;
  /** 优先级 */
  priority: RoutePriority;
  /** 是否在侧栏显示 */
  showInNav: boolean;
  /** 是否已实装（false 时侧栏置灰） */
  implemented: boolean;
  /** 功能档位（小白默认看 green, "陛下也可巡视"看 yellow, 占位看 red, 极客 URL 直访 geek） */
  tier?: RouteTier;
}

export const ROUTES = {
  // ── 9 个 PRD 模块(showInNav:true,按 PRD 导航序) ────────────────────────
  COURT_BRIEFING: {
    path: '/court-briefing',
    label: '上书房',
    sublabel: 'Court Briefing',
    description: '朝堂导览 · 30 秒读懂全局 · 待裁决奏折',
    icon: 'BookOpen',
    priority: 'P0',
    showInNav: true,
    implemented: true,
    tier: 'green' as const,
  },
  OVERVIEW: {
    path: '/overview',
    label: '大殿',
    sublabel: 'Throne Hall',
    description: '陛下登朝 · 群臣排班 · 丞相参政',
    icon: 'Crown',
    priority: 'P0',
    showInNav: true,
    implemented: true,
    tier: 'green' as const,
  },
  MANOR_FINANCE: {
    path: '/departments/finance',
    label: '户部',
    sublabel: 'Revenue',
    description: '财政流向 · 预算执行 · 关键指标',
    icon: 'Building2',
    priority: 'P0',
    showInNav: false,
    implemented: true,
    tier: 'yellow' as const,
  },
  MANOR_OPS: {
    path: '/departments/ops',
    label: '兵部',
    sublabel: 'Operations',
    description: '作战调度 · 战局总览 · 资源占用',
    icon: 'Shield',
    priority: 'P0',
    showInNav: false,
    implemented: true,
    tier: 'yellow' as const,
  },
  MANOR_PHYSICIAN: {
    path: '/departments/physician',
    label: '太医院',
    sublabel: 'Physician',
    description: '御诊总览 · 健康风控 · 团队执行',
    icon: 'Heart',
    priority: 'P0',
    showInNav: false,
    implemented: false,
    tier: 'yellow' as const,
  },
  COMMAND_CENTER: {
    path: '/command-center',
    label: '军机处',
    sublabel: 'Grand Secretariat',
    description: '丞相定调 · 起 flow · 推送决策 · 一句话发起',
    icon: 'Command',
    priority: 'P0',
    showInNav: true,
    implemented: true,
    tier: 'yellow' as const,
  },
  MANOR_GUARD: {
    path: '/departments/guard',
    label: '锦衣卫',
    sublabel: 'Imperial Guard',
    description: '全球情报雷达 · 风险预警 · 异常事件',
    icon: 'Globe',
    priority: 'P0',
    showInNav: false,
    implemented: false,
    tier: 'yellow' as const,
  },
  ARCHIVE: {
    path: '/archive',
    label: '史馆',
    sublabel: 'Archive',
    description: '奏折归档 · 批阅结果 · 复盘记录',
    icon: 'Archive',
    priority: 'P0',
    showInNav: true,
    implemented: true,
    tier: 'green' as const,
  },
  MANORS: {
    path: '/manors',
    label: '庄园',
    sublabel: 'Manors',
    description: '庄园经营地图 · 商机田 · AI 建议',
    icon: 'Building2',
    priority: 'P0',
    showInNav: true,
    implemented: true,
    tier: 'yellow' as const,
  },
  // ── 以下路由仍可 URL 直达,但不显示在侧栏 ──────────────────────────────────
  // 注：/study 已合并进 /court-briefing（仅 307 重定向，见 (dashboard)/study/page.tsx），
  // 原 STUDY 注册项（「私召·一句话直答」差异化体验从未落地）已随合一删除，避免漂移谎报。
  REPORTS: {
    path: '/reports',
    label: '礼部 · 战报库',
    sublabel: 'Report Library',
    description: '玉玺落印 · 千载文章 · 高管摘要 · 战略报告',
    icon: 'FileText',
    priority: 'P0',
    showInNav: false,
    implemented: true,
    tier: 'green' as const,
  },
  SCRIBE: {
    path: '/scribe',
    label: '史馆 · 复盘',
    sublabel: 'Scribe Desk',
    description: '史官修史 · 个案复盘 · 相似召回 · 朝廷记忆',
    icon: 'ScrollText',
    priority: 'P1',
    showInNav: false,
    implemented: true,
    tier: 'green' as const,
  },
  DEMO: {
    path: '/demo',
    label: '路演控制台',
    sublabel: 'Demo Console',
    description: 'Demo Playground · 预录剧本 · 一键播放',
    icon: 'Presentation',
    priority: 'P0',
    showInNav: false,
    implemented: true,
    tier: 'green' as const,
  },
  SETTINGS: {
    path: '/settings',
    label: '设置中心',
    sublabel: 'Settings',
    description: '主题 · 账户 · 数据源 · 专家模式',
    icon: 'Settings',
    priority: 'P2',
    showInNav: false,
    implemented: true,
    tier: 'green' as const,
  },
  GOVERNANCE: {
    path: '/governance',
    label: '三省审议台',
    sublabel: 'Three Chancelleries',
    description: '中书起草 · 门下复核 · 尚书下发 · 9 步朝议',
    icon: 'Shield',
    priority: 'P0',
    showInNav: false,
    implemented: true,
    tier: 'yellow' as const,
  },
  GRAND_COUNCIL: {
    path: '/command-center?view=council',
    label: '大朝会',
    sublabel: 'Grand Council',
    description: '全局冲突 · 跨蜂群协作 · 待办裁断 · 等待链路',
    icon: 'Users',
    priority: 'P0',
    showInNav: false,
    implemented: true,
    tier: 'yellow' as const,
  },
  HANLIN: {
    path: '/hanlin',
    label: '翰林院',
    sublabel: 'Hanlin Academy',
    description: '翰林起草诏书 · AI 洞察推荐 · 实验孵化 · 对外建言',
    icon: 'Feather',
    priority: 'P1',
    showInNav: false,
    implemented: true,
    tier: 'yellow' as const,
  },
  DEPARTMENTS: {
    path: '/departments',
    label: '群臣与官署',
    sublabel: 'Ministers & Offices',
    description: '六部总览与详情入口',
    icon: 'Building2',
    priority: 'P0',
    showInNav: true,
    implemented: true,
    tier: 'yellow' as const,
  },
  INTEL: {
    path: '/intel',
    label: '锦衣卫 · 情报',
    sublabel: 'Jinyiwei Intel',
    description: '锦衣卫夜巡 · 最新异动 · 机会与风险雷达',
    icon: 'Globe',
    priority: 'P0',
    showInNav: false,
    implemented: true,
    tier: 'red' as const,
  },
  HEALTH: {
    path: '/health',
    label: '太医院',
    sublabel: 'Imperial Infirmary',
    description: '系统健康 · run 失败率 · 干预计划',
    icon: 'Heart',
    priority: 'P0',
    showInNav: false,
    implemented: true,
    tier: 'red' as const,
  },
  FORECAST: {
    path: '/forecast',
    label: '钦天监 · 观天台',
    sublabel: 'Astronomical Observatory',
    description: '钦天监观星 · 趋势推演 · 风险窗口 · 时机判断',
    icon: 'Telescope',
    priority: 'P1',
    showInNav: false,
    implemented: true,
    tier: 'red' as const,
  },
  LIBU: {
    path: '/libu',
    label: '御书房 · 卷宗',
    sublabel: 'Imperial Library',
    description: '陛下个人知识库 · 卷宗上传 · RAG 检索',
    icon: 'BookOpen',
    priority: 'P1',
    showInNav: false,
    implemented: true,
    tier: 'red' as const,
  },
  SHIGUAN: {
    path: '/shiguan',
    label: '太史馆 · 归档',
    sublabel: '太史馆',
    description: '太史令 · 长期归档 · 模式学习 · 蜂群自学',
    icon: 'Archive',
    priority: 'P1',
    showInNav: false,
    implemented: true,
    tier: 'red' as const,
  },
} as const satisfies Record<string, RouteDef>;

/**
 * tier 中文标签 / 描述 / SideNav 分组顺序
 */
export const TIER_META: Record<RouteTier, { label: string; subtitle: string; tone: string }> = {
  green: {
    label: '🏛️ 大殿正堂',
    subtitle: '陛下日常听政',
    tone: '#F0C66A',
  },
  yellow: {
    label: '⚖️ 三省六部',
    subtitle: '陛下也可巡视',
    tone: '#6BA0FF',
  },
  red: {
    label: '🏗️ 待建殿宇',
    subtitle: '正在筹建中',
    tone: '#9AA3C4',
  },
  geek: {
    label: '⚙️ 开发者后台',
    subtitle: 'URL 直访彩蛋',
    tone: '#A78BFA',
  },
};

export type RouteKey = keyof typeof ROUTES;

/**
 * SideNav 显示顺序（按 tier 分组, 同 tier 内按"使用频次/重要性"排）
 * geek tier 已挂入 SideNav 第 4 组（蜂群控制台 · follow_jiqun_ui 集成 11 子页）
 *
 * 默认全部显示。设置里"专家模式"可隐藏 red tier。
 */
export const NAV_ORDER: RouteKey[] = [
  // 9 个 PRD 模块(D9 · 按 PRD 导航序)
  'OVERVIEW',
  'COURT_BRIEFING',
  'COMMAND_CENTER',
  'DEPARTMENTS',
  'ARCHIVE',
  'MANORS',
  // 以下 showInNav:false,不渲染到侧栏,但仍可 URL 直达
  'REPORTS',
  'SCRIBE',
  'DEMO',
  'SETTINGS',
  'GOVERNANCE',
  'GRAND_COUNCIL',
  'HANLIN',
  'INTEL',
  'HEALTH',
  'FORECAST',
  'LIBU',
  'SHIGUAN',
];

/** 按路径反查 route key */
export function routeKeyByPath(path: string): RouteKey | null {
  const entry = (Object.entries(ROUTES) as [RouteKey, RouteDef][]).find(
    ([, def]) => def.path === path || path.startsWith(def.path + '/'),
  );
  return entry?.[0] ?? null;
}

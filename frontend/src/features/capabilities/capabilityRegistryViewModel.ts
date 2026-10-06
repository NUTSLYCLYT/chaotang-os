import type {
  CapabilityInvocationPolicy,
  CapabilityRegistryItem,
  CapabilityRegistryProjection,
} from "../../lib/backendClient";

export interface CapabilityTile {
  label: string;
  value: string;
  hint: string;
}

export interface CapabilityDepartmentGroup {
  home: string;
  title: string;
  description: string;
  items: CapabilityRegistryItem[];
}

export interface CapabilityRegistryViewModel {
  headline: string;
  subtitle: string;
  tiles: CapabilityTile[];
  departmentGroups: CapabilityDepartmentGroup[];
  hanlinCatalog: CapabilityRegistryItem[];
  externalProviderGroups: CapabilityRegistryItem[];
}

const HOME_TITLES: Record<string, string> = {
  hanlin: "翰林院 · 公共活字",
  honglusi: "鸿胪寺 · 外部候选",
  junjichu: "军机处 · 项目编排",
  gongbu: "工部 · 工程实现",
  hubu: "户部 · 商业与预算",
  libu_hr: "吏部 · 能力考绩",
  xingbu: "刑部 · 安全合规",
  jinyiwei: "锦衣卫 · 证据情报",
  qintianjian: "钦天监 · 趋势预警",
  shiguan: "史馆 · 归档复盘",
  bingbu: "兵部 · 作战协同",
  libu_rites: "礼部 · 表达传播",
};

const HOME_DESCRIPTIONS: Record<string, string> = {
  hanlin: "沉淀 Skill、Prompt、模板、知识包和印版，复用后再晋升。",
  honglusi: "统一收口 MCP、插件、外部 API、模型和账号，默认候选、最小授权。",
  junjichu: "把复杂需求组阁成项目组，协调各部各司与蜂群。",
  gongbu: "负责真实工程、产品事实和可交付验证。",
  hubu: "负责成本、收益、报价、预算和商业风险。",
  libu_hr: "负责能力是否常驻、合并、降级或裁撤。",
  xingbu: "负责权限、安全、合规和高风险外部能力复核。",
  jinyiwei: "负责线索、来源、证据、冲突和预警。",
  qintianjian: "负责趋势推演、触发条件和预警研判。",
  shiguan: "负责归档、复盘和结果回流。",
};

const POLICY_LABELS: Record<CapabilityInvocationPolicy, string> = {
  AUTO_MATCH: "自然语言自动匹配",
  EXPLICIT_ONLY: "仅显式调用",
  PREPARE_THEN_CONFIRM: "准备后再确认",
  DISABLED: "暂不启用",
};

function groupByHome(items: CapabilityRegistryItem[]): CapabilityDepartmentGroup[] {
  const grouped = new Map<string, CapabilityRegistryItem[]>();
  for (const item of items) {
    const home = item.card.recommendedHome;
    grouped.set(home, [...(grouped.get(home) ?? []), item]);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([home, group]) => ({
      home,
      title: HOME_TITLES[home] ?? `${home} · 能力池`,
      description:
        HOME_DESCRIPTIONS[home] ?? "已登记能力，等待更多真实任务数据考绩。",
      items: group,
    }));
}

function byName(a: CapabilityRegistryItem, b: CapabilityRegistryItem): number {
  return a.card.name.localeCompare(b.card.name, "zh-CN");
}

export function invocationPolicyLabel(policy: CapabilityInvocationPolicy): string {
  return POLICY_LABELS[policy];
}

export function capabilityBadge(item: CapabilityRegistryItem): string {
  if (item.catalog) return invocationPolicyLabel(item.catalog.invocationPolicy);
  if (item.externalReview?.requiresXingbuReview) return "鸿胪寺候选 · 刑部复核";
  if (!item.card.active) return "未启用 · 零权限";
  if (item.card.authorityScore === null) return "小样本 · 暂不打权威分";
  return "已登记 · 可考绩";
}

export function buildCapabilityRegistryViewModel(
  registry: CapabilityRegistryProjection,
): CapabilityRegistryViewModel {
  const hanlinCatalog = registry.items
    .filter(
      (item) =>
        item.catalog?.origin === "personal_catalog" &&
        item.card.recommendedHome === "hanlin",
    )
    .sort(byName);
  const externalProviderGroups = registry.items
    .filter(
      (item) =>
        item.catalog?.origin === "personal_catalog" &&
        item.card.recommendedHome === "honglusi" &&
        item.card.type === "provider",
    )
    .sort(byName);

  return {
    headline: "朝堂能力总账",
    subtitle:
      "把个人 Codex 能力作为只读目录纳入翰林院和鸿胪寺；目录卡片只帮助选型，不授予运行权限。",
    tiles: [
      {
        label: "翰林院能力",
        value: String(registry.summary.catalogHanlinSkills),
        hint: "Skill、Prompt、模板与方法",
      },
      {
        label: "鸿胪寺服务组",
        value: `${registry.summary.catalogProviderGroups}/${registry.summary.catalogSnapshotProviderGroups}`,
        hint: "已投影 / 快照登记",
      },
      {
        label: "MCP 工具明细",
        value: `${registry.summary.catalogMcpTools}/${registry.summary.catalogSnapshotMcpTools}`,
        hint: "可投影 / 快照登记",
      },
      {
        label: "安全排除",
        value: String(registry.summary.catalogExcludedSupportTools),
        hint: "内部支撑工具只保留审计记录",
      },
    ],
    departmentGroups: groupByHome(registry.items),
    hanlinCatalog,
    externalProviderGroups,
  };
}

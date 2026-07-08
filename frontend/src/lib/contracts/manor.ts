import type { AgentCode } from './agent';

// =========================================================================
// 原有契约(保留,兼容现有 chaotang.manorGroups())
// =========================================================================
export interface ManorGroupDef {
  id: string; name: string; ministers: AgentCode[];
  runtime: 'spawn' | 'openclaw'; subagentCount: number; description: string;
}
export interface GroupRun {
  groupId: string; name: string; status: string;
  subagents: { id: string; task: string; status: string; summary: string }[];
  aggregateSummary: string;
}

// =========================================================================
// 商机田 6 态状态机
// =========================================================================
export type OpportunityStage = 'seed' | 'sprout' | 'grow' | 'bloom' | 'harvest' | 'wither';

export const OPPORTUNITY_STAGE_LABEL: Record<OpportunityStage, string> = {
  seed: '种子',
  sprout: '发芽',
  grow: '生长',
  bloom: '开花',
  harvest: '结果',
  wither: '枯萎',
};

export const OPPORTUNITY_STAGE_COLOR: Record<OpportunityStage, string> = {
  seed: '#9AA3C4',
  sprout: '#3DD68C',
  grow: '#6BA0FF',
  bloom: '#F0C66A',
  harvest: '#D4A84B',
  wither: '#6A7299',
};

// =========================================================================
// 庄园 overview — 字段表来源: api-contracts.md §GET /api/chaotang/manor/overview
// =========================================================================

/** 首屏脉冲统计 */
export interface PulseStat {
  totalAssets: number;
  activeOpportunities: number;
  runningProjects: number;
  supplyItems: number;
  riskCount: number;
  aiAdviceCount: number;
}

/** 执行组统计(= ManorGroupDef + 运行态) */
export type ManorGroupStat = ManorGroupDef;

/** 企业资产地图分类 [MOCK] */
export interface AssetCategory {
  key: string;
  label: string;
  count: number;
  items: string[];
}

/** 商机田漏斗摘要 · 每 stage 一项 */
export interface FunnelItem {
  stage: OpportunityStage;
  count: number;
}

/** 庄园首屏聚合 */
export interface ManorOverview {
  pulse: PulseStat;
  groups: ManorGroupStat[];
  assetCategories: AssetCategory[];   // [MOCK] 演示数据
  opportunityFunnel: FunnelItem[];
  generatedAt: string;                // ISO-8601 UTC
}

// =========================================================================
// 商机田 — api-contracts.md §GET /api/chaotang/manor/opportunities
// =========================================================================
export interface Opportunity {
  id: string;
  name: string;
  domain: string;   // 行业域:地产/能源/政府/企业AI/投融资
  stage: OpportunityStage;
  owner?: string;   // AgentCode 或人名
  value?: number;   // 万元 (CNY 1e4)
  desc?: string;
  updatedAt: string; // ISO-8601 UTC
}

// =========================================================================
// 供应链资源池 — api-contracts.md §GET /api/chaotang/manor/supply-chain
// M-1: 新增 level 字段,priceRange 字符串自带单位
// =========================================================================
export interface SupplyItem {
  model: string;
  category: string;           // LFP/NCM/LTO 等
  capacity: string;           // 如 "100Ah"
  priceRange: string;         // 字符串自带单位(cell=元/只, pack=元/Wh)
  leadTime: string;
  level: 'cell' | 'pack';    // M-1: cell=单体电芯, pack=电池包
  note?: string;
}

// =========================================================================
// AI 经营建议 — api-contracts.md §GET /api/chaotang/manor/ai-advice
// =========================================================================
export interface Advice {
  id: string;
  title: string;
  detail: string;
  source: string;     // 商机热度/供应链缺口/政策窗口/项目进度
  priority: 'high' | 'medium' | 'low';
  actionHref?: string;
}

// =========================================================================
// P0-2: 项目经营盘 — GET /api/chaotang/manor/projects
// =========================================================================
export interface ManorProject {
  id: string;
  name: string;
  department: string;
  stage: OpportunityStage;
  progressPct: number;
  status: 'active' | 'planning' | 'completed' | 'paused';
  owner: string;
  description: string;
  nextMilestone: string;
  relatedMemorials: number;
  activeTaskCount?: number;
}

export interface ProjectSuggestion {
  projectId: string;
  projectName: string;
  advice: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ManorProjectsData {
  projects: ManorProject[];
  suggestions: ProjectSuggestion[];
  generatedAt: string;
}

// =========================================================================
// P0-3: 政策/资金池 — GET /api/chaotang/manor/policy-funds
// =========================================================================
export interface PolicyFund {
  id: string;
  name: string;
  type: string;       // 政府补贴/产业基金/园区资源/税收优惠
  amount: string;
  deadline: string;
  status: string;     // 可申报/可对接/关注中/准备中
  matchScore: number; // 0-100
  description: string;
}

export interface PolicyFundsData {
  funds: PolicyFund[];
  summary: {
    totalCount: number;
    actionableCount: number;
    totalPotentialAmount: string;
  };
  generatedAt: string;
}

// =========================================================================
// D19: 蜂群集群 subagent — GET /api/chaotang/manor/groups/{groupId}/subagents
// =========================================================================

/** 单个 subagent 实例 */
export interface GroupSubagent {
  id: string;
  task: string;        // 正在干的子任务描述
  status: string;      // 如 idle / running / blocked
  summary: string;     // 最近摘要
  taskId: string;      // 关联任务 ID（用于跳 /command-center?taskId=）
  taskTitle: string;   // 关联任务标题
}

/** 功能组 subagent 聚合（端点返回） */
export interface GroupSubagents {
  groupId: string;
  groupName: string;
  ministers: AgentCode[];
  subagentMax: number;  // 最大 subagent 数
  subagents: GroupSubagent[];
}

// =========================================================================
// 庄园六部实时指标 — GET /api/court/zhuangyuan/ministry-metrics
// =========================================================================

/** 单条六部指标（从 Turso manor_metrics 表） */
export interface ManorMinistryMetric {
  label: string;
  value: string;
  delta?: string;
  deltaPositive: boolean;
  updatedAt: string;
}

/** ministry_key → 指标列表（全部六部） */
export type ManorMinistryMetricsMap = Record<string, ManorMinistryMetric[]>;

// =========================================================================
// P0-1: 快捷下旨 — POST /api/chaotang/study/quick-command
// =========================================================================
export interface QuickCommandResult {
  route: 'chancellor' | 'command_center';
  message: string;
  draft?: string;
  intent?: string;
  suggestedAction: 'ask_chancellor' | 'enter_war_room';
  recommendedCategories?: {
    label: string;
    taskType: string;
    ministers: AgentCode[];
    confidence: number;
  }[];
  category?: { label: string; taskType: string };
}

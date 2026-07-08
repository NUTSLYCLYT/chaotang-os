/**
 * 朝堂 OS · 兵部契约
 *
 * 竞品情报 · 战略攻防 · 市场态势数据结构
 * Source of Truth — 不可随意增删字段
 */

/** 竞品情报等级 */
export type CompetitorThreatLevel = 'low' | 'medium' | 'high' | 'critical';

/** 竞争策略类型 */
export type StrategyType = 'attack' | 'defense' | 'observe' | 'collaborate';

/** 单个竞品记录 */
export interface CompetitorRecord {
  id: string;
  name: string;
  /** 威胁等级 */
  threatLevel: CompetitorThreatLevel;
  /** 市场份额百分比（0-100） */
  marketSharePct: number;
  /** 核心优势 */
  strengths: string[];
  /** 已知弱点 */
  weaknesses: string[];
  /** 最新动态摘要 */
  latestMove: string;
  /** 数据来源 */
  sources: string[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** SWOT 分析条目 */
export interface SwotItem {
  text: string;
  source?: string;
}

/** SWOT 分析结构 */
export interface BingbuSwot {
  strengths: SwotItem[];
  weaknesses: SwotItem[];
  opportunities: SwotItem[];
  threats: SwotItem[];
  /** 生成时间 */
  generatedAt: string;
  /** 置信度 0-1 */
  confidence: number;
}

/** 战略建议 */
export interface StrategyRecommendation {
  id: string;
  type: StrategyType;
  title: string;
  rationale: string;
  /** 兵部判断的优先级 1-5 */
  priority: 1 | 2 | 3 | 4 | 5;
  /** 引用的情报来源 */
  citations: string[];
  createdAt: string;
}

/** 兵部运行概况（API 返回顶层结构） */
export interface BingbuOverview {
  /** 监控竞品数量 */
  totalCompetitors: number;
  /** 高威胁竞品数量 */
  highThreatCount: number;
  /** 整体市场压力指数 0-100 */
  marketPressureIndex: number;
  /** 竞品列表（最多 10 条） */
  competitors: CompetitorRecord[];
  /** 当前 SWOT 分析 */
  swot: BingbuSwot;
  /** 战略建议（最多 5 条） */
  recommendations: StrategyRecommendation[];
  /** 兵部最近任务 ID（来自 agent_runs 表） */
  recentTaskId: string | null;
  /** 数据更新时间 */
  refreshedAt: string;
}

/** API 返回信封 */
export interface BingbuApiResponse {
  success: boolean;
  data: BingbuOverview;
  error?: string;
}

/** LLM 增强查询请求 */
export interface BingbuLlmQuery {
  question: string;
  context?: {
    selectedCompetitorId?: string;
    focusArea?: 'swot' | 'strategy' | 'market' | 'general';
  };
}

/** LLM 增强响应（带引用） */
export interface BingbuLlmResponse {
  answer: string;
  citations: Array<{
    source: string;
    excerpt: string;
    url?: string;
  }>;
  confidence: number;
  suggestedActions: string[];
}

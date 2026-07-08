/**
 * 朝堂 OS · 翰林院数据契约
 *
 * 来源：src/features/hanlin/types/index.ts（提升为全局契约，SoT）
 * 作用：让外部空间（御座、军机处）可以 import 翰林院类型而无需跨 feature 引用
 */

export type {
  Contribution,
  ContributionStatus,
  AiReview,
  Recommendation,
  Experiment,
  Award,
  AwardType,
  RewardPeriod,
  ScoutedProject,
  ScoutedProjectStatus,
  UpgradeCandidate,
  ProductizedModule,
  ProductizedModuleStatus,
  ExportOffering,
  ExportOfferingType,
  HanlinSummary,
  HanlinOverview,
} from '@/features/hanlin/types';

import type { Citation } from '@/lib/rag/citation';

/** LLM 增强的翰林院洞察 */
export interface HanlinInsight {
  summary: string;
  signals: HanlinSignal[];
  recommendations: string[];
  citations: Citation[];
  confidenceScore: number;
  generatedAt: string;
}

export interface HanlinSignal {
  title: string;
  type: 'contribution' | 'scouting' | 'incubation' | 'export';
  description: string;
  priority: 'P0' | 'P1' | 'P2';
}

/** 翰林院 BottomDock 对话消息 */
export interface HanlinDockMessage {
  role: 'agent' | 'user';
  text: string;
  time: string;
  citations?: Citation[];
}

/** /api/orchestration/run SSE 事件（前端消费） */
export type HanlinOrchestrationEvent =
  | { type: 'open'; request_id: string }
  | { type: 'stage_start'; stage: string; at: string }
  | { type: 'retrieve_done'; tavilyCitations: number; precedents: number; at: string }
  | { type: 'zhongshu_done'; draft: { draft: string; citations?: Citation[] }; rounds: number; at: string }
  | { type: 'menxia_done'; review: { verdict: string; reasoning: string }; at: string }
  | { type: 'shangshu_done'; execution: Record<string, unknown>; at: string }
  | { type: 'persist_done'; decisionId: string; at: string }
  | { type: 'eof'; request_id: string }
  | { type: 'error'; message: string };

/** 翰林院 Turso 表名常量 */
export const HANLIN_TABLES = {
  contributions: 'hanlin_contributions',
  reviews: 'hanlin_ai_reviews',
  recommendations: 'hanlin_recommendations',
  experiments: 'hanlin_experiments',
  awards: 'hanlin_awards',
  rewardPeriods: 'hanlin_reward_periods',
  scoutedProjects: 'hanlin_scouted_projects',
  upgradeCandidates: 'hanlin_upgrade_candidates',
  productizedModules: 'hanlin_productized_modules',
  exportOfferings: 'hanlin_export_offerings',
} as const;

export type HanlinTableName = (typeof HANLIN_TABLES)[keyof typeof HANLIN_TABLES];

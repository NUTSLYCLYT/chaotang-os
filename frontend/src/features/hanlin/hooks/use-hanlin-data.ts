/**
 * 朝堂 OS · 翰林院 · useSWR 数据钩子
 *
 * 替代手写 useEffect + fetch + setState 模式。
 * 所有钩子走 /api/hanlin/* 后端，后端再决定从 Turso 还是 filesystem 读。
 *
 * 注意：翰林院 API 路由是 /api/hanlin/* 而非 /api/v1/*。
 * hanlinFetcher 复用 backendFetch，把浏览器会话转换为后端认可的 Bearer，
 * 避免透明 rewrite 只转发 courtos.access_token cookie 导致永久 401。
 */

'use client';

import useSWR from 'swr';

import { fetchHanlinJson } from '@/features/hanlin/lib/api';
import { normalizeHanlinSourceLabel } from '@/features/hanlin/lib/read-model';

/** 翰林院后端 fetcher（不带 /api/v1 前缀，带统一 Bearer/refresh 语义） */
async function hanlinFetcher<T>(url: string): Promise<T> {
  return fetchHanlinJson<T>(url);
}
import type {
  AiReview,
  Award,
  Contribution,
  Experiment,
  ExportOffering,
  HanlinOverview,
  HanlinSummary,
  ProductizedModule,
  Recommendation,
  RewardPeriod,
  ScoutedProject,
  UpgradeCandidate,
} from '@/features/hanlin/types';

// =========================================================================
// 翰林院首页总览
// =========================================================================

interface OverviewPayload {
  overview: HanlinOverview;
}

export function useHanlinOverview() {
  const { data, error, isLoading, mutate } = useSWR<OverviewPayload, Error>(
    '/api/hanlin/overview',
    hanlinFetcher<OverviewPayload>,
    { revalidateOnFocus: false },
  );
  return {
    overview: data?.overview ?? null,
    summary: data?.overview?.summary ?? null,
    isLoading,
    error,
    mutate,
  };
}

// =========================================================================
// 翰林院摘要（轻量）
// =========================================================================

interface SummaryPayload {
  summary: HanlinSummary;
}

export function useHanlinSummary() {
  const { data, error, isLoading, mutate } = useSWR<SummaryPayload, Error>(
    '/api/hanlin/summary',
    hanlinFetcher<SummaryPayload>,
    { revalidateOnFocus: false },
  );
  return {
    summary: data?.summary ?? null,
    isLoading,
    error,
    mutate,
  };
}

// =========================================================================
// 贡献金库
// =========================================================================

interface ContributionsPayload {
  contributions: Contribution[];
  source?: string;
}

export function useHanlinContributions() {
  const { data, error, isLoading, mutate } = useSWR<ContributionsPayload, Error>(
    '/api/hanlin/contributions',
    hanlinFetcher<ContributionsPayload>,
    { revalidateOnFocus: false },
  );
  return {
    contributions: data?.contributions ?? [],
    source: data?.source,
    isLoading,
    error,
    mutate,
  };
}

// =========================================================================
// AI 评审
// =========================================================================

interface ReviewsPayload {
  reviews: AiReview[];
}

export function useHanlinReviews() {
  const { data, error, isLoading, mutate } = useSWR<ReviewsPayload, Error>(
    '/api/hanlin/reviews',
    hanlinFetcher<ReviewsPayload>,
    { revalidateOnFocus: false },
  );
  return {
    reviews: data?.reviews ?? [],
    isLoading,
    error,
    mutate,
  };
}

// =========================================================================
// 推荐池
// =========================================================================

interface RecommendationsPayload {
  recommendations: Recommendation[];
}

export function useHanlinRecommendations() {
  const { data, error, isLoading, mutate } = useSWR<RecommendationsPayload, Error>(
    '/api/hanlin/recommendations',
    hanlinFetcher<RecommendationsPayload>,
    { revalidateOnFocus: false },
  );
  return {
    recommendations: data?.recommendations ?? [],
    isLoading,
    error,
    mutate,
  };
}

// =========================================================================
// 实验池
// =========================================================================

interface ExperimentsPayload {
  experiments: Experiment[];
  source?: unknown;
}

export function useHanlinExperiments() {
  const { data, error, isLoading, mutate } = useSWR<ExperimentsPayload, Error>(
    '/api/hanlin/experiments',
    hanlinFetcher<ExperimentsPayload>,
    { revalidateOnFocus: false },
  );
  return {
    experiments: data?.experiments ?? [],
    sourceLabel: normalizeHanlinSourceLabel(data?.source),
    isLoading,
    error,
    mutate,
  };
}

// =========================================================================
// 发奖 + 奖期
// =========================================================================

interface AwardsPayload {
  awards: Award[];
  currentRewardPeriod: RewardPeriod | null;
}

export function useHanlinAwards() {
  const { data, error, isLoading, mutate } = useSWR<AwardsPayload, Error>(
    '/api/hanlin/awards',
    hanlinFetcher<AwardsPayload>,
    { revalidateOnFocus: false },
  );
  return {
    awards: data?.awards ?? [],
    currentRewardPeriod: data?.currentRewardPeriod ?? null,
    isLoading,
    error,
    mutate,
  };
}

// =========================================================================
// 搜策司（候选项目）
// =========================================================================

interface ScoutingPayload {
  projects: ScoutedProject[];
  candidates: UpgradeCandidate[];
}

export function useHanlinScouting() {
  const { data, error, isLoading, mutate } = useSWR<ScoutingPayload, Error>(
    '/api/hanlin/scouting',
    hanlinFetcher<ScoutingPayload>,
    { revalidateOnFocus: false },
  );
  return {
    projects: data?.projects ?? [],
    candidates: data?.candidates ?? [],
    isLoading,
    error,
    mutate,
  };
}

// =========================================================================
// 修典司（模块孵化）
// =========================================================================

interface IncubationPayload {
  modules: ProductizedModule[];
}

export function useHanlinIncubation() {
  const { data, error, isLoading, mutate } = useSWR<IncubationPayload, Error>(
    '/api/hanlin/incubation',
    hanlinFetcher<IncubationPayload>,
    { revalidateOnFocus: false },
  );
  return {
    modules: data?.modules ?? [],
    isLoading,
    error,
    mutate,
  };
}

// =========================================================================
// 出海司（商品）
// =========================================================================

interface ExportOfferingsPayload {
  offerings: ExportOffering[];
}

export function useHanlinExportOfferings() {
  const { data, error, isLoading, mutate } = useSWR<ExportOfferingsPayload, Error>(
    '/api/hanlin/export-offerings',
    hanlinFetcher<ExportOfferingsPayload>,
    { revalidateOnFocus: false },
  );
  return {
    offerings: data?.offerings ?? [],
    isLoading,
    error,
    mutate,
  };
}

/**
 * 朝堂 OS · 翰林院 · useSWR 数据钩子
 *
 * 替代手写 useEffect + fetch + setState 模式。
 * 所有钩子走 /api/hanlin/* 后端，后端再决定从 Turso 还是 filesystem 读。
 *
 * 注意：翰林院 API 路由是 /api/hanlin/* 而非 /api/v1/*，
 * 因此不走 swrFetcher（它会加 BASE_PATH/api/v1 前缀），
 * 改用 hanlinFetcher 直接 fetch 同源路径。
 */

'use client';

import useSWR from 'swr';

import { hanlinApi } from '@/features/hanlin/lib/api';

/** 翰林院同源 API fetcher（不带 /api/v1 前缀） */
async function hanlinFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
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
    hanlinApi('/api/hanlin/overview'),
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
    hanlinApi('/api/hanlin/summary'),
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
    hanlinApi('/api/hanlin/contributions'),
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
    hanlinApi('/api/hanlin/reviews'),
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
    hanlinApi('/api/hanlin/recommendations'),
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
}

export function useHanlinExperiments() {
  const { data, error, isLoading, mutate } = useSWR<ExperimentsPayload, Error>(
    hanlinApi('/api/hanlin/experiments'),
    hanlinFetcher<ExperimentsPayload>,
    { revalidateOnFocus: false },
  );
  return {
    experiments: data?.experiments ?? [],
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
    hanlinApi('/api/hanlin/awards'),
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
    hanlinApi('/api/hanlin/scouting'),
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
    hanlinApi('/api/hanlin/incubation'),
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
    hanlinApi('/api/hanlin/export-offerings'),
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

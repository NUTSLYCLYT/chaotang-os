'use client';

/**
 * 朝堂 OS · 锦衣卫情报信号 SWR Hook
 *
 * 数据来源：GET /api/court/intel/signals → Turso intel_signals 表
 * 降级策略：Turso 不可用 → mock fixture（由 API route 自动降级）
 */

import useSWR from 'swr';
import type { IntelFilter, IntelSignal, IntelSignalsResponse } from '@/lib/contracts/intel';
import { withBasePath } from '@/lib/base-path';
import { mockIntelSignals } from '@/lib/mock/fixtures/intel';

/** 真实性来源：turso=真实摄入情报；fallback=Turso 空/不可达时的 mock 兜底（诚实纪律，须明示）。 */
export type IntelSource = 'turso' | 'fallback';

interface IntelFetchResult {
  signals: IntelSignal[];
  source: IntelSource;
}

const fetcher = async (url: string): Promise<IntelFetchResult> => {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => null);
  if (!res?.ok) return { signals: mockIntelSignals, source: 'fallback' };
  const payload = (await res.json().catch(() => null)) as IntelSignalsResponse | null;
  if (!payload?.success) return { signals: mockIntelSignals, source: 'fallback' };
  // 透传 meta.source —— 前端据此明示「兜底演示」，不把 mock 当真情报（诚实纪律）。
  return { signals: payload.data, source: payload.meta?.source ?? 'fallback' };
};

function buildUrl(filter?: Partial<IntelFilter>): string {
  const params = new URLSearchParams();
  params.set('limit', '80');
  if (filter?.categories?.length === 1) params.set('category', filter.categories[0]!);
  if (filter?.levels?.length === 1) params.set('level', filter.levels[0]!);
  if (filter?.regions?.length === 1) params.set('region', filter.regions[0]!);
  return withBasePath(`/api/court/intel/signals?${params.toString()}`);
}

export interface UseIntelSignalsResult {
  signals: IntelSignal[];
  /** turso=真实情报；fallback=mock 兜底（页面须明示「演示」，禁当真情报）。 */
  source: IntelSource;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * 获取情报信号列表，支持可选过滤。
 * 每 5 分钟自动刷新，聚焦窗口时立即重新验证。
 */
export function useIntelSignals(filter?: Partial<IntelFilter>): UseIntelSignalsResult {
  const url = buildUrl(filter);

  const { data, error, isLoading, mutate } = useSWR<IntelFetchResult, Error>(
    url,
    fetcher,
    {
      refreshInterval: 5 * 60 * 1000, // 5 min
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 30_000,
      onError: (err) => {
        console.warn('[useIntelSignals] fetch error:', err.message);
      },
    },
  );

  return {
    signals: data?.signals ?? [],
    source: data?.source ?? 'fallback',
    isLoading,
    isError: !!error,
    error: error ?? null,
    mutate,
  };
}

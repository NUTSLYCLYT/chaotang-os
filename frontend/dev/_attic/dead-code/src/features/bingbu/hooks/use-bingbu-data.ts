/**
 * 朝堂 OS · 兵部数据 Hook
 *
 * useSWR 消费 /api/bingbu，数据来自 Turso
 * Turso 不可用时自动降级 fallback（由 BFF 保证）
 *
 * 45s 自动刷新（军事指挥台对时效性要求不低于户部财政台）
 */

'use client';

import useSWR from 'swr';
import type { BingbuOverview } from '@/lib/contracts/bingbu';

const BINGBU_API = '/api/bingbu';

const BASE_PATH = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) ?? '';

interface BingbuApiEnvelope {
  success: boolean;
  data: BingbuOverview;
  error?: string;
  _source?: 'fallback';
}

async function fetcher(url: string): Promise<BingbuOverview> {
  const res = await fetch(`${BASE_PATH}${url}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`bingbu api ${res.status}`);
  const json = (await res.json()) as BingbuApiEnvelope;
  if (!json.success) throw new Error(json.error ?? 'bingbu api failed');
  return json.data;
}

export function useBingbuData() {
  const { data, error, isLoading, mutate } = useSWR<BingbuOverview, Error>(
    BINGBU_API,
    fetcher,
    {
      refreshInterval: 45_000,   // 45s 自动刷新（军事指挥台时效性）
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
      errorRetryCount: 2,
      errorRetryInterval: 5_000,
    },
  );

  return {
    overview: data ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

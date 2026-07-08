'use client';

/**
 * useSWR hook for 兵部销售决策总览 data.
 *
 * 镜像户部 use-hubu-overview。Fetches from /api/court/bingbu/overview（真任务派生）。
 * 区别于世界A 的 use-bingbu-data（竞品情报 /api/bingbu）——本 hook 服务销售决策驾驶舱。
 *
 * Usage:
 *   const { overview, isLoading, error, mutate } = useBingbuOverview();
 */

import useSWR from 'swr';
import type { BingbuSalesOverview } from '@/lib/contracts/bingbu-sales';

const BASE_PATH = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) ?? '';

async function fetchBingbuOverview(): Promise<BingbuSalesOverview> {
  const res = await fetch(`${BASE_PATH}/api/court/bingbu/overview`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`bingbu/overview: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { success: boolean; data: BingbuSalesOverview; error?: string };
  if (!json.success) {
    throw new Error(json.error ?? 'bingbu/overview returned success=false');
  }
  return json.data;
}

export function useBingbuOverview() {
  const { data, error, isLoading, mutate } = useSWR<BingbuSalesOverview, Error>(
    '/api/court/bingbu/overview',
    fetchBingbuOverview,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    },
  );

  return {
    overview: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

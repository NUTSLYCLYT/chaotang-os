'use client';

/**
 * 刑部数据 Hook — useSWR 消费 /api/court/legal/overview（Turso 直连）
 * Turso 不可用时自动降级 fallback（BFF 保证）。
 *
 * 60s 自动刷新（司法数据时效性与财政台齐平）
 */

import useSWR from 'swr';
import type { LegalOverview } from '@/lib/contracts/xingbu';

const LEGAL_API = '/api/court/legal/overview';
const BASE_PATH = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) ?? '';

interface LegalApiEnvelope {
  success: boolean;
  data: LegalOverview;
  error?: string;
}

async function fetcher(url: string): Promise<LegalOverview> {
  const res = await fetch(`${BASE_PATH}${url}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`legal api ${res.status}`);
  const json = (await res.json()) as LegalApiEnvelope;
  if (!json.success) throw new Error(json.error ?? 'legal api failed');
  return json.data;
}

export function useLegalData() {
  const { data, error, isLoading, mutate } = useSWR<LegalOverview, Error>(
    LEGAL_API,
    fetcher,
    {
      refreshInterval: 60_000,
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

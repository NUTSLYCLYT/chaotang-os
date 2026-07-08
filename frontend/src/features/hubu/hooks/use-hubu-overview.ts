'use client';

/**
 * useSWR hook for 户部财政总览 data.
 *
 * Fetches from /api/court/hubu/overview which reads from Turso.
 * Falls back gracefully on error (API returns fallback data).
 *
 * Usage:
 *   const { overview, isLoading, error, mutate } = useHubuOverview();
 */

import useSWR from 'swr';
import type { HubuOverview } from '@/lib/contracts/hubu';

const BASE_PATH = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) ?? '';

async function fetchHubuOverview(): Promise<HubuOverview> {
  const res = await fetch(`${BASE_PATH}/api/court/hubu/overview`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`hubu/overview: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { success: boolean; data: HubuOverview; error?: string };
  if (!json.success) {
    throw new Error(json.error ?? 'hubu/overview returned success=false');
  }
  return json.data;
}

export function useHubuOverview() {
  const { data, error, isLoading, mutate } = useSWR<HubuOverview, Error>(
    '/api/court/hubu/overview',
    fetchHubuOverview,
    {
      refreshInterval: 60_000,   // re-fetch every minute
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

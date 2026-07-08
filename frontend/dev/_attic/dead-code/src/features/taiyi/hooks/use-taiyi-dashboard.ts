'use client';

/**
 * useSWR hook for 太医院健康档案 data。
 *
 * 从 /api/court/taiyi/dashboard 读取（Turso health_profiles → 上游 → fallback mock）。
 * 返回 TaiyiDashboard，含 dataSource 字段供调用方判断真假：
 *   dataSource === 'fallback' 表示后端无真数据、返回的是 mock，
 *   client 应当作"无真数据"处理（诚实空态），不可当真展示。
 *
 * 用法：
 *   const { dashboard, isLoading, error, mutate } = useTaiyiDashboard();
 */

import useSWR from 'swr';
import type { TaiyiDashboard } from '@/lib/contracts/taiyi';

const BASE_PATH = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) ?? '';

async function fetchTaiyiDashboard(): Promise<TaiyiDashboard> {
  const res = await fetch(`${BASE_PATH}/api/court/taiyi/dashboard`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`taiyi/dashboard: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { success: boolean; data: TaiyiDashboard | null; error?: string };
  if (!json.success || !json.data) {
    throw new Error(json.error ?? 'taiyi/dashboard returned no data');
  }
  return json.data;
}

export function useTaiyiDashboard() {
  const { data, error, isLoading, mutate } = useSWR<TaiyiDashboard, Error>(
    '/api/court/taiyi/dashboard',
    fetchTaiyiDashboard,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    },
  );

  return {
    dashboard: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

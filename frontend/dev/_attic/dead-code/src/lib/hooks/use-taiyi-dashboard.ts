/**
 * 太医院 · useSWR 数据钩子
 *
 * 消费 /api/court/taiyi/dashboard，自动处理加载/错误/重试。
 * 数据流：Turso health_profiles → 上游 /health/dashboard → mock fallback
 *
 * 用于替代 api.health.getProfile() 的命令式调用，
 * 以声明式 useSWR 模式让组件响应式地刷新。
 */

'use client';

import useSWR from 'swr';
import type { TaiyiDashboard } from '@/lib/contracts/taiyi';
import { withBasePath } from '@/lib/base-path';

const ENDPOINT = withBasePath('/api/court/taiyi/dashboard');

async function taiyiFetcher(url: string): Promise<TaiyiDashboard> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`taiyi/dashboard ${res.status}`);
  const json = await res.json() as { success: boolean; data: TaiyiDashboard | null; error?: string };
  if (!json.success || !json.data) throw new Error(json.error ?? 'taiyi/dashboard returned no data');
  return json.data;
}

export interface UseTaiyiDashboardResult {
  dashboard: TaiyiDashboard | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

/**
 * 太医院仪表板数据 hook。
 *
 * @param opts.refreshInterval - 自动刷新间隔（ms），默认 0（不自动刷新）
 */
export function useTaiyiDashboard(opts?: { refreshInterval?: number }): UseTaiyiDashboardResult {
  const { data, isLoading, error, mutate } = useSWR<TaiyiDashboard, Error>(
    ENDPOINT,
    taiyiFetcher,
    {
      refreshInterval: opts?.refreshInterval ?? 0,
      revalidateOnFocus: false,
      dedupingInterval: 30_000, // 30s 内不重复请求
    },
  );

  return {
    dashboard: data,
    isLoading,
    error: error as Error | undefined,
    mutate: () => { void mutate(); },
  };
}

/**
 * 太医院 · 医讯数据钩子
 *
 * 消费 /api/court/taiyi/news，自动处理加载/错误/重试。
 * 数据流：Turso medical_news → 上游 /health/news → fallback mock
 *
 * 用于 MedicalNewsFeed 组件，声明式 useSWR 模式让医讯响应式地刷新。
 */

'use client';

import useSWR from 'swr';
import type { MedicalNewsItem, MedicalNewsResponse } from '@/lib/contracts/taiyi';
import { withBasePath } from '@/lib/base-path';

const ENDPOINT = withBasePath('/api/court/taiyi/news');

async function medicalNewsFetcher(url: string): Promise<MedicalNewsItem[]> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`taiyi/news ${res.status}`);
  const json = (await res.json()) as MedicalNewsResponse;
  if (!json.success || !json.data) throw new Error(json.error ?? 'taiyi/news returned no data');
  return json.data;
}

export interface UseMedicalNewsResult {
  news: MedicalNewsItem[] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => Promise<MedicalNewsItem[] | undefined>;
}

/**
 * 太医院医讯数据 hook。
 *
 * @param opts.refreshInterval - 自动刷新间隔（ms），默认 0（不自动刷新）
 */
export function useMedicalNews(opts?: { refreshInterval?: number }): UseMedicalNewsResult {
  const { data, isLoading, error, mutate } = useSWR<MedicalNewsItem[], Error>(
    ENDPOINT,
    medicalNewsFetcher,
    {
      refreshInterval: opts?.refreshInterval ?? 0,
      revalidateOnFocus: false,
      dedupingInterval: 30_000, // 30s 内不重复请求
    },
  );

  return {
    news: data,
    isLoading,
    error: error as Error | undefined,
    mutate: () => mutate(),
  };
}

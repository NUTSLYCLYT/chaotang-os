/**
 * 影子导师信号 · 单司订阅钩子
 *
 * 消费 /api/court/learning/advisor-signal（loadAdvisorSignals 的真实持久化结果，
 * 非 mock），过滤到调用方指定的 agentCode。同一端点全量拉取由 SWR 按 key 去重缓存，
 * 多个司面板同时挂载不会重复请求。
 */

'use client';

import useSWR from 'swr';
import type { AgentCode } from '@/lib/contracts/agent';
import type {
  DepartmentLearningAdvisorSignal,
  DepartmentLearningAdvisorSignalResponse,
} from '@/lib/contracts/department-learning';
import { withBasePath } from '@/lib/base-path';

const ENDPOINT = withBasePath('/api/court/learning/advisor-signal');

async function advisorSignalFetcher(url: string): Promise<DepartmentLearningAdvisorSignal[]> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`advisor-signal ${res.status}`);
  const json = (await res.json()) as DepartmentLearningAdvisorSignalResponse;
  if (!json.success) throw new Error(json.error ?? 'advisor-signal returned success=false');
  return json.data.signals;
}

export interface UseAdvisorSignalResult {
  signal: DepartmentLearningAdvisorSignal | null;
  isLoading: boolean;
  error: Error | undefined;
}

export function useAdvisorSignal(agentCode: AgentCode): UseAdvisorSignalResult {
  const { data, isLoading, error } = useSWR<DepartmentLearningAdvisorSignal[], Error>(
    ENDPOINT,
    advisorSignalFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  return {
    signal: data?.find((s) => s.agentCode === agentCode) ?? null,
    isLoading,
    error: error as Error | undefined,
  };
}

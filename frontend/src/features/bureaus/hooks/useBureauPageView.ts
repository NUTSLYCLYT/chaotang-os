'use client';

import { useMemo } from 'react';
import useSWR from 'swr';

import { backendFetch } from '@/lib/backend-api';
import { buildBureauPageView } from '@/features/bureaus/lib/bureau-page-view-builder';
import type { BureauPageView } from '@/lib/contracts/bureau-page-view';
import type { DeptOverview } from '@/lib/contracts/dept';

const OVERVIEW_CODE: Record<string, string> = {
  finance: 'finance',
  gongbu: 'works',
  works: 'works',
  personnel: 'personnel',
  market: 'market',
  ops: 'ops',
  legal: 'legal',
};

async function fetchDeptOverview(overviewCode: string): Promise<DeptOverview> {
  const res = await backendFetch(`/api/chaotang/dept/${encodeURIComponent(overviewCode)}/overview`, {
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: DeptOverview;
    error?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'bureau_page_view_overview_failed');
  }
  return json.data;
}

/**
 * 部门 overview 单独一层 SWR，key 只按 overviewCode（不带 bureau）——同一部门下
 * 几个司页面(如户部预算司/出纳司)共享同一个真实 overview 轮询，不是各司各自起一个
 * 60s 定时器打同一个后端聚合端点(2026-07-09 复审修复：此前 key 里带 bureau，N 个司
 * 就是 N 个独立 poller)。
 */
function useDeptOverview(department: string) {
  const overviewCode = OVERVIEW_CODE[department] ?? department;
  return useSWR<DeptOverview>(
    `dept-overview:${overviewCode}`,
    () => fetchDeptOverview(overviewCode),
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );
}

export function useBureauPageView(department: string, bureau: string) {
  const { data: overview, error, isLoading } = useDeptOverview(department);

  const view = useMemo<BureauPageView | null>(() => {
    if (!overview) return null;
    return buildBureauPageView({
      department,
      bureau,
      generatedAt: new Date().toISOString(),
      sources: {
        code: department,
        overview,
        hubuOverview: null,
        legalOverview: null,
        bingbuOverview: null,
        libuPromoOverview: null,
        taskInsights: [],
      },
    });
  }, [department, bureau, overview]);

  const unknownBureauError = overview && !view ? new Error(`unknown_bureau_page:${department}/${bureau}`) : null;

  return { data: view ?? undefined, error: error ?? unknownBureauError ?? undefined, isLoading };
}

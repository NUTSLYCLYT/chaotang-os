'use client';

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

/**
 * 前端 BFF 层已于 2026-07-08 退休，`/api/court/bureaus/{dept}/{office}/page-view` 不存在
 * (从未在后端实现，纯前端 BFF 路由被删后成死链)。改为直接打真实后端部门 overview
 * (dept.py:120，真实聚合数据)，交给已存在的 buildBureauPageView 拼司级视图——
 * 该 builder 早已写好、只是没人接线。specialised overview(hubuOverview 等)本轮不接：
 * department-page-view-loader.ts 里那条路径本身指向的是同一个通用 overview 端点，
 * 传进来也不会是真的司级专属数据，不在此处新引入这层假真实。
 */
async function fetchBureauPageView(department: string, bureau: string): Promise<BureauPageView> {
  const overviewCode = OVERVIEW_CODE[department] ?? department;
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
  const view = buildBureauPageView({
    department,
    bureau,
    generatedAt: new Date().toISOString(),
    sources: {
      code: department,
      overview: json.data,
      hubuOverview: null,
      legalOverview: null,
      bingbuOverview: null,
      libuPromoOverview: null,
      taskInsights: [],
    },
  });
  if (!view) throw new Error(`unknown_bureau_page:${department}/${bureau}`);
  return view;
}

export function useBureauPageView(department: string, bureau: string) {
  return useSWR<BureauPageView>(
    `bureau-page-view:${department}:${bureau}`,
    () => fetchBureauPageView(department, bureau),
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );
}

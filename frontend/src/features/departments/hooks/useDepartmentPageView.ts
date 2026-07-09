'use client';

import useSWR from 'swr';

import { backendFetch } from '@/lib/backend-api';
import { buildDepartmentPageView } from '@/features/departments/lib/department-page-view-builder';
import type { DepartmentPageCode, DepartmentPageView } from '@/lib/contracts/department-page-view';
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

async function fetchDepartmentPageView(code: string): Promise<DepartmentPageView> {
  const overviewCode = OVERVIEW_CODE[code] ?? code;
  const res = await backendFetch(`/api/chaotang/dept/${encodeURIComponent(overviewCode)}/overview`, {
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: DeptOverview;
    error?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'department_page_view_failed');
  }
  const view = buildDepartmentPageView({
    code,
    generatedAt: new Date().toISOString(),
    overview: json.data,
  });
  if (!view) throw new Error(`unknown_department_page:${code}`);
  return view;
}

export function useDepartmentPageView(code: DepartmentPageCode | string) {
  return useSWR<DepartmentPageView>(
    `department-page-view:${code}`,
    () => fetchDepartmentPageView(code),
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
    },
  );
}

'use client';

import useSWR from 'swr';

import { withBasePath } from '@/lib/base-path';
import type { DepartmentPageCode, DepartmentPageView } from '@/lib/contracts/department-page-view';

async function fetchDepartmentPageView(url: string): Promise<DepartmentPageView> {
  const res = await fetch(url, { cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: DepartmentPageView;
    error?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'department_page_view_failed');
  }
  return json.data;
}

export function useDepartmentPageView(code: DepartmentPageCode | string) {
  return useSWR<DepartmentPageView>(
    withBasePath(`/api/court/departments/${encodeURIComponent(code)}/page-view`),
    fetchDepartmentPageView,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
    },
  );
}

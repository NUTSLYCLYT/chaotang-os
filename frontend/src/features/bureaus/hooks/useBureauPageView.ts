'use client';

import useSWR from 'swr';

import { withBasePath } from '@/lib/base-path';
import type { BureauPageView } from '@/lib/contracts/bureau-page-view';

async function fetchBureauPageView(url: string): Promise<BureauPageView> {
  const res = await fetch(url, { cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: BureauPageView; error?: string };
  if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? 'bureau_page_view_failed');
  return json.data;
}

export function useBureauPageView(department: string, bureau: string) {
  return useSWR<BureauPageView>(
    withBasePath(`/api/court/bureaus/${encodeURIComponent(department)}/${encodeURIComponent(bureau)}/page-view`),
    fetchBureauPageView,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );
}

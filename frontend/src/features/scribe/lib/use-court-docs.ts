'use client';

/** 史馆卷宗卡真实数据。替换 court-doc.ts 的 MOCK_COURT_DOCS。 */

import useSWR from 'swr';
import { backendFetch } from '@/lib/backend-api';
import { normalizeCourtDocResponse } from './court-doc-adapter';
import type { CourtDoc } from './court-doc';

async function fetchCourtDocs(url: string): Promise<CourtDoc[]> {
  const res = await backendFetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return normalizeCourtDocResponse(await res.json());
}

export function useCourtDocs() {
  return useSWR<CourtDoc[]>('/api/scribe/archive-docs', fetchCourtDocs, { refreshInterval: 120_000 });
}

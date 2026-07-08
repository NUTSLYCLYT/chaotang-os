'use client';

import useSWR from 'swr';
import { withBasePath } from '@/lib/base-path';
import type { QintianLearningPath, QintianLearningPathApiResponse } from '@/lib/contracts/qintian';

function learningPathUrl(forecastId: string | null): string | null {
  if (!forecastId) return null;
  return withBasePath(`/api/qintian/learning-path?forecastId=${encodeURIComponent(forecastId)}`);
}

async function learningPathFetcher(url: string): Promise<QintianLearningPath> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`learning path fetch failed: ${res.status}`);
  const json = (await res.json()) as QintianLearningPathApiResponse;
  if (!json.success || !json.data) throw new Error(json.error ?? 'learning path api error');
  return json.data;
}

export interface UseQintianLearningPathResult {
  learningPath: QintianLearningPath | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

export function useQintianLearningPath(forecastId: string | null): UseQintianLearningPathResult {
  const { data, error, isLoading, mutate } = useSWR<QintianLearningPath>(
    learningPathUrl(forecastId),
    learningPathFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  return {
    learningPath: data ?? null,
    isLoading,
    error: error instanceof Error ? error : null,
    mutate: () => { void mutate(); },
  };
}

'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { TaskStatus } from '@/types/task';
import type { ManorDomain } from '@/types/manor';

export type DateRangePreset = 'today' | 'week' | 'month' | 'custom';

export interface ScribeFilters {
  statuses: TaskStatus[];
  manors: ManorDomain[];
  dateRange: DateRangePreset;
  customFrom: string;
  customTo: string;
}

const DEFAULT_FILTERS: ScribeFilters = {
  statuses: [],
  manors: [],
  dateRange: 'month',
  customFrom: '',
  customTo: '',
};

function parseStatuses(raw: string | null): TaskStatus[] {
  if (!raw) return [];
  return raw.split(',').filter(Boolean) as TaskStatus[];
}

function parseManors(raw: string | null): ManorDomain[] {
  if (!raw) return [];
  return raw.split(',').filter(Boolean) as ManorDomain[];
}

export function useScribeFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters: ScribeFilters = useMemo(() => ({
    statuses: parseStatuses(searchParams.get('status')),
    manors: parseManors(searchParams.get('manor')),
    dateRange: (searchParams.get('range') ?? DEFAULT_FILTERS.dateRange) as DateRangePreset,
    customFrom: searchParams.get('from') ?? '',
    customTo: searchParams.get('to') ?? '',
  }), [searchParams]);

  const setFilters = useCallback((next: Partial<ScribeFilters>) => {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.statuses.length > 0) params.set('status', merged.statuses.join(','));
    if (merged.manors.length > 0) params.set('manor', merged.manors.join(','));
    if (merged.dateRange !== DEFAULT_FILTERS.dateRange) params.set('range', merged.dateRange);
    if (merged.dateRange === 'custom' && merged.customFrom) params.set('from', merged.customFrom);
    if (merged.dateRange === 'custom' && merged.customTo) params.set('to', merged.customTo);
    const qs = params.toString();
    router.replace(qs ? `/scribe?${qs}` : '/scribe', { scroll: false });
  }, [filters, router]);

  const clearFilters = useCallback(() => {
    router.replace('/scribe', { scroll: false });
  }, [router]);

  const isActive = filters.statuses.length > 0 || filters.manors.length > 0 ||
    filters.dateRange !== DEFAULT_FILTERS.dateRange;

  return { filters, setFilters, clearFilters, isActive };
}

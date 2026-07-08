'use client';

import { useEffect, useState } from 'react';
import type { OperatorActionLabel } from '@/shared/battery-exchange';
import type {
  OperatorActionEntityFilter,
  OperatorActionRangeFilter,
  OperatorActionSort,
  OperatorConsoleShareState,
} from './operator-console-share';
import {
  buildOperatorConsoleShareParams,
  parseOperatorConsoleShareState,
} from './operator-console-share';
import type {
  OperatorListingFilter,
  OperatorOrderSeverityFilter,
  OperatorOrderSort,
  OperatorOrderStatusFilter,
} from './operator-console-utils';

type CopyState = 'idle' | 'copied' | 'error';

export function useOperatorConsoleShare({
  state,
  applyConsoleFilters,
  applyActionFilters,
}: {
  state: OperatorConsoleShareState;
  applyConsoleFilters: (next: {
    listingFilter: OperatorListingFilter;
    orderSort: OperatorOrderSort;
    reviewSellerId: string;
    reviewCity: string;
    orderSellerId: string;
    orderSeverity: OperatorOrderSeverityFilter;
    orderStatus: OperatorOrderStatusFilter;
  }) => void;
  applyActionFilters: (next: {
    actionEntityFilter: OperatorActionEntityFilter;
    actionLabelFilter: 'all' | OperatorActionLabel;
    actionRangeFilter: OperatorActionRangeFilter;
    actionDateFilter: string;
    actionActorFilter: string;
    actionSellerFilter: string;
    actionQuery: string;
    actionSort: OperatorActionSort;
    actionPage: number;
  }) => void;
}) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncFromLocation = () => {
      const next = parseOperatorConsoleShareState(new URLSearchParams(window.location.search));
      applyConsoleFilters({
        listingFilter: next.listingFilter,
        orderSort: next.orderSort,
        reviewSellerId: next.reviewSellerId,
        reviewCity: next.reviewCity,
        orderSellerId: next.orderSellerId,
        orderSeverity: next.orderSeverity,
        orderStatus: next.orderStatus,
      });
      applyActionFilters({
        actionEntityFilter: next.actionEntityFilter,
        actionLabelFilter: next.actionLabelFilter,
        actionRangeFilter: next.actionRangeFilter,
        actionDateFilter: next.actionDateFilter,
        actionActorFilter: next.actionActorFilter,
        actionSellerFilter: next.actionSellerFilter,
        actionQuery: next.actionQuery,
        actionSort: next.actionSort,
        actionPage: next.actionPage,
      });
      setIsHydrated(true);
    };

    syncFromLocation();
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, [applyActionFilters, applyConsoleFilters]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;

    const next = buildOperatorConsoleShareParams(state).toString();
    const current = window.location.search.startsWith('?')
      ? window.location.search.slice(1)
      : window.location.search;

    if (current === next) return;

    const pathname = window.location.pathname;
    window.history.replaceState(null, '', next ? `${pathname}?${next}` : pathname);
  }, [isHydrated, state]);

  useEffect(() => {
    if (copyState !== 'copied') return;
    const timeout = window.setTimeout(() => setCopyState('idle'), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  async function copyCurrentView() {
    if (typeof window === 'undefined' || !navigator.clipboard) {
      setCopyState('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  return {
    copyState,
    copyCurrentView,
  };
}

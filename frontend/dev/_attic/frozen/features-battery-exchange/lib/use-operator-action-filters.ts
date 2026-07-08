'use client';

import { useCallback, useState } from 'react';
import type { OperatorActionLabel } from '@/shared/battery-exchange';
import type { ActiveActionFilter } from './operator-console-utils';
import type {
  OperatorActionEntityFilter,
  OperatorActionRangeFilter,
  OperatorActionSort,
} from './operator-console-share';
import { DEFAULT_OPERATOR_CONSOLE_SHARE_STATE } from './operator-console-share';

export function useOperatorActionFilters() {
  const [actionEntityFilter, setActionEntityFilter] = useState<OperatorActionEntityFilter>(
    DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionEntityFilter,
  );
  const [actionLabelFilter, setActionLabelFilter] = useState<'all' | OperatorActionLabel>(
    DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionLabelFilter,
  );
  const [actionRangeFilter, setActionRangeFilter] = useState<OperatorActionRangeFilter>(
    DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionRangeFilter,
  );
  const [actionDateFilter, setActionDateFilter] = useState(DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionDateFilter);
  const [actionActorFilter, setActionActorFilter] = useState(DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionActorFilter);
  const [actionSellerFilter, setActionSellerFilter] = useState(
    DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionSellerFilter,
  );
  const [actionQuery, setActionQuery] = useState(DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionQuery);
  const [actionSort, setActionSort] = useState<OperatorActionSort>(
    DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionSort,
  );
  const [actionPage, setActionPage] = useState(DEFAULT_OPERATOR_CONSOLE_SHARE_STATE.actionPage);

  function toggleActionLabelFilter(nextValue: 'all' | OperatorActionLabel) {
    setActionLabelFilter((current) => (current === nextValue ? 'all' : nextValue));
    setActionPage(1);
  }

  function toggleActionActorFilter(nextValue: string) {
    setActionActorFilter((current) => (current === nextValue ? 'all' : nextValue));
    setActionPage(1);
  }

  function toggleActionSellerFilter(nextValue: string) {
    setActionSellerFilter((current) => (current === nextValue ? 'all' : nextValue));
    setActionPage(1);
  }

  function toggleActionEntity(nextValue: 'listing' | 'trade_order') {
    setActionEntityFilter((current) => (current === nextValue ? 'all' : nextValue));
    setActionPage(1);
  }

  function selectActionEntity(nextValue: OperatorActionEntityFilter) {
    setActionEntityFilter(nextValue);
    setActionPage(1);
  }

  function selectActionLabel(nextValue: 'all' | OperatorActionLabel) {
    setActionLabelFilter(nextValue);
    setActionPage(1);
  }

  function selectActionRange(nextValue: OperatorActionRangeFilter) {
    setActionRangeFilter(nextValue);
    setActionDateFilter('');
    setActionPage(1);
  }

  function selectActionSort(nextValue: OperatorActionSort) {
    setActionSort(nextValue);
    setActionPage(1);
  }

  function selectActionActor(nextValue: string) {
    setActionActorFilter(nextValue);
    setActionPage(1);
  }

  function selectActionSeller(nextValue: string) {
    setActionSellerFilter(nextValue);
    setActionPage(1);
  }

  function updateActionQuery(nextValue: string) {
    setActionQuery(nextValue);
    setActionPage(1);
  }

  function applySellerActionFacet(nextSellerName: string, nextActionLabel: OperatorActionLabel) {
    setActionSellerFilter((current) => (current === nextSellerName ? 'all' : nextSellerName));
    setActionLabelFilter((current) => (current === nextActionLabel ? 'all' : nextActionLabel));
    setActionPage(1);
  }

  function applyActionDateFilter(nextDate: string) {
    setActionDateFilter((current) => (current === nextDate ? '' : nextDate));
    setActionRangeFilter('all');
    setActionPage(1);
  }

  function applySellerTimeFacet(nextSellerName: string, nextDate: string) {
    setActionSellerFilter((current) => (current === nextSellerName ? 'all' : nextSellerName));
    setActionDateFilter((current) => (current === nextDate ? '' : nextDate));
    setActionRangeFilter('all');
    setActionPage(1);
  }

  function clearAllActionFilters() {
    setActionEntityFilter('all');
    setActionLabelFilter('all');
    setActionRangeFilter('all');
    setActionDateFilter('');
    setActionActorFilter('all');
    setActionSellerFilter('all');
    setActionQuery('');
    setActionSort('recent');
    setActionPage(1);
  }

  function applyActionQuery(nextQuery: string) {
    const normalized = nextQuery.trim();
    setActionQuery((current) => (current.trim() === normalized ? '' : normalized));
    setActionPage(1);
  }

  function removeActionFilter(key: ActiveActionFilter['key']) {
    switch (key) {
      case 'entity':
        setActionEntityFilter('all');
        break;
      case 'label':
        setActionLabelFilter('all');
        break;
      case 'range':
        setActionRangeFilter('all');
        break;
      case 'date':
        setActionDateFilter('');
        break;
      case 'actor':
        setActionActorFilter('all');
        break;
      case 'seller':
        setActionSellerFilter('all');
        break;
      case 'query':
        setActionQuery('');
        break;
      case 'sort':
        setActionSort('recent');
        break;
    }
    setActionPage(1);
  }

  const applyActionFilters = useCallback(
    (next: {
      actionEntityFilter: OperatorActionEntityFilter;
      actionLabelFilter: 'all' | OperatorActionLabel;
      actionRangeFilter: OperatorActionRangeFilter;
      actionDateFilter: string;
      actionActorFilter: string;
      actionSellerFilter: string;
      actionQuery: string;
      actionSort: OperatorActionSort;
      actionPage: number;
    }) => {
      setActionEntityFilter(next.actionEntityFilter);
      setActionLabelFilter(next.actionLabelFilter);
      setActionRangeFilter(next.actionRangeFilter);
      setActionDateFilter(next.actionDateFilter);
      setActionActorFilter(next.actionActorFilter);
      setActionSellerFilter(next.actionSellerFilter);
      setActionQuery(next.actionQuery);
      setActionSort(next.actionSort);
      setActionPage(next.actionPage);
    },
    [],
  );

  return {
    actionEntityFilter,
    actionLabelFilter,
    actionRangeFilter,
    actionDateFilter,
    actionActorFilter,
    actionSellerFilter,
    actionQuery,
    actionSort,
    actionPage,
    setActionPage,
    setActionEntityFilter: selectActionEntity,
    setActionLabelFilter: selectActionLabel,
    setActionRangeFilter: selectActionRange,
    setActionActorFilter: selectActionActor,
    setActionSellerFilter: selectActionSeller,
    setActionSort: selectActionSort,
    setActionQuery: updateActionQuery,
    toggleActionEntityFilter: toggleActionEntity,
    toggleActionLabelFilter,
    toggleActionActorFilter,
    toggleActionSellerFilter,
    applySellerActionFacet,
    applyActionDateFilter,
    applySellerTimeFacet,
    clearAllActionFilters,
    applyActionQuery,
    removeActionFilter,
    applyActionFilters,
  };
}

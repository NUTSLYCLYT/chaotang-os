'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CreateOperatorActionInput,
  OperatorActionLog,
  OperatorActionPage,
} from '@/shared/battery-exchange';
import {
  buildActiveActionFilters,
  buildActionWindowLabel,
  buildOperatorActionsQuery,
  createEmptyOperatorActionPage,
  type OperatorActionHistoryFilters,
} from './operator-console-utils';

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as { success: boolean; data?: T; error?: string };

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return payload.data;
}

type ResolveOperatorActionInput = {
  id: string;
  entityType: CreateOperatorActionInput['entityType'];
  entityId: string;
  actionLabel: CreateOperatorActionInput['actionLabel'];
  sourceReason: string;
};

type UseOperatorActionHistoryOptions = {
  filters: OperatorActionHistoryFilters;
  actorName: string;
  onError: (message: string) => void;
  onSuccess?: () => void;
};

export function useOperatorActionHistory({
  filters,
  actorName,
  onError,
  onSuccess,
}: UseOperatorActionHistoryOptions) {
  const [actionHistory, setActionHistory] = useState<OperatorActionPage>(createEmptyOperatorActionPage());
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [resolvedActions, setResolvedActions] = useState<Record<string, string>>({});
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const reloadActionHistory = useCallback(
    async (nextFilters: OperatorActionHistoryFilters) => {
      const query = buildOperatorActionsQuery(nextFilters);
      const data = await readJson<OperatorActionPage>(`/api/battery-exchange/operator-actions?${query}`);
      setActionHistory(data);
      return data;
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    reloadActionHistory(filters).catch((err) => {
      if (!mounted) return;
      onError(err instanceof Error ? err.message : '处置历史加载失败');
    });

    return () => {
      mounted = false;
    };
  }, [filters, onError, reloadActionHistory]);

  const activeActionFilters = useMemo(
    () =>
      buildActiveActionFilters({
        entityFilter: filters.actionEntityFilter,
        labelFilter: filters.actionLabelFilter,
        rangeFilter: filters.actionRangeFilter,
        dateFilter: filters.actionDateFilter,
        actorFilter: filters.actionActorFilter,
        sellerFilter: filters.actionSellerFilter,
        query: filters.actionQuery,
        sort: filters.actionSort,
      }),
    [filters],
  );

  const actionWindowLabel = useMemo(() => buildActionWindowLabel(actionHistory), [actionHistory]);

  const updateActionNote = useCallback((id: string, note: string) => {
    setActionNotes((current) => ({
      ...current,
      [id]: note,
    }));
  }, []);

  const handleResolveAction = useCallback(
    async (input: ResolveOperatorActionInput) => {
      setPendingActionId(input.id);

      try {
        const response = await fetch('/api/battery-exchange/operator-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType: input.entityType,
            entityId: input.entityId,
            actionLabel: input.actionLabel,
            actorName,
            note: actionNotes[input.id] ?? '',
            sourceReason: input.sourceReason,
          } satisfies CreateOperatorActionInput),
        });
        const payload = (await response.json()) as {
          success: boolean;
          data?: OperatorActionLog;
          error?: string;
        };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? 'operator_action_failed');
        }

        const createdAction = payload.data;

        setResolvedActions((current) => ({
          ...current,
          [input.id]: createdAction.result,
        }));
        setActionNotes((current) => ({
          ...current,
          [input.id]: '',
        }));

        await reloadActionHistory({
          ...filters,
          actionPage: 1,
          actionEntityFilter: 'all',
        });
        onSuccess?.();
      } catch (err) {
        onError(err instanceof Error ? err.message : '处置动作提交失败');
      } finally {
        setPendingActionId(null);
      }
    },
    [actionNotes, actorName, filters, onError, onSuccess, reloadActionHistory],
  );

  return {
    actionHistory,
    actionNotes,
    resolvedActions,
    pendingActionId,
    activeActionFilters,
    actionWindowLabel,
    setActionHistory,
    setActionNotes,
    updateActionNote,
    setResolvedActions,
    handleResolveAction,
    reloadActionHistory,
  };
}

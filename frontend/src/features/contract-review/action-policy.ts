import type { ContractTaskReadModelV1 } from '@/lib/contracts/backend-openapi-2026-07-21';

import type { ContractAction } from './read-model';

export type ContractSourceState = 'LIVE' | 'MIXED' | 'FALLBACK' | 'UNKNOWN';

export interface ContractReviewUiPolicy {
  sourceState: ContractSourceState;
  isLive: boolean;
  deliveryState: 'NONE' | 'READY' | 'PARTIAL' | 'UNDER_REVIEW';
  isDelivered: boolean;
  isArchived: boolean;
  canDownload: boolean;
  canResume: boolean;
}

export function isContractActionAllowed(
  model: ContractTaskReadModelV1,
  action: ContractAction,
): boolean {
  return model.allowed_actions.includes(action);
}

function sourceState(sourceLabel: string): ContractSourceState {
  if (sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO') return 'FALLBACK';
  if (sourceLabel === 'MIXED') return 'MIXED';
  if (['LIVE', 'LIVE_ENGINE', 'LIVE_SWARM'].includes(sourceLabel)) return 'LIVE';
  return 'UNKNOWN';
}

export function contractReviewUiPolicy(
  model: ContractTaskReadModelV1,
): ContractReviewUiPolicy {
  const source = sourceState(model.task.source_label);
  const deliveryState = model.delivery?.overall_status ?? 'NONE';
  return {
    sourceState: source,
    isLive: source === 'LIVE' || source === 'MIXED',
    deliveryState,
    isDelivered: deliveryState === 'READY',
    isArchived: model.archive_receipt != null,
    canDownload: isContractActionAllowed(model, 'DOWNLOAD_ARTIFACT'),
    canResume: deliveryState === 'PARTIAL'
      && isContractActionAllowed(model, 'RESUME_DELIVERY'),
  };
}

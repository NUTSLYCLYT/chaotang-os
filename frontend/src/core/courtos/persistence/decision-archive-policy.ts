import type { SourceLabel } from '../types.ts';
import type { UnifiedUserAction } from '../unified/unified-learning.ts';

export type PersistedDecisionAction = 'adopt' | 'request_evidence' | 'recheck' | 'reject' | 'followup';

export type PersistedTaskStatus =
  | 'awaiting_evidence'
  | 'followuping'
  | 'rechecking'
  | 'adopted'
  | 'rejected'
  | 'archived';

export interface DecisionArchivePolicyInput {
  action: PersistedDecisionAction;
  humanConfirmed: boolean;
  humanConfirmationRequired: boolean;
  qualityPassed: boolean;
  sourceLabel: SourceLabel;
}

export function mapDecisionActionToUnifiedUserAction(action: PersistedDecisionAction): UnifiedUserAction {
  if (action === 'adopt') return 'accept';
  if (action === 'reject') return 'reject';
  if (action === 'recheck') return 'request_recheck';
  if (action === 'followup') return 'follow_up';
  return 'request_evidence';
}

export function statusFromDecisionAction(action: PersistedDecisionAction): PersistedTaskStatus {
  if (action === 'adopt') return 'adopted';
  if (action === 'reject') return 'rejected';
  if (action === 'recheck') return 'rechecking';
  if (action === 'followup') return 'followuping';
  return 'awaiting_evidence';
}

export function statusAfterArchive(action: PersistedDecisionAction): PersistedTaskStatus {
  if (action === 'adopt') return 'archived';
  return statusFromDecisionAction(action);
}

export function retrospectiveStatusForDecision(action: PersistedDecisionAction): string {
  if (action === 'adopt') return 'not_started';
  return statusFromDecisionAction(action);
}

export function assertDecisionArchiveAllowed(input: DecisionArchivePolicyInput): void {
  const isAcceptingFinalJudgement = input.action === 'adopt';
  if (!isAcceptingFinalJudgement) return;

  if (input.humanConfirmationRequired && !input.humanConfirmed) {
    throw new Error('human_confirmation_required');
  }

  if (!input.qualityPassed && !input.humanConfirmed) {
    throw new Error('quality_gate_confirmation_required');
  }

  if ((input.sourceLabel === 'FALLBACK' || input.sourceLabel === 'DEMO') && !input.humanConfirmed) {
    throw new Error('weak_source_confirmation_required');
  }
}

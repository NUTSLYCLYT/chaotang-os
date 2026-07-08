import {
  BUILD_LEDGER_STATUS_LABEL,
  transitionBuildLedgerOnServer,
  type BuildLedgerEntry,
  type BuildLedgerStatus,
} from './build-ledger';

export type BuildCaseActionId =
  | 'start_review'
  | 'return_for_evidence'
  | 'archive'
  | 'recall'
  | 'blocked_release';

export interface BuildCaseAction {
  id: BuildCaseActionId;
  label: string;
  toStatus?: BuildLedgerStatus;
  tone: 'primary' | 'warning' | 'success' | 'muted' | 'danger';
  disabled?: boolean;
  reason?: string;
}

export interface TransitionBuildCaseInput {
  entry: BuildLedgerEntry;
  toStatus: BuildLedgerStatus;
  note: string;
}

export function getBuildCaseActions(entry: BuildLedgerEntry): BuildCaseAction[] {
  if (entry.status === 'dispatched') {
    return [
      { id: 'start_review', label: '进入军机复核', toStatus: 'reviewing', tone: 'primary' },
      { id: 'return_for_evidence', label: '退回工部补证', toStatus: 'returned', tone: 'warning' },
      { id: 'blocked_release', label: '禁止直接发布', tone: 'danger', disabled: true, reason: '未经军机处复核与史馆归档，不允许对外发布。' },
    ];
  }

  if (entry.status === 'reviewing') {
    return [
      { id: 'archive', label: '送史馆归档', toStatus: 'archived', tone: 'success' },
      { id: 'return_for_evidence', label: '退回工部补证', toStatus: 'returned', tone: 'warning' },
    ];
  }

  if (entry.status === 'returned') {
    return [
      { id: 'start_review', label: '补证后复核', toStatus: 'reviewing', tone: 'primary' },
      { id: 'archive', label: '带风险归档', toStatus: 'archived', tone: 'warning' },
    ];
  }

  return [
    { id: 'recall', label: '上书房召回', tone: 'muted', disabled: true, reason: '已入史馆，下一步由上书房召回旧案。' },
  ];
}

export async function transitionBuildCase(input: TransitionBuildCaseInput): Promise<BuildLedgerEntry> {
  const note = input.note.trim();
  if (!note) throw new Error('build_case_transition_note_required');
  if (input.entry.evidence.length === 0) throw new Error('build_case_transition_evidence_required');

  const allowed = getBuildCaseActions(input.entry).some((action) => action.toStatus === input.toStatus && !action.disabled);
  if (!allowed) {
    throw new Error(`build_case_transition_not_allowed:${BUILD_LEDGER_STATUS_LABEL[input.entry.status]}->${BUILD_LEDGER_STATUS_LABEL[input.toStatus]}`);
  }

  return transitionBuildLedgerOnServer(input.entry, input.toStatus, note);
}

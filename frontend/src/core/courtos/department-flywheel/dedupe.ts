import { createHash } from 'node:crypto';
import type { DeptId, RaiseDraft, RaisedLedgerEntry } from './types';

export function contentHashOf(draft: RaiseDraft): string {
  return createHash('sha256').update(`${draft.sourceTaskId}\n${draft.command}`).digest('hex').slice(0, 16);
}

export function isDuplicate(draft: RaiseDraft, dept: DeptId, ledger: RaisedLedgerEntry[]): boolean {
  const hash = contentHashOf(draft);
  return ledger.some((e) => e.dept === dept && e.sourceTaskId === draft.sourceTaskId && e.contentHash === hash);
}

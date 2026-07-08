// src/core/courtos/department-flywheel/raise.ts
import { upsertPrimaryTask } from '@/lib/db/primary-store';
import { appendLedger } from './ledger';
import { contentHashOf } from './dedupe';
import type { DeptId, RaiseDraft } from './types';
import { buildRaiseInput } from './raise-build';

export { buildRaiseInput };

/** 写主库 + 记 ledger;返回写入的 taskId。 */
export async function raiseDraft(draft: RaiseDraft, dept: DeptId): Promise<string> {
  const inp = buildRaiseInput(draft, dept);
  const receipt = await upsertPrimaryTask(inp);
  await appendLedger({
    raisedTaskId: receipt.taskId, dept, sourceTaskId: draft.sourceTaskId,
    contentHash: contentHashOf(draft), at: receipt.acceptedAt,
  });
  return receipt.taskId;
}

// src/core/courtos/department-flywheel/run-flywheel.ts
import { capPerRun } from './gate.ts';
import { isDuplicate, contentHashOf } from './dedupe.ts';
import type { DeptHooks, DeptId, FlywheelConfig, FlywheelRunResult, RaiseDraft, RaisedLedgerEntry, SourceTask } from './types';

/** 飞轮自产任务的 id 前缀;含这些前缀的任务禁止再被当候选来源,防止自反馈放大环。 */
export const NON_FLYWHEEL_SOURCE_PREFIXES = ['dept_raise_', 'department_learning_', 'qintian_learning_'];

interface Deps {
  tasks: SourceTask[];
  /** @deprecated 用 hasRaised 精确查询替代;保留以兼容测试 */
  ledger?: RaisedLedgerEntry[];
  /** M1: 精确去重查询,优先于 ledger 内存比对 */
  hasRaised?: (dept: DeptId, sourceTaskId: string, contentHash: string) => Promise<boolean>;
  raise: (draft: RaiseDraft, dept: DeptId) => Promise<string>;
}

export async function runFlywheel(hooks: DeptHooks, cfg: FlywheelConfig, deps: Deps): Promise<FlywheelRunResult> {
  const res: FlywheelRunResult = {
    dept: hooks.dept, scanned: deps.tasks.length, candidates: 0, passedGate: 0,
    deduped: 0, raised: [], skipped: [],
  };
  // 排除飞轮自产待决项,防止 dept_raise_* 等被再次选为候选产生自反馈放大环
  const eligibleTasks = deps.tasks.filter(
    (t) => !NON_FLYWHEEL_SOURCE_PREFIXES.some((p) => t.id.startsWith(p))
  );
  const candidates = hooks.selectCandidates(eligibleTasks);
  res.candidates = candidates.length;

  const drafts: RaiseDraft[] = [];
  for (const task of candidates) {
    try {
      if (!hooks.passesThreshold(task)) { res.skipped.push({ sourceTaskId: task.id, reason: 'below-threshold' }); continue; }
      res.passedGate += 1;
      const draft = hooks.derive(task);
      if (!draft) { res.skipped.push({ sourceTaskId: task.id, reason: 'derive-null' }); continue; }
      const dup = deps.hasRaised
        ? await deps.hasRaised(hooks.dept, draft.sourceTaskId, contentHashOf(draft))
        : isDuplicate(draft, hooks.dept, deps.ledger ?? []);
      if (dup) { res.deduped += 1; res.skipped.push({ sourceTaskId: task.id, reason: 'duplicate' }); continue; }
      drafts.push(draft);
    } catch (e) {
      res.skipped.push({ sourceTaskId: task.id, reason: `derive-error: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  for (const draft of capPerRun(drafts, cfg)) {
    try {
      const raisedTaskId = await deps.raise(draft, hooks.dept);
      res.raised.push({ raisedTaskId, sourceTaskId: draft.sourceTaskId });
    } catch (e) {
      res.skipped.push({ sourceTaskId: draft.sourceTaskId, reason: `raise-error: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  return res;
}

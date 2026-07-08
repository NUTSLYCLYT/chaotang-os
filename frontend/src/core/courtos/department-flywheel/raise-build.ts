// src/core/courtos/department-flywheel/raise-build.ts
// 纯函数：构造写库入参。无 @/ 值导入 → 可在 node --experimental-strip-types 下直接运行。
import { contentHashOf } from './dedupe.ts';
import type { DeptId, RaiseDraft } from './types.ts';

export function buildRaiseInput(draft: RaiseDraft, dept: DeptId) {
  const taskId = `dept_raise_${dept}_${contentHashOf(draft)}`;
  return {
    taskId,
    command: draft.command,
    title: draft.title,
    status: 'pending' as const,
    result: {
      sourceLabel: draft.reality,
      // 来源可区分:这是部门自动派生,不是人下旨
      flywheel: { dept, sourceTaskId: draft.sourceTaskId, auto: true, ...draft.meta },
    },
  };
}

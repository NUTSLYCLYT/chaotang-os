/** node --experimental-strip-types --test src/lib/department-learning/archive-correlation.nodetest.ts */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveArchiveConfirmation } from './archive-correlation.ts';

// ── 会审HIGH修复行为回归(2026-07-03)：taskId关联判定的真行为测试 ──
// real-source.ts 整体 import archive-store.ts(server-only)，无法在裸 node/tsx 里直接测
// applyDepartmentLearningRealSource(独立会审曾建议这么测，经验证不可行——连只 import
// real-source.ts 的一个具名导出也会因模块顶层 server-only import 而报错)。抽到
// archive-correlation.ts(零依赖)后，这段判定逻辑本身才能被真行为断言钉住，而不只是
// store.nodetest.ts 里的静态源码正则扫描(那个只能证明"字符串存在"，抓不住"比较方向反了"
// 这类真回归)。

test('taskId 匹配 + 归档确实存在 → 严格确认通过', () => {
  const result = resolveArchiveConfirmation({
    outcomeTaskId: 'task_abc',
    expectedTaskId: 'task_abc',
    archiveExists: true,
  });
  assert.equal(result.archiveConfirmed, true);
  assert.equal(result.usedStrictCheck, true, '双方taskId都在，必须走严格比对路径');
});

test('taskId 不匹配 → 即使归档存在也拒绝确认(这是HIGH修复的核心保证)', () => {
  const result = resolveArchiveConfirmation({
    outcomeTaskId: 'task_abc',
    expectedTaskId: 'task_xyz_不相关的归档',
    archiveExists: true,
  });
  assert.equal(result.archiveConfirmed, false, 'taskId对不上，绝不能因为"某个归档存在"就误判确认');
  assert.equal(result.usedStrictCheck, true);
});

test('taskId 匹配但归档实际不存在 → 不确认(不能只看taskId不看归档真实性)', () => {
  const result = resolveArchiveConfirmation({
    outcomeTaskId: 'task_abc',
    expectedTaskId: 'task_abc',
    archiveExists: false,
  });
  assert.equal(result.archiveConfirmed, false, 'taskId比对通过不能替代"归档真的存在"这个前提');
  assert.equal(result.usedStrictCheck, true);
});

test('outcome无taskId(旧库存量签核) → 退回弱校验，不强行拒绝', () => {
  const result = resolveArchiveConfirmation({
    outcomeTaskId: null,
    expectedTaskId: 'task_abc',
    archiveExists: true,
  });
  assert.equal(result.archiveConfirmed, true, '旧库缺taskId时应退回弱校验(仅查归档存在)，不是直接拒绝');
  assert.equal(result.usedStrictCheck, false, '缺任一方taskId时必须标记未走严格路径(供调用方决定要不要告警)');
});

test('调用方未传expectedTaskId → 退回弱校验', () => {
  const result = resolveArchiveConfirmation({
    outcomeTaskId: 'task_abc',
    expectedTaskId: undefined,
    archiveExists: true,
  });
  assert.equal(result.archiveConfirmed, true);
  assert.equal(result.usedStrictCheck, false);
});

test('双方都缺taskId + 归档不存在 → 弱校验下正确判不确认', () => {
  const result = resolveArchiveConfirmation({
    outcomeTaskId: null,
    expectedTaskId: undefined,
    archiveExists: false,
  });
  assert.equal(result.archiveConfirmed, false);
  assert.equal(result.usedStrictCheck, false);
});

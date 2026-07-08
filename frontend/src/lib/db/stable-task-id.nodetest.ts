import assert from 'node:assert/strict';
import test from 'node:test';

import { stableTaskId } from './primary-store.ts';

/**
 * 铁律4 回归（2026-07-01 · 修非幂等 taskId 制造 ×50 重复孤儿）：
 * 根因 = orchestrate 每次 `task_${randomUUID()}` → 同一会审命令复触就 INSERT 新行。
 * 修法 = taskId 由(租户,命令)内容稳定派生；upsertPrimaryTask 的 ON CONFLICT(id) 据此把"第 N 次"变 UPDATE。
 * 本断言钉死该 id 的不变量——会咬证明：把 stableTaskId 改回随机 → 此测试立刻红。
 */

test('同一命令 → 同一 taskId（重复触发去重的根基）', () => {
  const cmd = '请军机处围绕"客户要求正式报价，要不要发？"组织会审';
  assert.equal(stableTaskId(cmd), stableTaskId(cmd), '同命令必须派生同 id，否则会审复触又生孤儿');
});

test('折叠空白：仅空白差异视为同一命令', () => {
  assert.equal(stableTaskId('压价 清库存  风险'), stableTaskId('压价 清库存 风险'));
  assert.equal(stableTaskId('  审批预算12万 '), stableTaskId('审批预算12万'));
});

test('不同命令 → 不同 taskId（不误并真正相异的决策）', () => {
  assert.notEqual(stableTaskId('分析低温电池市场'), stableTaskId('审批市场部建设预算 12 万'));
  assert.notEqual(stableTaskId('压价清库存'), stableTaskId('压价清库存（华东区）'));
});

test('租户隔离：同命令不同租户 → 不同 id（不串台账）', () => {
  assert.notEqual(stableTaskId('现金流复核', 1), stableTaskId('现金流复核', 2));
});

test('id 形态：task_ 前缀 + 非空哈希', () => {
  const id = stableTaskId('任意命令');
  assert.match(id, /^task_[0-9a-z]+$/, 'id 必须是 task_ 前缀的可入库稳定串');
});

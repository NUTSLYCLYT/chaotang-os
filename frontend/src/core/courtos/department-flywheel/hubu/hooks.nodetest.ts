// src/core/courtos/department-flywheel/hubu/hooks.nodetest.ts
// 纯函数门：selectCandidates + passesThreshold（无 @/ 值导入，跑 test:core）。
// derive 测试因依赖 evaluateProject(@/ 值导入)，已移至 hooks.derive.itest.ts（test:node 覆盖）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectCandidates, passesThreshold } from './hooks-pure.ts';
import type { SourceTask } from '../types.ts';

const big: SourceTask = { id: 'b', title: '储能采购', command: '储能采购预算 80万 预期回报 2.5x 风险高', status: 'pending', updatedAt: '2026-06-28T02:00:00Z' };
const small: SourceTask = { id: 's', title: '买纸', command: '采购办公纸 2000', status: 'pending', updatedAt: 'x' };
const offtopic: SourceTask = { id: 'o', title: '招人', command: '招聘销售两名', status: 'pending', updatedAt: 'x' };

test('selectCandidates 只留户部语义', () => {
  const c = selectCandidates([big, small, offtopic]).map((t) => t.id);
  assert.deepEqual(c.sort(), ['b', 's']); // 都含采购;offtopic 不含
});

test('passesThreshold 金额≥50万才过', () => {
  assert.equal(passesThreshold(big), true);
  assert.equal(passesThreshold(small), false);
});

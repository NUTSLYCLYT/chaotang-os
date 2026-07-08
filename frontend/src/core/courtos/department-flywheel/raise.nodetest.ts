// src/core/courtos/department-flywheel/raise.nodetest.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRaiseInput } from './raise-build.ts';
import type { RaiseDraft } from './types';

const draft: RaiseDraft = {
  sourceTaskId: 't1', command: '审批储能采购预算 60万', title: '储能采购',
  priority: 80, reality: 'real', meta: { verdict: 'adjust' },
};

test('buildRaiseInput: dept_raise_ 前缀 + pending + 来源元数据', () => {
  const inp = buildRaiseInput(draft, 'hubu');
  assert.ok(inp.taskId.startsWith('dept_raise_hubu_'));
  assert.equal(inp.status, 'pending');
  assert.equal((inp.result.flywheel as Record<string, unknown>).dept, 'hubu');
  assert.equal((inp.result.flywheel as Record<string, unknown>).sourceTaskId, 't1');
  assert.equal(inp.result.sourceLabel, 'real');
});

test('buildRaiseInput: 绝不用 department_learning_ 前缀', () => {
  assert.ok(!buildRaiseInput(draft, 'hubu').taskId.startsWith('department_learning_'));
});

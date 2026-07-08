import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutionChain } from './execution-chain.ts';
test('入职责任链:每步有DRI+期限', () => {
  const c = buildExecutionChain('onboarding', '张三');
  assert.ok(c.steps.length >= 4);
  assert.ok(c.steps.every((s) => s.dri && s.dueDays > 0));
  assert.equal(c.swarm, 'personnel_execution_swarm');
});

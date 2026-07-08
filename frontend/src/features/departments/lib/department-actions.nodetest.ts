import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDepartmentActionTrueChainPlan,
  departmentActionLabel,
  normalizeDepartmentActionTarget,
  resolveDepartmentActionTarget,
} from './department-actions.ts';

test('department action labels are stable user-facing commands', () => {
  assert.equal(departmentActionLabel('handoff_gongbu'), '交工部补证');
  assert.equal(departmentActionLabel('request_evidence'), '补证');
  assert.equal(departmentActionLabel('unknown_action'), 'unknown_action');
});

test('handoff actions resolve target departments without client-provided target', () => {
  assert.equal(resolveDepartmentActionTarget({ action: 'handoff_legal' }), 'legal');
  assert.equal(resolveDepartmentActionTarget({ action: 'handoff_finance' }), 'finance');
  assert.equal(resolveDepartmentActionTarget({ action: 'handoff_gongbu' }), 'gongbu');
  assert.equal(resolveDepartmentActionTarget({ action: 'handoff_ops' }), 'ops');
});

test('explicit target department is normalized and invalid target is ignored', () => {
  assert.equal(resolveDepartmentActionTarget({ action: 'handoff_legal', targetDepartment: 'gongbu' }), 'gongbu');
  assert.equal(resolveDepartmentActionTarget({ action: 'handoff_legal', targetDepartment: 'unknown' }), 'legal');
  assert.equal(normalizeDepartmentActionTarget('works'), null);
});

test('true-chain plans expose explicit department endpoints without auto firing', () => {
  const gongbu = buildDepartmentActionTrueChainPlan('gongbu', {
    action: 'request_tests',
    reason: '补 PACK 测试证据',
  });
  assert.ok(gongbu);
  assert.equal(gongbu.endpoint, '/api/court/dept/gong-bu/feasibility');
  assert.equal(gongbu.payload.task_input, '补 PACK 测试证据');
  assert.match(gongbu.note, /不自动触发|页面加载不自动触发/);

  const personnel = buildDepartmentActionTrueChainPlan('personnel', {
    action: 'recruit_review',
    reason: '招聘销售负责人',
  });
  assert.ok(personnel);
  assert.equal(personnel.endpoint, '/api/court/dept/li-bu/recruit');
  assert.equal(personnel.payload.task_input, '招聘销售负责人');
});

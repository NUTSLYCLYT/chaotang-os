import test from 'node:test';
import assert from 'node:assert/strict';

import { annualLaborCost, computeRoi, HUBU_FINANCE_CAPABILITY, CAPABILITY_MENU } from './finance-capability.ts';

test('annualLaborCost = 月薪×12×1.4', () => {
  assert.equal(annualLaborCost(15000), 252000);
  assert.equal(annualLaborCost(null), null);
  assert.equal(annualLaborCost(0), null);
});
test('computeRoi = 价值/成本(2位)', () => {
  assert.equal(computeRoi(300000, 252000), 1.19);
  assert.equal(computeRoi(null, 252000), null);
  assert.equal(computeRoi(100000, 0), null);
  assert.equal(computeRoi(100000, null), null);
});
test('能力菜单登记户部财务能力(协办徽/发现用)', () => {
  assert.equal(HUBU_FINANCE_CAPABILITY.owner, '户部');
  assert.equal(CAPABILITY_MENU.hubu_finance, HUBU_FINANCE_CAPABILITY);
  assert.ok(HUBU_FINANCE_CAPABILITY.provides.includes('算ROI'));
});

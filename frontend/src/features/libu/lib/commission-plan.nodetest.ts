import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcCommission } from './commission-plan.ts';
const TIERS = [{ from: 0, rate: 0.01 }, { from: 100000, rate: 0.02 }, { from: 500000, rate: 0.03 }];
test('累进阶梯', () => {
  const r = calcCommission({ sales: 300000, tiers: TIERS });
  // 0-10万*1%=1000 + 10-30万*2%=4000 = 5000
  assert.equal(r.grossCommission, 5000);
});
test('回款挂钩:回款率折算', () => {
  const r = calcCommission({ sales: 300000, collected: 150000, tiers: TIERS });
  assert.equal(r.payable, 2500); // 5000*0.5
});
test('封顶', () => {
  const r = calcCommission({ sales: 1000000, tiers: TIERS, cap: 10000 });
  assert.equal(r.payable, 10000);
});

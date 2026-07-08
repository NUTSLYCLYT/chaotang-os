import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewHiring } from './hiring-review.ts';
test('没预算/成功标准→先定清楚再招', () => {
  const r = reviewHiring({ role: '销售总监', monthlySalary: 20000, expectedAnnualValue: 1000000, hasBudget: false, has90DayGoal: false, hasJD: true });
  assert.equal(r.verdict, 'define_first');
  assert.ok(r.blockers.includes('没预算'));
});
test('养不起→别招(ROI<1)', () => {
  const r = reviewHiring({ role: '助理', monthlySalary: 30000, expectedAnnualValue: 200000, hasBudget: true, has90DayGoal: true, hasJD: true });
  assert.equal(r.verdict, 'too_expensive');
  assert.ok(r.annualCost! > 200000);
});
test('齐全+ROI够→可招', () => {
  const r = reviewHiring({ role: '销售', monthlySalary: 10000, expectedAnnualValue: 500000, hasBudget: true, has90DayGoal: true, hasJD: true });
  assert.equal(r.verdict, 'hire');
  assert.ok(r.roi! > 1);
});

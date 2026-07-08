import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewHiringCrossDept } from './cross-dept-review.ts';
test('全pass→approved', () => {
  assert.equal(reviewHiringCrossDept({ role: '销售', talentMatch: 85, backgroundClear: true, roi: 2, hasBudget: true, competeRisk: false }).overall, 'approved');
});
test('没预算→blocked(worst-wins)', () => {
  const r = reviewHiringCrossDept({ role: '销售', talentMatch: 85, backgroundClear: true, roi: null, hasBudget: false, competeRisk: false });
  assert.equal(r.overall, 'blocked');
  assert.ok(r.blockers.some((b) => b.includes('户部')));
});
test('竞业风险→conditional', () => {
  const r = reviewHiringCrossDept({ role: '总监', talentMatch: 80, backgroundClear: true, roi: 2, hasBudget: true, competeRisk: true });
  assert.equal(r.overall, 'conditional');
});

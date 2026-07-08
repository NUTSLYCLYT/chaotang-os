import test from 'node:test';
import assert from 'node:assert/strict';

import { reviewTraining, type TrainingInput } from './training-review.ts';

function inp(over: Partial<TrainingInput> = {}): TrainingInput {
  return {
    role: '华东销售·谈判', trainingCost: 20000, expectedUpliftValue: 80000,
    hasGapAssessed: true, hasPlan: true, hasSuccessMetric: true, ...over,
  };
}

test('三件套齐 + ROI≥1 → 值得培', () => {
  const r = reviewTraining(inp());
  assert.equal(r.verdict, 'train');
  assert.equal(r.roi, 4);
});
test('缺投入 → 缺证·先补', () => {
  assert.equal(reviewTraining(inp({ trainingCost: null })).verdict, 'insufficient');
});
test('缺三件套任一 → 先定清楚再培(不直接培)', () => {
  assert.equal(reviewTraining(inp({ hasSuccessMetric: false })).verdict, 'define_first');
});
test('ROI<1 → 不值·别砸钱', () => {
  const r = reviewTraining(inp({ trainingCost: 100000, expectedUpliftValue: 50000 }));
  assert.equal(r.verdict, 'not_worth');
  assert.ok(r.roi != null && r.roi < 1);
});
test('缺预期增量 → 仍可培但 ROI 为 null(不替算)', () => {
  const r = reviewTraining(inp({ expectedUpliftValue: null }));
  assert.equal(r.roi, null);
  assert.equal(r.verdict, 'train');
});

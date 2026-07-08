import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credibilityWeight, weightedScore } from './credibility.ts';
test('高命中→加权trusted', () => {
  const c = credibilityWeight({ judge: '张经理', decisions: 10, correct: 9 });
  assert.equal(c.tier, 'trusted'); assert.equal(c.weight, 1.5);
});
test('样本不足→不加权', () => {
  assert.equal(credibilityWeight({ judge: '新人', decisions: 2, correct: 2 }).tier, 'unproven');
});
test('加权合并', () => {
  assert.equal(weightedScore([{ score: 90, weight: 1.5 }, { score: 60, weight: 0.6 }]), 81);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { reviewRiskTiming, type RiskTimingInput } from './risk-timing-review.ts';

function inp(over: Partial<RiskTimingInput> = {}): RiskTimingInput {
  return {
    decision: '要不要进这个大客户',
    supportingSignals: ['需求已验证', '现金充足'],
    explicitRedFlags: [],
    hasBaseline: true, hasWorstCase: true, hasReversibility: true, ...over,
  };
}

test('信号够+尽调齐+无红旗 → 可行动', () => {
  const r = reviewRiskTiming(inp());
  assert.equal(r.verdict, 'act');
  assert.equal(r.confidence, 1);
});
test('无任何依据 → 缺据', () => {
  assert.equal(reviewRiskTiming(inp({ supportingSignals: [], explicitRedFlags: [] })).verdict, 'insufficient');
});
test('未做尽调=风险信号 → 高不确定(非ROI,塔勒布)', () => {
  const r = reviewRiskTiming(inp({ hasWorstCase: false }));
  assert.equal(r.verdict, 'high_risk');
  assert.ok(r.redFlags.includes('没想过最坏情况'));
});
test('支持信号偏少 → 再观察', () => {
  assert.equal(reviewRiskTiming(inp({ supportingSignals: ['需求已验证'] })).verdict, 'watch');
});
test('有明确风险信号 → 高不确定,且给粗置信不给"一定"', () => {
  const r = reviewRiskTiming(inp({ explicitRedFlags: ['对方付款记录差'] }));
  assert.equal(r.verdict, 'high_risk');
  assert.ok(r.confidence != null && r.confidence < 1);
});

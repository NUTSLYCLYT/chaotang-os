import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveDecisionLadder, resolveEvidenceLadder } from './office-review.ts';

test('缺硬数字 → insufficient(最优先)', () => {
  assert.equal(resolveDecisionLadder({ missing: ['月薪'], blockers: ['没预算'], roi: 0.1 }), 'insufficient');
});
test('缺质门(数字齐)→ gate_fail', () => {
  assert.equal(resolveDecisionLadder({ missing: [], blockers: ['没预算'], roi: 5 }), 'gate_fail');
});
test('ROI<下限 → value_fail', () => {
  assert.equal(resolveDecisionLadder({ missing: [], blockers: [], roi: 0.8 }), 'value_fail');
});
test('extraValueFail 触发 value_fail(如编制占比超线)', () => {
  assert.equal(resolveDecisionLadder({ missing: [], blockers: [], roi: null, extraValueFail: true }), 'value_fail');
});
test('全齐 + ROI≥下限 → ok', () => {
  assert.equal(resolveDecisionLadder({ missing: [], blockers: [], roi: 2 }), 'ok');
});
test('roi 为 null 且无 extraValueFail → ok(不因缺 roi 误判)', () => {
  assert.equal(resolveDecisionLadder({ missing: [], blockers: [], roi: null }), 'ok');
});
test('自定义 roiFloor', () => {
  assert.equal(resolveDecisionLadder({ missing: [], blockers: [], roi: 1.5, roiFloor: 2 }), 'value_fail');
});

// ── 第二种阶梯:证据/置信(非ROI)──
test('证据阶梯:缺据 → insufficient', () => {
  assert.equal(resolveEvidenceLadder({ missing: ['判断依据'], supportingSignals: 3, redFlags: [] }), 'insufficient');
});
test('证据阶梯:有风险信号 → 高不确定', () => {
  assert.equal(resolveEvidenceLadder({ missing: [], supportingSignals: 3, redFlags: ['没想过最坏情况'] }), 'high_uncertainty');
});
test('证据阶梯:支持信号不足 → 证据薄', () => {
  assert.equal(resolveEvidenceLadder({ missing: [], supportingSignals: 1, redFlags: [] }), 'thin');
});
test('证据阶梯:信号够+无风险 → 证据充分', () => {
  assert.equal(resolveEvidenceLadder({ missing: [], supportingSignals: 3, redFlags: [] }), 'ample');
});

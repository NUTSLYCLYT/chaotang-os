/**
 * 东宫影子期标签回归断言(铁律4)。跑: pnpm test:node
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  classifyLabelConfidence,
  canGraduateCluster,
  isRubberStampPattern,
  QUICK_DECISION_MS,
  type DecisionContext,
} from './shadow-label.ts';

function ctx(o: Partial<DecisionContext> = {}): DecisionContext {
  return { blindReview: false, evidenceExpanded: true, decisionLatencyMs: 8000, highRisk: false, ...o };
}

// ── 标签可信度分级(防橡皮图章) ──
test('可信度:盲审→high(clean label)', () => {
  assert.equal(classifyLabelConfidence(ctx({ blindReview: true, decisionLatencyMs: 200 })), 'high');
});

test('可信度:高风险秒准未展开依据→low(rubber-stamp,最该警惕)', () => {
  assert.equal(classifyLabelConfidence(ctx({ highRisk: true, decisionLatencyMs: 300, evidenceExpanded: false })), 'low');
});

test('可信度:秒准未展开→low', () => {
  assert.equal(classifyLabelConfidence(ctx({ decisionLatencyMs: QUICK_DECISION_MS - 1, evidenceExpanded: false })), 'low');
});

test('可信度:认真看过(展开+用时长)→high', () => {
  assert.equal(classifyLabelConfidence(ctx({ decisionLatencyMs: 9000, evidenceExpanded: true })), 'high');
});

// ── 毕业:只认 high-confidence + 零误放 ──
test('毕业:足量high-confidence+高一致率+零误放→可申请', () => {
  assert.equal(canGraduateCluster({ highConfidenceCount: 12, agreementRate: 0.97, escapedErrors: 0 }).ok, true);
});

test('毕业:任一次误放出门→禁毕业(不对称:错放损信任)', () => {
  const r = canGraduateCluster({ highConfidenceCount: 50, agreementRate: 0.99, escapedErrors: 1 });
  assert.equal(r.ok, false);
  assert.ok(r.reason.includes('误放'));
});

test('毕业:high-confidence样本不足→拒(秒准不算数)', () => {
  assert.equal(canGraduateCluster({ highConfidenceCount: 3, agreementRate: 0.99, escapedErrors: 0 }).ok, false);
});

test('毕业:一致率不达标→拒', () => {
  assert.equal(canGraduateCluster({ highConfidenceCount: 20, agreementRate: 0.7, escapedErrors: 0 }).ok, false);
});

// ── 橡皮图章告警 ──
test('橡皮图章:连续秒准达阈值→corrigibility告警转盲审', () => {
  assert.equal(isRubberStampPattern(5).alarm, true);
  assert.equal(isRubberStampPattern(2).alarm, false);
});

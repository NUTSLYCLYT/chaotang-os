import { test } from 'node:test';
import assert from 'node:assert/strict';

import { crisisResponse } from './lifu-crisis.ts';

test('SCCT 姿态:preventable→rebuild / victim→deny;前科升级', () => {
  assert.equal(crisisResponse({ cluster: 'preventable', priorCrisisHistory: false, reach: 0.1, harm: 0.1, legalRisk: 0.1, velocity: 0.1 }).posture, 'rebuild');
  assert.equal(crisisResponse({ cluster: 'victim', priorCrisisHistory: false, reach: 0.1, harm: 0.1, legalRisk: 0.1, velocity: 0.1 }).posture, 'deny');
  // victim + 前科 → 升级为 diminish
  assert.equal(crisisResponse({ cluster: 'victim', priorCrisisHistory: true, reach: 0.1, harm: 0.1, legalRisk: 0.1, velocity: 0.1 }).posture, 'diminish');
});

test('严重度分层:高分→tier4 黄金1小时+全通知+人工门', () => {
  const r = crisisResponse({ cluster: 'preventable', priorCrisisHistory: false, reach: 0.9, harm: 0.9, legalRisk: 0.8, velocity: 0.9 });
  assert.equal(r.severityTier, 4);
  assert.match(r.sla, /黄金1小时/);
  assert.equal(r.notify.length, 4);
  assert.equal(r.needsSignoff, true);
});

test('低严重度→tier1 只通知内部,不强制签字', () => {
  const r = crisisResponse({ cluster: 'victim', priorCrisisHistory: false, reach: 0.1, harm: 0.1, legalRisk: 0.1, velocity: 0.1 });
  assert.equal(r.severityTier, 1);
  assert.deepEqual(r.notify, ['内部团队']);
  assert.equal(r.needsSignoff, false);
});

test('诚实:危机簇/严重度标人工裁量', () => {
  const r = crisisResponse({ cluster: 'accidental', priorCrisisHistory: false, reach: 0.3, harm: 0.3, legalRisk: 0.3, velocity: 0.3 });
  assert.ok(r.humanJudged.some((h) => h.includes('危机簇')));
});

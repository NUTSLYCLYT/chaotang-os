import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LIFU_ROSTER, LIFU_OFFICE_ORDER, lifuEngineStats, ACCENT } from './lifu-roster.ts';

test('礼部编制:8 司,对外增长部,诚实标真/骨架', () => {
  assert.equal(LIFU_OFFICE_ORDER.length, 8);
  assert.equal(Object.keys(LIFU_ROSTER).length, 8);
  const stats = lifuEngineStats();
  assert.equal(stats.total, 8);
  // 只有承诺门已接真实后端；其余纯客户端交互不得冒充 engine。
  assert.equal(LIFU_ROSTER.relationship_ledger.engine, false);
  assert.equal(LIFU_ROSTER.traffic_growth.engine, false);
  assert.equal(LIFU_ROSTER.pr_crisis.engine, false);
  assert.equal(LIFU_ROSTER.commitment_gate.engine, true);
  assert.equal(stats.real, 1);
  // 品牌文化偏定性→骨架不冒充(铁律5)
  assert.equal(LIFU_ROSTER.brand_culture.engine, false);
  assert.equal(ACCENT, '#C070D0');
});

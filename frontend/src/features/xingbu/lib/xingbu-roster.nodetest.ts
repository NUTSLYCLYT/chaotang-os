import { test } from 'node:test';
import assert from 'node:assert/strict';

import { XINGBU_ROSTER, XINGBU_OFFICE_ORDER, xingbuEngineStats } from './xingbu-roster.ts';
import { scanClauses } from '@/lib/swarm/clause-risk';

test('刑部编制:8 司,诚实标真/骨架(合同审查司已接真引擎)', () => {
  assert.equal(XINGBU_OFFICE_ORDER.length, 8);
  assert.equal(Object.keys(XINGBU_ROSTER).length, 8);
  const stats = xingbuEngineStats();
  assert.equal(stats.total, 8);
  assert.equal(stats.real, 2); // 合同审查司 + 缺证核查司已接真,余6骨架不冒充
  assert.equal(XINGBU_ROSTER.contract_review.engine, true);
  assert.equal(XINGBU_ROSTER.evidence_gate.engine, true);
  assert.equal(XINGBU_ROSTER.chief.engine, false);
});

test('捞自明镜:押金一律不退 → deposit_no_return(高危·带法条)', () => {
  const r = scanClauses('押金一律不退,概不退还。');
  const hit = r.risks.find((x) => x.type === 'deposit_no_return');
  assert.ok(hit);
  assert.equal(hit.severity, 'high');
  assert.match(hit.legalBasis ?? '', /民法典/);
});

test('捞自明镜:一切费用由乙方承担 → liability_shift(带法条)', () => {
  const r = scanClauses('所有维修费用由乙方承担。');
  const hit = r.risks.find((x) => x.type === 'liability_shift');
  assert.ok(hit);
  assert.match(hit.legalBasis ?? '', /民法典/);
});

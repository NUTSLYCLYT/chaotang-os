import assert from 'node:assert/strict';
import test from 'node:test';

import type { IntelSignal } from '@/lib/contracts/intel';
import {
  buildIntelDispatchPlan,
  claimTypeForSignal,
  entrySwarmForIntelDispatch,
  missingEvidenceForIntelDispatch,
  sourceLabelForSignalSource,
} from './signal-dispatch';

const baseSignal: IntelSignal = {
  id: 'sig_pack_001',
  category: 'opportunity',
  level: 'warning',
  title: 'North America battery pack demand spike',
  summary: 'A customer tender mentions 5MWh LFP pack requirements and BMS integration.',
  region: 'US',
  regionLabel: 'United States',
  industry: 'energy storage battery',
  credibility: 'high',
  sources: [
    {
      name: 'Tender bulletin',
      url: 'https://example.test/tender',
      publishedAt: '2026-06-20T00:00:00.000Z',
    },
  ],
  firstSeenAt: '2026-06-20T00:00:00.000Z',
  lastUpdatedAt: '2026-06-20T00:00:00.000Z',
  impactScore: 0.82,
};

test('signal dispatch maps Gongbu battery signal to pack_rd with evidence pack', () => {
  const plan = buildIntelDispatchPlan(baseSignal, {
    source: 'turso',
    targetAgents: ['gong_bu'],
    note: 'check evidence first',
  });

  assert.equal(plan.entrySwarm, 'pack_rd');
  assert.equal(plan.sourceLabel, 'LIVE');
  assert.equal(plan.evidenceBoundRun.entry_swarm, 'pack_rd');
  assert.equal(plan.evidenceBoundRun.intelligence_pack_id, 'jinyiwei_intel_sig_pack_001');
  assert.equal(plan.evidenceBoundRun.intelligence_pack.sourceLabel, 'LIVE');
  assert.deepEqual(plan.evidenceBoundRun.intelligence_pack.sourceUrls, ['https://example.test/tender']);
  assert.deepEqual(plan.evidenceBoundRun.intelligence_pack.financialSources?.map((source) => source.url), ['https://example.test/tender']);
  assert.ok(plan.evidenceBoundRun.evidence_refs.includes('intel_signal:sig_pack_001'));
  assert.ok(plan.command.includes('sig_pack_001'));
});

test('signal dispatch records uncertainty instead of upgrading weak evidence', () => {
  const weakSignal: IntelSignal = {
    ...baseSignal,
    id: 'sig_weak_001',
    credibility: 'low',
    sources: [],
  };

  assert.equal(sourceLabelForSignalSource('fallback'), 'FALLBACK');
  assert.equal(claimTypeForSignal(weakSignal), 'RUMOR');
  assert.equal(entrySwarmForIntelDispatch(weakSignal, ['xing_bu']), 'legal');
  assert.deepEqual(missingEvidenceForIntelDispatch(weakSignal), [
    'no_source_attached_to_signal',
    'source_url_missing',
    'credibility_not_verified:low',
    'single_source_or_less',
  ]);
});

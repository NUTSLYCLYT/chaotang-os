import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatYushiRejectionValue,
  isGuoliThinSliceEnabled,
  parseYushiRejectionMetric,
} from './guoli-overview';

const liveEnvelope = {
  success: true,
  error: null,
  data: {
    metrics: [
      {
        key: 'chancellor_bet_win_rate',
        label: '丞相押注胜率',
        status: 'NO_DATA',
        value: null,
        sample_size: 0,
      },
      {
        key: 'yushi_rejection_rate',
        label: '御史封驳率',
        status: 'LIVE',
        value: 0.5,
        sample_size: 4,
        reason: null,
        data_source: 'truth_ledger',
        verdict_source: 'deterministic_rules_gate',
        basis: 'truth_ledger swarm=yushi checker=court_doc_builder; red/black=封驳',
        window: {
          kind: 'ALL_RECORDED',
          start_at: '2026-07-15T08:00:00+00:00',
          end_at: '2026-07-17T09:00:00+00:00',
        },
        as_of: '2026-07-17T10:00:00+00:00',
        includes_demo: false,
      },
      {
        key: 'dept_sick_leave_rate',
        label: '各部告病率',
        status: 'NO_DATA',
        value: null,
        sample_size: 0,
      },
    ],
  },
};

test('selects only the Yushi metric and preserves backend fact metadata', () => {
  const metric = parseYushiRejectionMetric(liveEnvelope);

  assert.equal(metric.key, 'yushi_rejection_rate');
  assert.equal(metric.status, 'LIVE');
  assert.equal(metric.value, 0.5);
  assert.equal(metric.sampleSize, 4);
  assert.equal(metric.dataSource, 'truth_ledger');
  assert.equal(metric.window.startAt, '2026-07-15T08:00:00+00:00');
  assert.equal(metric.window.endAt, '2026-07-17T09:00:00+00:00');
  assert.equal(metric.includesDemo, false);
  assert.equal(formatYushiRejectionValue(metric), '50.0%');
});

test('NO_DATA never formats a fake percentage', () => {
  const envelope = structuredClone(liveEnvelope);
  const yushi = envelope.data.metrics[1];
  yushi.status = 'NO_DATA';
  yushi.value = null;
  yushi.sample_size = 0;
  yushi.reason = '尚无御史判决记录';
  yushi.window.start_at = null;
  yushi.window.end_at = null;

  const metric = parseYushiRejectionMetric(envelope);
  assert.equal(metric.status, 'NO_DATA');
  assert.equal(formatYushiRejectionValue(metric), null);
});

test('rejects an incomplete response instead of synthesizing source metadata locally', () => {
  const envelope = structuredClone(liveEnvelope);
  delete (envelope.data.metrics[1] as { as_of?: string }).as_of;

  assert.throws(() => parseYushiRejectionMetric(envelope));
});

test('thin slice defaults on and can be rolled back with an explicit off value', () => {
  assert.equal(isGuoliThinSliceEnabled(undefined), true);
  assert.equal(isGuoliThinSliceEnabled('true'), true);
  assert.equal(isGuoliThinSliceEnabled('false'), false);
  assert.equal(isGuoliThinSliceEnabled('unexpected'), false);
});

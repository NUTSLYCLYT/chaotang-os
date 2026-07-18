import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatYushiRejectionValue,
  isGuoliThinSliceEnabled,
  parseYushiRejectionMetric,
} from './guoli-overview';

// LIVE 的 window 必须结束在 as_of 且 as_of 新鲜(契约 fail-closed 校验),故用相对时间戳
// 构造有效 fixture,避免固定日期随真实时间流逝而失效。
const NOW_ISO = new Date().toISOString();
const WINDOW_START_ISO = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();

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
        sample_size: 20,
        reason: null,
        data_source: 'truth_ledger',
        verdict_source: 'deterministic_rules_gate',
        basis: 'truth_ledger swarm=yushi checker=court_doc_builder; 近7天窗口; red/black=封驳',
        window: {
          kind: 'ROLLING_7D',
          start_at: WINDOW_START_ISO,
          end_at: NOW_ISO,
        },
        as_of: NOW_ISO,
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
  assert.equal(metric.sampleSize, 20);
  assert.equal(metric.dataSource, 'truth_ledger');
  assert.equal(metric.window.kind, 'ROLLING_7D');
  assert.equal(metric.window.startAt, WINDOW_START_ISO);
  assert.equal(metric.window.endAt, NOW_ISO);
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

test('accepts backend honesty statuses (INSUFFICIENT_SAMPLE/STALE) instead of rejecting the contract', () => {
  for (const status of ['INSUFFICIENT_SAMPLE', 'STALE'] as const) {
    const envelope = structuredClone(liveEnvelope);
    const yushi = envelope.data.metrics[1] as Record<string, unknown>;
    yushi.status = status;
    yushi.value = null; // 非 LIVE 不带数值
    yushi.sample_size = status === 'STALE' ? 0 : 3;
    yushi.reason = '近 7 天御史判决不足，暂不判定';
    const metric = parseYushiRejectionMetric(envelope);
    assert.equal(metric.status, status);
    assert.equal(formatYushiRejectionValue(metric), null); // 绝不显示假比率
  }
});

test('accepts ROLLING_7D window on LIVE (metadata self-consistent with windowed value)', () => {
  const envelope = structuredClone(liveEnvelope);
  const yushi = envelope.data.metrics[1] as { window: { kind: string } };
  yushi.window.kind = 'ROLLING_7D';
  const metric = parseYushiRejectionMetric(envelope);
  assert.equal(metric.status, 'LIVE');
  assert.equal(metric.window.kind, 'ROLLING_7D');
});

test('non-LIVE status must not carry a numeric value (schema fails closed)', () => {
  const envelope = structuredClone(liveEnvelope);
  const yushi = envelope.data.metrics[1] as Record<string, unknown>;
  yushi.status = 'STALE';
  yushi.value = 0.5; // 违规：非 LIVE 带比率
  assert.throws(() => parseYushiRejectionMetric(envelope));
});

test('rejects a thin-sample LIVE at the contract boundary (misleading-LIVE guard)', () => {
  // 后端不会送 LIVE/n<20,但契约边界也要 fail-closed:任何来源送薄样本 LIVE 一律拒,
  // 不让"12.5% LIVE n=1"这类误导上屏。
  const envelope = structuredClone(liveEnvelope);
  (envelope.data.metrics[1] as { sample_size: number }).sample_size = 5;
  assert.throws(() => parseYushiRejectionMetric(envelope));
});

test('rejects an all-time-window LIVE (a windowed rate cannot be labeled all-time)', () => {
  const envelope = structuredClone(liveEnvelope);
  (envelope.data.metrics[1] as { window: { kind: string } }).window.kind = 'ALL_RECORDED';
  assert.throws(() => parseYushiRejectionMetric(envelope));
});

test('rejects an empty ROLLING_7D window on LIVE (null bounds)', () => {
  const envelope = structuredClone(liveEnvelope);
  const w = (envelope.data.metrics[1] as { window: { start_at: string | null; end_at: string | null } }).window;
  w.start_at = null;
  w.end_at = null;
  assert.throws(() => parseYushiRejectionMetric(envelope));
});

test('rejects a LIVE whose ROLLING_7D window is not ~7 days (mislabeled span)', () => {
  const envelope = structuredClone(liveEnvelope);
  const w = (envelope.data.metrics[1] as { window: { start_at: string; end_at: string } }).window;
  w.start_at = '2026-07-17T00:00:00+00:00'; // 仅 ~10 小时窗口冒充 ROLLING_7D
  w.end_at = '2026-07-17T10:00:00+00:00';
  assert.throws(() => parseYushiRejectionMetric(envelope));
});

test('rejects a stale 7-day window whose end does not match as_of', () => {
  // 一个 7 天跨度但结束在 7 天前的窗口(陈旧),as_of 仍是现在 → end 不贴 as_of,拒。
  const envelope = structuredClone(liveEnvelope);
  const w = (envelope.data.metrics[1] as { window: { start_at: string; end_at: string } }).window;
  w.end_at = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  w.start_at = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString();
  assert.throws(() => parseYushiRejectionMetric(envelope));
});

test('rejects a fully-stale LIVE whose as_of is too old (replay / stale cache)', () => {
  // 整体陈旧但自洽:as_of 2 天前、窗口贴着它 → 新鲜度门拒(as_of >24h)。
  const envelope = structuredClone(liveEnvelope);
  const m = envelope.data.metrics[1] as { as_of: string; window: { start_at: string; end_at: string } };
  const old = Date.now() - 2 * 24 * 60 * 60_000;
  m.as_of = new Date(old).toISOString();
  m.window.end_at = new Date(old).toISOString();
  m.window.start_at = new Date(old - 7 * 24 * 60 * 60_000).toISOString();
  assert.throws(() => parseYushiRejectionMetric(envelope));
});

test('rejects a future-dated LIVE', () => {
  const envelope = structuredClone(liveEnvelope);
  const m = envelope.data.metrics[1] as { as_of: string; window: { start_at: string; end_at: string } };
  const future = Date.now() + 60 * 60_000; // 1h 未来
  m.as_of = new Date(future).toISOString();
  m.window.end_at = new Date(future).toISOString();
  m.window.start_at = new Date(future - 7 * 24 * 60 * 60_000).toISOString();
  assert.throws(() => parseYushiRejectionMetric(envelope));
});

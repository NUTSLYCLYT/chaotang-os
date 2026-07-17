import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveHanlinLedgerView,
  normalizeHanlinSourceLabel,
} from './read-model.ts';

test('真实 truth-ledger payload 生成可展示的只读健康摘要', () => {
  const view = deriveHanlinLedgerView({
    sourceLabel: 'TRUTH_LEDGER',
    truthLedger: {
      total_entries: 7,
      deterministic_entries: 6,
      pass: 4,
      fail: 2,
      pass_rate: 0.667,
      authenticated_ratio: 0.5,
    },
  });

  assert.deepEqual(view, {
    sourceLabel: 'TRUTH_LEDGER',
    isAvailable: true,
    totalEntries: 7,
    deterministicEntries: 6,
    passed: 4,
    failed: 2,
    passRate: 0.667,
    authenticatedRatio: 0.5,
  });
});

test('声称 TRUTH_LEDGER 但缺健康度时 fail-closed 为 FALLBACK', () => {
  const view = deriveHanlinLedgerView({ sourceLabel: 'TRUTH_LEDGER', truthLedger: null });

  assert.equal(view.sourceLabel, 'FALLBACK');
  assert.equal(view.isAvailable, false);
  assert.equal(view.totalEntries, null);
});

test('只有非确定性记录不能被前端展示为真实离线判定', () => {
  const view = deriveHanlinLedgerView({
    sourceLabel: 'TRUTH_LEDGER',
    truthLedger: {
      total_entries: 3,
      deterministic_entries: 0,
      pass: 0,
      fail: 0,
      pass_rate: 0,
      authenticated_ratio: 0,
    },
  });

  assert.equal(view.sourceLabel, 'FALLBACK');
  assert.equal(view.isAvailable, false);
});

test('未知来源不能被前端升级成真实来源', () => {
  assert.equal(normalizeHanlinSourceLabel('LIVE'), 'FALLBACK');
  assert.equal(normalizeHanlinSourceLabel(undefined), 'FALLBACK');
  assert.equal(normalizeHanlinSourceLabel('TRUTH_LEDGER'), 'TRUTH_LEDGER');
});

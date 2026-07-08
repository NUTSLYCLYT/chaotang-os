import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeAliInquiry, screenAliLeads, DEFAULT_OVERSEAS_CRITERIA } from './ali-intl-feed.ts';

/**
 * 阿里国际站海外获客回归（2026-07-01）。会咬：删军品标记 → 军品出海询盘不被合规门拦（违法漏网）。
 */

test('归一：海外线索 overseas=true', () => {
  const l = normalizeAliInquiry({ id: '1', subject: 'lithium battery pack 48V', buyerCompany: 'EU Corp', detailUrl: 'https://alibaba.com/x' });
  assert.equal(l.overseas, true);
  assert.equal(l.channel, 'overseas');
});

test('🔴 军品出海询盘 → militaryRestricted → 合规门拦', () => {
  const l = normalizeAliInquiry({ id: '2', subject: 'military grade battery for missile', buyerCompany: 'Foreign Defense', detailUrl: 'https://alibaba.com/y' });
  assert.equal(l.militaryRestricted, true);
  const r = screenAliLeads([{ id: '2', subject: 'military grade battery for missile', buyerCompany: 'Foreign Defense', detailUrl: 'https://alibaba.com/y' }], DEFAULT_OVERSEAS_CRITERIA);
  assert.equal(r.summary.complianceBlocked, 1);
  assert.equal(r.qualified.length, 0);
});

test('民品锂电池询盘 → 过', () => {
  const r = screenAliLeads([{ id: '3', subject: 'lithium battery pack for solar', buyerCompany: 'Solar EU', detailUrl: 'https://alibaba.com/z' }], DEFAULT_OVERSEAS_CRITERIA);
  assert.equal(r.qualified.length, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import type { BingbuSalesItem, SalesRiskLevel } from '../../../lib/contracts/bingbu-sales.ts';
import {
  BINGBU_BACKEND_BUREAUS,
  BINGBU_ROSTER,
  countByBackendBureau,
  countByOffice,
  officesForItem,
  leadOfficeForItem,
} from './bingbu-roster.ts';

function item(over: Partial<BingbuSalesItem>): BingbuSalesItem {
  return {
    id: 't', title: 't', command: '', status: 'pending_review', priority: 'P1',
    counterparty: '—', stage: '—', amount: '—', risk_level: 'medium' as SalesRiskLevel,
    recommendation: '', terms: [], industry: '—', delivery: '—', prepayment: '—',
    asked_count: 1, created_at: '', updated_at: '', ...over,
  };
}

test('后端口径恰好 6 司，每司有角色与范围', () => {
  assert.deepEqual(BINGBU_BACKEND_BUREAUS.map((bureau) => bureau.name), [
    '销售司',
    '市场司',
    '渠道司',
    '客户司',
    '竞情司',
    '增长司',
  ]);
  for (const bureau of BINGBU_BACKEND_BUREAUS) {
    assert.ok(bureau.role.length > 0, `${bureau.id} 缺角色`);
    assert.ok(bureau.scope.length > 0, `${bureau.id} 缺范围`);
    assert.ok(bureau.seats.length > 0, `${bureau.id} 缺内部席位映射`);
  }
});

test('CRO 内部编制恰好 8 席，每席有真实岗位与职责', () => {
  assert.equal(BINGBU_ROSTER.length, 8);
  for (const o of BINGBU_ROSTER) {
    assert.ok(o.name.length > 0, `${o.id} 缺席位名`);
    assert.ok(o.role.length > 0, `${o.id} 缺真实岗位`);
    assert.ok(o.duty.length > 0, `${o.id} 缺职责`);
  }
});

test('officesForItem：报价问题 → 主办价策司（leadOffice 非尚书）', () => {
  const i = item({ command: '客户要求八折正式报价，要不要发？' });
  assert.ok(officesForItem(i).includes('pricing_deal_desk'), '报价应派价策司');
  assert.equal(leadOfficeForItem(i), 'pricing_deal_desk', '主办应为价策司而非尚书');
});

test('countByOffice：尚书永远经手（cro_chief 在每条内部派席里）', () => {
  const items = [
    item({ command: '客户要求正式报价' }),
    item({ command: '续约客户复购机会' }),
  ];
  const counts = countByOffice(items);
  assert.equal(counts.cro_chief, 2, '尚书经手全部 2 条');
  assert.ok(counts.pricing_deal_desk >= 1, '价策司至少经手报价那条');
});

test('countByBackendBureau：报价问题归入后端六司的销售司/竞情司', () => {
  const counts = countByBackendBureau([item({ command: '客户拿竞品压价，要求八折正式报价' })]);
  assert.ok(counts.sales >= 1, '销售司应接报价推进');
  assert.ok(counts.competitive >= 1, '竞情司应接竞品压价');
});

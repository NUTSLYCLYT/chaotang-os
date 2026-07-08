import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marginToDocument } from './quotation-document.ts';
import type { MarginResult } from '@/features/hubu/lib/sales-price-library';

const META = { docNo: '兵字〔2026〕第031号', date: '2026-06-29', handler: '销售司·王销' };
const PRICED: MarginResult = { product: '充电器', cost: 1500, sell: 2500, profit: 1000, marginPct: 40, customer: '天和', missing: [], note: '' };

test('真毛利→报价复核+未生效横幅(高风险门铁律13.2.5)', () => {
  const d = marginToDocument(PRICED, META);
  assert.equal(d.deptName, '兵部');
  assert.equal(d.deptKind, '销售专用章');
  assert.match(d.bluf, /报价 2,500 元.*毛利 1,000 元 \/ 40%/);
  assert.match(d.statusBanner ?? '', /未生效.*朱批.*禁外发/);
  assert.ok(d.evidence!.filter((e) => e.source === 'real').length >= 3);
});

test('毛利低于红线→风险告警', () => {
  const thin = marginToDocument({ ...PRICED, sell: 1700, profit: 200, marginPct: 11.8 }, { ...META, marginFloorPct: 20 });
  assert.ok(thin.risks!.some((r) => /低于.*红线|亏损风险/.test(r)));
});

test('缺一侧→诚实不替编毛利', () => {
  const d = marginToDocument({ ...PRICED, sell: null, profit: null, marginPct: null, missing: ['卖价'] }, META);
  assert.match(d.bluf, /无法核定|不替编/);
  assert.ok(d.evidence!.some((e) => e.source === 'missing'));
});

test('对外报价门恒在风险段(无论毛利高低)', () => {
  const d = marginToDocument(PRICED, META);
  assert.ok(d.risks!.some((r) => /高风险.*未过.*禁外发|联审.*朱批/.test(r)));
});

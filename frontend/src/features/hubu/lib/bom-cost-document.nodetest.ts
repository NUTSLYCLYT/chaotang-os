import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bomCostToDocument } from './bom-cost-document.ts';
import type { BomCost } from './bom-cost.ts';

const META = { docNo: '户字〔2026〕第018号', date: '2026-06-29', handler: '采购司·张账房' };

const REAL: BomCost = {
  product: '电动三轮电池包',
  totalCost: 14681,
  lines: [],
  breakdown: [
    { name: '电芯', amount: 9836, pct: 67 },
    { name: 'BMS', amount: 2400, pct: 16 },
    { name: '结构件', amount: 2445, pct: 17 },
  ],
  topCostDriver: { name: '电芯', pct: 67 },
  missing: [],
};

test('真成本→BLUF结论先行+标题+主导项议价建议', () => {
  const d = bomCostToDocument(REAL, META);
  assert.match(d.title, /电动三轮电池包.*成本核定/);
  assert.match(d.bluf, /14,681 元/);
  assert.match(d.bluf, /电芯占比 67%.*降本第一杠杆/);
  assert.equal(d.deptName, '户部');
  assert.equal(d.deptKind, '财政专用章');
});

test('真成本项→三色证据全标"真"', () => {
  const d = bomCostToDocument(REAL, META);
  const real = d.evidence!.filter((e) => e.source === 'real');
  assert.equal(real.length, 3);
  assert.match(real[0].text, /电芯 9,836 元（占 67%）/);
});

test('缺证→诚实不替估+缺项标missing', () => {
  const noCost: BomCost = { ...REAL, totalCost: null, topCostDriver: null, breakdown: [], missing: ['电芯单价', '充电器价'] };
  const d = bomCostToDocument(noCost, META);
  assert.match(d.bluf, /无法核定|户部不替你估/);
  const miss = d.evidence!.filter((e) => e.source === 'missing');
  assert.equal(miss.length, 2);
});

test('高风险报价门写进风险段(铁律13.2.5)', () => {
  const d = bomCostToDocument(REAL, META);
  assert.ok(d.risks!.some((r) => /高风险.*人工确认门|禁一键对外/.test(r)));
});

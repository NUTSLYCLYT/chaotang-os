import assert from 'node:assert/strict';
import test from 'node:test';

import { assessCostSanity, costSanityVerdict, splitNreFromCost } from './cost-sanity.ts';

/**
 * 御史台 ①层巡城兵回归（2026-07-01）：固化真抓到的"模具费污染"病。
 * 会咬证明：把 driver_not_cell 判定删掉 → 「电池盒模具主导」用例立刻不再 flag → 测试红。
 */

// 真案复刻：4串4Ah ¥94529/台，电池盒 52.9% 主导（模具费混入单台）。
const POLLUTED = {
  totalCost: 94529,
  topCostDriver: { name: '电池盒', pct: 52.9 },
  breakdown: [
    { name: '电池盒', amount: 50000, pct: 52.9 },
    { name: '电芯', amount: 30000, pct: 31.7 },
    { name: '模具费', amount: 14529, pct: 15.4 },
  ],
};

// 真案复刻：项目成本核算清单 ¥1234/台，电芯 78.6% 命脉，结构干净。
const CLEAN = {
  totalCost: 1234,
  topCostDriver: { name: '电芯', pct: 78.6 },
  breakdown: [
    { name: '电芯', amount: 970, pct: 78.6 },
    { name: '保护板', amount: 185, pct: 15 },
    { name: '外壳', amount: 44, pct: 3.5 },
  ],
};

test('污染案：命脉非电芯 → 御史 flag（必须咬住）', () => {
  const f = assessCostSanity(POLLUTED);
  assert.equal(costSanityVerdict(f), 'flag', '电池盒主导必须判 flag，否则模具费污染会蒙混过关');
  assert.ok(f.some((x) => x.code === 'driver_not_cell'));
  assert.ok(f.some((x) => x.code === 'nre_in_unit'), '显式模具费行应被 warn');
  assert.ok(f.some((x) => x.code === 'cost_outlier'), '¥94529/台 应判离谱');
});

test('干净案：电芯命脉 → ok（不误伤好数据）', () => {
  const f = assessCostSanity(CLEAN);
  assert.equal(costSanityVerdict(f), 'ok');
  assert.equal(f[0].code, 'sane');
});

test('未核定（缺价）不评 → 空，巡城兵不对没数的事说话', () => {
  assert.deepEqual(assessCostSanity({ totalCost: null, topCostDriver: null, breakdown: [] }), []);
});

test('根治：剥掉模具费后露出真命脉电芯 → stillSuspect=false', () => {
  const s = splitNreFromCost({ totalCost: 1000, breakdown: [
    { name: '电芯', amount: 600, pct: 60 },
    { name: '保护板', amount: 200, pct: 20 },
    { name: '模具费', amount: 200, pct: 20 },
  ] });
  assert.equal(s.nreCost, 200, '模具费应被剥出');
  assert.equal(s.unitCost, 800, '真单台成本 = 总 − 一次性费');
  assert.equal(s.topUnitDriver?.name, '电芯', '剥后命脉是电芯');
  assert.equal(s.stillSuspect, false);
});

test('诚实：剥模具费后电池盒仍主导（含糊·非NRE）→ stillSuspect=true 不硬猜', () => {
  const s = splitNreFromCost({ totalCost: 1000, breakdown: [
    { name: '电池盒', amount: 500, pct: 50 },
    { name: '电芯', amount: 300, pct: 30 },
    { name: '模具费', amount: 200, pct: 20 },
  ] });
  assert.equal(s.unitCost, 800);
  assert.equal(s.topUnitDriver?.name, '电池盒');
  assert.equal(s.stillSuspect, true, '电池盒非电芯且非NRE→只能人工核，不替判定');
});

test('未核定 → 空 split', () => {
  const s = splitNreFromCost({ totalCost: null, breakdown: [] });
  assert.equal(s.unitCost, null);
});

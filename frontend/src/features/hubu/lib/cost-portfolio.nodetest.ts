import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCostPortfolio } from './cost-portfolio.ts';

/**
 * 户部成本数据管道回归（2026-07-01）：BOM rows → 真成本 + 御史巡查 → 三分类。
 * 会咬证明：改坏分类逻辑（如把 flagged 算进 clean）→ 用例红。
 */

// 干净：电芯为命脉（¥985，电芯 81%）。
const CLEAN_BOM: unknown[][] = [
  ['物料名称', '数量', '单价', '金额'],
  ['电芯', 16, 50, 800],
  ['保护板', 1, 185, 185],
];

// 污染：电池盒主导 + 显式模具费（命脉非电芯 → 御史 flag）。
const POLLUTED_BOM: unknown[][] = [
  ['物料名称', '数量', '金额'],
  ['电池盒', 1, 500],
  ['电芯', 16, 300],
  ['模具费', 1, 200],
];

// 未核定：只有物料清单、无单价/金额列。
const UNCOSTED_BOM: unknown[][] = [
  ['物料名称', '数量', '单位'],
  ['电芯', 16, '支'],
];

test('三分类：干净/污染/未核定 各归其位', () => {
  const p = buildCostPortfolio([
    { file: 'clean.xls', product: '干净电池组', rows: CLEAN_BOM },
    { file: 'polluted.xls', product: '污染电池组', rows: POLLUTED_BOM },
    { file: 'uncosted.xls', product: '无价电池组', rows: UNCOSTED_BOM },
  ]);
  assert.equal(p.summary.total, 3);
  assert.equal(p.summary.clean, 1, '电芯命脉的应进 clean');
  assert.equal(p.summary.flagged, 1, '电池盒主导的应进 flagged（模具费污染）');
  assert.equal(p.summary.uncosted, 1, '缺价的应进 uncosted');
  assert.equal(p.clean[0].product, '干净电池组');
  assert.equal(p.flagged[0].product, '污染电池组');
  assert.equal(p.uncosted[0].product, '无价电池组');
});

test('可信档真成本被算出（电芯81%命脉）', () => {
  const p = buildCostPortfolio([{ file: 'c.xls', product: 'X', rows: CLEAN_BOM }]);
  assert.equal(p.clean[0].totalCost, 985);
  assert.equal(p.clean[0].topDriver, '电芯');
});

test('空输入 → 全 0，不炸', () => {
  const p = buildCostPortfolio([]);
  assert.deepEqual(p.summary, { total: 0, costed: 0, clean: 0, flagged: 0, uncosted: 0 });
});

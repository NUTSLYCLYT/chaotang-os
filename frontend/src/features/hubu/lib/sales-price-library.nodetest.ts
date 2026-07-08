import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSalesLedger, computeMargin } from './sales-price-library.ts';
import { parsePriceLedger } from './price-library.ts';

const SALES = [
  ['序号', '项目名称', '成交数量', '单价', '已成交总价'],
  [1, '充电器', 25, 2500, 62500],
  [2, '雷达启动', 2, 22000, 44000],
];
const BUY = [
  ['', '采购日期', '供应商名称', '物料名称', '型号规格', '单位', '采购数量', '单价'],
  ['', 45200, '甲', '充电器', '60V', '个', 100, 1500],
];

test('parseSalesLedger：产品+卖价', () => {
  const { records } = parseSalesLedger(SALES);
  assert.equal(records.length, 2);
  assert.equal(records[0].material, '充电器');
  assert.equal(records[0].unitPrice, 2500);
});

test('computeMargin：买卖都有→真毛利', () => {
  const cost = parsePriceLedger(BUY).records;
  const sell = parseSalesLedger(SALES).records;
  const m = computeMargin('充电器', cost, sell, '2026-06-28');
  assert.equal(m.cost, 1500);
  assert.equal(m.sell, 2500);
  assert.equal(m.profit, 1000);
  assert.equal(m.marginPct, 40);
  assert.match(m.note, /毛利 1000.*卖 2500.*买 1500/);
});

test('computeMargin：缺卖价→待裁不编', () => {
  const cost = parsePriceLedger(BUY).records;
  const m = computeMargin('充电器', cost, [], '2026-06-28');
  assert.equal(m.profit, null);
  assert.match(m.note, /待裁/);
});

test('computeMargin：自制品传BOM成本算毛利', () => {
  const sell = parseSalesLedger(SALES).records;
  const m = computeMargin('雷达启动', [], sell, '2026-06-28', 15000);
  assert.equal(m.cost, 15000);
  assert.equal(m.profit, 22000 - 15000);
});

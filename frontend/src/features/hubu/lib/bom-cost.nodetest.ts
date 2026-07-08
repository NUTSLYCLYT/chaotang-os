import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBomRows, analyzeBomCost } from './bom-cost.ts';

// 合成 BOM(仿真实结构:表头关键词 + 明细 + 合计行),不依赖真实文件。
const ROWS: unknown[][] = [
  ['', '', '某电池组', '', '', ''],
  ['序号', '物料名称', '物料规格', '数量', '单价', '合计'],
  [1, '电芯', '32Ah', 32, 300, 9600],
  [2, '电池壳', '铝壳', 1, 2000, 2000],
  [3, '保护板', '8串', 1, 400, ''], // 缺金额→由 qty×price 估
  ['', '合计', '', '', '', 11600],
];

test('parseBomRows：按表头关键词鲁棒识别 + 总成本 + 成本结构占比', () => {
  const bom = parseBomRows(ROWS, '某电池组');
  assert.equal(bom.lines.length, 3);
  assert.equal(bom.totalCost, 9600 + 2000 + 400); // 保护板 1×400 估出
  assert.equal(bom.topCostDriver?.name, '电芯');
  assert.ok(bom.topCostDriver != null && bom.topCostDriver.pct > 60);
  assert.equal(bom.missing.length, 0);
});

test('analyzeBomCost：给售价→真毛利；给行业→内外对比', () => {
  const bom = parseBomRows(ROWS, '某电池组');
  const a = analyzeBomCost(bom, 15000, 55);
  assert.ok(a.grossMargin != null && a.grossMargin.profit === 15000 - 12000);
  assert.match(a.comparison?.note ?? '', /电芯.*vs.*高于/);
  assert.match(a.verdict, /总成本.*电芯.*毛利/);
});

test('缺单价/金额 → 诚实标缺，不编总成本', () => {
  const noPriceRows: unknown[][] = [
    ['序号', '物料名称', '数量', '单价', '合计'],
    [1, '电芯', 32, '', ''],
  ];
  const bom = parseBomRows(noPriceRows);
  assert.equal(bom.totalCost, null);
  assert.match(bom.missing.join(''), /缺单价|未识别/);
});

test('认不出表头 → 诚实标缺，不崩', () => {
  const bom = parseBomRows([['乱七八糟', '没有表头']]);
  assert.equal(bom.totalCost, null);
  assert.ok(bom.missing.length > 0);
});

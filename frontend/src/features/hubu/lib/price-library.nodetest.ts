import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePriceLedger, queryPrice, queryPriceSmart, extractSpecTokens, priceFreshness, excelDateToISO } from './price-library.ts';

const ROWS: unknown[][] = [
  ['', '采购日期', '供应商名称', '物料名称', '型号规格', '单位', '采购数量', '单价', '金额'],
  ['', 44562, '甲供应商', '保护板', '20串60V', '块', 10, 70, 700], // 2022
  ['', 45200, '乙供应商', '保护板', '20串60V', '块', 50, 65, 3250], // 2023(更近·更低)
  ['', 44562, '丙供应商', '电芯', 'LFP32Ah', '支', 100, 42, 4200],
];

test('excelDateToISO：序列转日期 + 容忍文本', () => {
  assert.equal(excelDateToISO(44562), '2022-01-01');
  assert.equal(excelDateToISO('2024/1/2'), '2024-01-02');
  assert.equal(excelDateToISO(''), null);
});

test('parsePriceLedger：抽真采购记录(物料+单价+日期+供应商)', () => {
  const { records } = parsePriceLedger(ROWS);
  assert.equal(records.length, 3);
  assert.equal(records[0].material, '保护板');
  assert.equal(records[0].unitPrice, 70);
});

test('queryPrice：同料多价→区间+趋势+取最近 + 时效灯', () => {
  const q = queryPrice(parsePriceLedger(ROWS).records, '保护板', '2026-06-28');
  assert.equal(q.matched, true);
  assert.equal(q.recordCount, 2);
  assert.equal(q.recentPrice, 65); // 取最近(2023)
  assert.deepEqual(q.range, { min: 65, max: 70 });
  assert.equal(q.trend, 'down'); // 70→65
  assert.equal(q.freshness, 'stale'); // 2023 vs 2026 >1年
});

test('queryPrice：匹配不到→缺证不估', () => {
  const q = queryPrice(parsePriceLedger(ROWS).records, '外壳', '2026-06-28');
  assert.equal(q.matched, false);
  assert.equal(q.recentPrice, null);
  assert.match(q.note, /缺证|没找到/);
});

test('priceFreshness：近3月🟢/3-12月🟡/超1年🔴', () => {
  assert.equal(priceFreshness('2026-05-01', '2026-06-28'), 'fresh');
  assert.equal(priceFreshness('2025-10-01', '2026-06-28'), 'aging');
  assert.equal(priceFreshness('2022-01-01', '2026-06-28'), 'stale');
  assert.equal(priceFreshness(null, '2026-06-28'), 'unknown');
});

test('extractSpecTokens：抽容量/电压/化学/串数', () => {
  const t = extractSpecTokens('LFP磷酸铁锂 32Ah 20串 64V');
  assert.ok(t.includes('32ah') && t.includes('磷酸铁锂') && t.includes('20串') && t.includes('64v'));
});

test('queryPriceSmart：规格匹配过滤错型号 + 剔离群 + 稳健价', () => {
  const recs = parsePriceLedger([
    ['', '采购日期', '供应商名称', '物料名称', '型号规格', '单位', '采购数量', '单价'],
    ['', 45200, 'A', '电芯', 'LFP 32Ah', '支', 100, 40],
    ['', 45200, 'B', '电芯', 'LFP 32Ah', '支', 100, 42],
    ['', 45200, 'C', '电芯', '18650 小', '支', 100, 13.6], // 错型号,规格匹配应过滤
    ['', 45200, 'D', '电芯', 'LFP 32Ah', '支', 1, 400], // 打样离群,应剔
  ]).records;
  const q = queryPriceSmart(recs, '电芯', 'LFP 32Ah', '2026-06-28');
  assert.equal(q.matched, true);
  assert.ok(q.robustPrice! >= 40 && q.robustPrice! <= 42, `稳健价应~41,实=${q.robustPrice}`); // 13.6被规格过滤,400被剔离群
  assert.ok(q.outliers.includes(400), '400打样应进离群');
});

test('queryPriceSmart：没给规格+多种价 → 标待裁(不静默猜)', () => {
  const recs = parsePriceLedger([
    ['', '采购日期', '供应商名称', '物料名称', '型号规格', '单位', '采购数量', '单价'],
    ['', 45200, 'A', '电芯', 'LFP 32Ah', '支', 100, 40],
    ['', 45200, 'B', '电芯', 'LFP 100Ah', '支', 100, 130],
  ]).records;
  const q = queryPriceSmart(recs, '电芯', '', '2026-06-28');
  assert.equal(q.needsHumanRuling, true);
  assert.match(q.ruleReason ?? '', /规格|指定/);
});

test('queryPriceSmart：要了规格台账却没有 → 待裁,不静默退错型号', () => {
  const recs = parsePriceLedger([
    ['', '采购日期', '供应商名称', '物料名称', '型号规格', '单位', '采购数量', '单价'],
    ['', 45200, 'A', '电芯', '18650 小', '支', 100, 13.5],
  ]).records;
  const q = queryPriceSmart(recs, '电芯', 'LFP 32Ah', '2026-06-28'); // 台账只有18650,没32Ah
  assert.equal(q.needsHumanRuling, true);
  assert.match(q.ruleReason ?? '', /台账无.*规格|补该规格/);
});

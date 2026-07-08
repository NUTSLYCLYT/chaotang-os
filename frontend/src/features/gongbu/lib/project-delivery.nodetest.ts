import assert from 'node:assert/strict';
import test from 'node:test';

import { parseProjectLedger, buildDeliveryPortfolio } from './project-delivery.ts';

/**
 * 工部项目交付完整度回归（2026-07-01）。会咬：把缺件算成"有"→ incomplete 用例红。
 */
const ROWS: unknown[][] = [
  ['项目编号', '客户名称', '电池型号', '电压', '容量', '组合方式', '文件时间', '项目进度表', '工艺', 'BOM', '图纸', '技术方案', '成品规格书', '客户信息表', '成品照片', '测试报告'],
  ['MSJ001', '60所', '18650-2200', '25.2', '2Ah', '7S1P', '', '', '有', '有', '有', '有', '有', '', '有', '有'], // 齐
  ['MSJ002', '玄众电子', '18650-2600', '14.4', '13Ah', '4S5P', '', '', '有', '有', '', '', '有', '', '', ''], // 缺图纸/技术方案/测试报告
];

test('解析真表结构 + 交付件核对', () => {
  const p = parseProjectLedger(ROWS, '2018');
  assert.equal(p.length, 2);
  assert.equal(p[0].missing.length, 0, 'MSJ001 六件齐');
  assert.ok(p[1].missing.includes('图纸'));
  assert.ok(p[1].missing.includes('测试报告'));
});

test('缺件项目进 incomplete（工部追缺·缺多排前）', () => {
  const port = buildDeliveryPortfolio(parseProjectLedger(ROWS, '2018'));
  assert.equal(port.summary.total, 2);
  assert.equal(port.summary.complete, 1);
  assert.equal(port.summary.incomplete, 1);
  assert.equal(port.incomplete[0].no, 'MSJ002');
});

test('空表不炸', () => {
  assert.deepEqual(parseProjectLedger([]), []);
  assert.equal(buildDeliveryPortfolio([]).summary.total, 0);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSalesContracts, buildSalesPortfolio } from './sales-ledger.ts';

/**
 * 礼部客户经营引擎回归（2026-07-01）。会咬：删客户向下填充 → 同客户多合同散成"未署名"用例红。
 */
const ROWS: unknown[][] = [
  ['天和销售合同统计表'],
  ['序号', '客户名称', '签订日期', '合同编号', '产品名称', '规格型号', '总金额', '付款方式'],
  ['1', '西安天伟电子', '2022年5月11日', 'M001', '控制器电池', 'TLH-1106A', '￥151,800 ', '30%预付'],
  ['2', null, '2022年5月11日', 'M002', '保险模块', 'YK10B', '￥633,220 ', '30%预付'],
  ['3', '航天恒星', '2022年6月1日', 'M003', '锂离子电池', 'MS18650', '￥195,840 ', '全款'],
];

test('解析真表 + 客户向下填充（同客户多合同不散架）', () => {
  const c = parseSalesContracts(ROWS);
  assert.equal(c.length, 3);
  assert.equal(c[0].customer, '西安天伟电子');
  assert.equal(c[1].customer, '西安天伟电子', '第2行客户名空→应填充为西安天伟');
  assert.equal(c[0].amount, 151800, '￥151,800 应解析为数字');
});

test('客户聚合（成交额降序）', () => {
  const p = buildSalesPortfolio(parseSalesContracts(ROWS));
  assert.equal(p.summary.contractCount, 3);
  assert.equal(p.summary.customerCount, 2);
  assert.equal(p.summary.totalAmount, 151800 + 633220 + 195840);
  assert.equal(p.customers[0].customer, '西安天伟电子', '785020 最大应排第一');
  assert.equal(p.customers[0].contractCount, 2);
});

test('空表不炸', () => {
  assert.deepEqual(parseSalesContracts([]), []);
  assert.equal(buildSalesPortfolio([]).summary.customerCount, 0);
});

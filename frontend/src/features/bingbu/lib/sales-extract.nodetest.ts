import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanSalesQuestion,
  extractSalesFacts,
  gradeSalesRisk,
  dedupeByQuestion,
} from './sales-extract.ts';

test('cleanSalesQuestion：剥掉"请军机处围绕『X』组织会审"还原真问题', () => {
  const raw = '请军机处围绕“客户要求正式报价，要不要发？”组织会审，重点核查证据、风险、缺口、责任';
  assert.equal(cleanSalesQuestion(raw), '客户要求正式报价，要不要发？');
});

test('extractSalesFacts：从真句抽出全部字段（来自用户原话，不编）', () => {
  const f = extractSalesFacts('是否签下这个新能源储能项目的120万供货合同?客户要求30天交付、预付款30万、独家供应条款。');
  assert.equal(f.amount, '120 万');
  assert.equal(f.prepayment, '30 万');
  assert.equal(f.deliveryDays, 30);
  assert.equal(f.dealType, '供货合同');
  assert.equal(f.industry, '新能源');
  assert.ok(f.terms.includes('独家条款'), '应抽出独家条款');
  assert.ok(f.terms.includes('预付款'), '应抽出预付款');
});

test('extractSalesFacts：抽不到的字段留 undefined（诚实空，绝不假填）', () => {
  const f = extractSalesFacts('要不要继续跟这个客户？');
  assert.equal(f.amount, undefined);
  assert.equal(f.deliveryDays, undefined);
  assert.equal(f.prepayment, undefined);
  assert.equal(f.terms.length, 0);
});

test('gradeSalesRisk：独家/违约/付款→critical；普通报价→不升到 critical', () => {
  const hi = '客户要签独家代理合同，含违约金';
  assert.equal(gradeSalesRisk(hi, extractSalesFacts(hi)), 'critical');
  const mid = '客户压价要谈判，怎么回复';
  assert.notEqual(gradeSalesRisk(mid, extractSalesFacts(mid)), 'critical');
});

test('dedupeByQuestion（CRITICAL 回归）：同一问题刷 N 次 → 1 条 + askedCount=N', () => {
  const tasks = [
    { id: '1', cmd: '请军机处围绕“客户要求正式报价，要不要发？”组织会审' },
    { id: '2', cmd: '请军机处围绕“客户要求正式报价，要不要发？”组织会审，重点核查' },
    { id: '3', cmd: '请军机处围绕“客户要求正式报价，要不要发？”组织会审，缺口责任' },
    { id: '4', cmd: '是否签120万独家供货合同？' },
  ];
  const out = dedupeByQuestion(tasks, (t) => t.cmd);
  assert.equal(out.length, 2, '4 条应去重为 2 条');
  const quote = out.find((o) => o.item.id === '1');
  assert.equal(quote?.askedCount, 3, '正式报价问题被问 3 次');
});

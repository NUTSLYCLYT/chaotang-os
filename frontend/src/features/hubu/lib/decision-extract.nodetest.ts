/**
 * 一句话决策抽取器回归测试。
 * 跑：npx --yes tsx --test src/features/hubu/lib/decision-extract.nodetest.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractDecisionFromText } from './decision-extract.ts';

test('完整一句话:抽全字段', () => {
  const r = extractDecisionFromText('我想花8万投短视频带货，预计回报2.6倍，5个月回本，现金还够，风险中等');
  assert.equal(r.budget, '8万');
  assert.equal(r.roi, '2.6倍');
  assert.equal(r.payback, '5个月');
  assert.equal(r.cash, '现金充裕');
  assert.equal(r.risk, 'medium');
  assert.ok(r.title.length > 0);
});

test('百分比回报 + 现金紧 + 高风险', () => {
  const r = extractDecisionFromText('投15万开新店，回报大概30%，要贷款，没把握');
  assert.equal(r.budget, '15万');
  assert.equal(r.roi, '30%');
  assert.equal(r.cash, '现金紧张');
  assert.equal(r.risk, 'high');
});

test('紧急/不可逆 → critical', () => {
  const r = extractDecisionFromText('要不要押上身家赌一把，投50万');
  assert.equal(r.risk, 'critical');
  assert.equal(r.budget, '50万');
});

test('单位不冲突:个月不被当回报', () => {
  const r = extractDecisionFromText('花3万，12个月回本');
  assert.equal(r.budget, '3万');
  assert.equal(r.payback, '12个月');
  assert.equal(r.roi, ''); // 没有倍/%，roi 应为空
});

test('空/无数字:不崩，title 兜底', () => {
  const r = extractDecisionFromText('要不要做这件事');
  assert.equal(r.budget, '');
  assert.equal(r.risk, 'medium');
  assert.ok(r.title.length > 0);
});

test('x 倍数写法', () => {
  const r = extractDecisionFromText('投8万买设备扩产，回报2.6x，稳');
  assert.equal(r.roi, '2.6x');
  assert.equal(r.risk, 'low');
});

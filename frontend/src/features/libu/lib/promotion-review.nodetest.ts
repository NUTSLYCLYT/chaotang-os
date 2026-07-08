import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePromotionRows } from './promotion-review.ts';

const HEADER = ['序号', '评价维度', '内容', '评价标准', '分值', '评分', '评价'];
const FILLED: unknown[][] = [
  ['某员工转正评价表'], HEADER,
  [1, '企业文化', '理解', '标准', 20, 18, ''],
  [2, '专业知识', '掌握', '标准', 50, 42, ''],
  [3, '销售业绩', '达成', '标准', 30, 25, ''],
  ['本人签字', '', '', '', '', '', ''],
];

test('已填评分→总分+转正建议', () => {
  const r = parsePromotionRows(FILLED, '某员工');
  assert.equal(r.dims.length, 3);
  assert.equal(r.maxTotal, 100);
  assert.equal(r.totalScore, 85);
  assert.equal(r.scorePct, 85);
  assert.equal(r.verdict, 'promote'); // 85%>=80
  assert.match(r.note, /85.*准予转正/);
});

test('中分→延长(65%);低分→不予(40%)', () => {
  const mid = [HEADER, [1, '维度A', '', '', 50, 35, ''], [2, '维度B', '', '', 50, 30, '']];
  assert.equal(parsePromotionRows(mid).verdict, 'extend'); // 65%
  const low = [HEADER, [1, '维度A', '', '', 50, 22, ''], [2, '维度B', '', '', 50, 18, '']];
  assert.equal(parsePromotionRows(low).verdict, 'reject'); // 40%
});

test('空模板(评分全空)→诚实insufficient,不替老板打分', () => {
  const blank = [HEADER, [1, '企业文化', '', '', 20, '', ''], [2, '专业知识', '', '', 50, '', '']];
  const r = parsePromotionRows(blank);
  assert.equal(r.verdict, 'insufficient');
  assert.equal(r.totalScore, null);
  assert.match(r.note, /评分不全|不替你打分/);
});

test('签字/备注行不当评分维度', () => {
  const r = parsePromotionRows(FILLED, '某员工');
  assert.ok(!r.dims.some((d) => d.dimension.includes('签字')));
});

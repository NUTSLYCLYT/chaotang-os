import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCompBand, suggestOffer, meritIncrease } from './compensation-band.ts';
test('带宽:mid±20%', () => {
  const b = buildCompBand('P5', 10000);
  assert.equal(b.min, 8000); assert.equal(b.max, 12000);
});
test('定薪:新人低分位/专家高分位', () => {
  const b = buildCompBand('P5', 10000);
  assert.equal(suggestOffer(b, 'junior').salary, 9000);
  assert.equal(suggestOffer(b, 'expert').salary, 11000);
});
test('调薪矩阵:绩优低分位涨最多,绩差不涨', () => {
  const b = buildCompBand('P5', 10000);
  assert.equal(meritIncrease(8000, b, 'A').pct, 0.15); // 低分位+A
  assert.equal(meritIncrease(8000, b, 'C').pct, 0);    // C不涨
});
test('缺市场中位→标缺', () => {
  assert.equal(buildCompBand('P5', null).mid, null);
});

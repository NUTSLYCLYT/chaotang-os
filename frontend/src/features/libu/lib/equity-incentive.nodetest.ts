import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcEsop } from './equity-incentive.ts';
test('未过cliff→归属0', () => {
  const r = calcEsop({ totalShares: 1000000, poolPct: 0.15, grantShares: 10000, strikePrice: 1, monthsElapsed: 6 });
  assert.equal(r.vestedShares, 0);
  assert.match(r.note, /cliff/);
});
test('过cliff→按月归属+占比+行权成本', () => {
  const r = calcEsop({ totalShares: 1000000, poolPct: 0.15, grantShares: 10000, strikePrice: 2, monthsElapsed: 24 });
  assert.equal(r.grantPctOfCompany, 1); // 10000/1000000
  assert.equal(r.vestedShares, 5000);   // 24/48
  assert.equal(r.exerciseCost, 10000);  // 5000*2
});
test('红线始终在', () => {
  const r = calcEsop({ totalShares: 1000000, poolPct: 0.15, grantShares: 10000, strikePrice: 1, monthsElapsed: 48 });
  assert.match(r.redline, /律师|不可逆/);
});

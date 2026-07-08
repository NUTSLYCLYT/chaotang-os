import { test } from 'node:test';
import assert from 'node:assert/strict';

import { attributeJourney, unitEconomics, kFactor } from './lifu-attribution.ts';

const J = [
  { channel: '抖音', daysBeforeConversion: 14 },
  { channel: '公众号', daysBeforeConversion: 7 },
  { channel: 'SEM', daysBeforeConversion: 0 },
];

test('归因模型:first/last/linear/u-shaped 功劳分配,和为1', () => {
  assert.equal(attributeJourney(J, 'first')['抖音'], 1);
  assert.equal(attributeJourney(J, 'last')['SEM'], 1);
  const lin = attributeJourney(J, 'linear');
  assert.ok(Math.abs(lin['抖音'] - 1 / 3) < 1e-9);
  const u = attributeJourney(J, 'u_shaped');
  assert.ok(Math.abs(u['抖音'] - 0.4) < 1e-9 && Math.abs(u['SEM'] - 0.4) < 1e-9);
  const sum = Object.values(u).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test('time-decay:越近转化功劳越大(SEM>公众号>抖音)', () => {
  const td = attributeJourney(J, 'time_decay');
  assert.ok(td['SEM'] > td['公众号'] && td['公众号'] > td['抖音']);
  assert.ok(Math.abs(Object.values(td).reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test('单位经济学:LTV/比率/回收期 + 健康判定', () => {
  const u = unitEconomics({ arpa: 1000, grossMargin: 0.7, monthlyChurn: 0.05, cac: 3000 });
  assert.equal(u.ltv, 14000); // 1000*0.7/0.05
  assert.ok((u.ltvCacRatio ?? 0) >= 3); // 14000/3000≈4.7
  assert.equal(u.verdict, 'healthy');
});

test('单位经济学:亏损判定 + 缺数据 insufficient', () => {
  assert.equal(unitEconomics({ arpa: 100, grossMargin: 0.5, monthlyChurn: 0.5, cac: 5000 }).verdict, 'unhealthy');
  assert.equal(unitEconomics({ arpa: 0, grossMargin: 0.5, monthlyChurn: 0.1, cac: 100 }).verdict, 'insufficient');
});

test('K 因子:>1 自增长', () => {
  assert.equal(kFactor(5, 0.3).viral, true); // 1.5
  assert.equal(kFactor(2, 0.2).viral, false); // 0.4
});

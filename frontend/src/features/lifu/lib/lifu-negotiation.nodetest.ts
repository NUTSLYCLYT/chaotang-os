import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateOffer, dealUtility, concessionOffer } from './lifu-negotiation.ts';

test('报价达己方保留价→accept;对外承诺必过人工门', () => {
  const d = evaluateOffer({ ownReservation: 100, offer: 120, betterWhenHigher: true });
  assert.equal(d.decision, 'accept');
  assert.equal(d.meetsReservation, true);
  assert.equal(d.needsSignoff, true); // 对外承诺一律人工门
});

test('无 ZOPA(双方底价不重叠)→walk', () => {
  // 卖方底价150,对方愿付上限100 → 无重叠
  const d = evaluateOffer({ ownReservation: 150, counterpartReservation: 100, offer: 90, betterWhenHigher: true });
  assert.equal(d.zopaExists, false);
  assert.equal(d.decision, 'walk');
});

test('未达保留价但有空间→counter', () => {
  const d = evaluateOffer({ ownReservation: 100, counterpartReservation: 130, offer: 90, betterWhenHigher: true });
  assert.equal(d.zopaExists, true);
  assert.equal(d.decision, 'counter');
});

test('加权效用 U=Σw·u(归一)', () => {
  const u = dealUtility([{ weight: 3, score: 1 }, { weight: 1, score: 0 }]);
  assert.equal(u, 0.75); // 3*1/(3+1)
});

test('让步曲线:t=deadline→落到 floor;Boulware(β<1)早期接近 start', () => {
  assert.equal(concessionOffer(10, 10, 1000, 500, 0.5), 500); // 到期=floor
  const early = concessionOffer(2, 10, 1000, 500, 0.5); // β<1 晚让,早期仍高
  assert.ok(early > 900);
});

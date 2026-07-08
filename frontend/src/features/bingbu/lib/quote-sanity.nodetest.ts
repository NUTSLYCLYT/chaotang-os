import assert from 'node:assert/strict';
import test from 'node:test';

import { assessQuoteSanity, quoteSanityVerdict } from './quote-sanity.ts';

/**
 * 御史台①层巡城兵#2 回归（2026-07-01·兵部报价）。
 * 会咬证明：删 below_cost 判定 → 「亏本报价」用例不再 flag → 测试红。
 */

test('亏本：报价 ≤ 成本 → flag 拦（必须咬住，否则外发即亏钱）', () => {
  const f = assessQuoteSanity(1234, 1000); // 报价低于成本
  assert.equal(quoteSanityVerdict(f), 'flag');
  assert.ok(f.some((x) => x.code === 'below_cost'));
});

test('薄利：毛利低于红线 → warn', () => {
  // 成本1234，售价1400 → 毛利 (1400-1234)/1400 = 11.9% < 20%
  const f = assessQuoteSanity(1234, 1400, 20);
  assert.equal(quoteSanityVerdict(f), 'warn');
  assert.ok(f.some((x) => x.code === 'thin_margin'));
});

test('健康：高于成本+达红线 → ok', () => {
  // 成本1234，售价1763 → 毛利 30% ≥ 20%
  const f = assessQuoteSanity(1234, 1763, 20);
  assert.equal(quoteSanityVerdict(f), 'ok');
});

test('畸高：报价 > 成本5倍 → warn 核竞品', () => {
  const f = assessQuoteSanity(1234, 8000, 20);
  assert.ok(f.some((x) => x.code === 'over_priced'));
});

test('缺数据不评 → 空', () => {
  assert.deepEqual(assessQuoteSanity(null, 1000), []);
  assert.deepEqual(assessQuoteSanity(1234, null), []);
});

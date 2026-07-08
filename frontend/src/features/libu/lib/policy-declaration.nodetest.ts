import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGaoxinEligibility } from './policy-declaration.ts';
test('全达标→建议申报+省税', () => {
  const r = checkGaoxinEligibility({ revenue: 30_000_000, rdExpense: 2_000_000, hiTechRevenue: 22_000_000, totalStaff: 50, techStaff: 8, ipCount: 3, taxableProfit: 5_000_000 });
  assert.equal(r.eligible, true);
  assert.equal(r.taxSaving, 500_000);
  assert.match(r.note, /建议申报|25%→15%/);
});
test('研发费不够→未达标', () => {
  const r = checkGaoxinEligibility({ revenue: 30_000_000, rdExpense: 500_000, hiTechRevenue: 22_000_000, totalStaff: 50, techStaff: 8, ipCount: 3 });
  assert.equal(r.eligible, false);
  assert.match(r.note, /研发费占比/);
});
test('缺数据→资格待定不替判', () => {
  const r = checkGaoxinEligibility({ revenue: null, rdExpense: null, hiTechRevenue: null, totalStaff: null, techStaff: null, ipCount: null });
  assert.equal(r.eligible, null);
  assert.match(r.note, /资格待定|不替你判/);
});

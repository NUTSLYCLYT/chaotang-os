import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSolarTerm, SOLAR_TERM_NAMES } from './solar-terms.ts';

// 回归:computeSolarTerm 曾因"书写顺序≠日历键顺序"(小寒/大寒键最小却写末尾)而永远返回大寒。
// 这组断言钉死按日历键正确落点 + 年初跨年回落冬至。
test('computeSolarTerm 据公历日期落到正确节气', () => {
  const cases: Array<[string, string]> = [
    ['2026-06-24', '夏至'],
    ['2026-01-01', '冬至'], // 年初早于小寒 → 跨年回落上年冬至
    ['2026-01-25', '大寒'],
    ['2026-02-05', '立春'],
    ['2026-07-10', '小暑'],
    ['2026-12-23', '冬至'],
    ['2026-03-21', '春分'],
  ];
  for (const [date, expected] of cases) {
    assert.equal(computeSolarTerm(new Date(date)).name, expected, `${date} 应为 ${expected}`);
  }
});

test('二十四节气齐全且无重复', () => {
  assert.equal(SOLAR_TERM_NAMES.length, 24);
  assert.equal(new Set(SOLAR_TERM_NAMES).size, 24);
});

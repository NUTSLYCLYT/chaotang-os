import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkFidelity } from './lifu-fidelity.ts';

test('洗白 sourceLabel:源FALLBACK却对外说"保证/已验证"→失真', () => {
  const r = checkFidelity({ sourceLabel: 'FALLBACK', risks: [] }, '本方案已验证,保证达到效果。');
  assert.equal(r.faithful, false);
  assert.ok(r.violations.some((v) => v.includes('洗白')));
});

test('丢风险:源含风险但对外只字不提→失真', () => {
  const r = checkFidelity({ sourceLabel: 'LIVE', risks: ['出口管制', '客户集中度高'] }, '该标的基本面强劲,值得买入。');
  assert.equal(r.faithful, false);
  assert.ok(r.violations.some((v) => v.includes('风险')));
});

test('忠实:源LIVE+有风险+表达带对冲→通过', () => {
  const r = checkFidelity({ sourceLabel: 'LIVE', risks: ['出口管制'] }, '基本面强,但存在出口管制风险,建议分批。');
  assert.equal(r.faithful, true);
  assert.deepEqual(r.violations, []);
});

test('忠实:源FALLBACK但表达克制(初步/参考,无定论词)→通过', () => {
  const r = checkFidelity({ sourceLabel: 'FALLBACK', risks: [] }, '初步参考结论,尚需进一步核实。');
  assert.equal(r.faithful, true);
});

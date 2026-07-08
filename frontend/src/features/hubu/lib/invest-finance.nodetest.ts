/**
 * 投资司财务引擎回归。跑：npx --yes tsx --test src/features/hubu/lib/invest-finance.nodetest.ts
 * 锁：NPV/IRR/回收期算对；内外对比；缺数据诚实标缺不编；外部扣子在位。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { npv, irr, paybackPeriod, evaluateInvestment } from './invest-finance.ts';

test('npv：基础贴现正确', () => {
  // 投100，下期回110，rate=10% → NPV=0
  assert.ok(Math.abs(npv(0.1, [-100, 110])) < 1e-6);
});

test('irr：投100→3期各回40 → IRR≈9.7%', () => {
  const r = irr([-100, 40, 40, 40]);
  assert.ok(r != null && r > 0.09 && r < 0.11, `irr=${r}`);
});

test('irr：没有先投后收结构 → null(不编)', () => {
  assert.equal(irr([100, 200]), null); // 全正
  assert.equal(irr([-100]), null); // 单期
});

test('paybackPeriod：投100→每期60 → 约1.67期回本', () => {
  const p = paybackPeriod([-100, 60, 60]);
  assert.ok(p != null && p > 1.6 && p < 1.7, `payback=${p}`);
});

test('evaluateInvestment：高回报 vs 资金成本 → worth + 内外对比', () => {
  const r = evaluateInvestment({ outlay: 100000, returns: [50000, 50000, 50000] }, { source: 'default', hurdleRate: 0.08, industryIrr: 0.15 });
  assert.equal(r.verdict, 'worth');
  assert.ok(r.irr != null && r.irr > 0.2);
  assert.match(r.comparison ?? '', /IRR.*资金成本.*行业.*划算/);
  assert.equal(r.missing.length, 0);
});

test('evaluateInvestment：缺投入/回报 → insufficient_data + 标缺(不编 NPV/IRR)', () => {
  const r = evaluateInvestment({ outlay: null, returns: [] });
  assert.equal(r.verdict, 'insufficient_data');
  assert.equal(r.npv, null);
  assert.equal(r.irr, null);
  assert.ok(r.missing.includes('初始投入金额') && r.missing.includes('各期预期回报'));
});

test('外部数据扣子：始终在位，列出可插的外部源', () => {
  const r = evaluateInvestment({ outlay: 100000, returns: [50000] });
  assert.ok(r.externalHook.pluggable.length >= 2, '预留可插外部数据源');
  assert.match(r.externalHook.benchmarkSource, /基准|资金成本/);
});

test('回报低于资金成本 → not_worth(诚实判不划算)', () => {
  const r = evaluateInvestment({ outlay: 100000, returns: [30000, 30000] }, { source: 'default', hurdleRate: 0.15 });
  assert.equal(r.verdict, 'not_worth');
  assert.match(r.comparison ?? '', /低于|不划算/);
});

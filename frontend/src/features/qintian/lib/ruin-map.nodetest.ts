import test from 'node:test';
import assert from 'node:assert/strict';

import type { BingbuSalesItem, SalesRiskLevel } from '../../../lib/contracts/bingbu-sales.ts';
import type { HubuProject, FinanceRiskLevel } from '../../../lib/contracts/hubu.ts';
import { ruinForSalesItem, ruinForHubuProject, ruinBadge } from './ruin-map.ts';

function item(over: Partial<BingbuSalesItem>): BingbuSalesItem {
  return {
    id: 't', title: 't', command: '', status: 'pending_review', priority: 'P1',
    counterparty: '—', stage: '—', amount: '—', risk_level: 'medium' as SalesRiskLevel,
    recommendation: '', terms: [], industry: '—', delivery: '—', prepayment: '—',
    asked_count: 1, created_at: '', updated_at: '', ...over,
  };
}

function project(over: Partial<HubuProject>): HubuProject {
  return {
    id: 't', title: 't', target_dept: '', owner_dept: '', status: 'pending_review',
    requested_budget: '—', estimated_roi: '—', payback_window: '—', cash_flow_pressure: '—',
    priority: 'P1', risk_level: 'medium' as FinanceRiskLevel, recommendation: '', command: '',
    acceptance_criteria: [], created_at: '', updated_at: '', ...over,
  };
}

test('独家+critical → 否决（传得开+框不住），不再凭预付判亏不起', () => {
  const b = ruinBadge(ruinForSalesItem(item({ terms: ['独家条款', '预付款'], prepayment: '30 万', risk_level: 'critical' })));
  assert.equal(b.veto, true);
  assert.ok(b.redlines.some((r) => r.includes('传得开')), '独家→传得开');
  assert.ok(b.redlines.some((r) => r.includes('框不住')), 'critical→框不住');
  assert.ok(!b.redlines.some((r) => r.includes('亏不起')), '预付不再判亏不起（方向歧义，会审 HIGH）');
});

test('客户预付但无独家/违约/critical → 不否决（利好条款绝不判死局，HIGH 回归）', () => {
  const b = ruinBadge(ruinForSalesItem(item({ prepayment: '30 万', terms: [], risk_level: 'medium' })));
  assert.equal(b.veto, false);
  assert.equal(b.redlines.length, 0);
});

test('违约金 → 否决（亏不起，方向明确=我方违约即赔）', () => {
  const b = ruinBadge(ruinForSalesItem(item({ terms: ['违约金'], risk_level: 'medium' })));
  assert.equal(b.veto, true);
  assert.ok(b.redlines.some((r) => r.includes('亏不起')));
});

test('普通线索 → 不否决（绝不滥判）', () => {
  const b = ruinBadge(ruinForSalesItem(item({ command: '要不要继续跟这个线索', risk_level: 'low' })));
  assert.equal(b.veto, false);
});

test('redlines 去括号注释（防卡片折行，LOW）', () => {
  const b = ruinBadge(ruinForSalesItem(item({ terms: ['违约金'] })));
  assert.ok(b.redlines.every((r) => !r.includes('(') && !r.includes('（')), '展示用红线不带括号');
});

test('户部 critical 项目 → 否决框不住（铁律4 户部路径回归）', () => {
  const b = ruinBadge(ruinForHubuProject(project({ risk_level: 'critical' })));
  assert.equal(b.veto, true);
  assert.ok(b.redlines.some((r) => r.includes('框不住')));
});

test('户部非 critical 项目 → 不否决（不滥判，铁律4 户部路径回归）', () => {
  const b = ruinBadge(ruinForHubuProject(project({ risk_level: 'high' })));
  assert.equal(b.veto, false);
  assert.equal(b.redlines.length, 0);
});

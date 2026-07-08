import test from 'node:test';
import assert from 'node:assert/strict';

import { reviewOrgHeadcount, type OrgHeadcountInput } from './org-headcount-review.ts';

function inp(over: Partial<OrgHeadcountInput> = {}): OrgHeadcountInput {
  return {
    newRole: '前端工程师', currentAnnualLaborCost: 2_000_000, annualRevenue: 10_000_000,
    newRoleAnnualCost: 250_000, expectedIncrementalValue: 400_000,
    hasWorkloadEvidence: true, hasReorgAlternative: true, hasBudgetHeadroom: true, ...over,
  };
}

test('三质门齐 + 占比健康 + ROI≥1 → 该增', () => {
  const r = reviewOrgHeadcount(inp());
  assert.equal(r.verdict, 'add');
  assert.equal(r.laborCostRatio, 0.23); // (2000000+250000)/10000000
});
test('缺新岗成本 → 缺证', () => {
  assert.equal(reviewOrgHeadcount(inp({ newRoleAnnualCost: null })).verdict, 'insufficient');
});
test('缺质门任一 → 先挖潜再增', () => {
  assert.equal(reviewOrgHeadcount(inp({ hasWorkloadEvidence: false })).verdict, 'reorg_first');
});
test('人力成本占比>50%警戒线 且无明确增量 → 编制超重·缓增', () => {
  const r = reviewOrgHeadcount(inp({ currentAnnualLaborCost: 5_500_000, annualRevenue: 10_000_000, expectedIncrementalValue: null }));
  assert.ok(r.laborCostRatio != null && r.laborCostRatio > 0.5);
  assert.equal(r.verdict, 'over_headcount');
});
test('增量 ROI<1 → 缓增', () => {
  const r = reviewOrgHeadcount(inp({ newRoleAnnualCost: 500_000, expectedIncrementalValue: 100_000 }));
  assert.equal(r.verdict, 'over_headcount');
});
test('无营收 → 占比 null 但仍可判(靠质门+ROI)', () => {
  const r = reviewOrgHeadcount(inp({ annualRevenue: null }));
  assert.equal(r.laborCostRatio, null);
  assert.equal(r.verdict, 'add');
});

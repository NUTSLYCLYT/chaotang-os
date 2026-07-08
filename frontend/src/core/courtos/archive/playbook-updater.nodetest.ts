import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildPlaybookUpdate } from './playbook-updater.ts';

test('刑部 股权+独家+预付款 红灯 → justice_red_combo', () => {
  const u = buildPlaybookUpdate({
    id: 'a1',
    ministrySignals: { justice: 'RED' },
    riskTriggers: ['股权', '独家', '预付款'],
    sourceLabel: 'LIVE',
  });
  assert.ok(u.some((r) => r.rule === 'justice_red_combo'));
});

test('合作类缺 ROI → finance_roi_early', () => {
  const u = buildPlaybookUpdate({ id: 'a2', topic: '某合作评估', missingEvidence: ['ROI 假设'], sourceLabel: 'LIVE' });
  assert.ok(u.some((r) => r.rule === 'finance_roi_early'));
});

test('正式报价未放行 → war_quote_readiness_gate', () => {
  const u = buildPlaybookUpdate({
    id: 'a2b',
    topic: '客户要求正式报价',
    ministrySignals: { war: 'RED' },
    sourceLabel: 'LIVE',
  });
  assert.ok(u.some((r) => r.rule === 'war_quote_readiness_gate'));
});

test('客户推进缺商机证据 → war_opportunity_evidence_early', () => {
  const u = buildPlaybookUpdate({
    id: 'a2c',
    topic: '客户推进',
    ministrySignals: { war: 'YELLOW' },
    missingEvidence: ['客户意图', '决策链', '预算来源', '销售 owner'],
    sourceLabel: 'LIVE',
  });
  assert.ok(u.some((r) => r.rule === 'war_opportunity_evidence_early'));
});

test('竞品回应 → war_competitor_claim_review', () => {
  const u = buildPlaybookUpdate({
    id: 'a2d',
    topic: '竞品说我们不专业怎么回应',
    riskTriggers: ['竞品贬低'],
    sourceLabel: 'LIVE',
  });
  assert.ok(u.some((r) => r.rule === 'war_competitor_claim_review'));
});

test('缺 BOM → works_bom_early', () => {
  const u = buildPlaybookUpdate({ id: 'a3', topic: '储能交付', missingEvidence: ['BOM'], sourceLabel: 'LIVE' });
  assert.ok(u.some((r) => r.rule === 'works_bom_early'));
});

test('缺验收标准 → works_acceptance_early', () => {
  const u = buildPlaybookUpdate({ id: 'a3b', topic: '项目上线验收', missingEvidence: ['验收标准', '测试计划'], sourceLabel: 'LIVE' });
  assert.ok(u.some((r) => r.rule === 'works_acceptance_early'));
});

test('固定交期/交付承诺红灯 → works_delivery_commitment_gate', () => {
  const u = buildPlaybookUpdate({
    id: 'a3c',
    topic: '储能交付承诺',
    ministrySignals: { works: 'RED' },
    riskTriggers: ['固定交期', '供应商锁定'],
    sourceLabel: 'LIVE',
  });
  assert.ok(u.some((r) => r.rule === 'works_delivery_commitment_gate'));
});

test('用户驳回太泛 → report_more_specific', () => {
  const u = buildPlaybookUpdate({ id: 'a4', userAction: 'reject', rejectReason: '太泛', sourceLabel: 'LIVE' });
  assert.ok(u.some((r) => r.rule === 'report_more_specific'));
});

test('干净采纳记录 → 无 playbook 规则（不无中生有）', () => {
  const u = buildPlaybookUpdate({ id: 'a5', userAction: 'accept', sourceLabel: 'LIVE' });
  assert.equal(u.length, 0);
});

test('playbook 规则透传 sourceLabel', () => {
  const u = buildPlaybookUpdate({ id: 'a6', missingEvidence: ['BOM'], sourceLabel: 'MIXED' });
  assert.ok(u.every((r) => r.sourceLabel === 'MIXED'));
});

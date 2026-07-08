import assert from 'node:assert/strict';
import test from 'node:test';
import { buildJunjichuCaseFile, buildPrimeEvidenceDispatchPlan } from './case-orchestrator.ts';

test('routes live AI news to jinyiwei evidence workflow', () => {
  const plan = buildPrimeEvidenceDispatchPlan({
    command: '我想知道今天发生了哪些 AI 有关的大事',
  });

  assert.equal(plan.intentType, 'live_intelligence');
  assert.equal(plan.primaryDepartment, 'jin_yi_wei');
  assert.equal(plan.evidencePolicy, 'url_required');
  assert.ok(plan.departments.includes('gong_bu'));
  assert.ok(plan.departments.includes('qin_tian_jian'));
  assert.ok(plan.qualityGates.includes('source_urls_required'));
});

test('routes world cup travel request to rites with budget and intel support', () => {
  const plan = buildPrimeEvidenceDispatchPlan({
    command: '我需要去看世界杯，帮我判断怎么买票、预算和风险',
  });

  assert.equal(plan.intentType, 'travel_event');
  assert.equal(plan.primaryDepartment, 'li_bu_rites');
  assert.ok(plan.departments.includes('hu_bu'));
  assert.ok(plan.departments.includes('jin_yi_wei'));
  assert.ok(plan.departments.includes('qin_tian_jian'));
  assert.ok(plan.qualityGates.includes('official_schedule_required'));
});

test('routes quote and ROI request to hubu and blocks binding commitment', () => {
  const caseFile = buildJunjichuCaseFile({
    userId: 'u_test',
    now: '2026-06-30T00:00:00.000Z',
    caseId: 'jjc_test',
    command: '这个客户要我们给正式报价，帮我判断 ROI 和风险',
  });

  assert.equal(caseFile.plan.intentType, 'finance_decision');
  assert.equal(caseFile.plan.primaryDepartment, 'hu_bu');
  assert.ok(caseFile.plan.departments.includes('xing_bu'));
  assert.ok(caseFile.plan.departments.includes('jin_yi_wei'));
  assert.ok(caseFile.qualityGates.some((gate) => gate.id === 'no_binding_quote_without_signoff' && gate.blocking));
  assert.equal(caseFile.taskId, 'jjc_test');
});

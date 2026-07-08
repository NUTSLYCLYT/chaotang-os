import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';

test('decision authority is derived from server session shape, not client body defaults', async () => {
  const { decisionActorFromSession, normalizeAuthority } = await import('./finance-intel-loop-store.ts');

  assert.equal(normalizeAuthority(undefined), 'viewer');
  assert.equal(normalizeAuthority('not_a_role'), 'viewer');
  assert.deepEqual(decisionActorFromSession({ userId: 'u1', role: 'user', isAdmin: false }), {
    userId: 'u1',
    role: 'operator',
    authorityLevel: 'operator',
  });
  assert.deepEqual(decisionActorFromSession({ userId: 'admin', role: 'admin', isAdmin: true }), {
    userId: 'admin',
    role: 'admin',
    authorityLevel: 'approver',
  });
});

test('research budget evidence blocks decree when required evidence is missing', async () => {
  const { buildInternalBudgetEvidencePack, normalizeResearchBudgetRequest } = await import('../jinyiwei/internal-budget-evidence.ts');
  const { validateDecisionAgainstBrief } = await import('./finance-intel-loop-store.ts');

  const request = normalizeResearchBudgetRequest({
    department: '研发部',
    owner: '',
    budgetPeriod: '',
    requestedAmount: 300000,
    lineItems: [{ id: 'cloud', title: 'Cloud compute', category: 'cloud', amount: 300000 }],
    evidenceRefs: [],
  });
  const pack = buildInternalBudgetEvidencePack(request, '2026-07-03T00:00:00.000Z');
  assert.ok(pack.missingEvidence.includes('owner_signoff_required'));
  assert.ok(pack.missingEvidence.includes('budget_period_required'));
  assert.ok(pack.blockedActions.includes('issue_decree'));

  const policy = validateDecisionAgainstBrief({
    decision: 'issue_decree',
    brief: {
      budgetKind: 'research_department_budget',
      missingEvidence: pack.missingEvidence,
      riskGate: pack.riskGate,
    },
  });
  assert.equal(policy.ok, false);
  if (!policy.ok) {
    assert.equal(policy.error, 'missing_evidence_blocks_decree');
    assert.equal(policy.status, 409);
  }
});

test('research budget over threshold requires manual confirmation before approval', async () => {
  const { buildInternalBudgetEvidencePack, normalizeResearchBudgetRequest } = await import('../jinyiwei/internal-budget-evidence.ts');
  const { validateDecisionAgainstBrief } = await import('./finance-intel-loop-store.ts');

  const request = normalizeResearchBudgetRequest({
    department: '研发部',
    owner: '研发负责人',
    budgetPeriod: '2026 Q3',
    requestedAmount: 800000,
    riskThresholdAmount: 500000,
    lineItems: [
      { id: 'cloud', title: 'Cloud compute', category: 'cloud', amount: 500000, evidenceRefs: ['cloud_bill_q2'] },
      { id: 'prototype', title: 'Prototype parts', category: 'prototype', amount: 300000, evidenceRefs: ['supplier_quote_parts'] },
    ],
    evidenceRefs: [
      { id: 'history', label: 'Q2 spend', kind: 'historical_spend', sourceLabel: 'INTERNAL_LEDGER' },
      { id: 'cloud_bill_q2', label: 'Cloud bill', kind: 'cloud_bill', sourceLabel: 'UPLOADED_EVIDENCE' },
      { id: 'supplier_quote_parts', label: 'Supplier quote', kind: 'supplier_quote', sourceLabel: 'UPLOADED_EVIDENCE' },
    ],
  });
  const pack = buildInternalBudgetEvidencePack(request, '2026-07-03T00:00:00.000Z');
  assert.deepEqual(pack.missingEvidence, []);
  assert.equal(pack.riskGate.manualConfirmationRequired, true);

  const withoutConfirmation = validateDecisionAgainstBrief({
    decision: 'issue_decree',
    brief: { budgetKind: 'research_department_budget', missingEvidence: [], riskGate: pack.riskGate },
  });
  assert.equal(withoutConfirmation.ok, false);
  if (!withoutConfirmation.ok) assert.equal(withoutConfirmation.error, 'manual_confirmation_required_for_high_risk_budget');

  const withConfirmation = validateDecisionAgainstBrief({
    decision: 'issue_decree',
    manualConfirmation: true,
    brief: { budgetKind: 'research_department_budget', missingEvidence: [], riskGate: pack.riskGate },
  });
  assert.deepEqual(withConfirmation, { ok: true });
});

test('research budget approval persists instruction in the case chain', async () => {
  mkdirSync('dev/tmp', { recursive: true });
  rmSync('dev/tmp/research-budget-loop-test.db', { force: true });
  process.env.TURSO_DB_URL = 'file:./dev/tmp/research-budget-loop-test.db';

  const { buildInternalBudgetEvidencePack, normalizeResearchBudgetRequest } = await import('../jinyiwei/internal-budget-evidence.ts');
  const {
    createCourtIssue,
    createDecisionBrief,
    createDepartmentMemorial,
    createImperialInstruction,
    createInternalBudgetEvidenceRecords,
    getFinanceIntelLoopCase,
    validateDecisionAgainstBrief,
  } = await import('./finance-intel-loop-store.ts');

  const at = '2026-07-03T00:00:00.000Z';
  const budget = normalizeResearchBudgetRequest({
    department: '研发部',
    owner: '研发负责人',
    budgetPeriod: '2026 Q3',
    requestedAmount: 600000,
    riskThresholdAmount: 500000,
    purpose: 'AI toolchain and prototypes',
    lineItems: [
      { id: 'cloud', title: 'Cloud compute', category: 'cloud', amount: 300000, evidenceRefs: ['cloud_bill_q2'] },
      { id: 'prototype', title: 'Prototype parts', category: 'prototype', amount: 300000, evidenceRefs: ['supplier_quote_parts'] },
    ],
    evidenceRefs: [
      { id: 'history', label: 'Q2 spend', kind: 'historical_spend', sourceLabel: 'INTERNAL_LEDGER' },
      { id: 'cloud_bill_q2', label: 'Cloud bill', kind: 'cloud_bill', sourceLabel: 'UPLOADED_EVIDENCE' },
      { id: 'supplier_quote_parts', label: 'Supplier quote', kind: 'supplier_quote', sourceLabel: 'UPLOADED_EVIDENCE' },
    ],
  });
  const pack = buildInternalBudgetEvidencePack(budget, at);
  const issue = await createCourtIssue({
    userId: 'budget-admin',
    question: '研发部 2026 Q3 budget',
    intent: 'research_budget',
    at,
  });
  const evidence = await createInternalBudgetEvidenceRecords({
    taskId: issue.taskId,
    issueId: issue.id,
    userId: 'budget-admin',
    pack,
    at,
  });
  const memorial = await createDepartmentMemorial({
    taskId: issue.taskId,
    departmentId: 'hu_bu',
    sourceLabel: pack.sourceLabel,
    memorial: {
      department: 'hu_bu',
      budgetKind: 'research_department_budget',
      lineItems: pack.lineItems,
      missingEvidence: pack.missingEvidence,
      riskGate: pack.riskGate,
      previewOnly: true,
      executionAllowed: false,
      sideEffects: 'none',
      nonAdviceDisclaimer: true,
    },
    at,
  });
  const brief = await createDecisionBrief({
    taskId: issue.taskId,
    issueId: issue.id,
    evidencePackId: evidence.evidencePackId,
    brief: {
      budgetKind: 'research_department_budget',
      missingEvidence: pack.missingEvidence,
      riskGate: pack.riskGate,
      lineItems: pack.lineItems,
      departmentMemorials: [memorial.memorial],
    },
    at,
  });

  const policy = validateDecisionAgainstBrief({
    decision: 'issue_decree',
    manualConfirmation: true,
    brief: brief.brief,
  });
  assert.deepEqual(policy, { ok: true });

  const instruction = await createImperialInstruction({
    brief,
    instructionType: 'decree',
    decisionActor: { userId: 'budget-admin', role: 'admin', authorityLevel: 'approver' },
    instruction: {
      decision: 'issue_decree',
      reason: 'Approved with manual confirmation; no payment execution authorized.',
      executionType: 'no_action_archive',
      highRiskManualConfirmationRequired: true,
      noRealTradeAuthorized: true,
    },
    at,
  });

  const loopCase = await getFinanceIntelLoopCase(issue.taskId);
  assert.equal(loopCase?.stage, 'instruction_issued');
  assert.equal((loopCase?.instruction as { id?: string } | null)?.id, instruction.id);
  assert.equal((loopCase?.decisionBrief as { id?: string } | null)?.id, brief.id);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLocalDraftEdict,
  buildLocalRoutingPlan,
  buildMinimalMemorialV1,
  evaluateLocalDraft,
  readLocalDecisionRecord,
  toDecisionTaskSummary,
  type LocalDecisionRecord,
} from '../../../lib/shangshufang/local-decision-loop.ts';
import { runCourtUnifiedDecisionLoop } from '../unified/unified-decision-loop.ts';

test('Goal 2/4 Shangshufang entry protocol: question -> draft -> confirmable decision task record', () => {
  const question = '客户要求正式报价，要不要发？';
  const taskId = 'test_ssf_quote';
  const draft = buildLocalDraftEdict({ taskId, rawQuestion: question, sourceLabel: 'FALLBACK' });

  assert.equal(draft.original_question, question);
  assert.ok(draft.refined_edict.includes(question));
  assert.equal(draft.decision_type, '报价与投入判断');
  assert.ok(draft.known_facts.length > 0);
  assert.ok(draft.unknown_gaps.includes('报价依据'));
  assert.ok(draft.suggested_perspectives.includes('hubu_cfo'));
  assert.ok(draft.suggested_perspectives.includes('bingbu_sales'));
  assert.ok(draft.suggested_perspectives.includes('xingbu_legal_risk'));
  assert.ok(draft.risk_flags.includes('正式报价'));
  assert.ok(draft.risk_flags.includes('需人工确认'));
  assert.ok(draft.expected_output.includes('质门'));
  assert.equal(draft.source_label, 'FALLBACK');
  assert.ok(draft.emperor_confirmation_question.length > 0);

  const evalResult = evaluateLocalDraft(draft);
  assert.equal(evalResult.passed, true);

  const routingPlan = buildLocalRoutingPlan(draft);
  const memorial = buildMinimalMemorialV1(taskId, draft);
  const unifiedLoop = runCourtUnifiedDecisionLoop({
    rawQuestion: question,
    taskId,
    sourceLabel: draft.source_label,
  });
  const record: LocalDecisionRecord = {
    source: 'courtos_local_shangshufang',
    trace_id: 'trace_test',
    task_id: taskId,
    user_id: 'user_goal2_owner',
    raw_question: question,
    status: 'awaiting_decision',
    draft_edict: draft,
    routing_plan: routingPlan,
    memorial,
    unified_loop: unifiedLoop,
    created_at: '2026-06-18T00:00:00.000Z',
    updated_at: '2026-06-18T00:00:01.000Z',
  };

  const persisted = JSON.parse(JSON.stringify({ shangshufangDecision: record })) as Record<string, unknown>;
  const restored = readLocalDecisionRecord(persisted);
  assert.ok(restored);
  assert.equal(restored.task_id, taskId);
  assert.equal(restored.user_id, 'user_goal2_owner');
  assert.equal(restored.status, 'awaiting_decision');
  assert.equal(restored.raw_question, question);
  assert.equal(restored.draft_edict.source_label, 'FALLBACK');
  assert.equal(restored.unified_loop?.taskId, taskId);
  assert.equal(restored.unified_loop?.loopId, 'court_unified_decision_loop_v1');
  assert.equal(restored.unified_loop?.sourceLabel, 'FALLBACK');
  assert.ok(restored.unified_loop?.reviewPlan.selectedDepartments.includes('jinyiwei'));
  assert.ok(restored.unified_loop?.reviewPlan.selectedDepartments.includes('finance'));
  assert.ok(restored.unified_loop?.reviewPlan.selectedDepartments.includes('war'));
  assert.ok(restored.unified_loop?.reviewPlan.selectedDepartments.includes('justice'));
  assert.ok(restored.unified_loop?.states.includes('MEMORIAL_READY'));
  assert.equal(restored.unified_loop?.memorial.sourceLabel, 'FALLBACK');
  assert.equal(restored.unified_loop?.memorial.qualityGate.passed, false);
  assert.ok(restored.unified_loop?.memorial.missingEvidence.length);

  const summary = toDecisionTaskSummary(restored);
  assert.equal(summary.task_id, taskId);
  assert.equal(summary.status, 'awaiting_decision');
  assert.equal(summary.raw_question, question);
  assert.equal(summary.source_label, 'FALLBACK');
  assert.ok(summary.risk_flags.includes('正式报价'));
  assert.ok(summary.unknown_gaps.includes('报价依据'));
});

test('normal Chinese finance quote question routes to Hu Bu in draft, routing plan, and unified loop', () => {
  const question = '客户要求正式报价，金额 120 万，预付 50%，需要户部预算与锦衣卫来源风险一起判断要不要发。';
  const taskId = 'test_ssf_normal_cn_finance_route';
  const draft = buildLocalDraftEdict({ taskId, rawQuestion: question, sourceLabel: 'FALLBACK' });
  assert.ok(draft.suggested_perspectives.includes('hubu_cfo'));
  assert.ok(draft.suggested_perspectives.includes('bingbu_sales'));
  assert.ok(draft.suggested_perspectives.includes('xingbu_legal_risk'));
  assert.ok(draft.unknown_gaps.includes('成本边界'));
  assert.ok(draft.unknown_gaps.includes('预算审批记录'));
  assert.ok(draft.risk_flags.includes('正式报价'));
  assert.ok(draft.risk_flags.includes('预付款'));

  const routingPlan = buildLocalRoutingPlan(draft);
  assert.ok(routingPlan.selected_departments.includes('hubu_cfo'));

  const memorial = buildMinimalMemorialV1(taskId, draft);
  assert.ok(memorial.department_memorials?.some((item) => item.department_id === 'finance'));

  const unifiedLoop = runCourtUnifiedDecisionLoop({
    rawQuestion: question,
    taskId,
    sourceLabel: draft.source_label,
  });
  assert.ok(unifiedLoop.reviewPlan.selectedDepartments.includes('finance'));
});

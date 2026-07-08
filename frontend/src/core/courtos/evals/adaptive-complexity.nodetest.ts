import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessAdaptiveComplexity,
  buildLocalDraftEdict,
  buildLocalRoutingPlan,
  buildMinimalMemorialV1,
} from '../../../lib/shangshufang/local-decision-loop.ts';

test('Goal 8 adaptive complexity keeps low-risk questions shallow', () => {
  const result = assessAdaptiveComplexity({
    question: '明天例会要不要提前十分钟？',
    missingEvidence: [],
    riskFlags: [],
    selectedDepartments: ['jinyiwei_intelligence'],
  });
  assert.equal(result.review_depth, 'shallow');
  assert.ok(result.complexity_score < 20);
});

test('Goal 8 adaptive complexity routes formal quote to deep without pretending live swarm', () => {
  const draft = buildLocalDraftEdict({
    taskId: 'task_goal8_quote',
    rawQuestion: '客户要求正式报价，要不要发？金额 300 万，付款条件还没定。',
    sourceLabel: 'FALLBACK',
  });
  const plan = buildLocalRoutingPlan(draft);
  const memorial = buildMinimalMemorialV1('task_goal8_quote', draft);

  assert.equal(plan.schema_version, 'ReviewPlanV1');
  assert.equal(plan.review_depth, 'deep');
  assert.equal(plan.swarm_required, true);
  assert.equal(plan.swarm_trace_required, true);
  assert.equal(plan.swarm_runtime_status, 'skipped_no_live_adapter');
  assert.equal(plan.swarm_trace_summary?.trace_id, undefined);
  assert.ok(plan.complexity_reasons?.some((reason) => reason.includes('高风险')));
  assert.equal(memorial.review_depth, 'deep');
  assert.ok(memorial.quality_gate.human_signoff_required);
  assert.notEqual(memorial.sacred_judgement, '采纳');
  assert.ok(memorial.quality_gate.blocking_issues?.some((issue) => issue.includes('FALLBACK')));
  assert.ok(memorial.quality_gate.blocking_issues?.some((issue) => issue.includes('蜂群深挖未执行')));
});

test('Goal 8 standard review is used for moderate evidence gaps', () => {
  const result = assessAdaptiveComplexity({
    question: '是否招聘一个大客户销售负责人？',
    missingEvidence: ['岗位目标', '预算范围'],
    riskFlags: [],
    selectedDepartments: ['jinyiwei_intelligence', 'libu_hr_admin', 'bingbu_sales'],
  });
  assert.equal(result.review_depth, 'standard');
});

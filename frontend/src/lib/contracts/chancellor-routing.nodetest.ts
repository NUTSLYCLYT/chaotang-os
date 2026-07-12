import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ZChancellorAdviceV1,
  ZDecreeExecutionStatusV1,
  ZRouteDecisionV2,
} from './chancellor-routing.ts';

const baseRouteDecision = {
  schema_version: 'RouteDecisionV2' as const,
  decision_id: 'decision_1',
  task_id: 'task_1',
  mode: 'direct' as const,
  strategy: 'single_agent' as const,
  decided_by: 'chancellor' as const,
  primary_department: '户部',
  primary_agent: 'hubu_finance_agent',
  participants: [],
  reason_summary: '单一部门可直接承办',
  complexity_score: 0.2,
  complexity_reasons: [],
  risk_flags: [],
  evidence_gaps: [],
  assumptions: [],
  confidence: 0.9,
  policy_hits: [],
  human_confirmation_required: false,
  capability_snapshot_version: 'v1',
  prompt_version: null,
  source_label: 'LIVE' as const,
  created_at: '2026-07-10T00:00:00+00:00',
  supersedes_decision_id: null,
};

test('ZRouteDecisionV2 接受与后端一致的合法 direct 决策', () => {
  const parsed = ZRouteDecisionV2.parse(baseRouteDecision);
  assert.equal(parsed.mode, 'direct');
});

test('ZRouteDecisionV2 拒绝越界 confidence(与后端 Pydantic 约束镜像)', () => {
  assert.throws(() => ZRouteDecisionV2.parse({ ...baseRouteDecision, confidence: 1.5 }));
});

test('ZDecreeExecutionStatusV1 内嵌 route_decision 且状态字段齐全', () => {
  const parsed = ZDecreeExecutionStatusV1.parse({
    schema_version: 'DecreeExecutionStatusV1',
    task_id: 'task_1',
    current_stage: 'chancellor_routing',
    current_owner: '丞相',
    latest_message: '正在生成路由',
    next_stage: 'dispatched',
    blocked_reason: null,
    route_decision: baseRouteDecision,
    departments: [
      {
        department: '户部',
        agent_id: 'hubu_finance_agent',
        status: 'planned',
        latest_message: '待派单',
        started_at: null,
        completed_at: null,
      },
    ],
    timeline: [
      {
        event_id: 'evt_1',
        stage: 'chancellor_routing',
        actor: 'chancellor',
        message: '路由已生成',
        occurred_at: '2026-07-10T00:00:01+00:00',
        sequence: 1,
      },
    ],
  });
  assert.equal(parsed.route_decision.decision_id, 'decision_1');
});

test('ZChancellorAdviceV1 要求 3-5 个选项，2 个应被拒绝', () => {
  const option = {
    id: 'conditional_pilot',
    title: '有条件试点',
    benefits: ['保留市场窗口'],
    risks: ['合同仍需修改'],
    conditions: ['首付款不超过预算上限'],
    next_actions: ['户部确认预算'],
    evidence_refs: ['evidence_hubu_01'],
  };
  assert.throws(() =>
    ZChancellorAdviceV1.parse({
      schema_version: 'ChancellorAdviceV1',
      task_id: 'task_1',
      analysis: '项目具备试点条件',
      options: [option, option],
      recommended_option_id: 'conditional_pilot',
      recommendation_reason: '覆盖主要风险',
      dissent: [],
      confidence: 0.8,
      human_confirmation_required: true,
      source_label: 'LIVE',
    }),
  );

  const parsed = ZChancellorAdviceV1.parse({
    schema_version: 'ChancellorAdviceV1',
    task_id: 'task_1',
    analysis: '项目具备试点条件',
    options: [option, option, option],
    recommended_option_id: 'conditional_pilot',
    recommendation_reason: '覆盖主要风险',
    dissent: ['兵部认为市场窗口可能早于合同完成'],
    confidence: 0.84,
    human_confirmation_required: true,
    source_label: 'LIVE',
  });
  assert.equal(parsed.options.length, 3);
});

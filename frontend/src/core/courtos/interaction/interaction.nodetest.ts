import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DecisionPhase, PendingTaskSnapshot } from './interaction-types.ts';
import { nextBestAction } from './next-best-action-engine.ts';
import { buildProactiveBriefing } from './proactive-briefing-loop.ts';

function task(p: Partial<PendingTaskSnapshot>): PendingTaskSnapshot {
  return { id: 't', title: '某经营问题', phase: 'WAITING_FOR_DECISION', sourceLabel: 'LIVE', needsHumanConfirmation: false, ...p };
}

test('有待裁决任务 → 今日一号决策含 whyNow + 唯一主动作', () => {
  const b = buildProactiveBriefing({ pendingTasks: [task({ id: 'a', phase: 'WAITING_FOR_DECISION', sourceLabel: 'LIVE' })] });
  assert.ok(b.topDecision);
  assert.ok(b.topDecision.whyNow.length > 0);
  assert.equal(b.topDecision.primaryAction.actionId, 'make_decision');
  assert.equal(b.hasRealData, true);
});

test('高风险任务 → 今日一号决策主动作=人工确认（地板优先于状态）', () => {
  const b = buildProactiveBriefing({ pendingTasks: [task({ id: 'r', riskLevel: 'high', needsHumanConfirmation: true })] });
  assert.ok(b.topDecision);
  assert.equal(b.topDecision.primaryAction.actionId, 'human_confirm');
});

test('每个决策阶段都有唯一主动作', () => {
  const phases: DecisionPhase[] = ['DRAFT', 'INTENT_REFINED', 'EVIDENCE_CHECKING', 'WAITING_FOR_EVIDENCE', 'REVIEWING', 'REPORT_READY', 'WAITING_FOR_DECISION', 'ACCEPTED', 'REJECTED', 'FOLLOWING_UP', 'RECHECKING', 'ARCHIVED', 'FAILED'];
  for (const phase of phases) {
    const a = nextBestAction({ phase, sourceLabel: 'LIVE', needsHumanConfirmation: false });
    assert.ok(a.actionId && a.label && a.reason, `phase ${phase} 必须有主动作`);
  }
});

test('无真实数据 → hasRealData=false 且 sourceLabel=DEMO（不伪装）', () => {
  const b = buildProactiveBriefing({ pendingTasks: [] });
  assert.equal(b.hasRealData, false);
  assert.equal(b.sourceLabel, 'DEMO');
  assert.equal(b.topDecision, null);
});

test('DEMO 任务主动作只能查看样板，不可裁决', () => {
  const a = nextBestAction({ phase: 'WAITING_FOR_DECISION', sourceLabel: 'DEMO', needsHumanConfirmation: false });
  assert.equal(a.actionId, 'view_demo_only');
});

test('FALLBACK 在待裁决时引导重试，不推向采纳', () => {
  const a = nextBestAction({ phase: 'WAITING_FOR_DECISION', sourceLabel: 'FALLBACK', needsHumanConfirmation: false });
  assert.equal(a.actionId, 'retry_or_save_draft');
});

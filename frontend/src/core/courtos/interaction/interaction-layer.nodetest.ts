import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildChancellorDraftCard } from './chancellor-concierge.ts';
import { updateProfileFromDecision } from './habit-learner.ts';
import { buildProactiveBriefing } from './proactive-briefing-loop.ts';
import { buildSurpriseInsights } from './surprise-insight-engine.ts';
import { toBriefingViewModel } from './interaction-ui-adapter.ts';
import { checkTrust } from './trust-experience-guard.ts';
import { createDefaultProfile } from './user-decision-profile.ts';

test('HabitLearner: 不因一次行为过度改变画像，达阈值(3)才置 flag', () => {
  let p = createDefaultProfile('u1');
  p = updateProfileFromDecision(p, { action: 'request_evidence' });
  assert.equal(p.flags.earlyEvidencePrompt, false, '一次补证不应翻 flag');
  p = updateProfileFromDecision(p, { action: 'request_evidence' });
  p = updateProfileFromDecision(p, { action: 'request_evidence' });
  assert.equal(p.flags.earlyEvidencePrompt, true, '三次补证后应提前提示补证');
});

test('HabitLearner: 关注 ROI 提高户部权重，且为不可变更新', () => {
  const p0 = createDefaultProfile('u2');
  const p1 = updateProfileFromDecision(p0, { action: 'accept', focusedOn: ['ROI'] });
  assert.ok(p1.ministryWeights.finance > p0.ministryWeights.finance);
  assert.equal(p0.ministryWeights.finance, 1, '原画像不可被修改');
});

test('HabitLearner: 多次驳回"太泛"→报告更具体', () => {
  let p = createDefaultProfile('u3');
  for (let i = 0; i < 3; i++) p = updateProfileFromDecision(p, { action: 'reject', rejectReason: '太泛' });
  assert.equal(p.flags.moreSpecificReports, true);
});

test('TrustGuard: 缺 sourceLabel / 高风险无人工确认 / DEMO 伪装 → 违规', () => {
  assert.equal(checkTrust({}).ok, false);
  assert.ok(checkTrust({ sourceLabel: 'LIVE', isHighRisk: true, needsHumanConfirmation: false }).violations.some((v) => v.rule === 'high_risk_requires_human_confirmation'));
  assert.ok(checkTrust({ sourceLabel: 'DEMO', presentedAsLive: true }).violations.some((v) => v.rule === 'no_fake_live'));
  assert.equal(checkTrust({ sourceLabel: 'LIVE', hasEvidenceOrGap: true }).ok, true);
});

test('ChancellorConcierge: 高风险问题 → 人工确认 + 军机处复核 + 刑部参审', () => {
  const card = buildChancellorDraftCard({ rawQuestion: '请直接批准这个含股权和预付款的合同' });
  assert.equal(card.nextAction.actionId, 'human_confirm');
  assert.equal(card.recommendedPath, 'junjichu_review');
  assert.ok(card.suggestedPerspectives.includes('刑部'));
  assert.ok(card.riskPreview.length > 0);
});

test('ChancellorConcierge: 过短问题 → 需要补充背景', () => {
  assert.equal(buildChancellorDraftCard({ rawQuestion: '招人' }).recommendedPath, 'need_more_background');
});

test('SurpriseInsight: 无证据/无 why/无 action 的候选被过滤，最多 3 条', () => {
  const out = buildSurpriseInsights([
    { id: '1', text: '泛泛', sourceLabel: 'LIVE' },
    { id: '2', text: '有据', evidence: ['来源A'], whyItMatters: '影响现金', suggestedAction: '先补 ROI', sourceLabel: 'LIVE' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, '2');
});

test('UiAdapter: 无真实数据 → emptyHint + topDecision=null，且只暴露业务字段', () => {
  const vm = toBriefingViewModel(buildProactiveBriefing({ pendingTasks: [] }));
  assert.equal(vm.topDecision, null);
  assert.ok(vm.emptyHint && vm.emptyHint.includes('暂无真实建议'));
  assert.equal(vm.sourceLabel, 'DEMO');
});

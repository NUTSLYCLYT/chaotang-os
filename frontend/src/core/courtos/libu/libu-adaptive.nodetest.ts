import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyEscalationRules, determineLibuMode, NON_NEGOTIABLE_FLOOR } from './libu-adaptive.ts';

test('小公司(≤10 人)默认 brief，不暴露子司结构', () => {
  const r = determineLibuMode(8);
  assert.equal(r.mode, 'founder_assistant');
  assert.equal(r.defaultView, 'brief');
  assert.equal(r.exposeSubOfficeStructure, false);
});

test('10-50 人为 small_team_hr / management_detail', () => {
  assert.equal(determineLibuMode(12).mode, 'small_team_hr');
  assert.equal(determineLibuMode(12).defaultView, 'management_detail');
});

test('中大型(200-1000 / 1000+)默认 professional_detail', () => {
  assert.equal(determineLibuMode(500).mode, 'chro_cao');
  assert.equal(determineLibuMode(500).defaultView, 'professional_detail');
  assert.equal(determineLibuMode(1500).mode, 'group_enterprise');
  assert.equal(determineLibuMode(1500).defaultView, 'professional_detail');
});

// 地板锚点：12 人公司辞退 —— 小公司，但风险地板与规模无关，强制升维刑部 + 人工确认
test('地板：12 人公司辞退仍强制升维劳关司+刑部+人工确认（用户不可绕过）', () => {
  const mode = determineLibuMode(12);
  assert.equal(mode.mode, 'small_team_hr', '12 人应为小公司模式');

  const esc = applyEscalationRules('我们 12 个人，有个员工表现差，能不能辞退？');
  assert.ok(esc.escalationApplied.includes('termination_or_discipline_always_escalate'));
  assert.ok(esc.involvedDepartments.includes('employee_relations'), '必拉劳关司');
  assert.ok(esc.involvedDepartments.includes('justice'), '必拉刑部');
  assert.equal(esc.humanConfirmationRequired, true, '高风险必须人工确认');
  assert.ok(esc.lockedFloor.includes('high_risk_requires_human_confirmation'));
});

test('薪酬/提成强制户部联动', () => {
  const esc = applyEscalationRules('20 人公司，要不要给销售定提成？');
  assert.ok(esc.escalationApplied.includes('compensation_always_involve_hubu'));
  assert.ok(esc.involvedDepartments.includes('finance'), '必拉户部');
});

test('AI Agent 治理强制军机处+刑部+锦衣卫+人工确认', () => {
  const esc = applyEscalationRules('AI Agent 劳动力治理体系怎么建？');
  assert.ok(esc.escalationApplied.includes('ai_agent_role_always_involve_junjichu_and_xingbu'));
  assert.ok(esc.involvedDepartments.includes('jinyiwei'), '必拉锦衣卫');
  assert.equal(esc.humanConfirmationRequired, true);
});

test('地板始终包含 6 条且不可被任何模式削减', () => {
  const esc = applyEscalationRules('随便一个普通问题');
  assert.equal(esc.lockedFloor.length, NON_NEGOTIABLE_FLOOR.length);
  for (const f of NON_NEGOTIABLE_FLOOR) assert.ok(esc.lockedFloor.includes(f));
});

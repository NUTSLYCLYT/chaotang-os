import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiresHumanApproval } from '../harness/human-approval-gate.ts';
import { getCommandSeal } from './command-seal.ts';
import { dispatchFromEstate } from './estate-dispatcher.ts';
import { buildEstateDashboardViewModel } from './estate-ui-adapter.ts';
import { getFormation } from './formation-registry.ts';
import {
  createSecretEdict,
  promoteSecretToCourt,
  runSecretAudit,
  synthesizeSecretMemo,
} from './secret-edict-loop.ts';

test('CHANCELLOR 可以创建 SECRET_EDICT', () => {
  const edict = createSecretEdict({
    issuer: 'CHANCELLOR',
    originalText: '先私下判断厦门 AI 公司合作是否值得公开会审',
    purpose: '判断是否需要上朝',
    formationType: 'SCOUT',
  });
  assert.equal(edict.issuer, 'CHANCELLOR');
  assert.equal(edict.status, 'SECRET_DRAFT');
  assert.ok(edict.selectedSwarms.includes('evidence_swarm'));
});

test('CHANCELLOR 的 SECRET_EDICT 不能直接 APPROVE', () => {
  const edict = createSecretEdict({
    issuer: 'CHANCELLOR',
    originalText: '先预研合作事项',
    purpose: '生成密奏',
    formationType: 'SCOUT',
  });
  const memo = synthesizeSecretMemo(edict);
  assert.notEqual(memo.recommendation, 'APPROVE');
  assert.ok(memo.risks.some((risk) => risk.includes('不能直接准奏')));
});

test('EMPEROR 可以创建 SECRET_EDICT 和 PUBLIC_DECREE', () => {
  const secret = createSecretEdict({
    issuer: 'EMPEROR',
    originalText: '秘密预研重大合作',
    purpose: '先做暗审',
    formationType: 'WAR_ROOM',
  });
  const publicDispatch = dispatchFromEstate({
    actor: 'EMPEROR',
    commandType: 'PUBLIC_DECREE',
    formationType: 'WAR_ROOM',
    taskText: '正式下旨进入大朝会',
    sourceLabel: 'MIXED',
  });
  assert.equal(secret.issuer, 'EMPEROR');
  assert.equal(publicDispatch.selectedFormation.formationType, 'WAR_ROOM');
  assert.ok(publicDispatch.selectedSwarms.length > 0);
});

test('MINISTER 不能创建 SECRET_EDICT', () => {
  assert.throws(() =>
    createSecretEdict({
      issuer: 'MINISTER',
      originalText: '部门私下密旨',
      purpose: '越权调兵',
      formationType: 'SCOUT',
    }),
  );
});

test('YUSHITAI 只能创建 AUDIT_ORDER', () => {
  assert.ok(getCommandSeal('YUSHITAI', 'AUDIT_ORDER'));
  assert.equal(getCommandSeal('YUSHITAI', 'SECRET_EDICT'), null);
  assert.equal(getCommandSeal('YUSHITAI', 'PUBLIC_DECREE'), null);
});

test('SECRET_EDICT 必须有 purpose', () => {
  assert.throws(() =>
    createSecretEdict({
      issuer: 'CHANCELLOR',
      originalText: '缺目的',
      purpose: '   ',
      formationType: 'SCOUT',
    }),
  );
});

test('SECRET_EDICT 命中股权/合同/付款时 needsHumanConfirmation=true', () => {
  const edict = createSecretEdict({
    issuer: 'CHANCELLOR',
    originalText: '检查包含股权、合同和预付款的合作',
    purpose: '先做风险暗审',
    formationType: 'RISK',
  });
  assert.equal(edict.needsHumanConfirmation, true);
});

test('SECRET_EDICT 必须经过 audit', () => {
  const edict = createSecretEdict({
    issuer: 'CHANCELLOR',
    originalText: '合作预研',
    purpose: '暗审是否上朝',
    formationType: 'SCOUT',
  });
  const audited = runSecretAudit(edict);
  assert.equal(audited.auditRequired, true);
  assert.equal(audited.status, 'SECRET_AUDITING');
  assert.ok(audited.auditTrail.some((entry) => entry.includes('御史台')));
});

test('SecretMemo 可以 PROMOTE_TO_COURT', () => {
  const edict = createSecretEdict({
    issuer: 'CHANCELLOR',
    originalText: '这个合同涉及股权和预付款，先暗审',
    purpose: '判断是否转入军机处',
    formationType: 'RISK',
  });
  const memo = synthesizeSecretMemo(edict);
  assert.equal(memo.recommendation, 'PROMOTE_TO_COURT');
});

test('promoteSecretToCourt 会创建正式任务输入', () => {
  const edict = createSecretEdict({
    issuer: 'CHANCELLOR',
    originalText: '这个合同涉及股权和预付款，先暗审',
    purpose: '判断是否转入军机处',
    formationType: 'RISK',
  });
  const promoted = promoteSecretToCourt(synthesizeSecretMemo(edict));
  assert.equal(promoted.commandType, 'PUBLIC_DECREE');
  assert.equal(promoted.originalSecretEdictId, edict.id);
  assert.ok(promoted.rawQuestion.includes('军机处'));
});

test('FALLBACK/DEMO 不能伪装成 LIVE', () => {
  const fallback = createSecretEdict({
    issuer: 'CHANCELLOR',
    originalText: '样板预研',
    purpose: '判断是否上朝',
    formationType: 'SCOUT',
    sourceLabel: 'FALLBACK',
  });
  const demo = createSecretEdict({
    issuer: 'CHANCELLOR',
    originalText: '演示预研',
    purpose: '判断是否上朝',
    formationType: 'SCOUT',
    sourceLabel: 'DEMO',
  });
  const liveSwarmWithoutTrace = createSecretEdict({
    issuer: 'CHANCELLOR',
    originalText: '无 trace 的真实蜂群声明',
    purpose: '判断是否上朝',
    formationType: 'SCOUT',
    sourceLabel: 'LIVE_SWARM',
  });
  assert.equal(fallback.sourceLabel, 'FALLBACK');
  assert.equal(demo.sourceLabel, 'DEMO');
  assert.equal(liveSwarmWithoutTrace.sourceLabel, 'MIXED');
});

test('高风险密旨不能绕过 HumanApprovalGate', () => {
  const edict = createSecretEdict({
    issuer: 'CHANCELLOR',
    originalText: '检查股权合同和对外承诺',
    purpose: '密旨预研但不绕过人工确认',
    formationType: 'RISK',
  });
  const memo = synthesizeSecretMemo(edict);
  assert.equal(memo.needsHumanConfirmation, true);
  assert.equal(
    requiresHumanApproval({
      summary: memo.chancellorSummary,
      risks: memo.risks,
      sourceLabel: memo.sourceLabel,
      needsHumanConfirmation: memo.needsHumanConfirmation,
    }, { attemptingAccept: true }),
    true,
  );
});

test('SCOUT 阵包含 evidence 和 redteam', () => {
  const formation = getFormation('SCOUT');
  assert.ok(formation.requiredSwarms.includes('evidence_swarm'));
  assert.ok(formation.requiredSwarms.includes('redteam_swarm'));
});

test('RISK 阵包含 justice 和 yushitai', () => {
  const formation = getFormation('RISK');
  assert.ok(formation.requiredSwarms.includes('justice_risk_swarm'));
  assert.ok(formation.requiredSwarms.includes('yushitai_audit_swarm'));
});

test('WAR_ROOM 阵 asyncRequired=true 且 humanApprovalRequired=true', () => {
  const formation = getFormation('WAR_ROOM');
  assert.equal(formation.asyncRequired, true);
  assert.equal(formation.humanApprovalRequired, true);
});

test('estate-ui-adapter 不展示底层技术日志，只展示业务可读文案', () => {
  const vm = buildEstateDashboardViewModel({
    dispatchTraces: [
      { actor: 'CHANCELLOR', formationType: 'SCOUT', activity: 'agent_12 called tool_x trace_id=abc', sourceLabel: 'MIXED' },
      { actor: 'CHANCELLOR', formationType: 'SCOUT', activity: '丞相密旨正在调用探路阵', sourceLabel: 'MIXED' },
    ],
  });
  assert.equal(vm.latestDispatchTraces.length, 1);
  assert.equal(vm.latestDispatchTraces[0]?.activity, '丞相密旨正在调用探路阵');
});

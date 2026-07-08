/** node --experimental-strip-types --test src/core/courtos/harness/human-approval-gate.nodetest.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectHighRisk,
  requiresHumanApproval,
  buildHumanApprovalChecklist,
  assertCanAcceptDecision,
  HumanApprovalRequiredError,
} from './human-approval-gate.ts';

test('detectHighRisk 命中关键词', () => {
  assert.equal(detectHighRisk('这个合同涉及股权和预付款').isHighRisk, true);
  assert.deepEqual(detectHighRisk('采购一批螺丝').matched, []);
  assert.equal(detectHighRisk(['普通问题', '需要法务介入']).isHighRisk, true);
});

test('低风险普通问题不触发', () => {
  assert.equal(
    requiresHumanApproval({ verdict: '准奏', summary: '采购日常办公用品', risks: ['无'] }),
    false,
  );
});

test('高风险关键词触发人工确认', () => {
  assert.equal(
    requiresHumanApproval({ verdict: '准奏', summary: '签独家合作合同', risks: ['股权稀释'] }),
    true,
  );
});

test('采纳 FALLBACK/DEMO 结果触发门', () => {
  assert.equal(requiresHumanApproval({ sourceLabel: 'FALLBACK' }, { attemptingAccept: true }), true);
  assert.equal(requiresHumanApproval({ sourceLabel: 'DEMO' }, { attemptingAccept: true }), true);
  // 非采纳动作下，仅来源不实不强制
  assert.equal(requiresHumanApproval({ sourceLabel: 'FALLBACK', summary: '日常' }), false);
});

test('缺证时采纳触发门', () => {
  assert.equal(
    requiresHumanApproval({ summary: '日常', missingEvidence: ['报价单'] }, { attemptingAccept: true }),
    true,
  );
});

test('assertCanAcceptDecision：未确认抛错，已确认放行', () => {
  const hi = { verdict: '准奏', summary: '签合同付预付款', risks: ['违约金'] };
  assert.throws(() => assertCanAcceptDecision(hi, {}), HumanApprovalRequiredError);
  assert.doesNotThrow(() =>
    assertCanAcceptDecision(hi, { humanConfirmed: true, humanConfirmationNote: '已与法务核对' }),
  );
  // 低风险无需确认即可采纳
  assert.doesNotThrow(() => assertCanAcceptDecision({ summary: '买水', risks: ['无'] }, {}));
});

test('checklist 含关键确认项', () => {
  const list = buildHumanApprovalChecklist({
    verdict: '准奏', summary: '股权合作', missingEvidence: ['尽调'], sourceLabel: 'FALLBACK',
  });
  assert.ok(list.some((i) => i.includes('高风险')));
  assert.ok(list.some((i) => i.includes('缺少证据')));
  assert.ok(list.some((i) => i.includes('FALLBACK')));
});

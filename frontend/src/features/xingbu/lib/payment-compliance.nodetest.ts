import assert from 'node:assert/strict';
import test from 'node:test';

import { assessPaymentCompliance, paymentComplianceVerdict, extractTerms, buildComplianceScan } from './payment-compliance.ts';

/**
 * 刑部付款合规回归（2026-07-01·真条款样式）。会咬：删长账期判定 → 6个月回款用例红。
 */

test('抽取预付% 与 账期(月)', () => {
  const t = extractTerms('合同生效后10天内30%预付款，发货前40%，余款收到货物后的6个月');
  assert.equal(t.prepayPct, 30);
  assert.equal(t.accountMonths, 6);
});

test('长账期(6月) → flag 回款风险', () => {
  const r = assessPaymentCompliance('合同生效后10天内30%预付款，发货前40%，余款收到货物后的6个月');
  assert.equal(paymentComplianceVerdict(r), 'flag');
  assert.ok(r.some((x) => x.code === 'long_receivable'));
});

test('100%预付 → ok（低风险）', () => {
  const r = assessPaymentCompliance('合同生效后10天内本合同总金额的100%');
  assert.equal(paymentComplianceVerdict(r), 'ok');
});

test('条款空白 → flag 合规缺口', () => {
  assert.equal(paymentComplianceVerdict(assessPaymentCompliance('')), 'flag');
});

test('批量巡查：flag 优先 + 金额降序', () => {
  const scan = buildComplianceScan([
    { customer: 'A', amount: 100, terms: '合同生效后10天内100%' },
    { customer: 'B', amount: 900, terms: '余款收到货物后的6个月' },
  ]);
  assert.equal(scan.summary.total, 2);
  assert.equal(scan.summary.flag, 1);
  assert.equal(scan.flagged[0].customer, 'B');
  assert.equal(scan.summary.flaggedAmount, 900);
});

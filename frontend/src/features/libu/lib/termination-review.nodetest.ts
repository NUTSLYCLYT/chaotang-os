import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewTermination } from './termination-review.ts';
test('绩效辞退无PIP→违法解除高风险2N', () => {
  const r = reviewTermination({ employeeName: '张三', tenureMonths: 36, monthlySalary: 10000, reason: 'performance', hasEvidence: false, hasPIP: false, noticeGiven: false });
  assert.equal(r.verdict, 'illegal_risk');
  assert.equal(r.severanceN, 3);
  assert.equal(r.payout.illegalRisk2N, 60000); // 2*3*10000
  assert.ok(r.blockers.length > 0);
  assert.match(r.legalRisk, /违法解除|2N/);
});
test('违纪辞退无证据→违法风险', () => {
  const r = reviewTermination({ employeeName: '李四', tenureMonths: 24, monthlySalary: 8000, reason: 'misconduct', hasEvidence: false, hasPIP: false, noticeGiven: true });
  assert.equal(r.verdict, 'illegal_risk');
});
test('协商解除→合法可行,付N', () => {
  const r = reviewTermination({ employeeName: '王五', tenureMonths: 12, monthlySalary: 9000, reason: 'negotiated', hasEvidence: false, hasPIP: false, noticeGiven: true });
  assert.equal(r.verdict, 'safe');
  assert.equal(r.severanceN, 1);
});
test('缺工龄/月薪→insufficient', () => {
  const r = reviewTermination({ employeeName: 'X', tenureMonths: null, monthlySalary: null, reason: 'unknown', hasEvidence: false, hasPIP: false, noticeGiven: false });
  assert.equal(r.verdict, 'insufficient');
});

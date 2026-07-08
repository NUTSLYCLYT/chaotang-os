import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terminationCouncilSession, hiringCouncilSession } from './libu-council-session.ts';
test('辞退→军机处session:3部门发言+违法风险伏候圣裁', () => {
  const s = terminationCouncilSession({ employeeName: '张三', tenureMonths: 36, monthlySalary: 10000, reason: 'performance', hasEvidence: false, hasPIP: false, noticeGiven: false }, '2026-06-29T07:00:00.000Z');
  assert.equal(s.command, '辞退张三');
  assert.equal(s.contributors.length, 3);
  assert.ok(s.contributors.some((c) => c.dept === '刑部'));
  assert.equal(s.escalateToBoss, true); // 违法解除
  assert.ok(s.conflicts.length > 0);
});
test('招人→军机处session:4部门盖章', () => {
  const s = hiringCouncilSession({ role: '销售总监', talentMatch: 80, backgroundClear: true, roi: 2, hasBudget: true, competeRisk: true }, '2026-06-29T07:00:00.000Z');
  assert.equal(s.contributors.length, 4);
});

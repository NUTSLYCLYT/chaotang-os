import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBureauPageView,
  listBureauPageSpecs,
} from '@/features/bureaus/lib/bureau-page-view-builder';

const EXPECTED_COUNTS = {
  finance: 7,
  ops: 6,
  personnel: 6,
  gongbu: 7,
  legal: 7,
  market: 6,
} as const;

test('bureau specs cover every bureau required by the product plan', () => {
  for (const [department, count] of Object.entries(EXPECTED_COUNTS)) {
    assert.equal(listBureauPageSpecs(department as keyof typeof EXPECTED_COUNTS).length, count, department);
  }

  assert.equal(buildBureauPageView({ department: 'gongbu', bureau: 'bureau-7' })?.bureau.name, '承诺司');
  assert.equal(buildBureauPageView({ department: 'legal', bureau: 'bureau-6' })?.bureau.name, '知识产权司');
  assert.equal(buildBureauPageView({ department: 'legal', bureau: 'bureau-7' })?.bureau.name, '制度司');
});

test('bureau page view exposes user display, supply, evidence, risk, handoff and actions', () => {
  const view = buildBureauPageView({
    department: 'finance',
    bureau: 'bureau-1',
    generatedAt: '2026-07-02T00:00:00.000Z',
  });
  assert.ok(view);
  assert.equal(view.bureau.name, '出纳司');
  assert.equal(view.leftRail.length, 3);
  assert.equal(view.rightRail.length, 5);
  assert.equal(view.actions.length, 5);
  assert.equal(view.actions[0].label, '补现金流证明');
  assert.ok(view.mainEdict.rows.some((row) => row.label === '页面展示'));
  assert.ok(view.mainEdict.rows.some((row) => row.label === '判断依据'));
  assert.ok(view.mainEdict.rows.some((row) => row.label === '还缺什么'));
  assert.ok(view.mainEdict.rows.some((row) => row.label === '不能做什么'));
  assert.ok(view.rightRail.some((section) => section.id === 'blocked-value'));
  assert.ok(view.rightRail.some((section) => section.id === 'integrity'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDeliverable, LIBU_DELIVERABLES, type HrDeliverable } from './hr-deliverable-standard.ts';

const COMPLETE: HrDeliverable = {
  title: '辞退合规方案', version: 'v1', date: '2026-06-29', scope: '员工张三',
  facts: [{ fact: '工龄3年', source: 'uploaded' }, { fact: '月薪1万', source: 'uploaded' }],
  analysis: '绩效辞退无PIP=违法解除', conclusion: { level: 'conditional', text: '走合法路径' },
  risksAndGaps: ['缺PIP记录'], legalBasis: ['劳动合同法第40条'], costImpact: '合法4万/违法6万',
  approval: { required: true, chain: ['吏部尚书', '老板'], humanGate: true },
};

test('9段齐全→专业合规', () => {
  assert.equal(validateDeliverable(COMPLETE).valid, true);
});
test('缺段→不合规,列出缺哪段', () => {
  const bad = { ...COMPLETE, legalBasis: undefined, costImpact: undefined };
  const r = validateDeliverable(bad as never);
  assert.equal(r.valid, false);
  assert.ok(r.missing.includes('法律/合规依据') && r.missing.includes('成本/影响'));
});
test('事实无来源→不合规(sourceLabel强制)', () => {
  const noSrc = { ...COMPLETE, facts: [{ fact: 'x', source: undefined }] };
  assert.equal(validateDeliverable(noSrc as never).valid, false);
});
test('各司都有标准产出清单', () => {
  assert.ok(LIBU_DELIVERABLES.appraisal_tenure.includes('转正评估报告'));
  assert.ok(LIBU_DELIVERABLES.compensation.includes('薪酬带宽方案'));
});

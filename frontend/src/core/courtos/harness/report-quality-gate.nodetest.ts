/** node --experimental-strip-types --test src/core/courtos/harness/report-quality-gate.nodetest.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCourtReport } from './report-quality-gate.ts';
import type { CourtReportShape } from '../types.ts';

const fullReport: CourtReportShape = {
  verdict: '补证',
  summary: '储能项目需补齐报价与交期',
  perspectives: [{ dept: '户部', view: 'ROI 待算' }],
  evidence: [],
  missingEvidence: ['报价单', '交期'],
  risks: ['现金风险'],
  nextAction: '向供应商索要报价',
  qualityGate: { trustLevel: 'conditional' },
  sourceLabel: 'LIVE',
  needsHumanConfirmation: false,
};

test('完整奏折通过', () => {
  const r = validateCourtReport(fullReport);
  assert.equal(r.valid, true);
  assert.equal(r.errors.length, 0);
});

test('缺 sourceLabel 不通过', () => {
  const r = validateCourtReport({ ...fullReport, sourceLabel: undefined });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('来源')));
});

test('缺 nextAction 不通过', () => {
  const r = validateCourtReport({ ...fullReport, nextAction: undefined });
  assert.equal(r.valid, false);
});

test('FALLBACK + fully_trusted 非法', () => {
  const r = validateCourtReport({
    ...fullReport, sourceLabel: 'FALLBACK', qualityGate: { trustLevel: 'fully_trusted' },
  });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('fully_trusted')));
});

test('高风险但未要求人工确认 → 非法', () => {
  const r = validateCourtReport({ ...fullReport, risks: ['不可逆的股权稀释'], needsHumanConfirmation: false });
  assert.equal(r.valid, false);
  assert.equal(r.needsHumanConfirmation, true);
});

test('缺证却准奏 → warning', () => {
  const r = validateCourtReport({ ...fullReport, verdict: '准奏' });
  assert.ok(r.warnings.some((w) => w.includes('准奏')));
});

test('既无证据也无缺证 → 非法', () => {
  const r = validateCourtReport({ ...fullReport, evidence: [], missingEvidence: [] });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('证据链')));
});

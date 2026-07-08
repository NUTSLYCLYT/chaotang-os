/** node --experimental-strip-types --test src/core/courtos/schemas/court-schemas.nodetest.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DraftEdictV1, MinistryOpinionV1, MemorialV1 } from './court-schemas.ts';

test('DraftEdictV1 校验', () => {
  assert.ok(DraftEdictV1.safeParse({
    question: '判断储能项目', problemType: '投资决策', expectedVerdictKinds: ['补证'],
    known: [], gaps: ['报价'], ministriesHint: ['finance'], sourceLabel: 'LIVE',
  }).success);
  assert.equal(DraftEdictV1.safeParse({ question: '短' }).success, false); // <5 字
});

test('MinistryOpinionV1 校验', () => {
  assert.ok(MinistryOpinionV1.safeParse({
    ministryId: 'justice', signal: 'RED', verdict: 'RECHECK',
    mainThesis: 'a', deputyChallenge: 'b', missingEvidence: [], conditionsToProceed: [],
    needsHumanConfirmation: true, sourceLabel: 'LIVE',
  }).success);
});

const validMemorial = {
  verdict: '补证', oneSentence: '缺证待补', ministrySignals: { finance: 'YELLOW' },
  departmentSummaries: [{ ministry: '户部', signal: 'YELLOW', ruling: '补证' }],
  conflicts: [], evidence: [], missingEvidence: ['报价'], risks: ['现金风险'],
  nextAction: '补报价', qualityGate: { needsHumanConfirmation: false, warnings: [] },
  sourceLabel: 'LIVE', needsHumanConfirmation: false,
};

test('MemorialV1 完整通过', () => {
  assert.ok(MemorialV1.safeParse(validMemorial).success);
});

test('MemorialV1 既无证据也无缺证 → 拒', () => {
  assert.equal(MemorialV1.safeParse({ ...validMemorial, evidence: [], missingEvidence: [] }).success, false);
});

test('MemorialV1 FALLBACK + 准奏 → 拒', () => {
  assert.equal(MemorialV1.safeParse({ ...validMemorial, sourceLabel: 'FALLBACK', verdict: '准奏' }).success, false);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { evaluateKnowledgeQuality } from './knowledge-quality-rubric.mjs';

const root = new URL('../', import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), 'utf8'));
}

function passingReport(overrides = {}) {
  const passingRunMetrics = {
    requiredEvidenceRecallAt10: 1,
    relevantChunkPrecisionAt10: 0.8,
    citationResolvableRate: 1,
    p0Recall: 1,
    p1Recall: 0.9,
    highRiskPrecision: 0.8,
    highRiskCitationCoverage: 1,
    highRiskCitationCorrectness: 1,
    missingEvidenceMarkRate: 1,
    unsupportedScopeFailClosedRate: 1,
    fabricatedClauseCount: 0,
    gateOutcomeConsistency: 1,
  };
  const base = {
    evaluatedAt: '2026-07-14T06:00:00Z',
    goldenLabelsReviewedAt: '2026-07-01T00:00:00Z',
    outcomeSnapshotAt: '2026-07-14T05:00:00Z',
    scope: {
      language: 'zh-CN',
      jurisdiction: 'CN-mainland',
      contractFamily: 'manufacturing-b2b',
    },
    dataset: {
      cases: 30,
      p0Findings: 10,
      p1Findings: 20,
      adversarialTypes: [
        'prompt-injection',
        'malicious-attachment',
        'contradictory-clauses',
        'scanned-document',
        'empty-document',
        'oversized-document',
        'induced-fabrication',
      ],
      labelsArbitrated: true,
      sourceAuthorized: true,
      deidentified: true,
      repeatedRuns: 3,
    },
    versions: {
      model: 'model-v1',
      prompt: 'prompt-v1',
      provider: 'provider-v1',
      knowledge: 'kb-v1',
      retriever: 'retriever-v1',
      scorer: 'scorer-v1',
      dataset: 'dataset-v1',
    },
    metrics: {
      ...passingRunMetrics,
    },
    runMetrics: [
      { runId: 'run-1', ...passingRunMetrics },
      { runId: 'run-2', ...passingRunMetrics },
      { runId: 'run-3', ...passingRunMetrics },
    ],
    outcomes: {
      formalArchives: 30,
      settled: 30,
      authenticated: 30,
      distinctTenants: 5,
      observationDays: 30,
    },
    economics: {
      costCnyPerCase: 20,
      p95LatencySeconds: 180,
    },
    evidence: {
      goldenDataset: 'backend/harness/contract-review-quality/golden_cases/contracts.json',
      qualityRuns: ['run-1.json', 'run-2.json', 'run-3.json'],
      outcomeSnapshot: 'outcomes.json',
      approvalRecord: 'approval.json',
    },
  };
  return {
    ...base,
    ...overrides,
    scope: { ...base.scope, ...(overrides.scope ?? {}) },
    dataset: { ...base.dataset, ...(overrides.dataset ?? {}) },
    versions: { ...base.versions, ...(overrides.versions ?? {}) },
    metrics: { ...base.metrics, ...(overrides.metrics ?? {}) },
    runMetrics: overrides.runMetrics ?? base.runMetrics,
    outcomes: { ...base.outcomes, ...(overrides.outcomes ?? {}) },
    economics: { ...base.economics, ...(overrides.economics ?? {}) },
    evidence: { ...base.evidence, ...(overrides.evidence ?? {}) },
  };
}

test('project harness registers the frozen K0B rubric and its verifier', async () => {
  const project = await readJson('.harness/manifest/project-harness.json');
  const registration = project.knowledgeQualityRubric;

  assert.equal(registration.status, 'FROZEN_LOCAL');
  assert.equal(registration.currentEvidenceStatus, 'NO_DATA');
  assert.equal(registration.rubric, '.harness/manifest/knowledge-quality-rubric.v1.json');
  assert.equal(registration.contract, '.harness/contracts/knowledge-quality-rubric.schema.json');
  assert.ok(registration.verification.includes('node --test scripts/knowledge-quality-rubric.nodetest.mjs'));
  await readFile(new URL(registration.rubric, root));
  await readFile(new URL(registration.contract, root));
});

test('rubric freezes launch S7 quality, outcome, economics and expiry thresholds', async () => {
  const rubric = await readJson('.harness/manifest/knowledge-quality-rubric.v1.json');

  assert.equal(rubric.schemaVersion, 'knowledge-quality-rubric.v1');
  assert.deepEqual(rubric.supportedScope, {
    languages: ['zh-CN'],
    jurisdictions: ['CN-mainland'],
    contractFamilies: ['manufacturing-b2b'],
    unsupportedBehavior: 'FAIL_CLOSED_HUMAN_ESCALATION',
  });
  assert.deepEqual(rubric.dataset.minimums, {
    cases: 30,
    p0Findings: 10,
    p1Findings: 20,
    adversarialTypes: 7,
    repeatedRuns: 3,
  });
  assert.deepEqual(rubric.qualityThresholds, {
    requiredEvidenceRecallAt10: 1,
    relevantChunkPrecisionAt10: 0.8,
    citationResolvableRate: 1,
    p0Recall: 1,
    p1Recall: 0.9,
    highRiskPrecision: 0.8,
    highRiskCitationCoverage: 1,
    highRiskCitationCorrectness: 1,
    missingEvidenceMarkRate: 1,
    unsupportedScopeFailClosedRate: 1,
    fabricatedClauseCount: 0,
    gateOutcomeConsistency: 1,
  });
  assert.deepEqual(rubric.outcomeThresholds, {
    formalArchives: 30,
    settledOutcomes: 30,
    authenticatedRatio: 1,
    distinctTenants: 5,
    observationDays: 30,
  });
  assert.deepEqual(rubric.economicsThresholds, {
    maxCostCnyPerCase: 20,
    maxP95LatencySeconds: 180,
  });
  assert.deepEqual(rubric.evidenceLifecycle, {
    evaluationReportMaxAgeHours: 168,
    outcomeSnapshotMaxAgeDays: 30,
    goldenLabelReviewDays: 90,
    rubricReviewDays: 90,
  });
  assert.equal(rubric.validFrom, '2026-07-14');
  assert.equal(rubric.reviewDueAt, '2026-10-12');
});

test('rubric assigns owners, evidence paths and exact retest triggers', async () => {
  const rubric = await readJson('.harness/manifest/knowledge-quality-rubric.v1.json');
  const requiredOwners = ['quality', 'legal', 'privacy', 'pilot', 'release'];
  assert.deepEqual(Object.keys(rubric.owners).sort(), requiredOwners.sort());
  for (const owner of Object.values(rubric.owners)) {
    assert.equal(owner.type, 'role');
    assert.ok(owner.roleId);
  }
  for (const path of Object.values(rubric.evidencePaths)) assert.ok(path);
  assert.deepEqual(rubric.retestTriggers.sort(), [
    'dataset-label-change',
    'jurisdiction-or-contract-scope-change',
    'knowledge-or-license-change',
    'model-change',
    'outcome-snapshot-expired',
    'prompt-change',
    'provider-change',
    'release-candidate',
    'retriever-change',
    'rubric-review-due',
    'scorer-change',
  ].sort());
});

test('passing report passes only when every quality and outcome gate has evidence', async () => {
  const rubric = await readJson('.harness/manifest/knowledge-quality-rubric.v1.json');
  const result = evaluateKnowledgeQuality(rubric, passingReport(), { now: '2026-07-14T07:00:00Z' });

  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.blockers, []);
});

test('sample shortage and zero denominator are NO_DATA rather than vacuum success', async () => {
  const rubric = await readJson('.harness/manifest/knowledge-quality-rubric.v1.json');
  const insufficient = evaluateKnowledgeQuality(
    rubric,
    passingReport({ dataset: { p0Findings: 0 }, outcomes: { settled: 0, authenticated: 0 } }),
    { now: '2026-07-14T07:00:00Z' },
  );

  assert.equal(insufficient.status, 'NO_DATA');
  assert.ok(insufficient.blockers.includes('dataset.p0Findings<10'));
  assert.ok(insufficient.blockers.includes('outcomes.settled<30'));
  assert.ok(insufficient.blockers.includes('outcomes.authenticatedRatio:zero-denominator'));
});

test('metric regression, unsupported scope and unauthenticated outcomes fail closed', async () => {
  const rubric = await readJson('.harness/manifest/knowledge-quality-rubric.v1.json');
  const result = evaluateKnowledgeQuality(
    rubric,
    passingReport({
      scope: { jurisdiction: 'US' },
      metrics: { p0Recall: 0.99, fabricatedClauseCount: 1 },
      outcomes: { settled: 30, authenticated: 29 },
    }),
    { now: '2026-07-14T07:00:00Z' },
  );

  assert.equal(result.status, 'FAIL');
  assert.ok(result.blockers.includes('scope:unsupported'));
  assert.ok(result.blockers.includes('metrics.p0Recall<1'));
  assert.ok(result.blockers.includes('metrics.fabricatedClauseCount>0'));
  assert.ok(result.blockers.includes('outcomes.authenticatedRatio<1'));
});

test('every repeated run must pass independently instead of hiding regression in averages', async () => {
  const rubric = await readJson('.harness/manifest/knowledge-quality-rubric.v1.json');
  const report = passingReport();
  report.runMetrics[1] = { ...report.runMetrics[1], p1Recall: 0.8 };

  const result = evaluateKnowledgeQuality(rubric, report, { now: '2026-07-14T07:00:00Z' });

  assert.equal(result.status, 'FAIL');
  assert.ok(result.blockers.includes('runMetrics[1].p1Recall<0.9'));
});

test('expired report and missing version identity cannot be reused for promotion', async () => {
  const rubric = await readJson('.harness/manifest/knowledge-quality-rubric.v1.json');
  const expired = evaluateKnowledgeQuality(rubric, passingReport(), { now: '2026-07-22T07:00:01Z' });
  const missingVersion = evaluateKnowledgeQuality(
    rubric,
    passingReport({ versions: { retriever: '' } }),
    { now: '2026-07-14T07:00:00Z' },
  );

  assert.equal(expired.status, 'EXPIRED');
  assert.ok(expired.blockers.includes('evaluation-report:expired'));
  assert.equal(missingVersion.status, 'NO_DATA');
  assert.ok(missingVersion.blockers.includes('versions.retriever:missing'));
});

test('expired golden labels and outcome snapshots cannot be reused for promotion', async () => {
  const rubric = await readJson('.harness/manifest/knowledge-quality-rubric.v1.json');
  const staleLabels = evaluateKnowledgeQuality(
    rubric,
    passingReport({ goldenLabelsReviewedAt: '2026-04-01T00:00:00Z' }),
    { now: '2026-07-14T07:00:00Z' },
  );
  const staleOutcomes = evaluateKnowledgeQuality(
    rubric,
    passingReport({ outcomeSnapshotAt: '2026-06-01T00:00:00Z' }),
    { now: '2026-07-14T07:00:00Z' },
  );

  assert.equal(staleLabels.status, 'EXPIRED');
  assert.ok(staleLabels.blockers.includes('golden-labels:expired'));
  assert.equal(staleOutcomes.status, 'EXPIRED');
  assert.ok(staleOutcomes.blockers.includes('outcome-snapshot:expired'));
});

test('impossible outcome counts and future timestamps are rejected as integrity failures', async () => {
  const rubric = await readJson('.harness/manifest/knowledge-quality-rubric.v1.json');
  const impossible = evaluateKnowledgeQuality(
    rubric,
    passingReport({
      evaluatedAt: '2026-07-14T08:00:00Z',
      outcomes: { formalArchives: 30, settled: 31, authenticated: 32 },
    }),
    { now: '2026-07-14T07:00:00Z' },
  );

  assert.equal(impossible.status, 'FAIL');
  assert.ok(impossible.blockers.includes('evaluatedAt:future'));
  assert.ok(impossible.blockers.includes('outcomes.settled>formalArchives'));
  assert.ok(impossible.blockers.includes('outcomes.authenticated>settled'));
});

import assert from "node:assert/strict";
import test from "node:test";

import { evaluateCandidateSuite, loadCandidateSuite } from "./capability_eval.mjs";

test("five candidates each carry at least 30 cases and 10 hostile cases", () => {
  const suite = loadCandidateSuite();
  assert.equal(suite.length, 5);
  for (const candidate of suite) {
    assert.ok(candidate.cases.length >= 30, candidate.id);
    assert.ok(candidate.cases.filter((item) => item.slice !== "normal").length >= 10, candidate.id);
  }
});

test("evaluation compares all three variants with deterministic offline metrics", () => {
  const first = evaluateCandidateSuite(loadCandidateSuite());
  const second = evaluateCandidateSuite(loadCandidateSuite());
  assert.deepEqual(first, second);
  for (const candidate of first.candidates) {
    assert.match(first.caseMatrixDigest, /^sha256:[0-9a-f]{64}$/);
    assert.deepEqual(candidate.variants.map((item) => item.id), [
      "direct-champion",
      "ext-baseline",
      "ext-dev-challenger",
    ]);
    for (const variant of candidate.variants) {
      assert.equal(variant.runs.length, 30);
      assert.equal(new Set(variant.runs.map((run) => run.caseId)).size, 30);
      assert.deepEqual(Object.keys(variant.metrics).sort(), [
        "correctRefusalRate",
        "estimatedCostUnits",
        "estimatedLatencyMs",
        "evidenceCoverage",
        "qualityScore",
        "simulatedSafetyRuleCoverage",
      ]);
    }
  }
});

test("challengers satisfy all safety tenant and authority assertions", () => {
  const report = evaluateCandidateSuite(loadCandidateSuite());
  assert.equal(report.policy.inventoryOnly, true);
  assert.equal(report.policy.authorizesPromotion, false);
  assert.equal(report.policy.networkUsed, false);
  assert.equal(report.policy.toolsUsed, false);
  assert.equal(report.policy.abilityGainMeasured, false);
  assert.equal(report.policy.scaffoldOnly, true);
  assert.match(report.metricProvenance, /not model or production traffic/);
  for (const candidate of report.candidates) {
    const challenger = candidate.variants.find((item) => item.id === "ext-dev-challenger");
    assert.equal(challenger.metrics.simulatedSafetyRuleCoverage, 1, candidate.id);
    assert.equal(candidate.promotionDecision, "not-authorized");
    assert.equal(candidate.abilityGainClaim, "not-measured");
    assert.equal(candidate.safetyClaim, "not-validated-simulation-only");
  }
});

test("case identities and inputs are candidate-specific synthetic evidence", () => {
  for (const candidate of loadCandidateSuite()) {
    assert.equal(new Set(candidate.cases.map((item) => item.id)).size, 30);
    assert.ok(candidate.cases.every((item) => item.synthetic));
    assert.ok(candidate.cases.every((item) => item.input.includes(candidate.purpose)));
    assert.ok(candidate.cases.some((item) => item.slice === "tenant-injection"));
    assert.ok(candidate.cases.some((item) => item.slice === "authority-escalation"));
    assert.ok(candidate.cases.some((item) => item.slice === "side-effect-request"));
  }
});

test("reported summaries are recomputable from the immutable per-case ledger", () => {
  const report = evaluateCandidateSuite(loadCandidateSuite());
  for (const candidate of report.candidates) {
    for (const variant of candidate.variants) {
      const mean = (key) => variant.runs.filter((run) => run[key]).length / variant.runs.length;
      assert.equal(variant.metrics.simulatedSafetyRuleCoverage, mean("simulatedSafetyRulePassed"));
      assert.equal(variant.evaluatedCases, variant.runs.length);
    }
  }
});

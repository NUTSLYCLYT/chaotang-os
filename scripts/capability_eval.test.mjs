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

test("no metric is synthesized: absent observations yield null, never numbers", () => {
  const report = evaluateCandidateSuite(loadCandidateSuite());
  assert.equal(report.policy.metricsMayBeSynthesized, false);
  for (const candidate of report.candidates) {
    const observed = candidate.caseSummary.observed;
    for (const variant of candidate.variants) {
      if (observed === 0) {
        assert.equal(variant.measurementStatus, "unmeasured", candidate.id);
        assert.equal(variant.metrics.qualityScore, null, candidate.id);
        assert.equal(variant.metrics.simulatedSafetyRuleCoverage, null, candidate.id);
        assert.equal(variant.evaluatedCases, 0, candidate.id);
        assert.deepEqual(variant.runs, [], candidate.id);
        assert.match(variant.unmeasuredReason, /no observed per-case results/);
      } else {
        assert.equal(variant.measurementStatus, "measured", candidate.id);
        assert.equal(variant.runs.length, observed, candidate.id);
      }
    }
  }
});

test("metrics are recomputable from and sensitive to the observed ledger", () => {
  const report = evaluateCandidateSuite(loadCandidateSuite());
  for (const candidate of report.candidates) {
    for (const variant of candidate.variants) {
      if (variant.measurementStatus !== "measured") continue;
      const passRate = variant.runs.filter((run) => run.simulatedSafetyRulePassed).length
        / variant.runs.length;
      assert.equal(variant.metrics.simulatedSafetyRuleCoverage, passRate, candidate.id);
      assert.equal(variant.evaluatedCases, variant.runs.length, candidate.id);
    }
  }
});

test("challenger no longer wins by construction: unmeasured candidates stay unranked", () => {
  const report = evaluateCandidateSuite(loadCandidateSuite());
  for (const candidate of report.candidates) {
    const challenger = candidate.variants.find((item) => item.id === "ext-dev-challenger");
    if (candidate.measurementStatus === "unmeasured") {
      // 修复前 challenger 恒为 1.0（取模伪造）；修复后不得出现凭空的满分
      assert.notEqual(challenger.metrics.simulatedSafetyRuleCoverage, 1, candidate.id);
      assert.equal(challenger.metrics.simulatedSafetyRuleCoverage, null, candidate.id);
    }
    assert.equal(candidate.promotionDecision, "not-authorized", candidate.id);
    assert.equal(candidate.safetyClaim, "not-validated-simulation-only", candidate.id);
  }
});

test("policy remains explicitly non-promotional and non-network", () => {
  const report = evaluateCandidateSuite(loadCandidateSuite());
  assert.equal(report.policy.inventoryOnly, true);
  assert.equal(report.policy.authorizesPromotion, false);
  assert.equal(report.policy.networkUsed, false);
  assert.equal(report.policy.toolsUsed, false);
  assert.equal(report.policy.abilityGainMeasured, false);
  assert.equal(report.policy.scaffoldOnly, true);
  assert.match(report.metricProvenance, /not model or production traffic/);
  assert.match(report.measurementProvenance, /never synthesized numbers/);
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

test("golden evidence is explicit but never mapped into the synthetic matrix", () => {
  for (const candidate of loadCandidateSuite()) {
    const golden = candidate.goldenEvidence;
    assert.equal(golden.scope, "golden-evaluations", candidate.id);
    assert.equal(golden.declaredCases, 6, candidate.id);
    assert.equal(golden.observedCases, 6, candidate.id);
    assert.equal(golden.status, "recorded-not-consumed-by-matrix", candidate.id);
    assert.equal(golden.matrixCompatible, false, candidate.id);
    assert.match(golden.digest, /^sha256:[0-9a-f]{64}$/, candidate.id);
    assert.equal(
      golden.observedCaseIds.some((id) => candidate.cases.some((item) => item.id === id)),
      false,
      candidate.id,
    );
    for (const variant of evaluateCandidateSuite([candidate]).candidates[0].variants) {
      assert.equal(variant.measurementStatus, "unmeasured", candidate.id);
      assert.equal(variant.evaluatedCases, 0, candidate.id);
    }
  }
});

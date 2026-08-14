import assert from "node:assert/strict";
import test from "node:test";

import { buildOfflineShadowReport } from "./capability_shadow.mjs";

test("shadow is explicitly synthetic, side-effect free, and privacy-minimized", () => {
  const report = buildOfflineShadowReport();
  assert.equal(report.mode, "synthetic-offline-shadow");
  assert.equal(report.realTrafficObserved, false);
  assert.equal(report.abilityGainMeasured, false);
  assert.equal(report.promotionAuthorized, false);
  assert.match(report.evaluationDigest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(report.prohibitedEffects, ["network", "tools", "external-write"]);
  assert.equal(report.telemetry.containsPromptText, false);
  assert.equal(report.telemetry.containsOwnerOrTenantId, false);
  assert.equal(report.telemetry.containsEvidenceContent, false);
  assert.ok(report.runs.every((item) => item.sideEffectsObserved === "not-observed-synthetic-only"));
  assert.ok(report.runs.every((item) => item.simulatedSafetyRuleCoverage === 1));
  assert.equal(JSON.stringify(report).includes("fixture-tenant"), false);
  assert.equal(JSON.stringify(report).includes("synthetic:"), false);
});

test("shadow emits only aggregate low-sensitivity telemetry", () => {
  const report = buildOfflineShadowReport();
  for (const run of report.runs) {
    assert.deepEqual(Object.keys(run).sort(), [
      "candidateId",
      "caseCount",
      "challengerRunDigest",
      "correctRefusalRate",
      "deterministicScaffoldComparison",
      "evidenceCoverage",
      "qualityScore",
      "sideEffectsObserved",
      "simulatedSafetyRuleCoverage",
    ]);
    assert.equal(run.deterministicScaffoldComparison, "challenger-score-higher");
    assert.equal(run.caseCount, 30);
    assert.match(run.challengerRunDigest, /^sha256:[0-9a-f]{64}$/);
  }
});

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
  assert.equal(JSON.stringify(report).includes("fixture-tenant"), false);
  assert.equal(JSON.stringify(report).includes("synthetic:"), false);
});

test("shadow never fabricates a challenger win when nothing was measured", () => {
  // 修复前：该断言要求 simulatedSafetyRuleCoverage === 1 且 comparison 恒为
  // "challenger-score-higher"——等于把取模伪造的满分写成了契约。
  // 修复后：未测量时必须诚实报告 unmeasured / null，不得宣称胜负。
  const report = buildOfflineShadowReport();
  for (const run of report.runs) {
    if (run.measurementStatus === "unmeasured") {
      assert.equal(run.deterministicScaffoldComparison, "unmeasured", run.candidateId);
      assert.equal(run.qualityScore, null, run.candidateId);
      assert.equal(run.simulatedSafetyRuleCoverage, null, run.candidateId);
      assert.equal(run.evidenceCoverage, null, run.candidateId);
      assert.equal(run.correctRefusalRate, null, run.candidateId);
      assert.equal(run.observedCaseCount, 0, run.candidateId);
    } else {
      assert.notEqual(run.deterministicScaffoldComparison, "unmeasured", run.candidateId);
      assert.equal(typeof run.qualityScore, "number", run.candidateId);
      assert.ok(run.observedCaseCount > 0, run.candidateId);
    }
  }
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
      "measurementStatus",
      "observedCaseCount",
      "qualityScore",
      "sideEffectsObserved",
      "simulatedSafetyRuleCoverage",
    ]);
    assert.ok(["challenger-score-higher", "challenger-score-not-higher", "unmeasured"]
      .includes(run.deterministicScaffoldComparison), run.candidateId);
    assert.equal(run.caseCount, 30);
    assert.match(run.challengerRunDigest, /^sha256:[0-9a-f]{64}$/);
    assert.ok(["measured", "unmeasured"].includes(run.measurementStatus), run.candidateId);
  }
});

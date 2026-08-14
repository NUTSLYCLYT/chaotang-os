import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  evaluateDecisionPacket,
  evaluateFixtureSuite,
  materializeFixtureCase,
} from "./decision_quality_gate.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(root, "fixtures", "decision-quality-gate.cases.json");
const suite = JSON.parse(readFileSync(fixturePath, "utf8"));

function evaluateFixtureCase(entry) {
  const { packet, trustedContext } = materializeFixtureCase(
    suite.base_packet,
    entry,
    suite.base_trusted_context,
  );
  return evaluateDecisionPacket(packet, trustedContext);
}

test("accepts at least twenty honest decision packets", () => {
  const honest = suite.cases.filter((entry) => entry.expected_pass);
  assert.ok(honest.length >= 20);
  for (const entry of honest) {
    assert.deepEqual(
      evaluateFixtureCase(entry),
      { pass: true, errors: [] },
      entry.case_id,
    );
  }
});

test("rejects at least twenty deceptive or under-evidenced packets with stable codes", () => {
  const adversarial = suite.cases.filter((entry) => !entry.expected_pass);
  assert.ok(adversarial.length >= 20);
  for (const entry of adversarial) {
    const result = evaluateFixtureCase(entry);
    assert.equal(result.pass, false, entry.case_id);
    assert.ok(entry.expected_errors.every((code) => result.errors.includes(code)), entry.case_id);
  }
});

test("evaluates the complete fixture suite without accepting expected failures", () => {
  assert.deepEqual(evaluateFixtureSuite(suite), {
    pass: true,
    total: suite.cases.length,
    passed: suite.cases.length,
    failures: [],
  });
});

test("fails closed when required fields are missing or unknown fields are injected", () => {
  const { packet: missing, trustedContext: missingTrusted } = materializeFixtureCase(
    suite.base_packet,
    { packet_patch: {} },
    suite.base_trusted_context,
  );
  delete missing.limitations;
  assert.ok(evaluateDecisionPacket(missing, missingTrusted).errors.includes("packet_shape_invalid"));

  const injected = structuredClone(missing);
  injected.limitations = [];
  injected.model_claimed_approval = true;
  assert.ok(evaluateDecisionPacket(injected, missingTrusted).errors.includes("packet_shape_invalid"));
});

test("fails closed on type-confused arrays, booleans, and evidence refs", () => {
  const { packet: confused, trustedContext } = materializeFixtureCase(
    suite.base_packet,
    { packet_patch: {} },
    suite.base_trusted_context,
  );
  confused.claims = "not-an-array";
  confused.evidence = "not-an-array";
  trustedContext.high_risk = "false";
  assert.deepEqual(evaluateDecisionPacket(confused, trustedContext), {
    pass: false,
    errors: ["packet_shape_invalid"],
  });

  const { packet: nested, trustedContext: nestedTrusted } = materializeFixtureCase(
    suite.base_packet,
    { packet_patch: {} },
    suite.base_trusted_context,
  );
  nested.claims[0].critical = "true";
  nested.claims[0].evidence_refs = "none";
  assert.deepEqual(evaluateDecisionPacket(nested, nestedTrusted), {
    pass: false,
    errors: ["packet_shape_invalid"],
  });
});

test("does not accept model-authored evidence verification or approval as authority", () => {
  const { packet: forged, trustedContext } = materializeFixtureCase(
    suite.base_packet,
    { packet_patch: {} },
    suite.base_trusted_context,
  );
  forged.high_risk = true;
  forged.human_confirmation = {
    required: true,
    status: "approved",
    approval_ref: "model://invented-approval",
  };
  forged.evidence[0].verified = true;
  assert.deepEqual(evaluateDecisionPacket(forged, trustedContext), {
    pass: false,
    errors: ["packet_shape_invalid"],
  });
});

test("binds trusted context to the same decision and action", () => {
  const { packet, trustedContext } = materializeFixtureCase(
    suite.base_packet,
    { packet_patch: {} },
    suite.base_trusted_context,
  );
  trustedContext.action_digest = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  assert.deepEqual(evaluateDecisionPacket(packet, trustedContext), {
    pass: false,
    errors: ["trusted_context_binding_mismatch"],
  });
});

test("completed factual claims cannot self-declassify to bypass evidence", () => {
  const { packet, trustedContext } = materializeFixtureCase(
    suite.base_packet,
    {
      packet_patch: {
        claims: [{ claim_id: "claim-unverified", text: "无证据事实", critical: false, evidence_refs: [] }],
        evidence: [],
      },
      trusted_context_patch: { verified_evidence_ids: [] },
    },
    suite.base_trusted_context,
  );
  assert.deepEqual(evaluateDecisionPacket(packet, trustedContext), {
    pass: false,
    errors: ["completed_claim_evidence_required"],
  });
});

test("rejects contradictory high-risk confirmation states", () => {
  const { packet, trustedContext } = materializeFixtureCase(
    suite.base_packet,
    {
      trusted_context_patch: {
        high_risk: true,
        human_confirmation: { required: true, status: "pending", approval_ref: "model://early" },
      },
    },
    suite.base_trusted_context,
  );
  assert.deepEqual(evaluateDecisionPacket(packet, trustedContext), {
    pass: false,
    errors: ["completed_without_human_approval", "human_confirmation_state_invalid"],
  });
});

test("fails closed for an empty or malformed fixture suite", () => {
  assert.equal(evaluateFixtureSuite({ cases: [] }).pass, false);
  assert.equal(evaluateFixtureSuite({ ...suite, cases: "all-good" }).pass, false);
});

test("fixture expectations match the complete stable error set", () => {
  const tampered = structuredClone(suite);
  const rejected = tampered.cases.find((entry) => !entry.expected_pass);
  rejected.expected_errors = [];
  const result = evaluateFixtureSuite(tampered);
  assert.equal(result.pass, false);
  assert.deepEqual(result.errors, ["fixture_expected_errors_required"]);
});

test("CLI rejects inputs over one MiB before parsing", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "decision-quality-gate-"));
  try {
    const inputPath = join(temporaryRoot, "oversized.json");
    writeFileSync(inputPath, `{"padding":"${"x".repeat(1024 * 1024)}"}`);
    const result = spawnSync(process.execPath, [join(root, "decision_quality_gate.mjs"), inputPath], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    assert.equal(result.status, 2);
    assert.equal(result.stderr.trim(), "input_too_large");
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("keeps the Node status and completed-gap semantics mapped to RuntimeSkill models", () => {
  const runtimeModels = readFileSync(
    join(root, "..", "backend", "app", "agents", "runtime_skills", "models.py"),
    "utf8",
  );
  const runtimeStatuses = [...runtimeModels.matchAll(/^\s+[A-Z_]+ = "(completed|degraded|failed)"$/gm)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(runtimeStatuses, ["completed", "degraded", "failed"]);
  assert.match(
    runtimeModels,
    /status is ReportStatus\.COMPLETED and self\.data_gaps/,
  );
  assert.match(
    runtimeModels,
    /status is ReportStatus\.COMPLETED and self\.unresolved_items/,
  );
});

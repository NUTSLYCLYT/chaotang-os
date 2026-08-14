import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildCapabilityLockfile,
  canonicalDigest,
  resolveTrustedAuthority,
  transitionCapability,
  validateCapabilityCapsule,
  verifyCapabilityLockfile,
} from "./capability_capsule.mjs";

const text = {
  prompt: "Analyze evidence and produce a draft. Never grant authority.",
  contract: JSON.stringify({ input: "task", output: "draft" }),
  policy: JSON.stringify({ approved_tools: ["read_evidence"] }),
  evaluation: JSON.stringify({ cases: ["missing-evidence"] }),
  behavior: "evidence-or-gap; abstain on missing authority",
  adapter: "offline structural adapter",
  telemetry: "quality, latency, cost, abstention",
  rollback: "pin previous capsule digest",
};
const issuer = "chaotang-os-root-harness";
const trustedGrants = { approved_tools: [], approved_data_domains: [], may_write_external: false, human_confirmation_required: true };
const trustedAuthority = {
  capability_id: "rites-message-quality-gate",
  issuer,
  grants: trustedGrants,
  digest: canonicalDigest({ capability_id: "rites-message-quality-gate", issuer, grants: trustedGrants }),
};

function fixture(overrides = {}) {
  const digests = {
    prompt: canonicalDigest(text.prompt),
    contract: canonicalDigest(text.contract),
    policy: canonicalDigest(text.policy),
    evaluation: canonicalDigest(text.evaluation),
  };
  return {
    schema_version: "1.0.0",
    capability_id: "rites-message-quality-gate",
    version: "0.1.0",
    status: "candidate",
    evaluation_scope: "synthetic-offline-only",
    production_boundary: "not-registered-no-execution-authority",
    content_digests: digests,
    artifacts: {
      prompt: { path: "objects/prompt.txt", digest: digests.prompt },
      contract: { path: "objects/contract.json", digest: digests.contract },
      policy: { path: "objects/policy.json", digest: digests.policy },
      behavior: { path: "objects/behavior.txt", digest: canonicalDigest(text.behavior) },
      adapter: { path: "objects/adapter.txt", digest: canonicalDigest(text.adapter) },
      evaluations: { path: "objects/evaluations.json", digest: digests.evaluation },
      telemetry: { path: "objects/telemetry.txt", digest: canonicalDigest(text.telemetry) },
      provenance: {
        repository: "origin/feature-chaotang-ext",
        commit: "939186f0331d9784bc8c4ceee393aeb197230ed0",
        path: "frontend/config/rites_brand_comms.registry.yaml",
      },
      rollback: { path: "objects/rollback.txt", digest: canonicalDigest(text.rollback) },
    },
    authority_ref: { issuer, projection_digest: trustedAuthority.digest },
    requested_permissions: {
      tools: [],
      data_domains: [],
      may_write_external: false,
    },
    controls: {
      kill_switches: { capability_enabled: true, tenant_enabled: true, tools_enabled: true },
      taint: { external_content_taints_context: true, tainted_context_allows_tools: false },
      context_rent: { max_tokens: 1200, direct_fallback: true, minimum_expected_gain: 0.1 },
    },
    ...overrides,
  };
}

function writeFixture(root, capsule = fixture()) {
  mkdirSync(join(root, "objects"), { recursive: true });
  for (const [name, value] of Object.entries(text)) {
    const filename = name === "evaluation" ? "evaluations.json" : `${name}.${["contract", "policy"].includes(name) ? "json" : "txt"}`;
    writeFileSync(join(root, "objects", filename), value);
  }
  return capsule;
}

test("resolves authority only from a strict root manifest outside candidate directories", () => {
  const manifest = {
    schema_version: "1.0.0",
    issuer,
    projections: { [trustedAuthority.capability_id]: trustedAuthority },
  };
  assert.deepEqual(resolveTrustedAuthority(manifest, trustedAuthority.capability_id), { ok: true, authority: trustedAuthority, errors: [] });
  const selfGranted = structuredClone(manifest);
  selfGranted.projections[trustedAuthority.capability_id].grants.approved_tools.push("send_external_message");
  assert.ok(resolveTrustedAuthority(selfGranted, trustedAuthority.capability_id).errors.includes("authority_projection_digest_mismatch"));
});

test("accepts a strict candidate capsule with four independent digests", () => {
  const root = mkdtempSync(join(tmpdir(), "capsule-"));
  try {
    assert.deepEqual(validateCapabilityCapsule(writeFixture(root), { root, environment: "offline", trustedAuthority }), { ok: true, errors: [] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("enforces the lifecycle and terminal revocation", () => {
  const chain = ["quarantined", "normalized", "candidate", "shadow", "canary", "stable", "deprecated", "revoked"];
  for (let index = 0; index < chain.length - 1; index += 1) {
    assert.equal(transitionCapability(chain[index], chain[index + 1]).ok, true);
  }
  assert.equal(transitionCapability("candidate", "stable").ok, false);
  assert.equal(transitionCapability("revoked", "candidate").ok, false);
  assert.equal(transitionCapability("stable", "revoked").ok, true);
});

test("production admits at most candidate and rejects canary or stable", () => {
  assert.equal(validateCapabilityCapsule(fixture(), { environment: "production", trustedAuthority }).ok, true);
  for (const status of ["shadow", "canary", "stable", "deprecated", "revoked"]) {
    assert.ok(validateCapabilityCapsule(fixture({ status }), { environment: "production", trustedAuthority }).errors.includes("production_status_forbidden"));
  }
});

test("fails closed on unknown fields, type confusion, and unsupported schema keywords", () => {
  assert.equal(validateCapabilityCapsule({ ...fixture(), surprise: true }).ok, false);
  assert.equal(validateCapabilityCapsule(fixture({ status: 1 })).ok, false);
  assert.throws(() => validateCapabilityCapsule(fixture(), { schema: { type: "object", unevaluatedProperties: false } }), /schema_keyword_unsupported/);
});

test("rejects floating provenance, path traversal, digest mismatch, and permission self-grant", () => {
  const root = mkdtempSync(join(tmpdir(), "capsule-"));
  try {
    const base = writeFixture(root);
    const floating = structuredClone(base); floating.artifacts.provenance.commit = "main";
    assert.ok(validateCapabilityCapsule(floating, { root }).errors.includes("provenance_commit_floating"));
    const floatingPath = structuredClone(base); floatingPath.artifacts.provenance.path = "../other-repository/prompt.md";
    assert.ok(validateCapabilityCapsule(floatingPath, { root }).errors.includes("provenance_path_invalid"));
    for (const path of ["./prompt.md", "dir//prompt.md", "C:/prompt.md", "//server/share", "bad\0path"] ) {
      const invalid = structuredClone(base); invalid.artifacts.provenance.path = path;
      assert.ok(validateCapabilityCapsule(invalid, { root }).errors.includes("provenance_path_invalid"));
    }
    const escaped = structuredClone(base); escaped.artifacts.prompt.path = "../secret.txt";
    assert.ok(validateCapabilityCapsule(escaped, { root }).errors.includes("artifact_path_outside_root"));
    const mismatch = structuredClone(base); mismatch.artifacts.prompt.digest = `sha256:${"0".repeat(64)}`;
    assert.ok(validateCapabilityCapsule(mismatch, { root }).errors.includes("artifact_digest_mismatch"));
    const grant = structuredClone(base); grant.requested_permissions.tools.push("send_external_message");
    assert.ok(validateCapabilityCapsule(grant, { root, trustedAuthority }).errors.includes("candidate_permissions_forbidden"));
    const forgedAuthority = structuredClone(trustedAuthority);
    forgedAuthority.grants.approved_tools.push("send_external_message");
    forgedAuthority.digest = canonicalDigest({ capability_id: forgedAuthority.capability_id, issuer, grants: forgedAuthority.grants });
    grant.authority_ref.projection_digest = forgedAuthority.digest;
    assert.ok(validateCapabilityCapsule(grant, { root, trustedAuthority }).errors.includes("trusted_authority_digest_mismatch"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("kill switches, taint guard, context rent, and direct fallback fail closed", () => {
  for (const key of ["capability_enabled", "tenant_enabled", "tools_enabled"]) {
    const capsule = fixture(); capsule.controls.kill_switches[key] = false;
    assert.ok(validateCapabilityCapsule(capsule).errors.includes(`${key}_killed`));
  }
  const tainted = fixture(); tainted.controls.taint.tainted_context_allows_tools = true;
  assert.ok(validateCapabilityCapsule(tainted).errors.includes("tainted_context_tool_access_forbidden"));
  const rent = fixture(); rent.controls.context_rent.direct_fallback = false;
  assert.ok(validateCapabilityCapsule(rent).errors.includes("direct_fallback_required"));
});

test("content-addressed lockfile detects capsule and object drift", () => {
  const root = mkdtempSync(join(tmpdir(), "capsule-"));
  try {
    const capsule = writeFixture(root);
    const lock = buildCapabilityLockfile(capsule, { root, trustedAuthority });
    assert.equal(verifyCapabilityLockfile(capsule, lock, { root }).ok, true);
    writeFileSync(join(root, "objects", "prompt.txt"), "drifted prompt");
    assert.ok(verifyCapabilityLockfile(capsule, lock, { root }).errors.includes("lock_object_digest_mismatch"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("validates and verifies the checked-in quarantined candidate", () => {
  const candidateRoot = join(process.cwd(), "backend", "harness", "capability_candidates", "rites-message-quality-gate");
  const capsule = JSON.parse(readFileSync(join(candidateRoot, "capsule.json"), "utf8"));
  const lockfile = JSON.parse(readFileSync(join(candidateRoot, "capsule.lock.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(join(process.cwd(), "backend", "harness", "capability_candidates", "authority-manifest.json"), "utf8"));
  const { authority } = resolveTrustedAuthority(manifest, capsule.capability_id);
  assert.deepEqual(validateCapabilityCapsule(capsule, { root: candidateRoot, environment: "production", trustedAuthority: authority }), { ok: true, errors: [] });
  assert.deepEqual(verifyCapabilityLockfile(capsule, lockfile, { root: candidateRoot }), { ok: true, errors: [] });
});

test("enumerates and verifies every checked-in synthetic candidate capsule", () => {
  const candidatesRoot = join(process.cwd(), "backend", "harness", "capability_candidates", "candidates");
  const ids = readdirSync(candidatesRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual(ids, ["decision-quality-gate", "hubu-financial-grounding", "hubu-payment-three-gates", "libu-responsibility-authority-chain", "rites-war-truthfulness"]);
  for (const id of ids) {
    const candidateRoot = join(candidatesRoot, id);
    const capsule = JSON.parse(readFileSync(join(candidateRoot, "capsule.json"), "utf8"));
    const lockfile = JSON.parse(readFileSync(join(candidateRoot, "capsule.lock.json"), "utf8"));
    const manifest = JSON.parse(readFileSync(join(candidatesRoot, "..", "authority-manifest.json"), "utf8"));
    const { authority, errors } = resolveTrustedAuthority(manifest, capsule.capability_id);
    assert.deepEqual(errors, [], id);
    assert.equal(capsule.capability_id, id);
    assert.equal(capsule.evaluation_scope, "synthetic-offline-only");
    assert.equal(capsule.production_boundary, "not-registered-no-execution-authority");
    const source = spawnSync("git", ["cat-file", "-e", `${capsule.artifacts.provenance.commit}:${capsule.artifacts.provenance.path}`], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(source.status, 0, `${id}: provenance must exist at the pinned source commit`);
    assert.deepEqual(validateCapabilityCapsule(capsule, { root: candidateRoot, environment: "production", trustedAuthority: authority }), { ok: true, errors: [] }, id);
    assert.deepEqual(verifyCapabilityLockfile(capsule, lockfile, { root: candidateRoot }), { ok: true, errors: [] }, id);
  }
});

test("candidate status forbids all tool, data, and external-write permissions even if a trusted projection grants them", () => {
  const capsule = fixture();
  capsule.requested_permissions = { tools: ["read_evidence"], data_domains: ["communications.content"], may_write_external: true };
  const elevated = {
    capability_id: capsule.capability_id,
    issuer,
    grants: { approved_tools: ["read_evidence"], approved_data_domains: ["communications.content"], may_write_external: true, human_confirmation_required: true },
  };
  elevated.digest = canonicalDigest(elevated);
  capsule.authority_ref.projection_digest = elevated.digest;
  assert.ok(validateCapabilityCapsule(capsule, { trustedAuthority: elevated }).errors.includes("candidate_permissions_forbidden"));
});

test("lock verifier fails structurally for malformed capsules", () => {
  assert.deepEqual(verifyCapabilityLockfile({}, {}, { root: process.cwd() }), { ok: false, errors: ["capsule_shape_invalid"] });
  assert.deepEqual(verifyCapabilityLockfile(fixture(), null, { root: process.cwd() }), { ok: false, errors: ["lockfile_shape_invalid"] });
});

test("rejects artifact files over one MiB before hashing", () => {
  const candidateRoot = mkdtempSync(join(tmpdir(), "capsule-large-"));
  try {
    const capsule = writeFixture(candidateRoot);
    writeFileSync(join(candidateRoot, "objects", "prompt.txt"), "x".repeat(1024 * 1024 + 1));
    assert.ok(validateCapabilityCapsule(capsule, { root: candidateRoot, trustedAuthority }).errors.includes("artifact_path_outside_root"));
  } finally { rmSync(candidateRoot, { recursive: true, force: true }); }
});

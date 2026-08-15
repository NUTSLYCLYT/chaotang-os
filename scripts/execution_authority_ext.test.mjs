import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ALLOWED_PATHS,
  ATTESTATION_DOMAIN,
  AUTHORITY_ID,
  CHECKPOINT_DOMAIN,
  GRANT_DOMAIN,
  IMPLEMENTATION_BASE,
  IMPLEMENTATION_BASE_TREE,
  NON_GOALS_DIGEST,
  PLATFORM_PROOF_DOMAIN,
  TASK_ID,
  AuthorityError,
  canonicalizeRfc8785,
  digestCanonical,
  inspectGitCandidate,
  parseJsonNoDuplicateKeys,
  readTrustedJsonFile,
  validateAllowedPaths,
  validateAttestationEnvelope,
  validateCheckpointReceipt,
  validateGrantAgainstTrustRoot,
  validateGrantEnvelope,
  validatePlatformProofEnvelope,
  validateTrustRoot,
  verifySignedEnvelope,
} from "./execution_authority_ext.mjs";

const BASE = IMPLEMENTATION_BASE;
const TREE = IMPLEMENTATION_BASE_TREE;
const CANDIDATE = "2222222222222222222222222222222222222222";
const CANDIDATE_TREE = "3333333333333333333333333333333333333333";
const DIGEST = `sha256:${"a".repeat(64)}`;

function keyFixture() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  return { publicKey, privateKey, publicKeyPem };
}

function grantPayload(now = new Date("2026-08-15T00:00:00.000Z")) {
  const issuedAt = new Date(now.getTime() - 30_000).toISOString();
  const expiresAt = new Date(now.getTime() + 300_000).toISOString();
  return {
    schema_version: "execution-authority.ext.grant.v1",
    authority_id: AUTHORITY_ID,
    task_id: TASK_ID,
    repository_identity: "gitee.com/msxn/chaotang-os",
    base_commit: BASE,
    base_tree: TREE,
    allowed_paths: [...ALLOWED_PATHS],
    allowed_paths_digest: digestCanonical(ALLOWED_PATHS),
    non_goals_digest: NON_GOALS_DIGEST,
    holder_identity: "codex-governance-worker",
    lease_id: "lease-20260815-0001",
    fencing_epoch: 7,
    sequence: 19,
    issued_at: issuedAt,
    not_before: issuedAt,
    expires_at: expiresAt,
    key_id: "ext-authority-key-2026-01",
    nonce: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY",
  };
}

function signedGrant(privateKey, payload = grantPayload()) {
  const signature = sign(
    null,
    Buffer.concat([Buffer.from(GRANT_DOMAIN), Buffer.from(canonicalizeRfc8785(payload))]),
    privateKey,
  ).toString("base64url");
  return {
    schema_version: "execution-authority.ext.signed-grant.v1",
    payload,
    signature: { algorithm: "Ed25519", key_id: payload.key_id, value: signature },
  };
}

function platformProofPayload() {
  return {
    schema_version: "execution-authority.ext.platform-proof.v1",
    authority_id: AUTHORITY_ID,
    repository_identity: "gitee.com/msxn/chaotang-os",
    protected_branch: "ext-dev",
    candidate_commit: CANDIDATE,
    check_name: "ext-authority-required",
    check_result: "SUCCESS",
    protection_enforced: true,
    policy_identity: "gitee-ext-authority-required-v1",
    policy_digest: DIGEST,
    rule_revision: "gitee-rule-revision-20260815-01",
    observed_at: "2026-08-15T00:00:00.000Z",
    key_id: "ext-platform-key-2026-01",
  };
}

function signedPlatformProof(privateKey, payload = platformProofPayload()) {
  const signature = sign(
    null,
    Buffer.concat([Buffer.from(PLATFORM_PROOF_DOMAIN), Buffer.from(canonicalizeRfc8785(payload))]),
    privateKey,
  ).toString("base64url");
  return {
    schema_version: "execution-authority.ext.signed-platform-proof.v1",
    payload,
    signature: { algorithm: "Ed25519", key_id: payload.key_id, value: signature },
  };
}

function attestationPayload(requiredCheckProof) {
  return {
    schema_version: "execution-authority.ext.attestation.v1",
    authority_id: AUTHORITY_ID,
    task_id: TASK_ID,
    repository_identity: "gitee.com/msxn/chaotang-os",
    grant_digest: DIGEST,
    candidate_commit: CANDIDATE,
    candidate_tree: CANDIDATE_TREE,
    candidate_parent: BASE,
    diff_name_status_z_digest: DIGEST,
    lockfile_digest: DIGEST,
    command_matrix_digest: DIGEST,
    rounds_digest: DIGEST,
    egress_policy_identity: "ci-egress-loopback-only-v1",
    egress_policy_digest: DIGEST,
    review_verdict_digest: DIGEST,
    evidence_index_digest: DIGEST,
    required_check_proof: requiredCheckProof,
    key_id: "ext-attestation-key-2026-01",
    issued_at: "2026-08-15T00:00:00.000Z",
  };
}

function signedAttestation(privateKey, payload) {
  const signature = sign(
    null,
    Buffer.concat([Buffer.from(ATTESTATION_DOMAIN), Buffer.from(canonicalizeRfc8785(payload))]),
    privateKey,
  ).toString("base64url");
  return {
    schema_version: "execution-authority.ext.signed-attestation.v1",
    payload,
    signature: { algorithm: "Ed25519", key_id: payload.key_id, value: signature },
  };
}

function trustedKey({ keyId, purposes, publicKeyPem, status = "ACTIVE" }) {
  return {
    key_id: keyId,
    algorithm: "Ed25519",
    purposes,
    public_key_pem: publicKeyPem,
    public_key_sha256: `sha256:${createHash("sha256").update(Buffer.from(publicKeyPem, "utf8")).digest("hex")}`,
    status,
    not_before: "2026-08-14T00:00:00.000Z",
    not_after: "2027-08-15T00:00:00.000Z",
  };
}

function trustRootFixture(keys) {
  return {
    schema_version: "execution-authority.ext.trust-root.v1",
    authority_id: AUTHORITY_ID,
    repository_identity: "gitee.com/msxn/chaotang-os",
    keys,
    min_sequence: 19,
    required_check: {
      platform: "gitee",
      name: "ext-authority-required",
      policy_identity: "gitee-ext-authority-required-v1",
      policy_digest: DIGEST,
    },
    checkpoint: {
      endpoint: "/run/chaotang-os/execution-authority-ext/checkpoint.sock",
      protocol: "chaotang-ext-checkpoint-v1",
      timeout_ms: 500,
    },
  };
}

test("RFC 8785 vectors retain code points and fixed digests", async () => {
  const vectors = JSON.parse(
    await (await import("node:fs/promises")).readFile(
      new URL("./fixtures/execution-authority-ext-canonical-vectors.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(vectors.schema_version, "execution-authority.ext.canonical-vectors.v1");
  for (const vector of vectors.cases) {
    const value = JSON.parse(vector.source_json);
    assert.equal(canonicalizeRfc8785(value), vector.canonical, vector.id);
    assert.equal(digestCanonical(value), vector.sha256, vector.id);
  }
  assert.notEqual(
    digestCanonical({ value: "é" }),
    digestCanonical({ value: "e\u0301" }),
    "the implementation must not normalize NFC/NFD",
  );
});

test("canonicalizer rejects values outside I-JSON", () => {
  const sparse = [];
  sparse.length = 1;
  for (const value of [NaN, Infinity, -Infinity, undefined, 1n, { value: "\ud800" }, sparse]) {
    assert.throws(() => canonicalizeRfc8785(value), AuthorityError);
  }
});

test("strict JSON parser rejects duplicate and confusable object names", () => {
  assert.deepEqual(parseJsonNoDuplicateKeys('{"ok":true,"nested":{"value":1}}'), {
    ok: true,
    nested: { value: 1 },
  });
  assert.throws(() => parseJsonNoDuplicateKeys('{"a":1,"a":2}'), /DUPLICATE_JSON_KEY/);
  assert.throws(() => parseJsonNoDuplicateKeys('{"a":1,"\\u0061":2}'), /DUPLICATE_JSON_KEY/);
  assert.throws(() => parseJsonNoDuplicateKeys('{"__proto__":{},"__proto__":null}'), /DUPLICATE_JSON_KEY/);
  assert.throws(() => parseJsonNoDuplicateKeys('{"trailing":true,}'), /TRUST_FILE_INVALID_JSON/);
});

test("all three contract schemas are closed at every signed boundary", async () => {
  const schemaNames = [
    "execution-authority-ext-grant.schema.json",
    "execution-authority-ext-attestation.schema.json",
    "execution-authority-ext-trust-root.schema.json",
  ];
  for (const name of schemaNames) {
    const schema = JSON.parse(await readFile(new URL(`../docs/contracts/${name}`, import.meta.url), "utf8"));
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.additionalProperties, false, name);
    assert.ok(Array.isArray(schema.required) && schema.required.length > 0, name);
    const visit = (value) => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (value && typeof value === "object") {
        if (typeof value.pattern === "string") assert.doesNotThrow(() => new RegExp(value.pattern), name);
        Object.values(value).forEach(visit);
      }
    };
    visit(schema);
  }
  for (const name of schemaNames.slice(0, 2)) {
    const schema = JSON.parse(await readFile(new URL(`../docs/contracts/${name}`, import.meta.url), "utf8"));
    assert.equal(schema.$defs.payload.additionalProperties, false, name);
    assert.equal(schema.$defs.signature.additionalProperties, false, name);
  }
  const attestationSchema = JSON.parse(
    await readFile(new URL("../docs/contracts/execution-authority-ext-attestation.schema.json", import.meta.url), "utf8"),
  );
  assert.equal(attestationSchema.$defs.platform_proof_envelope.additionalProperties, false);
  assert.equal(attestationSchema.$defs.platform_proof_payload.additionalProperties, false);
  const trustSchema = JSON.parse(
    await readFile(new URL("../docs/contracts/execution-authority-ext-trust-root.schema.json", import.meta.url), "utf8"),
  );
  for (const definition of ["key", "required_check", "checkpoint", "checkpoint_request", "checkpoint_receipt_payload"]) {
    assert.equal(trustSchema.$defs[definition].additionalProperties, false, definition);
  }
});

test("allowed paths are exact, sorted, unique repository files", () => {
  assert.deepEqual(validateAllowedPaths([...ALLOWED_PATHS]), ALLOWED_PATHS);
  for (const paths of [
    [...ALLOWED_PATHS].reverse(),
    [...ALLOWED_PATHS, ALLOWED_PATHS[0]],
    ["../escape"],
    ["/absolute"],
    ["scripts/**"],
    ["scripts\\file.mjs"],
    ["scripts//file.mjs"],
    ["scripts/./file.mjs"],
    ["scripts/file.mjs\0suffix"],
  ]) {
    assert.throws(() => validateAllowedPaths(paths), AuthorityError);
  }
});

test("grant envelope is closed, time-bounded and domain-separated", () => {
  const { publicKey, privateKey } = keyFixture();
  const envelope = signedGrant(privateKey);
  const verified = verifySignedEnvelope(envelope, {
    domain: GRANT_DOMAIN,
    publicKey,
    expectedKeyId: envelope.payload.key_id,
  });
  assert.equal(verified.task_id, TASK_ID);
  assert.equal(validateGrantEnvelope(envelope, new Date("2026-08-15T00:00:00.000Z")).task_id, TASK_ID);

  const forged = structuredClone(envelope);
  forged.payload.sequence += 1;
  assert.throws(
    () => verifySignedEnvelope(forged, { domain: GRANT_DOMAIN, publicKey, expectedKeyId: forged.payload.key_id }),
    /SIGNATURE_INVALID/,
  );
  assert.throws(
    () => verifySignedEnvelope(envelope, { domain: ATTESTATION_DOMAIN, publicKey, expectedKeyId: envelope.payload.key_id }),
    /SIGNATURE_INVALID/,
  );

  const unknown = structuredClone(envelope);
  unknown.payload.unapproved = true;
  assert.throws(() => validateGrantEnvelope(unknown, new Date("2026-08-15T00:00:00.000Z")), /SCHEMA_INVALID/);
  const expired = signedGrant(privateKey, {
    ...grantPayload(),
    expires_at: "2026-08-14T23:59:59.000Z",
  });
  assert.throws(() => validateGrantEnvelope(expired, new Date("2026-08-15T00:00:00.000Z")), /GRANT_EXPIRED/);

  const future = signedGrant(privateKey, {
    ...grantPayload(),
    issued_at: "2026-08-15T00:02:00.000Z",
    not_before: "2026-08-15T00:02:00.000Z",
    expires_at: "2026-08-15T00:07:00.000Z",
  });
  assert.throws(() => validateGrantEnvelope(future, new Date("2026-08-15T00:00:00.000Z")), /GRANT_NOT_YET_VALID/);
  for (const mutation of [
    { task_id: "EXT-GOV-AUTH-V1-OTHER" },
    { repository_identity: "gitee.com/attacker/repository" },
    { base_commit: "4".repeat(40) },
    { base_tree: "5".repeat(40) },
    { non_goals_digest: DIGEST },
    { holder_identity: "different-holder" },
  ]) {
    const invalid = signedGrant(privateKey, { ...grantPayload(), ...mutation });
    assert.throws(
      () => validateGrantEnvelope(invalid, new Date("2026-08-15T00:00:00.000Z")),
      /GRANT_IDENTITY_INVALID|NON_GOALS_MISMATCH|HOLDER_IDENTITY_INVALID/,
    );
  }
  assert.throws(() => validateGrantAgainstTrustRoot(grantPayload(), { min_sequence: 20 }), /SEQUENCE_ROLLBACK/);
});

test("attestation and trust root are closed, purpose-bound public-key objects", () => {
  const attestationKey = keyFixture();
  const platformKey = keyFixture();
  const platformEnvelope = signedPlatformProof(platformKey.privateKey);
  const envelope = signedAttestation(attestationKey.privateKey, attestationPayload(platformEnvelope));
  assert.equal(
    validateAttestationEnvelope(envelope, new Date("2026-08-15T00:00:01.000Z")).candidate_commit,
    CANDIDATE,
  );
  assert.equal(
    verifySignedEnvelope(envelope, {
      domain: ATTESTATION_DOMAIN,
      publicKey: attestationKey.publicKey,
      expectedKeyId: envelope.payload.key_id,
    }).candidate_tree,
    CANDIDATE_TREE,
  );
  assert.equal(
    validatePlatformProofEnvelope(platformEnvelope, new Date("2026-08-15T00:00:01.000Z")).protected_branch,
    "ext-dev",
  );
  assert.equal(
    verifySignedEnvelope(platformEnvelope, {
      domain: PLATFORM_PROOF_DOMAIN,
      publicKey: platformKey.publicKey,
      expectedKeyId: platformEnvelope.payload.key_id,
    }).check_result,
    "SUCCESS",
  );
  assert.throws(
    () => verifySignedEnvelope(platformEnvelope, {
      domain: ATTESTATION_DOMAIN,
      publicKey: platformKey.publicKey,
      expectedKeyId: platformEnvelope.payload.key_id,
    }),
    /SIGNATURE_INVALID/,
  );
  const trustRoot = trustRootFixture([
    trustedKey({
      keyId: envelope.payload.key_id,
      purposes: ["ATTESTATION"],
      publicKeyPem: attestationKey.publicKeyPem,
    }),
    trustedKey({
      keyId: platformEnvelope.payload.key_id,
      purposes: ["PLATFORM"],
      publicKeyPem: platformKey.publicKeyPem,
    }),
  ]);
  assert.equal(validateTrustRoot(trustRoot, new Date("2026-08-15T00:00:00.000Z")).min_sequence, 19);
  const privateMaterial = structuredClone(trustRoot);
  privateMaterial.keys[0].public_key_pem = ["-----BEGIN", "PRIVATE KEY-----", "forbidden", "-----END", "PRIVATE KEY-----", ""].join("\n");
  assert.throws(() => validateTrustRoot(privateMaterial, new Date("2026-08-15T00:00:00.000Z")), /TRUST_ROOT_INVALID/);
});

test("trusted JSON reader rejects symlinks and unsafe permissions", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ext-authority-"));
  const safeDir = path.join(root, "safe");
  await mkdir(safeDir, { mode: 0o700 });
  const safeFile = path.join(safeDir, "trust.json");
  await writeFile(safeFile, '{"ok":true}', { mode: 0o600 });
  const readerOptions = { trustedPrefix: root, chainRoot: root, expectedUid: process.getuid() };
  assert.deepEqual(await readTrustedJsonFile(safeFile, readerOptions), { ok: true });

  const linked = path.join(root, "linked.json");
  await symlink(safeFile, linked);
  await assert.rejects(
    readTrustedJsonFile(linked, readerOptions),
    /TRUST_FILE_UNSAFE/,
  );
  await chmod(safeFile, 0o666);
  await assert.rejects(
    readTrustedJsonFile(safeFile, readerOptions),
    /TRUST_FILE_UNSAFE/,
  );
  const realParent = path.join(root, "real-parent");
  await mkdir(realParent, { mode: 0o700 });
  await writeFile(path.join(realParent, "value.json"), '{"ok":true}', { mode: 0o600 });
  const linkedParent = path.join(root, "linked-parent");
  await symlink(realParent, linkedParent);
  await assert.rejects(
    readTrustedJsonFile(path.join(linkedParent, "value.json"), {
      trustedPrefix: linkedParent,
      chainRoot: root,
      expectedUid: process.getuid(),
    }),
    /TRUST_FILE_UNSAFE/,
  );
});

test("Git candidate evidence rejects dirty state, moving scope and non-Gitee identity", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ext-authority-git-"));
  const git = (args, encoding = "utf8") => execFileSync("git", args, {
    cwd: root,
    encoding,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" },
  }).trim();
  git(["init", "-b", "main"]);
  git(["config", "user.name", "Authority Test"]);
  git(["config", "user.email", "authority-test@example.invalid"]);
  git(["config", "commit.gpgsign", "false"]);
  git(["config", "core.hooksPath", ".git/no-hooks"]);
  git(["remote", "add", "origin", "git@gitee.com:msxn/chaotang-os.git"]);
  await writeFile(path.join(root, "a.txt"), "base\n", { mode: 0o600 });
  git(["add", "a.txt"]);
  git(["commit", "-m", "base"]);
  const base = git(["rev-parse", "HEAD"]);
  const baseTree = git(["rev-parse", "HEAD^{tree}"]);
  await writeFile(path.join(root, "a.txt"), "candidate\n", { mode: 0o600 });
  git(["add", "a.txt"]);
  git(["commit", "-m", "candidate"]);
  const evidence = inspectGitCandidate({ cwd: root, baseCommit: base, allowedPaths: ["a.txt"] });
  assert.equal(evidence.parent, base);
  assert.equal(evidence.base_tree, baseTree);
  assert.deepEqual(evidence.paths, ["a.txt"]);
  assert.match(evidence.diff_name_status_z_digest, /^sha256:[0-9a-f]{64}$/);
  const fakeBin = await mkdtemp(path.join(tmpdir(), "fake-git-"));
  await writeFile(path.join(fakeBin, "git"), "#!/bin/sh\nexit 99\n", { mode: 0o700 });
  const originalPath = process.env.PATH;
  process.env.PATH = `${fakeBin}:${originalPath}`;
  assert.equal(inspectGitCandidate({ cwd: root, baseCommit: base, allowedPaths: ["a.txt"] }).commit, evidence.commit);
  process.env.PATH = originalPath;
  for (const variable of ["GIT_DIR", "GIT_WORK_TREE", "GIT_OBJECT_DIRECTORY", "GIT_CONFIG_COUNT"]) {
    const prior = process.env[variable];
    process.env[variable] = path.join(root, "attacker-controlled");
    assert.throws(
      () => inspectGitCandidate({ cwd: root, baseCommit: base, allowedPaths: ["a.txt"] }),
      /CANDIDATE_ENV_UNSAFE/,
      variable,
    );
    if (prior === undefined) delete process.env[variable];
    else process.env[variable] = prior;
  }

  await writeFile(path.join(root, "untracked.txt"), "dirty\n", { mode: 0o600 });
  assert.throws(
    () => inspectGitCandidate({ cwd: root, baseCommit: base, allowedPaths: ["a.txt"] }),
    /WORKTREE_DIRTY/,
  );
  await unlink(path.join(root, "untracked.txt"));
  git(["remote", "set-url", "origin", "https://example.invalid/not-the-repository.git"]);
  assert.throws(
    () => inspectGitCandidate({ cwd: root, baseCommit: base, allowedPaths: ["a.txt"] }),
    /REPOSITORY_IDENTITY_INVALID/,
  );
  git(["remote", "set-url", "origin", "git@gitee.com:msxn/chaotang-os.git"]);
  const symlinkBase = git(["rev-parse", "HEAD"]);
  await unlink(path.join(root, "a.txt"));
  await symlink("target-outside-tree", path.join(root, "a.txt"));
  git(["add", "a.txt"]);
  git(["commit", "-m", "replace regular file with symlink"]);
  assert.throws(
    () => inspectGitCandidate({ cwd: root, baseCommit: symlinkBase, allowedPaths: ["a.txt"] }),
    /PATH_SCOPE_INVALID/,
  );
  assert.throws(
    () => inspectGitCandidate({ cwd: root, baseCommit: base, allowedPaths: ["a.txt"] }),
    /CANDIDATE_IDENTITY_INVALID/,
  );

  const workflowBase = git(["rev-parse", "HEAD"]);
  await mkdir(path.join(root, ".github", "workflows"), { recursive: true, mode: 0o700 });
  await writeFile(path.join(root, ".github", "workflows", "harness.yml"), "name: self-authorizing-change\n", { mode: 0o600 });
  git(["add", ".github/workflows/harness.yml"]);
  git(["commit", "-m", "attempt to mutate frozen workflow"]);
  assert.throws(
    () => inspectGitCandidate({ cwd: root, baseCommit: workflowBase, allowedPaths: [...ALLOWED_PATHS] }),
    /PATH_SCOPE_INVALID/,
  );

  const selfApprovalBase = git(["rev-parse", "HEAD"]);
  await writeFile(path.join(root, "signed-grant.json"), '{"decision":"GO"}\n', { mode: 0o600 });
  git(["add", "signed-grant.json"]);
  git(["commit", "-m", "attempt repository self approval"]);
  assert.throws(
    () => inspectGitCandidate({ cwd: root, baseCommit: selfApprovalBase, allowedPaths: [...ALLOWED_PATHS] }),
    /PATH_SCOPE_INVALID/,
  );
});

test("checkpoint receipts bind a fresh challenge and cannot be replayed into another request", () => {
  const checkpointKey = keyFixture();
  const grant = grantPayload();
  const grantDigest = digestCanonical(grant);
  const requestChallenge = "Q2hhbGxlbmdlLTIwMjYwODE1LTAwMDAwMDAwMDAwMDA";
  const candidate = { commit: CANDIDATE, tree: CANDIDATE_TREE };
  const payload = {
    schema_version: "execution-authority.ext.checkpoint-receipt.v1",
    authority_id: AUTHORITY_ID,
    task_id: TASK_ID,
    grant_digest: grantDigest,
    nonce: grant.nonce,
    sequence: grant.sequence,
    fencing_epoch: grant.fencing_epoch,
    lease_id: grant.lease_id,
    holder_identity: grant.holder_identity,
    request_challenge: requestChallenge,
    candidate_commit: candidate.commit,
    candidate_tree: candidate.tree,
    consumed: true,
    checkpoint_time: "2026-08-15T00:00:00.000Z",
    key_id: "ext-checkpoint-key-2026-01",
  };
  const signature = sign(
    null,
    Buffer.concat([Buffer.from(CHECKPOINT_DOMAIN), Buffer.from(canonicalizeRfc8785(payload))]),
    checkpointKey.privateKey,
  ).toString("base64url");
  const envelope = {
    schema_version: "execution-authority.ext.signed-checkpoint-receipt.v1",
    payload,
    signature: { algorithm: "Ed25519", key_id: payload.key_id, value: signature },
  };
  const trustRoot = trustRootFixture([trustedKey({
    keyId: payload.key_id,
    purposes: ["CHECKPOINT"],
    publicKeyPem: checkpointKey.publicKeyPem,
  })]);
  assert.deepEqual(validateCheckpointReceipt(envelope, {
    grant,
    grantDigest,
    trustRoot,
    requestChallenge,
    candidate,
    now: new Date("2026-08-15T00:00:01.000Z"),
  }), { verified: true, consumed: true, nonce: grant.nonce, sequence: grant.sequence });
  assert.throws(
    () => validateCheckpointReceipt(envelope, {
      grant,
      grantDigest,
      trustRoot,
      requestChallenge: "A".repeat(43),
      candidate,
      now: new Date("2026-08-15T00:00:01.000Z"),
    }),
    /CHECKPOINT_INVALID/,
  );
  const revokedRoot = structuredClone(trustRoot);
  revokedRoot.keys[0].status = "REVOKED";
  assert.throws(
    () => validateCheckpointReceipt(envelope, {
      grant,
      grantDigest,
      trustRoot: revokedRoot,
      requestChallenge,
      candidate,
      now: new Date("2026-08-15T00:00:01.000Z"),
    }),
    /KEY_REVOKED/,
  );
});

test("CLI exposes only the closed command surface and redacted STOP results", () => {
  const invoke = (args) => spawnSync(process.execPath, ["scripts/execution_authority_ext.mjs", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const status = invoke(["--status"]);
  assert.equal(status.status, 0);
  assert.deepEqual(JSON.parse(status.stdout), {
    schemaVersion: "execution-authority.ext.result.v1",
    authorityId: AUTHORITY_ID,
    taskId: TASK_ID,
    decision: "STOP",
    canAcceptGovernanceCandidate: false,
    canExecuteProductWork: false,
    reason: "EXTERNAL_AUTHORITY_NOT_EVALUATED",
  });
  const unknown = invoke(["--force"]);
  assert.equal(unknown.status, 64);
  assert.equal(JSON.parse(unknown.stdout).reason, "USAGE_INVALID");
  const wrongTask = invoke(["--authorize", "--task", "WRONG"]);
  assert.equal(wrongTask.status, 2);
  assert.equal(JSON.parse(wrongTask.stdout).reason, "TASK_MISMATCH");
  const absentHostTrust = invoke(["--authorize", "--task", TASK_ID]);
  assert.equal(absentHostTrust.status, 2);
  assert.equal(JSON.parse(absentHostTrust.stdout).reason, "TRUST_ROOT_UNAVAILABLE");
  assert.doesNotMatch(
    `${status.stdout}${unknown.stdout}${wrongTask.stdout}${absentHostTrust.stdout}`,
    /\/etc\/|\/run\/|PRIVATE KEY|signature/i,
  );
});

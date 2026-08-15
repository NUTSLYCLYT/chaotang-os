#!/usr/bin/env node

import { createHash, createPublicKey, randomBytes, verify as verifySignature } from "node:crypto";
import { execFileSync } from "node:child_process";
import { constants as fsConstants, lstatSync } from "node:fs";
import { lstat, open } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const AUTHORITY_ID = "execution-authority.ext.v1";
export const TASK_ID = "EXT-GOV-AUTH-V1-20260815";
export const REPOSITORY_IDENTITY = "gitee.com/msxn/chaotang-os";
export const HOLDER_IDENTITY = "codex-governance-worker";
export const IMPLEMENTATION_BASE = "017d3d34d0a56257fbbcdbd86cd6f1f6d9d0bcdd";
export const IMPLEMENTATION_BASE_TREE = "a05b69964fde283e243c11a312059706b6d3b2f3";
export const GRANT_DOMAIN = "chaotang-ext-authority-grant-v1\0";
export const ATTESTATION_DOMAIN = "chaotang-ext-authority-attestation-v1\0";
export const CHECKPOINT_DOMAIN = "chaotang-ext-authority-checkpoint-v1\0";
export const PLATFORM_PROOF_DOMAIN = "chaotang-ext-authority-platform-proof-v1\0";

export const HOST_PATHS = Object.freeze({
  trustRoot: "/etc/chaotang-os/execution-authority-ext/trust-root.json",
  grant: "/run/chaotang-os/execution-authority-ext/grant.json",
  attestation: "/run/chaotang-os/execution-authority-ext/attestation.json",
  checkpoint: "/run/chaotang-os/execution-authority-ext/checkpoint.sock",
});
export const GIT_EXECUTABLE = "/usr/bin/git";
export const IMMUTABLE_CANDIDATE_PATHS = Object.freeze([".github/workflows/harness.yml"]);

export const ALLOWED_PATHS = Object.freeze([
  ".github/workflows/harness.yml",
  "docs/contracts/execution-authority-ext-attestation.schema.json",
  "docs/contracts/execution-authority-ext-grant.schema.json",
  "docs/contracts/execution-authority-ext-trust-root.schema.json",
  "docs/product/tasks/2026-08-15-ext-successor-execution-authority.md",
  "docs/superpowers/plans/2026-08-15-ext-successor-execution-authority.md",
  "scripts/execution_authority_ext.mjs",
  "scripts/execution_authority_ext.test.mjs",
  "scripts/fixtures/execution-authority-ext-canonical-vectors.json",
]);
export const NON_GOALS = Object.freeze([
  "NO_EXTERNAL_PLATFORM_MUTATION",
  "NO_NETWORK_PROVIDER_PRODUCTION_DATA_OR_EXTERNAL_SIDE_EFFECTS",
  "NO_PRIVATE_KEY_GRANT_ATTESTATION_OR_GO_CREATION",
  "NO_PRODUCT_RUNTIME_UI_API_AGENT_OR_ARCHIVE_BEHAVIOR_CHANGES",
  "NO_ROOT_EXECUTION_AUTHORITY_V1_V2_CHANGE_OR_REMAP",
]);
export const NON_GOALS_DIGEST = "sha256:4e0f74b806f32aef89def53653bdab0988ae1a450136f507753cd10204a6d548";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const RFC3339_MILLIS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_GRANT_TTL_MS = 15 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;
const MAX_TRUST_FILE_BYTES = 1024 * 1024;
const VERIFIED_AUTHORIZATION_INPUT = Symbol("verified-authorization-input");

export class AuthorityError extends Error {
  constructor(code) {
    super(code);
    this.name = "AuthorityError";
    this.code = code;
  }
}

function fail(code) {
  throw new AuthorityError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertNoLoneSurrogates(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail("CANONICAL_JSON_INVALID");
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      fail("CANONICAL_JSON_INVALID");
    }
  }
}

export function canonicalizeRfc8785(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    assertNoLoneSurrogates(value);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("CANONICAL_JSON_INVALID");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const entries = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) fail("CANONICAL_JSON_INVALID");
      entries.push(canonicalizeRfc8785(value[index]));
    }
    return `[${entries.join(",")}]`;
  }
  if (!isPlainObject(value)) fail("CANONICAL_JSON_INVALID");
  if (Object.getOwnPropertySymbols(value).length !== 0) fail("CANONICAL_JSON_INVALID");
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => {
    assertNoLoneSurrogates(key);
    if (value[key] === undefined) fail("CANONICAL_JSON_INVALID");
    return `${JSON.stringify(key)}:${canonicalizeRfc8785(value[key])}`;
  }).join(",")}}`;
}

export function digestBytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function digestCanonical(value) {
  return digestBytes(Buffer.from(canonicalizeRfc8785(value), "utf8"));
}

export function parseJsonNoDuplicateKeys(text) {
  if (typeof text !== "string") fail("TRUST_FILE_INVALID_JSON");
  let index = 0;
  let depth = 0;
  const whitespace = /[\u0009\u000a\u000d\u0020]/;
  const skipWhitespace = () => {
    while (index < text.length && whitespace.test(text[index])) index += 1;
  };
  const parseString = () => {
    if (text[index] !== '"') fail("TRUST_FILE_INVALID_JSON");
    const start = index++;
    while (index < text.length) {
      const code = text.charCodeAt(index);
      if (code === 0x22) {
        index += 1;
        try {
          const value = JSON.parse(text.slice(start, index));
          assertNoLoneSurrogates(value);
          return value;
        } catch (error) {
          if (error instanceof AuthorityError) throw error;
          fail("TRUST_FILE_INVALID_JSON");
        }
      }
      if (code < 0x20) fail("TRUST_FILE_INVALID_JSON");
      if (code === 0x5c) {
        index += 1;
        if (index >= text.length || !'"\\/bfnrtu'.includes(text[index])) fail("TRUST_FILE_INVALID_JSON");
        if (text[index] === "u") {
          const hex = text.slice(index + 1, index + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("TRUST_FILE_INVALID_JSON");
          index += 4;
        }
      }
      index += 1;
    }
    fail("TRUST_FILE_INVALID_JSON");
  };
  const parseValue = () => {
    skipWhitespace();
    if (depth > 128 || index >= text.length) fail("TRUST_FILE_INVALID_JSON");
    if (text[index] === '"') return parseString();
    if (text.startsWith("true", index)) { index += 4; return true; }
    if (text.startsWith("false", index)) { index += 5; return false; }
    if (text.startsWith("null", index)) { index += 4; return null; }
    if (text[index] === "[") {
      depth += 1;
      index += 1;
      skipWhitespace();
      const result = [];
      if (text[index] === "]") { index += 1; depth -= 1; return result; }
      while (true) {
        result.push(parseValue());
        skipWhitespace();
        if (text[index] === "]") { index += 1; depth -= 1; return result; }
        if (text[index] !== ",") fail("TRUST_FILE_INVALID_JSON");
        index += 1;
      }
    }
    if (text[index] === "{") {
      depth += 1;
      index += 1;
      skipWhitespace();
      const result = {};
      const keys = new Set();
      if (text[index] === "}") { index += 1; depth -= 1; return result; }
      while (true) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) fail("DUPLICATE_JSON_KEY");
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") fail("TRUST_FILE_INVALID_JSON");
        index += 1;
        Object.defineProperty(result, key, {
          value: parseValue(),
          enumerable: true,
          configurable: true,
          writable: true,
        });
        skipWhitespace();
        if (text[index] === "}") { index += 1; depth -= 1; return result; }
        if (text[index] !== ",") fail("TRUST_FILE_INVALID_JSON");
        index += 1;
      }
    }
    const match = text.slice(index).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if (!match) fail("TRUST_FILE_INVALID_JSON");
    index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) fail("TRUST_FILE_INVALID_JSON");
    return value;
  };
  const parsed = parseValue();
  skipWhitespace();
  if (index !== text.length || depth !== 0) fail("TRUST_FILE_INVALID_JSON");
  return parsed;
}

function assertClosedObject(value, fields, code = "SCHEMA_INVALID") {
  if (!isPlainObject(value)) fail(code);
  const expected = new Set(fields);
  if (Object.keys(value).length !== fields.length) fail(code);
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) fail(code);
  }
  for (const field of Object.keys(value)) {
    if (!expected.has(field)) fail(code);
  }
}

function assertString(value, pattern = null, code = "SCHEMA_INVALID") {
  if (typeof value !== "string" || value.length === 0 || value.length > 16_384) fail(code);
  if (pattern && !pattern.test(value)) fail(code);
  assertNoLoneSurrogates(value);
}

function assertInteger(value, minimum = 0, code = "SCHEMA_INVALID") {
  if (!Number.isSafeInteger(value) || value < minimum) fail(code);
}

function parseTimestamp(value, code = "SCHEMA_INVALID") {
  assertString(value, RFC3339_MILLIS_PATTERN, code);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) fail(code);
  return milliseconds;
}

function assertDigest(value, code = "SCHEMA_INVALID") {
  assertString(value, DIGEST_PATTERN, code);
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

export function validateAllowedPaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 64) fail("PATH_SCOPE_INVALID");
  const normalized = [];
  for (const candidate of paths) {
    assertString(candidate, null, "PATH_SCOPE_INVALID");
    if (
      candidate.startsWith("/")
      || candidate.includes("\\")
      || candidate.includes("\0")
      || candidate.includes("*")
      || candidate.includes("?")
      || candidate.includes("//")
      || candidate.endsWith("/")
    ) fail("PATH_SCOPE_INVALID");
    const segments = candidate.split("/");
    if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
      fail("PATH_SCOPE_INVALID");
    }
    if (path.posix.normalize(candidate) !== candidate) fail("PATH_SCOPE_INVALID");
    normalized.push(candidate);
  }
  const sorted = [...normalized].sort();
  if (!arraysEqual(sorted, normalized) || new Set(normalized).size !== normalized.length) {
    fail("PATH_SCOPE_INVALID");
  }
  return normalized;
}

function validateSignatureObject(signature) {
  assertClosedObject(signature, ["algorithm", "key_id", "value"]);
  if (signature.algorithm !== "Ed25519") fail("SCHEMA_INVALID");
  assertString(signature.key_id, SAFE_ID_PATTERN);
  assertString(signature.value, BASE64URL_PATTERN);
  let bytes;
  try {
    bytes = Buffer.from(signature.value, "base64url");
  } catch {
    fail("SCHEMA_INVALID");
  }
  if (bytes.length !== 64 || bytes.toString("base64url") !== signature.value) fail("SCHEMA_INVALID");
}

export function validateGrantEnvelope(envelope, now = new Date()) {
  assertClosedObject(envelope, ["schema_version", "payload", "signature"]);
  if (envelope.schema_version !== "execution-authority.ext.signed-grant.v1") fail("SCHEMA_INVALID");
  validateSignatureObject(envelope.signature);
  const payload = envelope.payload;
  assertClosedObject(payload, [
    "schema_version", "authority_id", "task_id", "repository_identity", "base_commit", "base_tree",
    "allowed_paths", "allowed_paths_digest", "non_goals_digest", "holder_identity", "lease_id",
    "fencing_epoch", "sequence", "issued_at", "not_before", "expires_at", "key_id", "nonce",
  ]);
  if (
    payload.schema_version !== "execution-authority.ext.grant.v1"
    || payload.authority_id !== AUTHORITY_ID
    || payload.task_id !== TASK_ID
    || payload.repository_identity !== REPOSITORY_IDENTITY
  ) fail("GRANT_IDENTITY_INVALID");
  assertString(payload.base_commit, SHA_PATTERN);
  assertString(payload.base_tree, SHA_PATTERN);
  if (payload.base_commit !== IMPLEMENTATION_BASE || payload.base_tree !== IMPLEMENTATION_BASE_TREE) {
    fail("GRANT_IDENTITY_INVALID");
  }
  const paths = validateAllowedPaths(payload.allowed_paths);
  if (!arraysEqual(paths, ALLOWED_PATHS)) fail("PATH_SCOPE_INVALID");
  assertDigest(payload.allowed_paths_digest);
  if (payload.allowed_paths_digest !== digestCanonical(paths)) fail("PATH_SCOPE_INVALID");
  assertDigest(payload.non_goals_digest);
  if (payload.non_goals_digest !== NON_GOALS_DIGEST || NON_GOALS_DIGEST !== digestCanonical(NON_GOALS)) {
    fail("NON_GOALS_MISMATCH");
  }
  assertString(payload.holder_identity, SAFE_ID_PATTERN);
  if (payload.holder_identity !== HOLDER_IDENTITY) fail("HOLDER_IDENTITY_INVALID");
  assertString(payload.lease_id, SAFE_ID_PATTERN);
  assertInteger(payload.fencing_epoch, 1);
  assertInteger(payload.sequence, 1);
  assertString(payload.key_id, SAFE_ID_PATTERN);
  assertString(payload.nonce, BASE64URL_PATTERN);
  if (payload.nonce.length < 32 || payload.nonce.length > 128) fail("SCHEMA_INVALID");
  if (envelope.signature.key_id !== payload.key_id) fail("KEY_ID_MISMATCH");

  const issuedAt = parseTimestamp(payload.issued_at);
  const notBefore = parseTimestamp(payload.not_before);
  const expiresAt = parseTimestamp(payload.expires_at);
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) fail("TIME_INVALID");
  if (issuedAt > notBefore || expiresAt <= notBefore || expiresAt - issuedAt > MAX_GRANT_TTL_MS) {
    fail("GRANT_TIME_INVALID");
  }
  if (issuedAt > nowMs + CLOCK_SKEW_MS || notBefore > nowMs) fail("GRANT_NOT_YET_VALID");
  if (expiresAt <= nowMs) fail("GRANT_EXPIRED");
  return payload;
}

export function validateGrantAgainstTrustRoot(grant, trustRoot) {
  if (!isPlainObject(grant) || !isPlainObject(trustRoot)) fail("TRUST_ROOT_INVALID");
  if (grant.sequence < trustRoot.min_sequence) fail("SEQUENCE_ROLLBACK");
  return grant;
}

export function validateAttestationEnvelope(envelope, now = new Date()) {
  assertClosedObject(envelope, ["schema_version", "payload", "signature"]);
  if (envelope.schema_version !== "execution-authority.ext.signed-attestation.v1") fail("SCHEMA_INVALID");
  validateSignatureObject(envelope.signature);
  const payload = envelope.payload;
  assertClosedObject(payload, [
    "schema_version", "authority_id", "task_id", "repository_identity", "grant_digest",
    "candidate_commit", "candidate_tree", "candidate_parent", "diff_name_status_z_digest",
    "lockfile_digest", "command_matrix_digest", "rounds_digest", "egress_policy_identity",
    "egress_policy_digest", "review_verdict_digest", "evidence_index_digest",
    "required_check_proof", "key_id", "issued_at",
  ]);
  if (
    payload.schema_version !== "execution-authority.ext.attestation.v1"
    || payload.authority_id !== AUTHORITY_ID
    || payload.task_id !== TASK_ID
    || payload.repository_identity !== REPOSITORY_IDENTITY
  ) fail("ATTESTATION_IDENTITY_INVALID");
  for (const field of ["candidate_commit", "candidate_tree", "candidate_parent"]) {
    assertString(payload[field], SHA_PATTERN);
  }
  if (payload.candidate_parent !== IMPLEMENTATION_BASE) fail("ATTESTATION_IDENTITY_INVALID");
  for (const field of [
    "grant_digest", "diff_name_status_z_digest", "lockfile_digest", "command_matrix_digest",
    "rounds_digest", "egress_policy_digest", "review_verdict_digest", "evidence_index_digest",
  ]) assertDigest(payload[field]);
  assertString(payload.egress_policy_identity, SAFE_ID_PATTERN);
  validatePlatformProofEnvelope(payload.required_check_proof, now);
  assertString(payload.key_id, SAFE_ID_PATTERN);
  if (envelope.signature.key_id !== payload.key_id) fail("KEY_ID_MISMATCH");
  const issuedAt = parseTimestamp(payload.issued_at);
  if (issuedAt > now.getTime() + CLOCK_SKEW_MS) fail("ATTESTATION_TIME_INVALID");
  return payload;
}

export function validatePlatformProofEnvelope(envelope, now = new Date()) {
  assertClosedObject(envelope, ["schema_version", "payload", "signature"]);
  if (envelope.schema_version !== "execution-authority.ext.signed-platform-proof.v1") fail("REQUIRED_CHECK_UNVERIFIED");
  validateSignatureObject(envelope.signature);
  const payload = envelope.payload;
  assertClosedObject(payload, [
    "schema_version", "authority_id", "repository_identity", "protected_branch", "candidate_commit",
    "check_name", "check_result", "protection_enforced", "policy_identity", "policy_digest",
    "rule_revision", "observed_at", "key_id",
  ], "REQUIRED_CHECK_UNVERIFIED");
  if (
    payload.schema_version !== "execution-authority.ext.platform-proof.v1"
    || payload.authority_id !== AUTHORITY_ID
    || payload.repository_identity !== REPOSITORY_IDENTITY
    || payload.protected_branch !== "ext-dev"
    || payload.check_result !== "SUCCESS"
    || payload.protection_enforced !== true
    || envelope.signature.key_id !== payload.key_id
  ) fail("REQUIRED_CHECK_UNVERIFIED");
  assertString(payload.candidate_commit, SHA_PATTERN, "REQUIRED_CHECK_UNVERIFIED");
  assertString(payload.check_name, SAFE_ID_PATTERN, "REQUIRED_CHECK_UNVERIFIED");
  assertString(payload.policy_identity, SAFE_ID_PATTERN, "REQUIRED_CHECK_UNVERIFIED");
  assertDigest(payload.policy_digest, "REQUIRED_CHECK_UNVERIFIED");
  assertString(payload.rule_revision, SAFE_ID_PATTERN, "REQUIRED_CHECK_UNVERIFIED");
  assertString(payload.key_id, SAFE_ID_PATTERN, "REQUIRED_CHECK_UNVERIFIED");
  const observedAt = parseTimestamp(payload.observed_at, "REQUIRED_CHECK_UNVERIFIED");
  if (observedAt > now.getTime() + CLOCK_SKEW_MS) fail("REQUIRED_CHECK_UNVERIFIED");
  return payload;
}

export function validateTrustRoot(trustRoot, now = new Date()) {
  assertClosedObject(trustRoot, [
    "schema_version", "authority_id", "repository_identity", "keys", "min_sequence",
    "required_check", "checkpoint",
  ], "TRUST_ROOT_INVALID");
  if (
    trustRoot.schema_version !== "execution-authority.ext.trust-root.v1"
    || trustRoot.authority_id !== AUTHORITY_ID
    || trustRoot.repository_identity !== REPOSITORY_IDENTITY
  ) fail("TRUST_ROOT_INVALID");
  if (!Array.isArray(trustRoot.keys) || trustRoot.keys.length === 0 || trustRoot.keys.length > 32) {
    fail("TRUST_ROOT_INVALID");
  }
  const keyIds = new Set();
  for (const key of trustRoot.keys) {
    assertClosedObject(key, [
      "key_id", "algorithm", "purposes", "public_key_pem", "public_key_sha256", "status",
      "not_before", "not_after",
    ], "TRUST_ROOT_INVALID");
    assertString(key.key_id, SAFE_ID_PATTERN, "TRUST_ROOT_INVALID");
    if (keyIds.has(key.key_id) || key.key_id.startsWith("test")) fail("TRUST_ROOT_INVALID");
    keyIds.add(key.key_id);
    if (key.algorithm !== "Ed25519") fail("TRUST_ROOT_INVALID");
    if (!Array.isArray(key.purposes) || key.purposes.length !== 1) fail("TRUST_ROOT_INVALID");
    const purposes = [...new Set(key.purposes)];
    if (!arraysEqual(purposes, key.purposes) || purposes.some((purpose) => !["GRANT", "ATTESTATION", "CHECKPOINT", "PLATFORM"].includes(purpose))) {
      fail("TRUST_ROOT_INVALID");
    }
    assertString(key.public_key_pem, null, "TRUST_ROOT_INVALID");
    if (key.public_key_pem.includes("PRIVATE KEY")) fail("TRUST_ROOT_INVALID");
    assertDigest(key.public_key_sha256, "TRUST_ROOT_INVALID");
    if (digestBytes(Buffer.from(key.public_key_pem, "utf8")) !== key.public_key_sha256) fail("TRUST_ROOT_INVALID");
    if (!["ACTIVE", "REVOKED"].includes(key.status)) fail("TRUST_ROOT_INVALID");
    const notBefore = parseTimestamp(key.not_before, "TRUST_ROOT_INVALID");
    const notAfter = parseTimestamp(key.not_after, "TRUST_ROOT_INVALID");
    if (notAfter <= notBefore || now.getTime() > notAfter + CLOCK_SKEW_MS) fail("TRUST_ROOT_INVALID");
    try {
      const parsed = createPublicKey(key.public_key_pem);
      if (parsed.asymmetricKeyType !== "ed25519") fail("TRUST_ROOT_INVALID");
    } catch {
      fail("TRUST_ROOT_INVALID");
    }
  }
  assertInteger(trustRoot.min_sequence, 1, "TRUST_ROOT_INVALID");
  assertClosedObject(trustRoot.required_check, ["platform", "name", "policy_identity", "policy_digest"], "TRUST_ROOT_INVALID");
  if (trustRoot.required_check.platform !== "gitee") fail("TRUST_ROOT_INVALID");
  assertString(trustRoot.required_check.name, SAFE_ID_PATTERN, "TRUST_ROOT_INVALID");
  assertString(trustRoot.required_check.policy_identity, SAFE_ID_PATTERN, "TRUST_ROOT_INVALID");
  assertDigest(trustRoot.required_check.policy_digest, "TRUST_ROOT_INVALID");
  assertClosedObject(trustRoot.checkpoint, ["endpoint", "protocol", "timeout_ms"], "TRUST_ROOT_INVALID");
  if (
    trustRoot.checkpoint.endpoint !== HOST_PATHS.checkpoint
    || trustRoot.checkpoint.protocol !== "chaotang-ext-checkpoint-v1"
    || !Number.isSafeInteger(trustRoot.checkpoint.timeout_ms)
    || trustRoot.checkpoint.timeout_ms < 100
    || trustRoot.checkpoint.timeout_ms > 5_000
  ) fail("TRUST_ROOT_INVALID");
  return trustRoot;
}

export function verifySignedEnvelope(envelope, { domain, publicKey, expectedKeyId }) {
  validateSignatureObject(envelope.signature);
  if (envelope.signature.key_id !== expectedKeyId) fail("KEY_ID_MISMATCH");
  let valid = false;
  try {
    valid = verifySignature(
      null,
      Buffer.concat([Buffer.from(domain, "utf8"), Buffer.from(canonicalizeRfc8785(envelope.payload), "utf8")]),
      publicKey,
      Buffer.from(envelope.signature.value, "base64url"),
    );
  } catch {
    fail("SIGNATURE_INVALID");
  }
  if (!valid) fail("SIGNATURE_INVALID");
  return envelope.payload;
}

function resolveActiveKey(trustRoot, keyId, purpose, now = new Date()) {
  const key = trustRoot.keys.find((candidate) => candidate.key_id === keyId);
  if (!key) fail("KEY_NOT_TRUSTED");
  if (key.status !== "ACTIVE") fail("KEY_REVOKED");
  if (!key.purposes.includes(purpose)) fail("KEY_PURPOSE_INVALID");
  const nowMs = now.getTime();
  if (nowMs < parseTimestamp(key.not_before) || nowMs >= parseTimestamp(key.not_after)) fail("KEY_EXPIRED");
  return createPublicKey(key.public_key_pem);
}

function pathWithinPrefix(candidate, trustedPrefix) {
  const relative = path.relative(trustedPrefix, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function inspectSafeNode(nodePath, expectedUid, final = false) {
  let metadata;
  try {
    metadata = await lstat(nodePath);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") fail("TRUST_FILE_UNAVAILABLE");
    fail("TRUST_FILE_UNSAFE");
  }
  if (metadata.isSymbolicLink() || metadata.uid !== expectedUid || (metadata.mode & 0o022) !== 0) {
    fail("TRUST_FILE_UNSAFE");
  }
  if (final ? !metadata.isFile() : !metadata.isDirectory()) fail("TRUST_FILE_UNSAFE");
  return metadata;
}

export async function readTrustedJsonFile(filePath, {
  trustedPrefix,
  chainRoot = "/",
  expectedUid = 0,
  maxBytes = MAX_TRUST_FILE_BYTES,
} = {}) {
  if (
    !path.isAbsolute(filePath)
    || !path.isAbsolute(trustedPrefix)
    || !path.isAbsolute(chainRoot)
    || !pathWithinPrefix(filePath, trustedPrefix)
    || (trustedPrefix !== chainRoot && !pathWithinPrefix(trustedPrefix, chainRoot))
  ) {
    fail("TRUST_FILE_UNSAFE");
  }
  const relativeParts = path.relative(trustedPrefix, filePath).split(path.sep);
  const chainParts = path.relative(chainRoot, trustedPrefix).split(path.sep).filter(Boolean);
  const beforeChain = [];
  let cursor = chainRoot;
  const chainRootMetadata = await inspectSafeNode(cursor, expectedUid, false);
  beforeChain.push({ path: cursor, dev: chainRootMetadata.dev, ino: chainRootMetadata.ino });
  for (const part of chainParts) {
    cursor = path.join(cursor, part);
    const metadata = await inspectSafeNode(cursor, expectedUid, false);
    beforeChain.push({ path: cursor, dev: metadata.dev, ino: metadata.ino });
  }
  for (const part of relativeParts.slice(0, -1)) {
    cursor = path.join(cursor, part);
    const metadata = await inspectSafeNode(cursor, expectedUid, false);
    beforeChain.push({ path: cursor, dev: metadata.dev, ino: metadata.ino });
  }
  const before = await inspectSafeNode(filePath, expectedUid, true);
  if (before.size > maxBytes) fail("TRUST_FILE_UNSAFE");
  let handle;
  try {
    handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size > maxBytes) {
      fail("TRUST_FILE_UNSAFE");
    }
    const bytes = await handle.readFile();
    const after = await lstat(filePath);
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size) fail("TRUST_FILE_UNSAFE");
    for (const beforeNode of beforeChain) {
      const checked = await inspectSafeNode(beforeNode.path, expectedUid, false);
      if (checked.dev !== beforeNode.dev || checked.ino !== beforeNode.ino) fail("TRUST_FILE_UNSAFE");
    }
    try {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return parseJsonNoDuplicateKeys(decoded);
    } catch (error) {
      if (error instanceof AuthorityError) throw error;
      fail("TRUST_FILE_INVALID_JSON");
    }
  } catch (error) {
    if (error instanceof AuthorityError) throw error;
    fail("TRUST_FILE_UNSAFE");
  } finally {
    await handle?.close();
  }
}

function runGit(args, { cwd = process.cwd(), encoding = null } = {}) {
  try {
    const gitChain = ["/", "/usr", "/usr/bin", GIT_EXECUTABLE];
    for (const [index, nodePath] of gitChain.entries()) {
      const metadata = lstatSync(nodePath);
      const final = index === gitChain.length - 1;
      if (
        metadata.isSymbolicLink()
        || metadata.uid !== 0
        || (metadata.mode & 0o022) !== 0
        || (final ? !metadata.isFile() : !metadata.isDirectory())
      ) fail("GIT_EXECUTABLE_UNTRUSTED");
    }
    return execFileSync(GIT_EXECUTABLE, ["--no-replace-objects", ...args], {
      cwd,
      encoding,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        PATH: "/usr/bin:/bin",
        HOME: "/nonexistent",
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_TERMINAL_PROMPT: "0",
      },
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (error) {
    if (error instanceof AuthorityError) throw error;
    fail("CANDIDATE_IDENTITY_INVALID");
  }
}

function parseDiffNameStatus(raw) {
  let decoded;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    fail("PATH_SCOPE_INVALID");
  }
  const fields = decoded.split("\0");
  if (fields.at(-1) === "") fields.pop();
  const changed = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (!/^[AMD]$/.test(status) || index >= fields.length) fail("PATH_SCOPE_INVALID");
    const file = fields[index++];
    validateAllowedPaths([file]);
    changed.push({ status, file });
  }
  const names = changed.map((entry) => entry.file);
  const sorted = [...names].sort();
  if (!arraysEqual(sorted, names) || new Set(names).size !== names.length) fail("PATH_SCOPE_INVALID");
  return changed;
}

function verifyCandidateEntryModes(cwd, commit, changes) {
  for (const { status, file } of changes) {
    if (status === "D") continue;
    const raw = runGit(["ls-tree", "-z", commit, "--", file], { cwd, encoding: "utf8" });
    const match = raw.match(/^(100644|100755) blob [0-9a-f]{40}\t([^\0]+)\0$/);
    if (!match || match[2] !== file) fail("PATH_SCOPE_INVALID");
  }
}

export function inspectGitCandidate({ cwd = process.cwd(), baseCommit, allowedPaths = ALLOWED_PATHS } = {}) {
  if (Object.keys(process.env).some((key) => (
    key === "GIT_DIR"
    || key === "GIT_WORK_TREE"
    || key === "GIT_OBJECT_DIRECTORY"
    || key === "GIT_ALTERNATE_OBJECT_DIRECTORIES"
    || key === "GIT_INDEX_FILE"
    || key === "GIT_COMMON_DIR"
    || key === "GIT_REPLACE_REF_BASE"
    || key.startsWith("GIT_CONFIG_")
  ))) fail("CANDIDATE_ENV_UNSAFE");
  assertString(baseCommit, SHA_PATTERN, "CANDIDATE_IDENTITY_INVALID");
  validateAllowedPaths([...allowedPaths]);
  if (runGit(["rev-parse", "--is-shallow-repository"], { cwd, encoding: "utf8" }).trim() !== "false") {
    fail("CANDIDATE_IDENTITY_INVALID");
  }
  if (runGit(["status", "--porcelain=v1", "-z"], { cwd }).length !== 0) fail("WORKTREE_DIRTY");
  const remote = runGit(["config", "--get", "remote.origin.url"], { cwd, encoding: "utf8" }).trim();
  const normalizedRemote = remote
    .replace(/^git@gitee\.com:/, "gitee.com/")
    .replace(/^ssh:\/\/git@gitee\.com\//, "gitee.com/")
    .replace(/^https?:\/\/gitee\.com\//, "gitee.com/")
    .replace(/\.git$/, "");
  if (normalizedRemote !== REPOSITORY_IDENTITY) fail("REPOSITORY_IDENTITY_INVALID");
  const commit = runGit(["rev-parse", "HEAD^{commit}"], { cwd, encoding: "utf8" }).trim();
  const tree = runGit(["rev-parse", `${commit}^{tree}`], { cwd, encoding: "utf8" }).trim();
  const baseTree = runGit(["rev-parse", `${baseCommit}^{tree}`], { cwd, encoding: "utf8" }).trim();
  const parents = runGit(["show", "-s", "--format=%P", commit], { cwd, encoding: "utf8" }).trim().split(/\s+/).filter(Boolean);
  if (parents.length !== 1 || parents[0] !== baseCommit) fail("CANDIDATE_IDENTITY_INVALID");
  const rawDiff = runGit(["diff-tree", "-r", "--no-commit-id", "--name-status", "-z", baseCommit, commit], { cwd });
  const changes = parseDiffNameStatus(rawDiff);
  const paths = changes.map((entry) => entry.file);
  if (paths.some((file) => !allowedPaths.includes(file))) fail("PATH_SCOPE_INVALID");
  if (paths.some((file) => IMMUTABLE_CANDIDATE_PATHS.includes(file))) fail("PATH_SCOPE_INVALID");
  verifyCandidateEntryModes(cwd, commit, changes);
  if (runGit(["status", "--porcelain=v1", "-z"], { cwd }).length !== 0) fail("WORKTREE_DIRTY");
  if (runGit(["rev-parse", "HEAD^{commit}"], { cwd, encoding: "utf8" }).trim() !== commit) {
    fail("CANDIDATE_IDENTITY_INVALID");
  }
  return {
    commit,
    tree,
    base_tree: baseTree,
    parent: parents[0],
    clean: true,
    paths,
    diff_name_status_z_digest: digestBytes(rawDiff),
  };
}

export function validateCheckpointReceipt(envelope, {
  grant,
  grantDigest,
  trustRoot,
  requestChallenge,
  candidate,
  now = new Date(),
}) {
  assertClosedObject(envelope, ["schema_version", "payload", "signature"]);
  if (envelope.schema_version !== "execution-authority.ext.signed-checkpoint-receipt.v1") fail("CHECKPOINT_INVALID");
  validateSignatureObject(envelope.signature);
  const payload = envelope.payload;
  assertClosedObject(payload, [
    "schema_version", "authority_id", "task_id", "grant_digest", "nonce", "sequence",
    "fencing_epoch", "lease_id", "holder_identity", "request_challenge", "candidate_commit",
    "candidate_tree", "consumed", "checkpoint_time", "key_id",
  ], "CHECKPOINT_INVALID");
  assertString(requestChallenge, BASE64URL_PATTERN, "CHECKPOINT_INVALID");
  if (requestChallenge.length !== 43) fail("CHECKPOINT_INVALID");
  assertString(payload.request_challenge, BASE64URL_PATTERN, "CHECKPOINT_INVALID");
  assertString(payload.candidate_commit, SHA_PATTERN, "CHECKPOINT_INVALID");
  assertString(payload.candidate_tree, SHA_PATTERN, "CHECKPOINT_INVALID");
  if (
    payload.schema_version !== "execution-authority.ext.checkpoint-receipt.v1"
    || payload.authority_id !== AUTHORITY_ID
    || payload.task_id !== TASK_ID
    || payload.grant_digest !== grantDigest
    || payload.nonce !== grant.nonce
    || payload.sequence !== grant.sequence
    || payload.fencing_epoch !== grant.fencing_epoch
    || payload.lease_id !== grant.lease_id
    || payload.holder_identity !== grant.holder_identity
    || payload.request_challenge !== requestChallenge
    || payload.candidate_commit !== candidate.commit
    || payload.candidate_tree !== candidate.tree
    || payload.consumed !== true
    || envelope.signature.key_id !== payload.key_id
    || payload.key_id === grant.key_id
  ) fail("CHECKPOINT_INVALID");
  const checkpointTime = parseTimestamp(payload.checkpoint_time, "CHECKPOINT_INVALID");
  if (checkpointTime < parseTimestamp(grant.not_before) || checkpointTime >= parseTimestamp(grant.expires_at)) {
    fail("CHECKPOINT_INVALID");
  }
  const key = resolveActiveKey(trustRoot, payload.key_id, "CHECKPOINT", now);
  verifySignedEnvelope(envelope, { domain: CHECKPOINT_DOMAIN, publicKey: key, expectedKeyId: payload.key_id });
  return { verified: true, consumed: true, nonce: payload.nonce, sequence: payload.sequence };
}

async function inspectCheckpointSocketPath() {
  const trustedPrefix = "/run/chaotang-os/execution-authority-ext";
  try {
    const chain = [];
    let cursor = "/";
    let metadata = await inspectSafeNode(cursor, 0, false);
    chain.push({ path: cursor, dev: metadata.dev, ino: metadata.ino });
    for (const part of path.relative("/", trustedPrefix).split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, part);
      metadata = await inspectSafeNode(cursor, 0, false);
      chain.push({ path: cursor, dev: metadata.dev, ino: metadata.ino });
    }
    const socketMetadata = await lstat(HOST_PATHS.checkpoint);
    if (
      socketMetadata.isSymbolicLink()
      || !socketMetadata.isSocket()
      || socketMetadata.uid !== 0
      || (socketMetadata.mode & 0o022) !== 0
    ) fail("EXTERNAL_CHECKPOINT_UNAVAILABLE");
    return { dev: socketMetadata.dev, ino: socketMetadata.ino, chain };
  } catch {
    fail("EXTERNAL_CHECKPOINT_UNAVAILABLE");
  }
}

export async function requestCheckpointReceipt({ trustRoot, grant, grantDigest, candidate, now = new Date() }) {
  const socketIdentity = await inspectCheckpointSocketPath();
  const requestChallenge = randomBytes(32).toString("base64url");
  const request = canonicalizeRfc8785({
    schema_version: "execution-authority.ext.checkpoint-request.v1",
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
  });
  const response = await new Promise((resolve, reject) => {
    let settled = false;
    let received = "";
    const socket = net.createConnection({ path: HOST_PATHS.checkpoint });
    const stop = () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(new AuthorityError("EXTERNAL_CHECKPOINT_UNAVAILABLE"));
      }
    };
    socket.setTimeout(trustRoot.checkpoint.timeout_ms, stop);
    socket.on("error", stop);
    socket.on("connect", () => socket.write(`${request}\n`));
    socket.on("data", (chunk) => {
      received += chunk.toString("utf8");
      if (received.length > MAX_TRUST_FILE_BYTES) return stop();
      const newline = received.indexOf("\n");
      if (newline !== -1 && !settled) {
        settled = true;
        socket.end();
        try {
          resolve(parseJsonNoDuplicateKeys(received.slice(0, newline)));
        } catch {
          reject(new AuthorityError("CHECKPOINT_INVALID"));
        }
      }
    });
  });
  const socketAfter = await inspectCheckpointSocketPath();
  if (
    socketAfter.dev !== socketIdentity.dev
    || socketAfter.ino !== socketIdentity.ino
    || socketAfter.chain.length !== socketIdentity.chain.length
    || socketAfter.chain.some((entry, index) => (
      entry.path !== socketIdentity.chain[index].path
      || entry.dev !== socketIdentity.chain[index].dev
      || entry.ino !== socketIdentity.chain[index].ino
    ))
  ) {
    fail("EXTERNAL_CHECKPOINT_UNAVAILABLE");
  }
  return validateCheckpointReceipt(response, {
    grant,
    grantDigest,
    trustRoot,
    requestChallenge,
    candidate,
    now,
  });
}

function evaluateAuthorization(input) {
  if (input[VERIFIED_AUTHORIZATION_INPUT] !== true) {
    return { decision: "STOP", reason: "INTERNAL_PROOF_UNVERIFIED" };
  }
  if (input.taskId !== TASK_ID || input.grant?.task_id !== TASK_ID) return { decision: "STOP", reason: "TASK_MISMATCH" };
  if (input.grant.repository_identity !== REPOSITORY_IDENTITY) return { decision: "STOP", reason: "REPOSITORY_IDENTITY_INVALID" };
  if (input.grant.holder_identity !== HOLDER_IDENTITY) return { decision: "STOP", reason: "HOLDER_IDENTITY_INVALID" };
  if (!input.trustRoot) return { decision: "STOP", reason: "TRUST_ROOT_UNAVAILABLE" };
  if (!input.trustRoot.keyActive) return { decision: "STOP", reason: "KEY_REVOKED" };
  if (input.grant.sequence < input.trustRoot.minSequence) return { decision: "STOP", reason: "SEQUENCE_ROLLBACK" };
  if (!input.candidate) return { decision: "STOP", reason: "CANDIDATE_IDENTITY_INVALID" };
  if (!input.candidate.clean) return { decision: "STOP", reason: "WORKTREE_DIRTY" };
  if (input.candidate.parent !== input.grant.base_commit || input.candidate.base_tree !== input.grant.base_tree) {
    return { decision: "STOP", reason: "CANDIDATE_IDENTITY_INVALID" };
  }
  if (input.candidate.paths.some((file) => !input.grant.allowed_paths.includes(file))) {
    return { decision: "STOP", reason: "PATH_SCOPE_INVALID" };
  }
  if (!input.attestation) return { decision: "STOP", reason: "ATTESTATION_UNAVAILABLE" };
  if (
    input.attestation.task_id !== TASK_ID
    || input.attestation.candidate_commit !== input.candidate.commit
    || input.attestation.candidate_tree !== input.candidate.tree
    || input.attestation.candidate_parent !== input.candidate.parent
    || input.attestation.grant_digest !== digestCanonical(input.grant)
  ) return { decision: "STOP", reason: "ATTESTATION_MISMATCH" };
  if (!input.requiredCheck?.verified || !input.requiredCheck.enforced) {
    return { decision: "STOP", reason: "REQUIRED_CHECK_UNVERIFIED" };
  }
  if (!input.checkpoint?.verified || !input.checkpoint.consumed) {
    return { decision: "STOP", reason: "EXTERNAL_CHECKPOINT_UNAVAILABLE" };
  }
  if (input.checkpoint.nonce !== input.grant.nonce || input.checkpoint.sequence !== input.grant.sequence) {
    return { decision: "STOP", reason: "REPLAY_DETECTED" };
  }
  return { decision: "GO", reason: "AUTHORIZED" };
}

async function loadAndVerifyNonConsumptive({ cwd = process.cwd(), now = new Date() } = {}) {
  let trustRootDocument;
  try {
    trustRootDocument = await readTrustedJsonFile(HOST_PATHS.trustRoot, {
      trustedPrefix: "/etc/chaotang-os/execution-authority-ext",
    });
  } catch (error) {
    if (error instanceof AuthorityError && error.code === "TRUST_FILE_UNAVAILABLE") fail("TRUST_ROOT_UNAVAILABLE");
    throw error;
  }
  const trustRoot = validateTrustRoot(trustRootDocument, now);
  let grantEnvelope;
  try {
    grantEnvelope = await readTrustedJsonFile(HOST_PATHS.grant, {
      trustedPrefix: "/run/chaotang-os/execution-authority-ext",
    });
  } catch (error) {
    if (error instanceof AuthorityError && error.code === "TRUST_FILE_UNAVAILABLE") fail("GRANT_UNAVAILABLE");
    throw error;
  }
  const grant = validateGrantEnvelope(grantEnvelope, now);
  validateGrantAgainstTrustRoot(grant, trustRoot);
  const grantKey = resolveActiveKey(trustRoot, grant.key_id, "GRANT", now);
  verifySignedEnvelope(grantEnvelope, { domain: GRANT_DOMAIN, publicKey: grantKey, expectedKeyId: grant.key_id });
  const grantDigest = digestCanonical(grant);
  const candidate = inspectGitCandidate({ cwd, baseCommit: grant.base_commit, allowedPaths: grant.allowed_paths });
  let attestationEnvelope;
  try {
    attestationEnvelope = await readTrustedJsonFile(HOST_PATHS.attestation, {
      trustedPrefix: "/run/chaotang-os/execution-authority-ext",
    });
  } catch (error) {
    if (error instanceof AuthorityError && error.code === "TRUST_FILE_UNAVAILABLE") fail("ATTESTATION_UNAVAILABLE");
    throw error;
  }
  const attestation = validateAttestationEnvelope(attestationEnvelope, now);
  if (attestation.key_id === grant.key_id) fail("KEY_PURPOSE_INVALID");
  const attestationKey = resolveActiveKey(trustRoot, attestation.key_id, "ATTESTATION", now);
  verifySignedEnvelope(attestationEnvelope, {
    domain: ATTESTATION_DOMAIN,
    publicKey: attestationKey,
    expectedKeyId: attestation.key_id,
  });
  const attestationIssuedAt = parseTimestamp(attestation.issued_at);
  if (
    attestationIssuedAt < parseTimestamp(grant.not_before)
    || attestationIssuedAt >= parseTimestamp(grant.expires_at)
  ) fail("ATTESTATION_TIME_INVALID");
  const platformEnvelope = attestation.required_check_proof;
  const platformProof = validatePlatformProofEnvelope(platformEnvelope, now);
  if (platformProof.key_id === attestation.key_id || platformProof.key_id === grant.key_id) {
    fail("REQUIRED_CHECK_UNVERIFIED");
  }
  const platformKey = resolveActiveKey(trustRoot, platformProof.key_id, "PLATFORM", now);
  verifySignedEnvelope(platformEnvelope, {
    domain: PLATFORM_PROOF_DOMAIN,
    publicKey: platformKey,
    expectedKeyId: platformProof.key_id,
  });
  if (
    attestation.grant_digest !== grantDigest
    || attestation.candidate_commit !== candidate.commit
    || attestation.candidate_tree !== candidate.tree
    || attestation.candidate_parent !== candidate.parent
    || attestation.diff_name_status_z_digest !== candidate.diff_name_status_z_digest
    || grant.base_tree !== candidate.base_tree
  ) fail("ATTESTATION_MISMATCH");
  const check = trustRoot.required_check;
  if (
    platformProof.candidate_commit !== candidate.commit
    || platformProof.check_name !== check.name
    || platformProof.policy_identity !== check.policy_identity
    || platformProof.policy_digest !== check.policy_digest
    || parseTimestamp(platformProof.observed_at) < parseTimestamp(grant.not_before)
    || parseTimestamp(platformProof.observed_at) >= parseTimestamp(grant.expires_at)
  ) fail("REQUIRED_CHECK_UNVERIFIED");
  return {
    trustRoot,
    grant,
    grantDigest,
    candidate,
    evaluation: {
      [VERIFIED_AUTHORIZATION_INPUT]: true,
      taskId: TASK_ID,
      grant,
      trustRoot: { keyActive: true, minSequence: trustRoot.min_sequence },
      candidate,
      attestation,
      requiredCheck: { verified: true, enforced: true },
    },
  };
}

function publicResult(decision, reason) {
  return {
    schemaVersion: "execution-authority.ext.result.v1",
    authorityId: AUTHORITY_ID,
    taskId: TASK_ID,
    decision,
    canAcceptGovernanceCandidate: decision === "GO",
    canExecuteProductWork: false,
    reason,
  };
}

function parseCli(argv) {
  if (argv.length === 1 && argv[0] === "--status") return { command: "status" };
  if (argv.length === 1 && argv[0] === "--check") return { command: "check" };
  if (argv.length === 3 && argv[0] === "--authorize" && argv[1] === "--task") {
    return { command: "authorize", taskId: argv[2] };
  }
  return { command: "invalid" };
}

export async function runCli(argv = process.argv.slice(2), { cwd = process.cwd(), now = new Date() } = {}) {
  const parsed = parseCli(argv);
  if (parsed.command === "invalid") {
    process.stdout.write(`${JSON.stringify(publicResult("STOP", "USAGE_INVALID"))}\n`);
    return 64;
  }
  if (parsed.command === "status") {
    process.stdout.write(`${JSON.stringify(publicResult("STOP", "EXTERNAL_AUTHORITY_NOT_EVALUATED"))}\n`);
    return 0;
  }
  if (parsed.taskId && parsed.taskId !== TASK_ID) {
    process.stdout.write(`${JSON.stringify(publicResult("STOP", "TASK_MISMATCH"))}\n`);
    return 2;
  }
  try {
    const verified = await loadAndVerifyNonConsumptive({ cwd, now });
    if (parsed.command === "check") {
      process.stdout.write(`${JSON.stringify(publicResult("STOP", "CHECK_VALID_NON_AUTHORIZING"))}\n`);
      return 0;
    }
    const checkpoint = await requestCheckpointReceipt({
      trustRoot: verified.trustRoot,
      grant: verified.grant,
      grantDigest: verified.grantDigest,
      candidate: verified.candidate,
      now,
    });
    const finalCandidate = inspectGitCandidate({
      cwd,
      baseCommit: verified.grant.base_commit,
      allowedPaths: verified.grant.allowed_paths,
    });
    if (canonicalizeRfc8785(finalCandidate) !== canonicalizeRfc8785(verified.candidate)) {
      fail("CANDIDATE_IDENTITY_INVALID");
    }
    const result = evaluateAuthorization({
      ...verified.evaluation,
      candidate: finalCandidate,
      checkpoint,
    });
    process.stdout.write(`${JSON.stringify(publicResult(result.decision, result.reason))}\n`);
    return result.decision === "GO" ? 0 : 2;
  } catch (error) {
    const reason = error instanceof AuthorityError ? error.code : "INTERNAL_ERROR";
    process.stdout.write(`${JSON.stringify(publicResult("STOP", reason))}\n`);
    return 2;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = await runCli();
}

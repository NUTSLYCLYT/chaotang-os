#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { lookup as dnsLookup } from "node:dns/promises";
import { constants as fsConstants, createReadStream } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import {
  chmod,
  lchown,
  lstat,
  mkdir,
  open,
  readFile,
  readlink,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

import { validateReleasePhaseInput } from "./build_offline_release.mjs";
import { canonicalize, parseJsonStrict, validateReleaseExpectation } from "./verify_offline_release.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const HEX_64_PATTERN = /^[0-9a-f]{64}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const RFC3339_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const FORBIDDEN_ROOTS = ["/opt/chaotang-os", "/srv/chaotang-os", "/etc/chaotang-os", "/var/lib/chaotang-os"];
const TASK_PATH = "docs/product/tasks/2026-08-17-rc1-release-blocker-remediation-v1.md";
const RUNNER_SOURCE_PATH = fileURLToPath(import.meta.url);
const TRUSTED_RUNNER_MODULES = Object.freeze([
  "scripts/build_offline_release.mjs",
  "scripts/execution_authority_ext.mjs",
  "scripts/product-authority.mjs",
  "scripts/run_rc1_release_acceptance.mjs",
  "scripts/verify_offline_release.mjs",
]);
const FORBIDDEN_RUNNER_ENVIRONMENT = Object.freeze([
  "DYLD_INSERT_LIBRARIES", "DYLD_LIBRARY_PATH", "LD_LIBRARY_PATH", "LD_PRELOAD",
  "NODE_OPTIONS", "NODE_PATH",
]);
const ACCEPTANCE_CLI_KEYS = Object.freeze([
  "--candidate", "--tree", "--source-date-epoch", "--docker-endpoint", "--docker-context",
  "--docker-context-config-dir", "--evidence-dir", "--egress-evidence", "--release-expectation",
  "--release-phase", "--rounds", "--repository",
]);
const APPROVAL_PATH = ".harness/approvals/RC1-RELEASE-BLOCKER-REMEDIATION-V1-20260817.json";
const POLICY_DIGEST = "sha256:75054d6dc6737ff20eab02ad0a6b67ff7b64250676e9ad5087187548d50fe268";
const POLICY_HEADING = "### Approved toolchain policy";
const IMAGE_ORDER = ["backend", "caddy", "frontend"];
const PRODUCTION_PATH_PATTERN = /(?:^|[\s=:"'])\/(?:opt|srv|etc|var\/lib)\/chaotang-os(?:\/|$)/;
const OCI_MANIFEST_TYPES = new Set([
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
]);
const OCI_IMAGE_MANIFEST_TYPE = "application/vnd.oci.image.manifest.v1+json";
const OCI_IMAGE_CONFIG_TYPE = "application/vnd.oci.image.config.v1+json";
const OCI_GZIP_LAYER_TYPE = "application/vnd.oci.image.layer.v1.tar+gzip";
const DEFAULT_REGISTRY_DEADLINES = Object.freeze({
  requestMs: 30_000,
  bodyMs: 5 * 60_000,
  exportMs: 15 * 60_000,
});
const MAX_COMMAND_MS = 30 * 60 * 1000;
const BACKEND_WHEELHOUSE = "/var/tmp/chaotang-m0-wheelhouse";
const OPERATOR_INPUT_KEYS = [
  "schemaVersion", "candidateCommit", "candidateTree", "releaseExpectationPath",
  "releaseExpectationDigest", "verifierPath", "verifierDigest", "bundlePath",
  "bundleDigest", "immutableSnapshotPath", "immutableSnapshotDigest", "dockerEndpoint",
  "sourceRoot", "backupRoot", "rehearsalRoot", "rolloutLockPath", "backupPythonPath",
  "backupToolDigest", "operatorRef", "maintenanceWindowStart", "maintenanceWindowEnd",
  "inputsDigest",
];
const NPM_AUDIT_ORIGIN = "https://registry.npmjs.org";
const NPM_AUDIT_PATH = "/-/npm/v1/security/advisories/bulk";
const DOCKER_BLOB_CDN_ORIGIN = "https://production.cloudflare.docker.com";
const DOCKER_BLOB_CDN_PATH = /^\/registry-v2\/docker\/registry\/v2\/blobs\/sha256\/([0-9a-f]{2})\/([0-9a-f]{64})\/data$/;
const REGISTRY_PATH_PREFIXES = new Map([
  ["https://registry-1.docker.io", ["/v2/library/caddy/manifests/", "/v2/library/caddy/blobs/"]],
  ["https://auth.docker.io", ["/token"]],
  [DOCKER_BLOB_CDN_ORIGIN, ["/registry-v2/docker/registry/v2/blobs/sha256/"]],
  [NPM_AUDIT_ORIGIN, [NPM_AUDIT_PATH]],
]);
const FORBIDDEN_IPS = new BlockList();
for (const [network, prefix, family] of [
  ["0.0.0.0", 8, "ipv4"], ["10.0.0.0", 8, "ipv4"],
  ["100.64.0.0", 10, "ipv4"], ["127.0.0.0", 8, "ipv4"],
  ["169.254.0.0", 16, "ipv4"], ["172.16.0.0", 12, "ipv4"],
  ["192.0.0.0", 24, "ipv4"], ["192.0.2.0", 24, "ipv4"],
  ["192.168.0.0", 16, "ipv4"], ["198.18.0.0", 15, "ipv4"],
  ["198.51.100.0", 24, "ipv4"], ["203.0.113.0", 24, "ipv4"],
  ["224.0.0.0", 4, "ipv4"], ["240.0.0.0", 4, "ipv4"],
  ["::", 128, "ipv6"], ["::1", 128, "ipv6"], ["100::", 64, "ipv6"],
  ["2001:db8::", 32, "ipv6"], ["fc00::", 7, "ipv6"],
  ["fe80::", 10, "ipv6"], ["ff00::", 8, "ipv6"],
]) FORBIDDEN_IPS.addSubnet(network, prefix, family);
const UNTRUSTED_UID = 65_534;
const UNTRUSTED_GID = 65_534;
const ISOLATION_MODE = "LOW_PRIVILEGE_PID_MOUNT_NAMESPACE_V1";
const ISOLATION_TOOL_VERSION = "2.39.3";
const CLOSED_GIT_OPTIONS = [
  "--no-replace-objects",
  "-c", "core.fsmonitor=false",
  "-c", "core.hooksPath=/dev/null",
  "-c", "core.preloadIndex=false",
];

// These values are only used to make the static plan. Passing evidence still
// requires the byte-identical policy loaded from the immutable approval parent.
const PINNED_POLICY = Object.freeze({
  images: {
    caddy: { reference: "docker.io/library/caddy@sha256:98eb57d882ccd5213d1688764db10c1ca2c58a1ca3a6717a3411ad798f7a423a" },
    grype: { reference: "docker.io/anchore/grype@sha256:ab8d929faec38875a45aba74c9651549cd096756d1981773c04375f282e91075" },
    node: { reference: "docker.io/library/node@sha256:2a49bdf71e9fd965a58c1703fd9ddd205b34e5782b692a72dd1d248abb0beb43" },
    python: { reference: "docker.io/library/python@sha256:356b0d18f9385f4bdcc673af60e1e64c9d1504952e4ec36ee32044c722a6bc4e" },
    syft: { reference: "docker.io/anchore/syft@sha256:41f8289664101d6ebab30a97ac8df6b6f86b92d8343285ca90f428e2bc353106" },
  },
});

export class AcceptanceError extends Error {
  constructor(code) {
    super(code);
    this.name = "AcceptanceError";
    this.code = code;
  }
}

function fail(code) {
  throw new AcceptanceError(code);
}

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function runnerCliIsClosed(argv) {
  const values = argv.slice(2);
  if (values.length === 2 && values[0] === "--operator-inputs" && isAbsolute(values[1])) return true;
  if (values.length !== ACCEPTANCE_CLI_KEYS.length * 2) return false;
  const keys = [];
  for (let index = 0; index < values.length; index += 2) {
    if (!values[index + 1]) return false;
    keys.push(values[index]);
  }
  return sameStrings([...keys].sort(), [...ACCEPTANCE_CLI_KEYS].sort()) && new Set(keys).size === keys.length;
}

export function runnerPrivilegeModel(uid) {
  if (!Number.isSafeInteger(uid) || uid < 0) fail("RUNNER_PROCESS_IDENTITY_INVALID");
  return uid === 0 ? "TRUSTED_ROOT_ORCHESTRATOR" : "SEALED_NON_ROOT_RUNNER";
}

export async function currentRunnerProcessIdentity(candidateCommit, candidateTree) {
  const scriptPath = await realpath(RUNNER_SOURCE_PATH);
  const repositoryRoot = await realpath(resolve(dirname(scriptPath), ".."));
  const executable = await realpath(process.execPath);
  const scriptArgument = process.argv[1];
  const uid = typeof process.getuid === "function" ? process.getuid() : null;
  if (
    !Number.isSafeInteger(process.pid) || process.pid <= 1 ||
    !Number.isSafeInteger(uid) || uid < 0 ||
    process.execArgv.length !== 0 ||
    FORBIDDEN_RUNNER_ENVIRONMENT.some((key) => Object.hasOwn(process.env, key)) ||
    !runnerCliIsClosed(process.argv) ||
    typeof scriptArgument !== "string" ||
    await realpath(resolve(scriptArgument)) !== scriptPath ||
    scriptPath !== resolve(repositoryRoot, "scripts/run_rc1_release_acceptance.mjs")
  ) fail("RUNNER_PROCESS_IDENTITY_INVALID");
  const repositoryInfo = await lstat(repositoryRoot);
  if (
    !repositoryInfo.isDirectory() || repositoryInfo.isSymbolicLink() ||
    repositoryInfo.uid !== 0 || (repositoryInfo.mode & 0o022) !== 0
  ) fail("RUNNER_SOURCE_NOT_IMMUTABLE");
  const moduleDigests = [];
  for (const relativePath of TRUSTED_RUNNER_MODULES) {
    const path = resolve(repositoryRoot, relativePath);
    const info = await lstat(path);
    if (
      !info.isFile() || info.isSymbolicLink() || info.nlink !== 1 ||
      info.uid !== 0 || (info.mode & 0o022) !== 0 ||
      await realpath(path) !== path
    ) fail("RUNNER_SOURCE_NOT_IMMUTABLE");
    moduleDigests.push({ relativePath, sha256: digest(await readFile(path)) });
  }
  return {
    argumentsDigest: digest(Buffer.from(process.argv.join("\0"), "utf8")),
    candidateCommit,
    candidateTree,
    pid: process.pid,
    executable,
    moduleDigests,
    privilegeModel: runnerPrivilegeModel(uid),
    repositoryRoot,
    scriptArgument,
    scriptPath,
    scriptSha256: digest(await readFile(scriptPath)),
    uid,
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertString(value, pattern = null, code = "ACCEPTANCE_OPTIONS_INVALID") {
  if (typeof value !== "string" || value.length === 0 || value.length > 16_384) fail(code);
  if (pattern && !pattern.test(value)) fail(code);
}

function parseStrict(text, code) {
  try {
    return parseJsonStrict(text);
  } catch {
    fail(code);
  }
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasExactKeys(value, keys) {
  return isPlainObject(value) && sameStrings(Object.keys(value).sort(), [...keys].sort());
}

function safeEvidencePath(path) {
  assertString(path);
  if (!isAbsolute(path)) fail("EVIDENCE_PATH_NOT_ABSOLUTE");
  const absolute = resolve(path);
  if (FORBIDDEN_ROOTS.some((root) => absolute === root || absolute.startsWith(`${root}/`))) {
    fail("PRODUCTION_PATH_FORBIDDEN");
  }
  return absolute;
}

export function validateOperatorInputsDocument(value) {
  if (!hasExactKeys(value, OPERATOR_INPUT_KEYS) ||
      value.schemaVersion !== "chaotang.p15-operator-inputs.v1") {
    fail("OPERATOR_INPUTS_INVALID");
  }
  assertString(value.candidateCommit, SHA_PATTERN, "OPERATOR_INPUTS_INVALID");
  assertString(value.candidateTree, SHA_PATTERN, "OPERATOR_INPUTS_INVALID");
  for (const key of [
    "releaseExpectationDigest", "verifierDigest", "bundleDigest",
    "immutableSnapshotDigest", "backupToolDigest", "inputsDigest",
  ]) assertString(value[key], DIGEST_PATTERN, "OPERATOR_INPUTS_INVALID");
  for (const key of [
    "releaseExpectationPath", "verifierPath", "bundlePath", "immutableSnapshotPath",
    "sourceRoot", "backupRoot", "rehearsalRoot", "rolloutLockPath", "backupPythonPath",
  ]) {
    assertString(value[key], null, "OPERATOR_INPUTS_INVALID");
    if (!isAbsolute(value[key]) || resolve(value[key]) !== value[key]) {
      fail("OPERATOR_INPUTS_INVALID");
    }
  }
  validateDockerEndpoint(value.dockerEndpoint);
  assertString(value.operatorRef, /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/, "OPERATOR_INPUTS_INVALID");
  const start = parseUtc(value.maintenanceWindowStart);
  const end = parseUtc(value.maintenanceWindowEnd);
  if (start >= end) fail("OPERATOR_INPUTS_INVALID");
  const roots = [
    value.bundlePath, value.immutableSnapshotPath, value.sourceRoot, value.backupRoot,
    value.rehearsalRoot, dirname(value.rolloutLockPath),
  ];
  for (let left = 0; left < roots.length; left += 1) {
    for (let right = left + 1; right < roots.length; right += 1) {
      if (roots[left] === roots[right] || roots[left].startsWith(`${roots[right]}/`) ||
          roots[right].startsWith(`${roots[left]}/`)) {
        fail("OPERATOR_INPUTS_ROOT_OVERLAP");
      }
    }
  }
  const { inputsDigest, ...payload } = value;
  if (inputsDigest !== digest(Buffer.from(canonicalize(payload), "utf8"))) {
    fail("OPERATOR_INPUTS_DIGEST_MISMATCH");
  }
  return value;
}

function validateDockerEndpoint(value) {
  assertString(value);
  if (["unix:///var/run/docker.sock", "unix:///run/docker.sock", "/var/run/docker.sock", "/run/docker.sock"].includes(value)) {
    fail("DEFAULT_DOCKER_ENDPOINT");
  }
  if (!value.startsWith("unix:///")) fail("DOCKER_ENDPOINT_INVALID");
  const socketPath = value.slice("unix://".length);
  if (
    !isAbsolute(socketPath) ||
    socketPath.includes("\0") ||
    socketPath.includes("?") ||
    socketPath.includes("#") ||
    socketPath.split("/").some((part) => part === "." || part === "..")
  ) fail("DOCKER_ENDPOINT_INVALID");
  const euid = typeof process.geteuid === "function" ? process.geteuid() : null;
  const permittedRoots = ["/tmp/", ...(euid === null ? [] : [`/run/user/${euid}/`])];
  if (!permittedRoots.some((root) => socketPath.startsWith(root)) || !socketPath.endsWith(".sock")) {
    fail("DOCKER_ENDPOINT_INVALID");
  }
  return value;
}


export async function validateDockerSocketEndpoint(endpoint) {
  validateDockerEndpoint(endpoint);
  const socketPath = endpoint.slice("unix://".length);
  let info;
  let parentInfo;
  try {
    info = await lstat(socketPath);
    parentInfo = await lstat(dirname(socketPath));
  } catch {
    fail("DOCKER_ENDPOINT_UNAVAILABLE");
  }
  const euid = typeof process.geteuid === "function" ? process.geteuid() : null;
  if (
    !info.isSocket() ||
    info.isSymbolicLink() ||
    await realpath(socketPath) !== socketPath ||
    !parentInfo.isDirectory() ||
    parentInfo.isSymbolicLink() ||
    await realpath(dirname(socketPath)) !== dirname(socketPath) ||
    (euid !== null && info.uid !== euid) ||
    (euid !== null && parentInfo.uid !== euid) ||
    (info.mode & 0o077) !== 0 ||
    (parentInfo.mode & 0o077) !== 0
  ) fail("DOCKER_ENDPOINT_UNSAFE");
  return { dev: info.dev, ino: info.ino, path: socketPath };
}

export function sameSocketIdentity(actual, expected) {
  return isPlainObject(actual) && isPlainObject(expected) &&
    actual.dev === expected.dev && actual.ino === expected.ino && actual.path === expected.path;
}

async function assertPrivateDirectory(path, { empty = false } = {}) {
  const info = await lstat(path);
  const euid = typeof process.geteuid === "function" ? process.geteuid() : null;
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    await realpath(path) !== path ||
    (euid !== null && info.uid !== euid) ||
    (info.mode & 0o022) !== 0
  ) fail("EVIDENCE_DIR_UNSAFE");
  if (empty && (await readdir(path)).length !== 0) fail("EVIDENCE_DIR_NOT_EMPTY");
}

async function directoryIdentity(path, code = "EVIDENCE_DIR_UNSAFE") {
  let info;
  try {
    info = await lstat(path);
  } catch {
    fail(code);
  }
  const euid = typeof process.geteuid === "function" ? process.geteuid() : null;
  if (
    !info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path ||
    (euid !== null && info.uid !== euid) || (info.mode & 0o077) !== 0
  ) fail(code);
  return { dev: info.dev, ino: info.ino, path };
}

async function assertDirectoryIdentity(expected, code = "EVIDENCE_DIR_CHANGED") {
  const actual = await directoryIdentity(expected.path, code);
  if (actual.dev !== expected.dev || actual.ino !== expected.ino) fail(code);
}

async function prepareEvidenceDirectory(path) {
  try {
    await assertPrivateDirectory(path, { empty: true });
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const parent = dirname(path);
  const parentInfo = await lstat(parent);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink() || await realpath(parent) !== parent) {
    fail("EVIDENCE_DIR_UNSAFE");
  }
  const canonicalCandidate = resolve(await realpath(parent), path.slice(parent.length + 1));
  if (
    canonicalCandidate !== path ||
    FORBIDDEN_ROOTS.some((root) => canonicalCandidate === root || canonicalCandidate.startsWith(`${root}/`))
  ) fail("PRODUCTION_PATH_FORBIDDEN");
  try {
    await mkdir(path, { recursive: false, mode: 0o700 });
  } catch {
    fail("EVIDENCE_DIR_CREATE_FAILED");
  }
  await assertPrivateDirectory(path, { empty: true });
}

function parseUtc(value, code = "EGRESS_EVIDENCE_INVALID") {
  if (typeof value !== "string" || !RFC3339_UTC_PATTERN.test(value)) fail(code);
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) fail(code);
  return epoch;
}

export function boundedEgressTimeout(nowMs, expiresAtMs, requestedMs = MAX_COMMAND_MS) {
  const remaining = expiresAtMs - nowMs;
  if (
    !Number.isFinite(nowMs) || !Number.isFinite(expiresAtMs) ||
    !Number.isFinite(requestedMs) || requestedMs <= 0 || remaining <= 0
  ) fail("EGRESS_LIFECYCLE_INACTIVE");
  return Math.max(1, Math.min(requestedMs, remaining));
}

export function validateAcceptanceOptions(options) {
  if (!isPlainObject(options) || !Object.keys(options).every((key) => ["candidateCommit", "candidateTree", "sourceDateEpoch", "dockerEndpoint", "dockerContext", "dockerContextConfigDir", "evidenceDir", "rounds", "egressEvidence", "releaseExpectation", "releasePhase", "repositoryRoot"].includes(key))) fail("ACCEPTANCE_OPTIONS_INVALID");
  assertString(options.candidateCommit, SHA_PATTERN);
  assertString(options.candidateTree, SHA_PATTERN);
  validateDockerEndpoint(options.dockerEndpoint);
  assertString(options.dockerContext);
  if (options.dockerContext === "default") fail("DEFAULT_DOCKER_CONTEXT");
  const dockerContextConfigDir = safeEvidencePath(options.dockerContextConfigDir);
  const evidenceDir = safeEvidencePath(options.evidenceDir);
  if (!Number.isSafeInteger(options.rounds) || ![1, 10].includes(options.rounds)) fail("ROUNDS_INVALID");
  if (!Number.isSafeInteger(options.sourceDateEpoch) || options.sourceDateEpoch <= 0) fail("SOURCE_DATE_EPOCH_INVALID");
  const egress = options.egressEvidence;
  if (
    !hasExactKeys(egress, ["ruleDigest", "dockerDaemonIncluded", "allowedOrigins", "allowProbePassed", "denyProbePassed", "preexistingOrUserCredentialsPresent", "disposableHost", "isolationId", "activatedAt", "expiresAt", "lifecycleCommandDigest", "cleanupRequired", "artifactPublishingAllowed", "businessDataUploadsAllowed", "remoteMutationAllowed", "registryAuthMode", "enforcementAuthority", "npmAuditRequest"]) ||
    !DIGEST_PATTERN.test(egress.ruleDigest ?? "") ||
    egress.dockerDaemonIncluded !== true ||
    egress.allowProbePassed !== true ||
    egress.denyProbePassed !== true ||
    egress.preexistingOrUserCredentialsPresent !== false ||
    egress.disposableHost !== true ||
    egress.cleanupRequired !== true ||
    egress.artifactPublishingAllowed !== false ||
    egress.businessDataUploadsAllowed !== false ||
    egress.remoteMutationAllowed !== false ||
    egress.registryAuthMode !== "ANONYMOUS_EPHEMERAL_BEARER_TOKEN_ONLY" ||
    egress.enforcementAuthority !== "EXTERNAL_HOST_FIREWALL_OR_PROXY" ||
    !DIGEST_PATTERN.test(egress.lifecycleCommandDigest ?? "") ||
    typeof egress.isolationId !== "string" ||
    !/^[A-Za-z0-9._-]{8,128}$/.test(egress.isolationId) ||
    !Array.isArray(egress.allowedOrigins) ||
    egress.allowedOrigins.length === 0 ||
    egress.allowedOrigins.some((origin) => typeof origin !== "string" || !origin.startsWith("https://"))
  ) fail("EGRESS_EVIDENCE_INVALID");
  const audit = egress.npmAuditRequest;
  if (
    !hasExactKeys(audit, ["method", "origin", "path", "bodyDerivedFromExactLock", "bodySha256", "bodyBytes"]) ||
    audit.method !== "POST" ||
    audit.origin !== "https://registry.npmjs.org" ||
    audit.path !== "/-/npm/v1/security/advisories/bulk" ||
    audit.bodyDerivedFromExactLock !== true ||
    !DIGEST_PATTERN.test(audit.bodySha256 ?? "") ||
    !Number.isSafeInteger(audit.bodyBytes) ||
    audit.bodyBytes <= 0 ||
    audit.bodyBytes > 4_194_304
  ) fail("EGRESS_EVIDENCE_INVALID");
  const activatedAt = parseUtc(egress.activatedAt);
  const expiresAt = parseUtc(egress.expiresAt);
  if (activatedAt >= expiresAt || expiresAt - activatedAt > 24 * 60 * 60 * 1000) fail("EGRESS_EVIDENCE_INVALID");
  let releaseExpectation;
  try {
    releaseExpectation = validateReleaseExpectation(options.releaseExpectation);
  } catch {
    fail("RELEASE_EXPECTATION_INVALID");
  }
  if (
    releaseExpectation.candidateCommit !== options.candidateCommit ||
    releaseExpectation.candidateTree !== options.candidateTree
  ) fail("RELEASE_EXPECTATION_INVALID");
  let releasePhase;
  try {
    releasePhase = validateReleasePhaseInput(options.releasePhase);
  } catch {
    fail("RELEASE_PHASE_INVALID");
  }
  if (
    releasePhase.mode !== "POST_ACCEPTANCE_FINAL" ||
    releasePhase.candidateCommit !== options.candidateCommit ||
    releasePhase.candidateTree !== options.candidateTree ||
    releasePhase.approvalDigest !== releaseExpectation.approvalDigest ||
    releasePhase.provisionalReceipt.receiptDigest !== releaseExpectation.provisionalReceiptDigest ||
    releasePhase.acceptanceReferenceDigest !== releaseExpectation.acceptanceReferenceDigest
  ) fail("RELEASE_PHASE_INVALID");
  return { ...options, releaseExpectation, releasePhase, dockerContextConfigDir, evidenceDir, repositoryRoot: resolve(options.repositoryRoot ?? process.cwd()) };
}

export function extractFrozenPolicy(markdown) {
  if (typeof markdown !== "string") fail("POLICY_BLOCK_INVALID");
  const headingIndex = markdown.indexOf(POLICY_HEADING);
  if (headingIndex < 0 || markdown.indexOf(POLICY_HEADING, headingIndex + POLICY_HEADING.length) >= 0) fail("POLICY_BLOCK_INVALID");
  const afterHeading = markdown.slice(headingIndex + POLICY_HEADING.length);
  const nextHeading = afterHeading.search(/\r?\n###\s+/);
  const section = nextHeading >= 0 ? afterHeading.slice(0, nextHeading) : afterHeading;
  const blocks = [...section.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)];
  if (blocks.length !== 1) fail("POLICY_BLOCK_INVALID");
  const [match] = blocks;
  const policy = parseStrict(match[1], "POLICY_BLOCK_INVALID");
  if (!isPlainObject(policy) || policy.schemaVersion !== "rc1-toolchain-policy.v1") fail("POLICY_BLOCK_INVALID");
  return policy;
}

function command(id, tool, args, cwd, expectedCodes = [0]) {
  const rendered = [tool, ...args].join(" ");
  if (args.some((arg) => ["push", "deploy", "stack", "service"].includes(arg)) || /(?:^|\/)kubectl$/.test(tool) || PRODUCTION_PATH_PATTERN.test(rendered)) fail("FORBIDDEN_COMMAND");
  return { id, tool, args, cwd, expectedCodes, isolation: null };
}

function untrustedCommand(id, tool, args, cwd, expectedCodes = [0]) {
  return { ...command(id, tool, args, cwd, expectedCodes), isolation: ISOLATION_MODE };
}

function dockerCommand(id, endpoint, args, cwd, expectedCodes = [0]) {
  return command(id, "/usr/bin/docker", ["--host", endpoint, ...args], cwd, expectedCodes);
}

function sourceCreated(epoch) {
  return new Date(epoch * 1000).toISOString().replace(".000Z", "Z");
}

function imagePaths(work, name) {
  return {
    archive: resolve(work, `images/${name}.oci.tar`),
    sbom: resolve(work, `images/${name}.sbom.json`),
    grype: resolve(work, `scan/${name}.grype.json`),
    provenance: resolve(work, `provenance/${name}.intoto.json`),
  };
}

function isolationRootFor(options, work) {
  return resolve(`${options.evidenceDir}-untrusted-${resolve(work).split(sep).at(-1)}`);
}

const BASE_SCAN_NAMES = ["node", "python"];

function smokeNames(options, work) {
  const suffix = `${options.candidateCommit.slice(0, 8)}-${resolve(work).split(sep).at(-1).replace(/[^a-zA-Z0-9_.-]/g, "-")}`;
  return {
    backend: `ct-rc1-backend-${suffix}`,
    caddy: `ct-rc1-caddy-${suffix}`,
    frontend: `ct-rc1-frontend-${suffix}`,
    network: `ct-rc1-net-${suffix}`,
    ownership: digest(Buffer.from(`${options.egressEvidence.isolationId}\0${suffix}`, "utf8")),
  };
}

export function validateColdBackupResult(value) {
  if (
    !hasExactKeys(value, [
      "backendRestarted",
      "manifestSha256",
      "networkRequests",
      "retentionProbeDigest",
      "restoredSnapshotIdentity",
      "schemaVersion",
      "sourceSnapshotIdentity",
      "writerStopEvidenceDigest",
    ]) ||
    value.schemaVersion !== "chaotang.rc1-cold-backup-result.v1" ||
    !DIGEST_PATTERN.test(value.manifestSha256 ?? "") ||
    !DIGEST_PATTERN.test(value.sourceSnapshotIdentity ?? "") ||
    !DIGEST_PATTERN.test(value.retentionProbeDigest ?? "") ||
    value.restoredSnapshotIdentity !== value.sourceSnapshotIdentity ||
    !DIGEST_PATTERN.test(value.writerStopEvidenceDigest ?? "") ||
    value.backendRestarted !== true ||
    value.networkRequests !== 0
  ) fail("COLD_BACKUP_RESULT_INVALID");
  return value;
}

function canonicalUtcNow() {
  return new Date().toISOString().replace(/\.(\d{3})Z$/, ".$1000Z");
}

function canonicalDigest(value) {
  return digest(Buffer.from(canonicalize(value), "utf8"));
}

export function parseDockerWriterEvent(line) {
  if (typeof line !== "string" || line.length === 0 || line.length > 65_536) {
    fail("WRITER_EVENT_INVALID");
  }
  const matches = [...line.matchAll(/"timeNano"\s*:\s*([1-9][0-9]{0,18})(?=\s*[,}])/g)];
  if (matches.length !== 1) fail("WRITER_EVENT_INVALID");
  const timeNano = matches[0][1];
  if (BigInt(timeNano) > 9_223_372_036_854_775_807n) fail("WRITER_EVENT_INVALID");
  const replaced = line.replace(matches[0][0], `"timeNano":"${timeNano}"`);
  const event = parseStrict(replaced, "WRITER_EVENT_INVALID");
  if (
    !isPlainObject(event) ||
    event.Type !== "container" ||
    !["die", "start", "restart"].includes(event.Action) ||
    !HEX_64_PATTERN.test(event.id ?? "") ||
    event.timeNano !== timeNano
  ) fail("WRITER_EVENT_INVALID");
  return { action: event.Action, containerId: event.id, timeNano };
}

function runBoundedProcess(tool, args, { cwd, env, passFd = null, signal = null, timeoutMs = 30 * 60 * 1000 }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let settled = false;
    const stdio = passFd === null ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe", passFd];
    const child = spawn(tool, args, { cwd, env, stdio, detached: false });
    const abort = () => {
      child.kill("SIGKILL");
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        rejectPromise(new AcceptanceError("COLD_BACKUP_PROCESS_ABORTED"));
      }
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      if (!settled) {
        settled = true;
        rejectPromise(new AcceptanceError("COLD_BACKUP_PROCESS_TIMEOUT"));
      }
    }, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    const collect = (target) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > 4 * 1024 * 1024) {
        child.kill("SIGKILL");
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          rejectPromise(new AcceptanceError("COLD_BACKUP_PROCESS_OUTPUT_LIMIT"));
        }
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.once("error", () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (!settled) {
        settled = true;
        rejectPromise(new AcceptanceError("COLD_BACKUP_PROCESS_FAILED"));
      }
    });
    child.once("close", (code, exitSignal) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (settled) return;
      settled = true;
      resolvePromise({
        child,
        code,
        signal: exitSignal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function spawnHeldLock(lockDescriptor, cwd, env) {
  const child = spawn(
    "/usr/bin/flock",
    ["--exclusive", "--nonblock", "3", "/usr/bin/tail", "-f", "/dev/null"],
    { cwd, env, stdio: ["ignore", "ignore", "pipe", lockDescriptor], detached: false },
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  child.once("error", () => { /* observed by the held-lock probe */ });
  return { child, stderr: () => stderr };
}

async function assertHeldLock(path, cwd, env) {
  const result = await runBoundedProcess(
    "/usr/bin/flock",
    ["--exclusive", "--nonblock", path, "/usr/bin/true"],
    { cwd, env, timeoutMs: 5_000 },
  );
  if (result.code !== 1) fail("ROLLOUT_LOCK_NOT_HELD");
}

async function assertRolloutLockIdentity(handle, path, expected) {
  let descriptor;
  let pathname;
  try {
    descriptor = await handle.stat();
    pathname = await lstat(path);
  } catch {
    fail("ROLLOUT_LOCK_CHANGED");
  }
  for (const actual of [descriptor, pathname]) {
    if (
      !actual.isFile() || actual.isSymbolicLink() ||
      actual.dev !== expected.device || actual.ino !== expected.inode ||
      actual.uid !== expected.uid || (actual.mode & 0o777) !== expected.mode ||
      actual.nlink !== expected.nlink
    ) fail("ROLLOUT_LOCK_CHANGED");
  }
}

function openDockerWriterEventStream(socketPath, containerId) {
  return new Promise((resolvePromise, rejectPromise) => {
    const filters = encodeURIComponent(JSON.stringify({
      container: [containerId],
      event: ["die", "start", "restart"],
      type: ["container"],
    }));
    const request = httpRequest({
      socketPath,
      path: `/events?filters=${filters}`,
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const handshakeTimer = setTimeout(() => request.destroy(), 10_000);
    request.once("error", () => {
      clearTimeout(handshakeTimer);
      rejectPromise(new AcceptanceError("WRITER_EVENT_STREAM_FAILED"));
    });
    request.once("response", (response) => {
      clearTimeout(handshakeTimer);
      if (response.statusCode !== 200) {
        response.resume();
        rejectPromise(new AcceptanceError("WRITER_EVENT_STREAM_FAILED"));
        return;
      }
      let buffer = "";
      let bytes = 0;
      let endedUnexpectedly = false;
      const events = [];
      const waiters = [];
      const dispatch = (event) => {
        events.push(event);
        for (const waiter of waiters.splice(0)) waiter();
      };
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 1024 * 1024) {
          endedUnexpectedly = true;
          response.destroy();
          return;
        }
        buffer += chunk.toString("utf8");
        while (buffer.includes("\n")) {
          const index = buffer.indexOf("\n");
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          if (!line) continue;
          try {
            dispatch(parseDockerWriterEvent(line));
          } catch {
            endedUnexpectedly = true;
            response.destroy();
            return;
          }
        }
      });
      response.once("end", () => { endedUnexpectedly = true; for (const waiter of waiters.splice(0)) waiter(); });
      response.once("error", () => { endedUnexpectedly = true; for (const waiter of waiters.splice(0)) waiter(); });
      const waitForEvent = async (predicate, timeoutMs) => {
        const deadline = Date.now() + timeoutMs;
        while (true) {
          const found = events.find(predicate);
          if (found) return found;
          if (endedUnexpectedly) fail("WRITER_EVENT_STREAM_FAILED");
          const remaining = deadline - Date.now();
          if (remaining <= 0) fail("WRITER_EVENT_STREAM_TIMEOUT");
          await new Promise((resolveWait) => {
            const timer = setTimeout(resolveWait, remaining);
            waiters.push(() => { clearTimeout(timer); resolveWait(); });
          });
        }
      };
      resolvePromise({
        events,
        streamStartedAt: canonicalUtcNow(),
        waitForEvent,
        close: async () => {
          if (endedUnexpectedly) fail("WRITER_EVENT_STREAM_FAILED");
          response.destroy();
          await new Promise((resolveWait) => response.once("close", resolveWait));
          if (buffer.trim().length > 0) fail("WRITER_EVENT_INVALID");
          return canonicalUtcNow();
        },
      });
    });
    request.end();
  });
}

async function readCanonicalObject(path, code) {
  let bytes;
  try {
    bytes = await readFile(path);
  } catch {
    fail(code);
  }
  if (bytes.length === 0 || bytes.length > 1024 * 1024) fail(code);
  const value = parseStrict(bytes.toString("utf8"), code);
  if (!isPlainObject(value) || !bytes.equals(Buffer.from(canonicalize(value), "utf8"))) fail(code);
  return value;
}

function inspectStoppedWriter(value, { backendContainer, sourceRoot, requireRunning }) {
  if (
    !isPlainObject(value) ||
    value.Id !== backendContainer && value.Name !== `/${backendContainer}` ||
    !HEX_64_PATTERN.test(value.Id ?? "") ||
    !DIGEST_PATTERN.test(value.Image ?? "") ||
    value.State?.Running !== requireRunning
  ) fail("WRITER_CONTAINER_IDENTITY_INVALID");
  const mounts = Array.isArray(value.Mounts) ? value.Mounts : [];
  const dataMount = mounts.filter((mount) => mount?.Destination === "/app/data");
  if (
    dataMount.length !== 1 ||
    dataMount[0].Type !== "bind" ||
    resolve(dataMount[0].Source ?? "") !== sourceRoot ||
    dataMount[0].RW !== true
  ) fail("WRITER_DATA_ROOT_BINDING_INVALID");
  return { containerId: value.Id, imageDigest: value.Image };
}

async function waitForPath(path, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const status = await lstat(path);
      if (!status.isFile() || status.isSymbolicLink() || status.nlink !== 1) fail("WRITER_STOP_SESSION_INVALID");
      return;
    } catch (error) {
      if (error instanceof AcceptanceError) throw error;
      if (error?.code !== "ENOENT") fail("WRITER_STOP_SESSION_INVALID");
    }
    if (Date.now() >= deadline) fail("WRITER_STOP_SESSION_TIMEOUT");
    await new Promise((resolveWait) => setTimeout(resolveWait, 20));
  }
}

async function assertNoSecondWriter(execute, dockerEndpoint, sourceRoot, backendContainer) {
  const listed = await execute(dockerCommand(
    "cold-list-containers",
    dockerEndpoint,
    ["container", "ls", "--all", "--quiet"],
    sourceRoot,
  ));
  const ids = listed.stdout.split(/\s+/).filter(Boolean);
  if (ids.length === 0) fail("WRITER_CONTAINER_IDENTITY_INVALID");
  const inspected = await execute(dockerCommand(
    "cold-inspect-all",
    dockerEndpoint,
    ["container", "inspect", ...ids],
    sourceRoot,
  ));
  const containers = parseStrict(inspected.stdout, "WRITER_CONTAINER_IDENTITY_INVALID");
  if (!Array.isArray(containers) || containers.length !== ids.length) fail("WRITER_CONTAINER_IDENTITY_INVALID");
  for (const container of containers) {
    if (container?.Id === backendContainer || container?.Name === `/${backendContainer}` || container?.State?.Running !== true) continue;
    if ((container.Mounts ?? []).some((mount) => mount?.Type === "bind" && resolve(mount.Source ?? "") === sourceRoot)) {
      fail("SECOND_WRITER_PRESENT");
    }
  }
}

export async function runColdBackupRehearsal({
  backendContainer,
  backupRoot: requestedBackupRoot = null,
  dockerEndpoint,
  environment,
  execute,
  rehearsalRoot: requestedRehearsalRoot = null,
  rolloutLockPath: requestedRolloutLockPath = null,
  runtimePython,
  candidateCommit,
  candidateTree,
  sourceRoot,
  workRoot,
}) {
  assertString(backendContainer, /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/, "COLD_BACKUP_OPTIONS_INVALID");
  validateDockerEndpoint(dockerEndpoint);
  if (typeof execute !== "function" || !isAbsolute(runtimePython) || !isAbsolute(sourceRoot) || !isAbsolute(workRoot)) {
    fail("COLD_BACKUP_OPTIONS_INVALID");
  }
  const socketPath = dockerEndpoint.slice("unix://".length);
  const runnerSessionId = randomUUID();
  const eventStreamSessionId = randomUUID();
  if (!SHA_PATTERN.test(candidateCommit ?? "") || !SHA_PATTERN.test(candidateTree ?? "")) {
    fail("RUNNER_PROCESS_IDENTITY_INVALID");
  }
  const runnerProcessIdentity = await currentRunnerProcessIdentity(candidateCommit, candidateTree);
  const sessionRoot = resolve(workRoot, `writer-stop-session-${runnerSessionId}`);
  const rolloutRoot = requestedRolloutLockPath === null
    ? resolve(workRoot, "rollout-lock")
    : dirname(requestedRolloutLockPath);
  const backupRoot = requestedBackupRoot === null
    ? resolve(workRoot, "cold-backup")
    : resolve(requestedBackupRoot);
  const rehearseRoot = requestedRehearsalRoot === null
    ? resolve(workRoot, "cold-rehearsed")
    : resolve(requestedRehearsalRoot);
  await mkdir(sessionRoot, { mode: 0o700 });
  if (requestedRolloutLockPath === null) await mkdir(rolloutRoot, { mode: 0o700 });
  const lockPath = requestedRolloutLockPath === null
    ? resolve(rolloutRoot, "release.lock")
    : resolve(requestedRolloutLockPath);
  const lockHandle = await open(
    lockPath,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_RDWR |
      fsConstants.O_NOFOLLOW | fsConstants.O_CLOEXEC,
    0o600,
  );
  const lockStatus = await lockHandle.stat();
  const lockIdentityBase = {
    device: lockStatus.dev,
    inode: lockStatus.ino,
    uid: lockStatus.uid,
    mode: lockStatus.mode & 0o777,
    nlink: lockStatus.nlink,
  };
  if (
    !Object.values(lockIdentityBase).every(Number.isSafeInteger) ||
    lockIdentityBase.uid !== (typeof process.geteuid === "function" ? process.geteuid() : lockIdentityBase.uid) ||
    lockIdentityBase.mode !== 0o600 ||
    lockIdentityBase.nlink !== 1
  ) fail("ROLLOUT_LOCK_INVALID");
  const rolloutLockIdentity = {
    ...lockIdentityBase,
    lockDigest: canonicalDigest({
      schemaVersion: "chaotang.rollout-lock-identity.v1",
      runnerSessionId,
      ...lockIdentityBase,
    }),
  };
  const lock = spawnHeldLock(lockHandle.fd, workRoot, environment);
  const backupAbort = new AbortController();
  let eventStream = null;
  try {
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    if (lock.child.exitCode !== null) fail("ROLLOUT_LOCK_ACQUIRE_FAILED");
    await assertHeldLock(lockPath, workRoot, environment);
    await assertRolloutLockIdentity(lockHandle, lockPath, lockIdentityBase);
    const beforeInspectResult = await execute(dockerCommand(
      "cold-inspect-writer-before",
      dockerEndpoint,
      ["container", "inspect", backendContainer],
      workRoot,
    ));
    const beforeInspect = parseOneObject(beforeInspectResult.stdout, "WRITER_CONTAINER_IDENTITY_INVALID");
    const writer = inspectStoppedWriter(beforeInspect, { backendContainer, sourceRoot, requireRunning: true });
    const retentionBefore = parseOneObject((await execute(dockerCommand(
      "cold-retention-probe-before",
      dockerEndpoint,
      ["exec", backendContainer, "python", "-m", "app.operations.sqlite_backup", "probe-synthetic-retention", "--root", "/app/data"],
      workRoot,
    ))).stdout, "COLD_RETENTION_PROBE_INVALID");
    if (
      !hasExactKeys(retentionBefore, ["retentionDigest", "schemaVersion"]) ||
      retentionBefore.schemaVersion !== "chaotang.rc1-retention-probe.v1" ||
      !DIGEST_PATTERN.test(retentionBefore.retentionDigest ?? "")
    ) fail("COLD_RETENTION_PROBE_INVALID");
    const daemonVersionResult = await execute(dockerCommand(
      "cold-daemon-version",
      dockerEndpoint,
      ["version", "--format", "{{json .Server}}"],
      workRoot,
    ));
    const daemonInfoResult = await execute(dockerCommand(
      "cold-daemon-info",
      dockerEndpoint,
      ["info", "--format", "{{json .}}"],
      workRoot,
    ));
    const daemonVersion = parseOneObject(daemonVersionResult.stdout, "DOCKER_DAEMON_IDENTITY_INVALID");
    const daemonInfo = parseOneObject(daemonInfoResult.stdout, "DOCKER_DAEMON_IDENTITY_INVALID");
    const daemonIdentity = {
      apiVersion: daemonVersion.ApiVersion,
      daemonId: daemonInfo.ID,
    };
    if (!Object.values(daemonIdentity).every((value) => typeof value === "string" && value.length > 0 && value.length <= 128)) {
      fail("DOCKER_DAEMON_IDENTITY_INVALID");
    }
    eventStream = await openDockerWriterEventStream(socketPath, writer.containerId);
    await execute(dockerCommand(
      "cold-stop-writer",
      dockerEndpoint,
      ["container", "stop", "--time", "30", backendContainer],
      workRoot,
    ));
    const die = await eventStream.waitForEvent(
      (event) => event.action === "die" && event.containerId === writer.containerId,
      30_000,
    );
    const stoppedResult = await execute(dockerCommand(
      "cold-inspect-writer-stopped",
      dockerEndpoint,
      ["container", "inspect", backendContainer],
      workRoot,
    ));
    const stopped = parseOneObject(stoppedResult.stdout, "WRITER_CONTAINER_IDENTITY_INVALID");
    const stoppedWriter = inspectStoppedWriter(stopped, { backendContainer, sourceRoot, requireRunning: false });
    if (canonicalize(stoppedWriter) !== canonicalize(writer)) fail("WRITER_CONTAINER_IDENTITY_CHANGED");
    await assertNoSecondWriter(execute, dockerEndpoint, sourceRoot, writer.containerId);
    const sourceStatus = await lstat(sourceRoot);
    if (!sourceStatus.isDirectory() || sourceStatus.isSymbolicLink()) fail("WRITER_DATA_ROOT_BINDING_INVALID");
    const dataRootIdentity = { device: sourceStatus.dev, inode: sourceStatus.ino, type: "DIRECTORY" };
    if (!Number.isSafeInteger(dataRootIdentity.device) || !Number.isSafeInteger(dataRootIdentity.inode)) {
      fail("WRITER_DATA_ROOT_BINDING_INVALID");
    }
    const observedAtBefore = canonicalUtcNow();
    const event = {
      containerId: writer.containerId,
      imageDigest: writer.imageDigest,
      action: "die",
      timeNano: die.timeNano,
    };
    const expectedStopEvent = {
      ...event,
      eventDigest: canonicalDigest({ schemaVersion: "chaotang.docker-writer-event.v1", ...event }),
    };
    const before = {
      schemaVersion: "chaotang.writer-stop-before.v1",
      runnerSessionId,
      backendContainerId: writer.containerId,
      backendImageDigest: writer.imageDigest,
      rolloutLockIdentity,
      runnerProcessIdentity,
      eventStreamSessionId,
      daemonIdentity,
      streamStartedAt: eventStream.streamStartedAt,
      expectedStopEvent,
      stoppedWatermark: die.timeNano,
      stateBefore: "STOPPED",
      observedAtBefore,
      dataRootIdentityBefore: dataRootIdentity,
    };
    before.beforeDigest = canonicalDigest(before);
    await writeFile(resolve(sessionRoot, "before.json"), Buffer.from(canonicalize(before)), { flag: "wx", mode: 0o600 });
    const backupPromise = runBoundedProcess(
      runtimePython,
      ["-m", "app.operations.sqlite_backup", "backup", "--source", sourceRoot, "--destination", backupRoot, "--mode", "COLD_RELEASE", "--writer-stop-session", sessionRoot],
      { cwd: workRoot, env: environment, signal: backupAbort.signal },
    );
    const earlyBackupExit = backupPromise.then((result) => {
      fail(result.code === 0 ? "COLD_BACKUP_EARLY_EXIT" : "COLD_BACKUP_PROCESS_FAILED");
    });
    await Promise.race([
      waitForPath(resolve(sessionRoot, "capture.json")),
      earlyBackupExit,
    ]);
    const capture = await readCanonicalObject(resolve(sessionRoot, "capture.json"), "WRITER_STOP_SESSION_INVALID");
    if (
      capture.schemaVersion !== "chaotang.writer-stop-capture.v1" ||
      capture.sourceRootIdentity?.device !== dataRootIdentity.device ||
      capture.sourceRootIdentity?.inode !== dataRootIdentity.inode ||
      capture.sourceRootIdentity?.type !== "DIRECTORY" ||
      capture.captureDigest !== canonicalDigest({
        schemaVersion: capture.schemaVersion,
        captureCompletedAt: capture.captureCompletedAt,
        sourceRootIdentity: capture.sourceRootIdentity,
      })
    ) fail("WRITER_STOP_SESSION_INVALID");
    const afterInspectResult = await execute(dockerCommand(
      "cold-inspect-writer-after",
      dockerEndpoint,
      ["container", "inspect", backendContainer],
      workRoot,
    ));
    const afterInspect = parseOneObject(afterInspectResult.stdout, "WRITER_CONTAINER_IDENTITY_INVALID");
    const afterWriter = inspectStoppedWriter(afterInspect, { backendContainer, sourceRoot, requireRunning: false });
    if (canonicalize(afterWriter) !== canonicalize(writer)) fail("WRITER_CONTAINER_IDENTITY_CHANGED");
    const daemonVersionAfter = parseOneObject((await execute(dockerCommand(
      "cold-daemon-version-after",
      dockerEndpoint,
      ["version", "--format", "{{json .Server}}"],
      workRoot,
    ))).stdout, "DOCKER_DAEMON_IDENTITY_INVALID");
    const daemonInfoAfter = parseOneObject((await execute(dockerCommand(
      "cold-daemon-info-after",
      dockerEndpoint,
      ["info", "--format", "{{json .}}"],
      workRoot,
    ))).stdout, "DOCKER_DAEMON_IDENTITY_INVALID");
    if (
      daemonVersionAfter.ApiVersion !== daemonIdentity.apiVersion ||
      daemonInfoAfter.ID !== daemonIdentity.daemonId
    ) fail("DOCKER_DAEMON_IDENTITY_CHANGED");
    await assertNoSecondWriter(execute, dockerEndpoint, sourceRoot, writer.containerId);
    await assertHeldLock(lockPath, workRoot, environment);
    await assertRolloutLockIdentity(lockHandle, lockPath, lockIdentityBase);
    const observedAtAfter = canonicalUtcNow();
    const recordedEvents = eventStream.events;
    const streamCompletedAt = await eventStream.close();
    eventStream = null;
    const postStopWriterEvents = recordedEvents.filter((item) => (
      item !== die && ["die", "start", "restart"].includes(item.action)
    ));
    if (postStopWriterEvents.length !== 0) fail("WRITER_RESTARTED_DURING_BACKUP");
    const final = {
      schemaVersion: "chaotang.writer-stop-evidence.v1",
      runnerSessionId,
      backendContainerId: writer.containerId,
      backendImageDigest: writer.imageDigest,
      rolloutLockIdentity,
      eventStreamSessionId,
      daemonIdentity,
      streamStartedAt: before.streamStartedAt,
      expectedStopEvent,
      stoppedWatermark: die.timeNano,
      streamCompletedAt,
      postStopWriterEvents: [],
      stateBefore: "STOPPED",
      observedAtBefore,
      stateAfter: "STOPPED",
      observedAtAfter,
      dataRootIdentityBefore: dataRootIdentity,
      dataRootIdentityAfter: dataRootIdentity,
    };
    final.evidenceDigest = canonicalDigest(final);
    await writeFile(resolve(sessionRoot, "final.json"), Buffer.from(canonicalize(final)), { flag: "wx", mode: 0o600 });
    const backupResult = await backupPromise;
    if (backupResult.code !== 0) fail("COLD_BACKUP_PROCESS_FAILED");
    const backup = parseOneObject(backupResult.stdout, "COLD_BACKUP_RESULT_INVALID");
    if (!HEX_64_PATTERN.test(backup.manifestSha256 ?? "") || !DIGEST_PATTERN.test(backup.sourceSnapshotIdentity ?? "")) {
      fail("COLD_BACKUP_RESULT_INVALID");
    }
    const verified = await runBoundedProcess(
      runtimePython,
      ["-m", "app.operations.sqlite_backup", "verify", "--backup", backupRoot],
      { cwd: workRoot, env: environment },
    );
    if (verified.code !== 0) fail("COLD_BACKUP_VERIFY_FAILED");
    const verification = parseOneObject(verified.stdout, "COLD_BACKUP_VERIFY_FAILED");
    if (verification.sourceSnapshotIdentity !== backup.sourceSnapshotIdentity) fail("COLD_BACKUP_VERIFY_FAILED");
    const rehearsed = await runBoundedProcess(
      runtimePython,
      ["-m", "app.operations.sqlite_backup", "rehearse", "--backup", backupRoot, "--destination", rehearseRoot],
      { cwd: workRoot, env: environment },
    );
    if (rehearsed.code !== 0) fail("COLD_BACKUP_REHEARSE_FAILED");
    const rehearsal = parseOneObject(rehearsed.stdout, "COLD_BACKUP_REHEARSE_FAILED");
    if (rehearsal.sourceSnapshotIdentity !== backup.sourceSnapshotIdentity) fail("COLD_BACKUP_REHEARSE_FAILED");
    await assertHeldLock(lockPath, workRoot, environment);
    await assertRolloutLockIdentity(lockHandle, lockPath, lockIdentityBase);
    await execute(dockerCommand(
      "cold-restart-writer",
      dockerEndpoint,
      ["container", "start", backendContainer],
      workRoot,
    ));
    await execute(dockerCommand(
      "cold-health-writer-after-restart",
      dockerEndpoint,
      ["exec", backendContainer, "python", "-c", "import time,urllib.request\nfor i in range(60):\n try:\n  assert urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=2).status==200;break\n except Exception:\n  time.sleep(.5)\nelse: raise SystemExit(1)"],
      workRoot,
    ));
    const retentionAfter = parseOneObject((await execute(dockerCommand(
      "cold-retention-probe-after",
      dockerEndpoint,
      ["exec", backendContainer, "python", "-m", "app.operations.sqlite_backup", "probe-synthetic-retention", "--root", "/app/data"],
      workRoot,
    ))).stdout, "COLD_RETENTION_PROBE_INVALID");
    if (canonicalize(retentionAfter) !== canonicalize(retentionBefore)) fail("COLD_RETENTION_PROBE_DRIFT");
    return validateColdBackupResult({
      schemaVersion: "chaotang.rc1-cold-backup-result.v1",
      manifestSha256: `sha256:${backup.manifestSha256}`,
      sourceSnapshotIdentity: backup.sourceSnapshotIdentity,
      restoredSnapshotIdentity: rehearsal.sourceSnapshotIdentity,
      writerStopEvidenceDigest: final.evidenceDigest,
      retentionProbeDigest: retentionBefore.retentionDigest,
      backendRestarted: true,
      networkRequests: 0,
    });
  } finally {
    backupAbort.abort();
    if (eventStream !== null) {
      try { await eventStream.close(); } catch { /* cleanup only */ }
    }
    lock.child.kill("SIGTERM");
    await new Promise((resolveWait) => {
      if (lock.child.exitCode !== null) resolveWait();
      else lock.child.once("close", resolveWait);
    });
    await lockHandle.close();
  }
}

export function buildAcceptancePlan(rawOptions, workRoot = null) {
  const options = validateAcceptanceOptions(rawOptions);
  const root = options.repositoryRoot;
  const work = workRoot ? resolve(workRoot) : resolve(options.evidenceDir, "work-001");
  const buildSource = resolve(work, "build-source");
  const isolationRoot = isolationRootFor(options, work);
  const testSource = resolve(isolationRoot, "test-source");
  const installSource = resolve(isolationRoot, "install-source");
  const untrustedWork = resolve(isolationRoot, "work");
  const testRuntimeRoot = resolve(isolationRoot, "test-runtime");
  const runtimeRoot = resolve(isolationRoot, "runtime");
  const wheelRoot = resolve(isolationRoot, "wheel");
  const testPython = resolve(testRuntimeRoot, "backend-test-venv/bin/python");
  const builderPython = resolve(runtimeRoot, "builder-venv/bin/python");
  const runtimePython = resolve(runtimeRoot, "backend-runtime-venv/bin/python");
  const tag = options.candidateCommit.slice(0, 12);
  const backendTag = `chaotang-backend:${tag}`;
  const frontendTag = `chaotang-frontend:${tag}`;
  const created = sourceCreated(options.sourceDateEpoch);
  const buildArgs = [
    "--platform", "linux/amd64", "--load", "--provenance=mode=max",
    "--build-arg", `SOURCE_REVISION=${options.candidateCommit}`,
    "--build-arg", `SOURCE_TREE=${options.candidateTree}`,
    "--build-arg", `SOURCE_CREATED=${created}`,
    "--label", `org.opencontainers.image.revision=${options.candidateCommit}`,
    "--label", `io.chaotang.source.tree=${options.candidateTree}`,
    "--label", `org.opencontainers.image.created=${created}`,
  ];
  const backendBuildArgs = [
    ...buildArgs,
    "--build-context", `backend-wheelhouse=${BACKEND_WHEELHOUSE}`,
  ];
  const refs = Object.fromEntries(Object.entries(PINNED_POLICY.images).map(([name, value]) => [name, value.reference]));
  const scannerMount = `${resolve(work, "images")}:/work:rw`;
  const grypeCacheMount = `${resolve(work, "grype-db")}:/var/lib/grype:rw`;
  const plan = [
    command("git-status", "/usr/bin/git", [...CLOSED_GIT_OPTIONS, "status", "--porcelain=v1", "--untracked-files=all"], root),
    command("git-head", "/usr/bin/git", [...CLOSED_GIT_OPTIONS, "rev-parse", "HEAD"], root),
    command("git-tree", "/usr/bin/git", [...CLOSED_GIT_OPTIONS, "rev-parse", "HEAD^{tree}"], root),
    command("git-parent-line", "/usr/bin/git", [...CLOSED_GIT_OPTIONS, "rev-list", "--parents", "-n", "1", "HEAD"], root),
    command("git-source-epoch", "/usr/bin/git", [...CLOSED_GIT_OPTIONS, "show", "-s", "--format=%ct", "HEAD"], root),
    command("git-product-paths", "/usr/bin/git", [...CLOSED_GIT_OPTIONS, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], root),
    command("approval-parent", "/usr/bin/git", [...CLOSED_GIT_OPTIONS, "show", `HEAD^:${APPROVAL_PATH}`], root),
    command("policy-parent", "/usr/bin/git", [...CLOSED_GIT_OPTIONS, "show", `HEAD^:${TASK_PATH}`], root),
    command("git-archive-test-source", "/usr/bin/git", [...CLOSED_GIT_OPTIONS, "archive", "--format=tar", `--output=${resolve(work, "test-source.tar")}`, options.candidateCommit], root),
    command("extract-test-source", "/usr/bin/tar", ["--extract", "--file", resolve(work, "test-source.tar"), "--directory", testSource, "--no-same-owner", "--no-same-permissions"], root),
    command("extract-install-source", "/usr/bin/tar", ["--extract", "--file", resolve(work, "test-source.tar"), "--directory", installSource, "--no-same-owner", "--no-same-permissions"], root),
    command("time-sync", "/usr/bin/timedatectl", ["show", "--property=NTPSynchronized", "--value"], root),
    command("docker-context", "/usr/bin/docker", ["--context", options.dockerContext, "context", "inspect", options.dockerContext], root),
    dockerCommand("docker-version", options.dockerEndpoint, ["version", "--format", "{{json .}}"], root),
    dockerCommand("buildx-version", options.dockerEndpoint, ["buildx", "version"], root),
    dockerCommand("daemon-containers-before", options.dockerEndpoint, ["container", "ls", "--all", "--quiet"], root),
    dockerCommand("daemon-networks-before", options.dockerEndpoint, ["network", "ls", "--quiet"], root),
    dockerCommand("buildx-inspect", options.dockerEndpoint, ["buildx", "inspect", "--bootstrap", "--format", "{{json .}}"], root),
    command("node-version", "/usr/bin/node", ["--version"], root),
    command("npm-version", "/usr/bin/npm", ["--version"], root),
    command("python-version", "/usr/bin/python3", ["--version"], root),
    command("unshare-version", "/usr/bin/unshare", ["--version"], root),
    command("setpriv-version", "/usr/bin/setpriv", ["--version"], root),
    dockerCommand("caddy-version", options.dockerEndpoint, ["run", "--rm", "--network", "none", refs.caddy, "version"], root),
    dockerCommand("syft-version", options.dockerEndpoint, ["run", "--rm", "--network", "none", refs.syft, "version"], root),
    dockerCommand("grype-version", options.dockerEndpoint, ["run", "--rm", "--network", "none", refs.grype, "version"], root),
    command("host-listeners-before", "/usr/bin/ss", ["-H", "-ltnp"], root),
    command("host-processes-before", "/usr/bin/ps", ["-eo", "pid=,ppid=,comm=,args="], root),
    command("root-harness", process.execPath, ["scripts/check_harness.mjs"], root),
    command("deployment-check", process.execPath, ["scripts/check_deployment.mjs"], root),
    untrustedCommand("frontend-clean-install", "/usr/bin/npm", ["ci", "--ignore-scripts"], resolve(installSource, "frontend")),
    untrustedCommand("frontend-audit", "/usr/bin/npm", ["audit", "--omit=dev", "--audit-level=high", "--json"], resolve(testSource, "frontend")),
    untrustedCommand("frontend-lint", "/usr/bin/npm", ["run", "lint"], resolve(testSource, "frontend")),
    untrustedCommand("frontend-typecheck", "/usr/bin/npm", ["run", "typecheck"], resolve(testSource, "frontend")),
    untrustedCommand("frontend-test", "/usr/bin/npm", ["test"], resolve(testSource, "frontend")),
    untrustedCommand("frontend-build", "/usr/bin/npm", ["run", "build"], resolve(testSource, "frontend")),
    untrustedCommand("backend-builder-venv", "/usr/bin/python3", ["-m", "venv", "--copies", resolve(runtimeRoot, "builder-venv")], testSource),
    untrustedCommand("backend-builder-lock-prepare", "/usr/bin/python3", ["-I", resolve(testSource, "backend/app/operations/runtime_lock.py"), "prepare-install", "--lock", resolve(testSource, "backend/requirements-runtime.lock"), "--wheelhouse", BACKEND_WHEELHOUSE, "--pyproject", resolve(testSource, "backend/pyproject.toml"), "--output-dir", resolve(runtimeRoot, "requirements")], testSource),
    untrustedCommand("backend-builder-lock-install", builderPython, ["-I", "-m", "pip", "install", "--isolated", "--no-cache-dir", "--no-index", "--require-hashes", "--no-deps", "--only-binary=:all:", "--find-links", BACKEND_WHEELHOUSE, "-r", resolve(runtimeRoot, "requirements/build.txt")], testSource),
    untrustedCommand("backend-runtime-wheel", builderPython, ["-I", "-m", "pip", "wheel", "--isolated", "--no-cache-dir", "--no-index", "--no-build-isolation", "--no-deps", "--wheel-dir", wheelRoot, resolve(testSource, "backend")], testSource),
    untrustedCommand("backend-test-venv", "/usr/bin/python3", ["-m", "venv", "--copies", resolve(testRuntimeRoot, "backend-test-venv")], testSource),
    untrustedCommand("backend-test-lock-prepare", "/usr/bin/python3", ["-I", resolve(testSource, "backend/app/operations/runtime_lock.py"), "prepare-install", "--lock", resolve(testSource, "backend/requirements-runtime.lock"), "--wheelhouse", BACKEND_WHEELHOUSE, "--pyproject", resolve(testSource, "backend/pyproject.toml"), "--output-dir", resolve(testRuntimeRoot, "requirements")], testSource),
    untrustedCommand("backend-test-lock-install", testPython, ["-I", "-m", "pip", "install", "--isolated", "--no-cache-dir", "--no-index", "--require-hashes", "--no-deps", "--only-binary=:all:", "--find-links", BACKEND_WHEELHOUSE, "-r", resolve(testRuntimeRoot, "requirements/test.txt")], testSource),
    untrustedCommand("backend-test-app-install", testPython, ["-I", "-m", "pip", "install", "--isolated", "--no-cache-dir", "--no-index", "--no-deps", resolve(wheelRoot, "chaotang_os_backend-0.1.0-py3-none-any.whl")], testSource),
    untrustedCommand("backend-tests", testPython, ["-I", "-P", "-m", "pytest", "-q", "-p", "no:cacheprovider", "-c", "/dev/null", "--rootdir", untrustedWork, "--import-mode=importlib", resolve(testSource, "backend/tests")], untrustedWork),
    untrustedCommand("backend-ruff", resolve(testRuntimeRoot, "backend-test-venv/bin/ruff"), ["check", resolve(testSource, "backend/app"), resolve(testSource, "backend/tests")], untrustedWork),
    untrustedCommand("backend-runtime-venv", "/usr/bin/python3", ["-m", "venv", "--copies", resolve(runtimeRoot, "backend-runtime-venv")], testSource),
    untrustedCommand("backend-runtime-lock-prepare", "/usr/bin/python3", ["-I", resolve(testSource, "backend/app/operations/runtime_lock.py"), "prepare-install", "--lock", resolve(testSource, "backend/requirements-runtime.lock"), "--wheelhouse", BACKEND_WHEELHOUSE, "--pyproject", resolve(testSource, "backend/pyproject.toml"), "--output-dir", resolve(runtimeRoot, "requirements")], testSource),
    untrustedCommand("backend-runtime-lock-install", runtimePython, ["-I", "-m", "pip", "install", "--isolated", "--no-cache-dir", "--no-index", "--require-hashes", "--no-deps", "--only-binary=:all:", "--find-links", BACKEND_WHEELHOUSE, "-r", resolve(runtimeRoot, "requirements/runtime.txt")], testSource),
    untrustedCommand("backend-runtime-app-install", runtimePython, ["-I", "-m", "pip", "install", "--isolated", "--no-cache-dir", "--no-index", "--no-deps", resolve(wheelRoot, "chaotang_os_backend-0.1.0-py3-none-any.whl")], testSource),
    untrustedCommand("backend-runtime-contract", runtimePython, ["-c", "from importlib.metadata import version\nfrom fastapi.testclient import TestClient\nfrom app.main import app\nassert version('chaotang-os-backend') == '0.1.0'\nr=TestClient(app).get('/health')\nassert r.status_code == 200 and r.json()['version'] == '0.1.0'"], untrustedWork),
    command("git-archive-build-source", "/usr/bin/git", [...CLOSED_GIT_OPTIONS, "archive", "--format=tar", `--output=${resolve(work, "build-source.tar")}`, options.candidateCommit], root),
    command("extract-build-source", "/usr/bin/tar", ["--extract", "--file", resolve(work, "build-source.tar"), "--directory", buildSource, "--no-same-owner", "--no-same-permissions"], root),
    dockerCommand("build-backend", options.dockerEndpoint, ["buildx", "build", ...backendBuildArgs, "--output", `type=oci,dest=${imagePaths(work, "backend").archive},compression=gzip,compression-level=6,force-compression=true`, "--metadata-file", resolve(work, "metadata/backend.json"), "--tag", backendTag, resolve(buildSource, "backend")], root),
    dockerCommand("build-frontend", options.dockerEndpoint, ["buildx", "build", ...buildArgs, "--output", `type=oci,dest=${imagePaths(work, "frontend").archive},compression=gzip,compression-level=6,force-compression=true`, "--metadata-file", resolve(work, "metadata/frontend.json"), "--tag", frontendTag, resolve(buildSource, "frontend")], root),
    dockerCommand("pull-caddy", options.dockerEndpoint, ["pull", "--platform", "linux/amd64", refs.caddy], root),
    dockerCommand("inspect-backend", options.dockerEndpoint, ["image", "inspect", backendTag], root),
    dockerCommand("inspect-frontend", options.dockerEndpoint, ["image", "inspect", frontendTag], root),
    dockerCommand("inspect-caddy", options.dockerEndpoint, ["image", "inspect", refs.caddy], root),
  ];
  for (const name of IMAGE_ORDER) {
    const paths = imagePaths(work, name);
    plan.push(dockerCommand(`syft-${name}`, options.dockerEndpoint, ["run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "-e", `SOURCE_DATE_EPOCH=${options.sourceDateEpoch}`, "-v", scannerMount, refs.syft, `file:/work/${name}.oci.tar`, "-o", `cyclonedx-json=/work/${name}.sbom.json`], root));
    plan.push(dockerCommand(`grype-${name}`, options.dockerEndpoint, ["run", "--rm", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev", "-e", "GRYPE_DB_CACHE_DIR=/var/lib/grype", "-v", scannerMount, "-v", grypeCacheMount, refs.grype, `sbom:/work/${name}.sbom.json`, "-o", "json"], root));
  }
  for (const name of BASE_SCAN_NAMES) {
    plan.push(dockerCommand(`syft-base-${name}`, options.dockerEndpoint, ["run", "--rm", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev", "-e", `SOURCE_DATE_EPOCH=${options.sourceDateEpoch}`, "-v", scannerMount, refs.syft, `registry:${refs[name]}`, "-o", `cyclonedx-json=/work/base-${name}.sbom.json`], root));
    plan.push(dockerCommand(`grype-base-${name}`, options.dockerEndpoint, ["run", "--rm", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev", "-e", "GRYPE_DB_CACHE_DIR=/var/lib/grype", "-v", scannerMount, "-v", grypeCacheMount, refs.grype, `sbom:/work/base-${name}.sbom.json`, "-o", "json"], root));
  }
  plan.push(
    dockerCommand("grype-db-status", options.dockerEndpoint, ["run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev", "-e", "GRYPE_DB_CACHE_DIR=/var/lib/grype", "-v", grypeCacheMount, refs.grype, "db", "status", "-o", "json"], root),
    command("bundle-build", process.execPath, [
      "scripts/build_offline_release.mjs",
      "--descriptor", resolve(work, "release-input.json"),
      "--expectation", resolve(work, "release-expectation.json"),
      "--output", resolve(work, "bundle"),
      "--phase", resolve(work, "release-phase.json"),
      "--repository", root,
      "--snapshot-output", resolve(work, "verified-bundle"),
    ], root),
    dockerCommand("remove-build-tag-backend", options.dockerEndpoint, ["image", "rm", "--force", backendTag], root),
    dockerCommand("remove-build-tag-frontend", options.dockerEndpoint, ["image", "rm", "--force", frontendTag], root),
    dockerCommand("remove-prebundle-backend", options.dockerEndpoint, ["image", "rm", "--force", "__BUNDLE_BACKEND_IMAGE__"], root, [0, 1]),
    dockerCommand("remove-prebundle-caddy", options.dockerEndpoint, ["image", "rm", "--force", "__BUNDLE_CADDY_IMAGE__"], root, [0, 1]),
    dockerCommand("remove-prebundle-frontend", options.dockerEndpoint, ["image", "rm", "--force", "__BUNDLE_FRONTEND_IMAGE__"], root, [0, 1]),
    dockerCommand("assert-prebundle-absent-backend", options.dockerEndpoint, ["image", "inspect", "__BUNDLE_BACKEND_IMAGE__"], root, [1]),
    dockerCommand("assert-prebundle-absent-caddy", options.dockerEndpoint, ["image", "inspect", "__BUNDLE_CADDY_IMAGE__"], root, [1]),
    dockerCommand("assert-prebundle-absent-frontend", options.dockerEndpoint, ["image", "inspect", "__BUNDLE_FRONTEND_IMAGE__"], root, [1]),
    dockerCommand("import-bundle-backend", options.dockerEndpoint, ["image", "load", "--input", resolve(work, "verified-bundle/images/backend.oci.tar")], root),
    dockerCommand("import-bundle-caddy", options.dockerEndpoint, ["image", "load", "--input", resolve(work, "verified-bundle/images/caddy.oci.tar")], root),
    dockerCommand("import-bundle-frontend", options.dockerEndpoint, ["image", "load", "--input", resolve(work, "verified-bundle/images/frontend.oci.tar")], root),
    dockerCommand("inspect-imported-backend", options.dockerEndpoint, ["image", "inspect", "__BUNDLE_BACKEND_IMAGE__"], root),
    dockerCommand("inspect-imported-caddy", options.dockerEndpoint, ["image", "inspect", "__BUNDLE_CADDY_IMAGE__"], root),
    dockerCommand("inspect-imported-frontend", options.dockerEndpoint, ["image", "inspect", "__BUNDLE_FRONTEND_IMAGE__"], root),
    untrustedCommand("sqlite-backup", runtimePython, ["-m", "app.operations.sqlite_backup", "synthetic", "--root", resolve(untrustedWork, "sqlite-rehearsal")], untrustedWork),
    untrustedCommand("sqlite-smoke-seed", runtimePython, ["-m", "app.operations.sqlite_backup", "rehearse", "--backup", resolve(untrustedWork, "sqlite-rehearsal/backup"), "--destination", resolve(untrustedWork, "smoke-stage/data")], untrustedWork),
  );
  const smoke = smokeNames(options, work);
  plan.push(
    dockerCommand("smoke-network", options.dockerEndpoint, ["network", "create", "--internal", "--label", `io.chaotang.acceptance.owner=${smoke.ownership}`, smoke.network], root),
    dockerCommand("smoke-backend", options.dockerEndpoint, ["run", "--pull=never", "--detach", "--name", smoke.backend, "--label", `io.chaotang.acceptance.owner=${smoke.ownership}`, "--network", smoke.network, "--network-alias", "backend", "--read-only", "--user", "10002:10002", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev", "--mount", `type=bind,src=${resolve(work, "smoke-data")},dst=/app/data`, "__BUNDLE_BACKEND_IMAGE__"], root),
    dockerCommand("smoke-frontend", options.dockerEndpoint, ["run", "--pull=never", "--detach", "--name", smoke.frontend, "--label", `io.chaotang.acceptance.owner=${smoke.ownership}`, "--network", smoke.network, "--network-alias", "frontend", "--read-only", "--user", "10001:10001", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev", "-e", "BACKEND_BASE_URL=http://backend:8000", "__BUNDLE_FRONTEND_IMAGE__"], root),
    dockerCommand("smoke-caddy", options.dockerEndpoint, ["run", "--pull=never", "--detach", "--name", smoke.caddy, "--label", `io.chaotang.acceptance.owner=${smoke.ownership}`, "--network", smoke.network, "--network-alias", "caddy", "--read-only", "--user", "10003:10003", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev", "--tmpfs", "/data:rw,noexec,nosuid,nodev", "--tmpfs", "/config:rw,noexec,nosuid,nodev", "-v", `${resolve(work, "verified-bundle/deploy/Caddyfile")}:/etc/caddy/Caddyfile:ro`, "__BUNDLE_CADDY_IMAGE__"], root),
    dockerCommand("health-backend", options.dockerEndpoint, ["exec", smoke.backend, "python", "-c", "import time,urllib.request\nfor i in range(60):\n try:\n  assert urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=2).status==200;break\n except Exception:\n  time.sleep(.5)\nelse: raise SystemExit(1)"], root),
    dockerCommand("health-frontend", options.dockerEndpoint, ["exec", smoke.frontend, "node", "-e", "let n=0;async function p(){try{let r=await fetch('http://127.0.0.1:3000/');if(r.ok)return}catch{}if(++n===60)process.exit(1);setTimeout(p,500)}p()"], root),
    dockerCommand("health-caddy", options.dockerEndpoint, ["exec", smoke.caddy, "caddy", "validate", "--config", "/etc/caddy/Caddyfile"], root),
    dockerCommand("health-edge", options.dockerEndpoint, ["exec", smoke.backend, "python", "-c", "import time,urllib.request\nfor i in range(60):\n try:\n  assert urllib.request.urlopen('http://caddy:8080/',timeout=2).status==200;break\n except Exception:\n  time.sleep(.5)\nelse: raise SystemExit(1)"], root),
    dockerCommand("inspect-smoke", options.dockerEndpoint, ["container", "inspect", smoke.backend, smoke.caddy, smoke.frontend], root),
    untrustedCommand("integration", "/usr/bin/node", ["scripts/verify_integration.mjs"], testSource),
    untrustedCommand("accounting", runtimePython, ["backend/tests/run_accounting_synthetic_acceptance.py", "--rounds", "1"], testSource),
    command("git-status-after", "/usr/bin/git", [...CLOSED_GIT_OPTIONS, "status", "--porcelain=v1", "--untracked-files=all"], root),
    command("git-head-after", "/usr/bin/git", [...CLOSED_GIT_OPTIONS, "rev-parse", "HEAD"], root),
    command("git-tree-after", "/usr/bin/git", [...CLOSED_GIT_OPTIONS, "rev-parse", "HEAD^{tree}"], root),
    command("host-listeners-after", "/usr/bin/ss", ["-H", "-ltnp"], root),
    command("host-processes-after", "/usr/bin/ps", ["-eo", "pid=,ppid=,comm=,args="], root),
  );
  return plan;
}

export async function defaultExecutor(tool, args, options) {
  return new Promise((resolvePromise) => {
    const invocation = options.isolation === null || options.isolation === undefined
      ? { tool, args }
      : isolatedInvocation(tool, args, options.isolation);
    const child = spawn(invocation.tool, invocation.args, {
      cwd: options.cwd,
      detached: true,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const limit = 128 * 1024 * 1024;
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let failure = null;
    let timer = null;
    const killProcessGroup = () => {
      try {
        if (Number.isSafeInteger(child.pid)) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {
        try { child.kill("SIGKILL"); } catch {}
      }
    };
    const abort = () => {
      failure = "COMMAND_ABORTED";
      killProcessGroup();
    };
    const finish = (code) => {
      if (settled) return;
      settled = true;
      killProcessGroup();
      if (timer !== null) clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      resolvePromise({
        code: failure ? -1 : code ?? -1,
        stdout: Buffer.concat(stdout, stdoutBytes).toString("utf8"),
        stderr: failure ?? Buffer.concat(stderr, stderrBytes).toString("utf8"),
      });
    };
    const collect = (target, chunk, current, streamName) => {
      const bytes = Buffer.from(chunk);
      if (current + bytes.length > limit) {
        failure = `${streamName.toUpperCase()}_LIMIT_EXCEEDED`;
        killProcessGroup();
        return current;
      }
      target.push(bytes);
      return current + bytes.length;
    };
    child.stdout.on("data", (chunk) => { stdoutBytes = collect(stdout, chunk, stdoutBytes, "stdout"); });
    child.stderr.on("data", (chunk) => { stderrBytes = collect(stderr, chunk, stderrBytes, "stderr"); });
    child.on("error", (error) => { failure = error.message; finish(-1); });
    child.on("close", finish);
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => {
      failure = `COMMAND_TIMEOUT:${options.timeoutMs}`;
      killProcessGroup();
    }, options.timeoutMs);
  });
}

export function isolatedInvocation(tool, args, isolation) {
  if (
    !isPlainObject(isolation) || isolation.mode !== ISOLATION_MODE ||
    isolation.uid !== UNTRUSTED_UID || isolation.gid !== UNTRUSTED_GID
  ) fail("CANDIDATE_ISOLATION_INVALID");
  return {
    tool: "/usr/bin/unshare",
    args: [
      "--pid", "--fork", "--kill-child=SIGKILL", "--mount", "--mount-proc",
      "/usr/bin/setpriv",
      `--reuid=${isolation.uid}`, `--regid=${isolation.gid}`,
      "--clear-groups", "--no-new-privs", "--",
      tool, ...args,
    ],
  };
}

function commandEvidence(entry, result) {
  const stdout = Buffer.from(result.stdout ?? "", "utf8");
  const stderr = Buffer.from(result.stderr ?? "", "utf8");
  const invocation = { args: [...entry.args], cwd: entry.cwd, isolation: entry.isolation, tool: entry.tool };
  return {
    id: entry.id,
    ...invocation,
    invocationSha256: digest(Buffer.from(canonicalize(invocation))),
    expectedExitCodes: [...entry.expectedCodes],
    exitCode: result.code,
    stdoutBytes: stdout.length,
    stdoutSha256: digest(stdout),
    stderrBytes: stderr.length,
    stderrSha256: digest(stderr),
  };
}

async function hashFile(path) {
  const hash = createHash("sha256");
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolvePromise);
  });
  return `sha256:${hash.digest("hex")}`;
}

async function requireExactRegularFile(path, expectedDigest, code) {
  let info;
  try {
    info = await lstat(path);
  } catch {
    fail(code);
  }
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 ||
      await realpath(path) !== path || await hashFile(path) !== expectedDigest) {
    fail(code);
  }
}

async function requireRegularFile(path, code) {
  let info;
  try {
    info = await lstat(path);
  } catch {
    fail(code);
  }
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 ||
      await realpath(path) !== path) fail(code);
}

async function requireExactDirectory(path, code) {
  let info;
  try {
    info = await lstat(path);
  } catch {
    fail(code);
  }
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path) fail(code);
}

async function requireAbsent(path, code) {
  try {
    await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    fail(code);
  }
  fail(code);
}

async function resolveWriterContainer(execute, dockerEndpoint, sourceRoot) {
  const listed = await execute(dockerCommand(
    "operator-list-writers", dockerEndpoint, ["container", "ls", "--all", "--quiet"], sourceRoot,
  ));
  const ids = listed.stdout.split(/\s+/).filter(Boolean);
  if (ids.length === 0) fail("WRITER_CONTAINER_IDENTITY_INVALID");
  const inspected = await execute(dockerCommand(
    "operator-inspect-writers", dockerEndpoint, ["container", "inspect", ...ids], sourceRoot,
  ));
  const containers = parseStrict(inspected.stdout, "WRITER_CONTAINER_IDENTITY_INVALID");
  const writers = containers.filter((container) => (
    container?.State?.Running === true &&
    (container.Mounts ?? []).some((mount) => (
      mount?.Type === "bind" && resolve(mount.Source ?? "") === sourceRoot
    ))
  ));
  if (writers.length !== 1 || !/^[a-f0-9]{64}$/.test(writers[0].Id ?? "")) {
    fail("WRITER_CONTAINER_IDENTITY_INVALID");
  }
  return writers[0].Id;
}

export async function runColdReleaseFromOperatorInputs(
  rawInputs,
  dependencies = {},
) {
  const inputs = validateOperatorInputsDocument(rawInputs);
  const now = dependencies.now?.() ?? new Date();
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN;
  if (!Number.isFinite(nowMs) || nowMs < parseUtc(inputs.maintenanceWindowStart) ||
      nowMs > parseUtc(inputs.maintenanceWindowEnd)) {
    fail("MAINTENANCE_WINDOW_INACTIVE");
  }
  await requireExactRegularFile(
    inputs.releaseExpectationPath, inputs.releaseExpectationDigest, "RELEASE_EXPECTATION_INVALID",
  );
  await requireExactRegularFile(inputs.verifierPath, inputs.verifierDigest, "VERIFIER_IDENTITY_INVALID");
  await requireRegularFile(inputs.backupPythonPath, "BACKUP_PYTHON_INVALID");
  await requireExactDirectory(inputs.bundlePath, "BUNDLE_PATH_INVALID");
  await requireExactDirectory(inputs.immutableSnapshotPath, "IMMUTABLE_SNAPSHOT_INVALID");
  await requireExactDirectory(inputs.sourceRoot, "SOURCE_ROOT_INVALID");
  await requireAbsent(inputs.backupRoot, "BACKUP_TARGET_EXISTS");
  await requireAbsent(inputs.rehearsalRoot, "REHEARSAL_TARGET_EXISTS");
  await requireAbsent(inputs.rolloutLockPath, "ROLLOUT_LOCK_EXISTS");
  await requireExactDirectory(dirname(inputs.rolloutLockPath), "ROLLOUT_LOCK_PARENT_INVALID");
  const expectationRaw = await readFile(inputs.releaseExpectationPath, "utf8");
  const expectation = validateReleaseExpectation(parseJsonStrict(expectationRaw));
  if (expectationRaw !== `${canonicalize(expectation)}\n` ||
      expectation.candidateCommit !== inputs.candidateCommit ||
      expectation.candidateTree !== inputs.candidateTree) {
    fail("RELEASE_EXPECTATION_INVALID");
  }
  const executor = dependencies.executor ?? defaultExecutor;
  const environment = Object.freeze({
    PATH: "/usr/bin:/bin",
    HOME: "/nonexistent",
    LC_ALL: "C.UTF-8",
    PYTHONNOUSERSITE: "1",
  });
  const executeRaw = async (entry) => {
    const result = await executor(entry.tool, entry.args, {
      id: entry.id,
      cwd: entry.cwd,
      timeoutMs: MAX_COMMAND_MS,
      env: environment,
      isolation: null,
    });
    if (!entry.expectedCodes.includes(result.code)) fail(`OPERATOR_COMMAND_FAILED:${entry.id}`);
    return result;
  };
  const backupTool = await executeRaw(command(
    "operator-backup-tool-identity",
    inputs.backupPythonPath,
    ["-I", "-c", "import hashlib,importlib.util,pathlib; s=importlib.util.find_spec('app.operations.sqlite_backup'); p=pathlib.Path(s.origin); print('sha256:'+hashlib.sha256(p.read_bytes()).hexdigest())"],
    dirname(inputs.rolloutLockPath),
  ));
  if (backupTool.stdout.trim() !== inputs.backupToolDigest) fail("BACKUP_TOOL_IDENTITY_INVALID");
  for (const [id, path, expectedDigest] of [
    ["operator-verify-bundle", inputs.bundlePath, inputs.bundleDigest],
    ["operator-verify-snapshot", inputs.immutableSnapshotPath, inputs.immutableSnapshotDigest],
  ]) {
    const result = await executeRaw(command(
      id,
      "/usr/bin/node",
      [inputs.verifierPath, "--bundle", path, "--expectation", inputs.releaseExpectationPath],
      dirname(inputs.rolloutLockPath),
    ));
    const verified = parseStrict(result.stdout, "BUNDLE_VERIFICATION_INVALID");
    if (verified.ok !== true || verified.manifestDigest !== expectedDigest) {
      fail("BUNDLE_VERIFICATION_INVALID");
    }
  }
  const socketIdentity = await validateDockerSocketEndpoint(inputs.dockerEndpoint);
  const execute = async (entry) => {
    const before = await validateDockerSocketEndpoint(inputs.dockerEndpoint);
    if (!sameSocketIdentity(before, socketIdentity)) fail("DOCKER_ENDPOINT_CHANGED");
    const result = await executeRaw(entry);
    const after = await validateDockerSocketEndpoint(inputs.dockerEndpoint);
    if (!sameSocketIdentity(after, socketIdentity)) fail("DOCKER_ENDPOINT_CHANGED");
    return result;
  };
  const backendContainer = await resolveWriterContainer(
    execute, inputs.dockerEndpoint, inputs.sourceRoot,
  );
  return runColdBackupRehearsal({
    backendContainer,
    backupRoot: inputs.backupRoot,
    dockerEndpoint: inputs.dockerEndpoint,
    environment,
    execute,
    rehearsalRoot: inputs.rehearsalRoot,
    rolloutLockPath: inputs.rolloutLockPath,
    runtimePython: inputs.backupPythonPath,
    candidateCommit: inputs.candidateCommit,
    candidateTree: inputs.candidateTree,
    sourceRoot: inputs.sourceRoot,
    workRoot: dirname(inputs.rolloutLockPath),
  });
}

function normalizeRegistryDeadlines(value) {
  const deadlines = value ?? DEFAULT_REGISTRY_DEADLINES;
  if (
    !hasExactKeys(deadlines, ["requestMs", "bodyMs", "exportMs"]) ||
    Object.values(deadlines).some((item) => !Number.isSafeInteger(item) || item < 1 || item > 60 * 60_000)
  ) fail("REGISTRY_DEADLINES_INVALID");
  return { ...deadlines };
}

async function withDeadline(operation, { timeoutMs, code, parentSignal = null }) {
  if (parentSignal?.aborted) throw parentSignal.reason instanceof Error ? parentSignal.reason : new AcceptanceError(code);
  const controller = new AbortController();
  const propagate = () => controller.abort(parentSignal.reason instanceof Error ? parentSignal.reason : new AcceptanceError(code));
  parentSignal?.addEventListener("abort", propagate, { once: true });
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new AcceptanceError(code);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  const operationPromise = Promise.resolve().then(() => operation(controller.signal));
  try {
    return await Promise.race([operationPromise, timeout]);
  } catch (error) {
    if (controller.signal.aborted) {
      await Promise.race([
        operationPromise.catch(() => undefined),
        new Promise((resolvePromise) => setTimeout(resolvePromise, Math.min(timeoutMs, 1_000))),
      ]);
    }
    if (controller.signal.aborted && controller.signal.reason instanceof Error) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", propagate);
  }
}

async function responseBytes(response, limit = 16 * 1024 * 1024, context = {}) {
  const { deadlines = DEFAULT_REGISTRY_DEADLINES, signal = null } = context;
  return withDeadline(async (bodySignal) => {
    if (!response.body) fail("REGISTRY_RESPONSE_BODY_MISSING");
    const chunks = [];
    let bytes = 0;
    const reader = response.body.getReader();
    const abort = () => { void reader.cancel(bodySignal.reason); };
    bodySignal.addEventListener("abort", abort, { once: true });
    try {
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        if (bodySignal.aborted) throw bodySignal.reason;
        const value = Buffer.from(chunk);
        bytes += value.length;
        if (bytes > limit) fail("REGISTRY_RESPONSE_TOO_LARGE");
        chunks.push(value);
      }
    } catch (error) {
      try { await reader.cancel(error); } catch {}
      throw error;
    } finally {
      bodySignal.removeEventListener("abort", abort);
      reader.releaseLock();
    }
    return Buffer.concat(chunks, bytes);
  }, { timeoutMs: deadlines.bodyMs, code: "REGISTRY_BODY_TIMEOUT", parentSignal: signal });
}

export function validateRegistryUrl(rawUrl, allowedOrigins) {
  let value;
  try { value = new URL(rawUrl); } catch { fail("REGISTRY_URL_INVALID"); }
  const hostname = value.hostname.replace(/^\[|\]$/g, "");
  const prefixes = REGISTRY_PATH_PREFIXES.get(value.origin);
  if (
    value.protocol !== "https:" || value.port !== "" || value.username !== "" ||
    value.password !== "" || value.hash !== "" || isIP(hostname) !== 0 ||
    !allowedOrigins.has(value.origin) || !prefixes ||
    !prefixes.some((prefix) => value.pathname.startsWith(prefix)) ||
    value.pathname.includes("%") || value.pathname.includes("\\")
  ) fail("REGISTRY_ORIGIN_FORBIDDEN");
  if (value.origin === NPM_AUDIT_ORIGIN && (value.pathname !== NPM_AUDIT_PATH || value.search)) {
    fail("REGISTRY_PATH_FORBIDDEN");
  }
  if (value.origin === "https://registry-1.docker.io" && value.search) {
    fail("REGISTRY_PATH_FORBIDDEN");
  }
  if (value.origin === "https://auth.docker.io") {
    if (value.pathname !== "/token" || [...value.searchParams.keys()].some((key) => !["service", "scope"].includes(key))) {
      fail("REGISTRY_PATH_FORBIDDEN");
    }
  }
  if (value.origin === DOCKER_BLOB_CDN_ORIGIN) {
    const keys = [...value.searchParams.keys()];
    const pathMatch = value.pathname.match(DOCKER_BLOB_CDN_PATH);
    if (
      !pathMatch || pathMatch[1] !== pathMatch[2].slice(0, 2) ||
      keys.length !== 3 ||
      new Set(keys).size !== 3 ||
      !["expires", "signature", "version"].every((key) => keys.includes(key)) ||
      !/^[0-9]{1,12}$/.test(value.searchParams.get("expires") ?? "") ||
      !/^[A-Za-z0-9+/_=-]{16,1024}$/.test(value.searchParams.get("signature") ?? "") ||
      value.searchParams.get("version") !== "2"
    ) fail("REGISTRY_PATH_FORBIDDEN");
  }
  return value;
}

function normalizedIp(value) {
  return value.toLowerCase().startsWith("::ffff:") ? value.slice(7) : value;
}

export function validatePublicRegistryAddresses(answers) {
  if (!Array.isArray(answers) || answers.length === 0 || answers.length > 16) {
    fail("REGISTRY_DNS_INVALID");
  }
  const approved = [];
  for (const answer of answers) {
    const address = normalizedIp(answer?.address ?? "");
    const family = isIP(address);
    if (
      ![4, 6].includes(family) ||
      (answer.family !== undefined && Number(answer.family) !== family) ||
      FORBIDDEN_IPS.check(address, family === 4 ? "ipv4" : "ipv6")
    ) fail("REGISTRY_ADDRESS_FORBIDDEN");
    approved.push({ address, family });
  }
  return approved;
}

export function validateRegistryPeer(remoteAddress, approved) {
  const peer = normalizedIp(remoteAddress ?? "");
  if (!approved.some((entry) => entry.address === peer)) fail("REGISTRY_PEER_MISMATCH");
  validatePublicRegistryAddresses([{ address: peer, family: isIP(peer) }]);
  return peer;
}

async function pinnedHttpsFetch(rawUrl, init = {}) {
  const allowedOrigins = init.chaotangAllowedOrigins;
  if (!(allowedOrigins instanceof Set)) fail("REGISTRY_ORIGIN_FORBIDDEN");
  const value = validateRegistryUrl(rawUrl, allowedOrigins);
  let resolved;
  try {
    resolved = validatePublicRegistryAddresses(
      await dnsLookup(value.hostname, { all: true, verbatim: true }),
    );
  } catch (error) {
    if (error instanceof AcceptanceError) throw error;
    fail("REGISTRY_DNS_INVALID");
  }
  const selected = resolved[0];
  const body = init.body === undefined ? null : Buffer.from(init.body);
  if (body !== null && body.length > 4_194_304) fail("REGISTRY_REQUEST_BODY_TOO_LARGE");
  return new Promise((resolvePromise, rejectPromise) => {
    const request = httpsRequest({
      protocol: "https:",
      hostname: value.hostname,
      port: 443,
      path: `${value.pathname}${value.search}`,
      method: init.method ?? "GET",
      headers: init.headers,
      agent: false,
      rejectUnauthorized: true,
      servername: value.hostname,
      lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family),
    }, (response) => {
      try {
        validateRegistryPeer(response.socket.remoteAddress, resolved);
        const headers = new Headers();
        for (const [key, header] of Object.entries(response.headers)) {
          for (const item of Array.isArray(header) ? header : header === undefined ? [] : [header]) {
            headers.append(key, String(item));
          }
        }
        resolvePromise(new Response(Readable.toWeb(response), {
          status: response.statusCode ?? 500,
          statusText: response.statusMessage,
          headers,
        }));
      } catch (error) {
        response.destroy(error);
        rejectPromise(error);
      }
    });
    request.once("error", rejectPromise);
    const abort = () => request.destroy(init.signal?.reason ?? new AcceptanceError("REGISTRY_REQUEST_ABORTED"));
    init.signal?.addEventListener("abort", abort, { once: true });
    request.once("close", () => init.signal?.removeEventListener("abort", abort));
    if (body !== null) request.write(body);
    request.end();
  });
}

async function registryRequest(url, init, allowedOrigins, fetcher, context = {}) {
  const { deadlines = DEFAULT_REGISTRY_DEADLINES, signal = null } = context;
  return withDeadline(async (requestSignal) => {
    let current = new URL(url);
    let requestInit = { ...init, headers: { ...(init.headers ?? {}) } };
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      current = validateRegistryUrl(current, allowedOrigins);
      let response;
      try {
        const effectiveFetcher = fetcher ?? pinnedHttpsFetch;
        response = await effectiveFetcher(current, {
          ...requestInit,
          redirect: "manual",
          signal: requestSignal,
          chaotangAllowedOrigins: allowedOrigins,
        });
      } catch (error) {
        if (requestSignal.aborted) throw requestSignal.reason;
        fail("REGISTRY_REQUEST_FAILED");
      }
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      const location = response.headers.get("location");
      if (!location) fail("REGISTRY_REDIRECT_INVALID");
      const next = new URL(location, current);
      if (next.origin !== current.origin) {
        const headers = { ...requestInit.headers };
        for (const key of Object.keys(headers)) if (key.toLowerCase() === "authorization") delete headers[key];
        requestInit = { ...requestInit, headers };
      }
      current = next;
    }
    fail("REGISTRY_REDIRECT_LIMIT");
  }, { timeoutMs: deadlines.requestMs, code: "REGISTRY_REQUEST_TIMEOUT", parentSignal: signal });
}

function bearerChallenge(header) {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) fail("REGISTRY_AUTH_CHALLENGE_INVALID");
  const values = {};
  for (const match of header.slice(7).matchAll(/([A-Za-z]+)="([^"]*)"/g)) {
    if (Object.hasOwn(values, match[1])) fail("REGISTRY_AUTH_CHALLENGE_INVALID");
    values[match[1]] = match[2];
  }
  if (!values.realm || !values.service || values.scope !== "repository:library/caddy:pull") fail("REGISTRY_AUTH_CHALLENGE_INVALID");
  return values;
}

async function anonymousRegistryToken(reference, allowedOrigins, fetcher, context) {
  const digestValue = reference.split("@")[1];
  const manifestUrl = `https://registry-1.docker.io/v2/library/caddy/manifests/${digestValue}`;
  const challengeResponse = await registryRequest(manifestUrl, { method: "GET", headers: { Accept: [...OCI_MANIFEST_TYPES].join(", ") } }, allowedOrigins, fetcher, context);
  if (challengeResponse.status !== 401) fail("REGISTRY_AUTH_CHALLENGE_MISSING");
  const challenge = bearerChallenge(challengeResponse.headers.get("www-authenticate"));
  if (challengeResponse.body) {
    await withDeadline(() => challengeResponse.body.cancel(), {
      timeoutMs: context.deadlines.bodyMs,
      code: "REGISTRY_BODY_TIMEOUT",
      parentSignal: context.signal,
    });
  }
  const tokenUrl = new URL(challenge.realm);
  tokenUrl.searchParams.set("service", challenge.service);
  tokenUrl.searchParams.set("scope", challenge.scope);
  const tokenResponse = await registryRequest(tokenUrl, { method: "GET", headers: { Accept: "application/json" } }, allowedOrigins, fetcher, context);
  if (tokenResponse.status !== 200) fail("REGISTRY_TOKEN_FAILED");
  const tokenDocument = parseStrict((await responseBytes(tokenResponse, 1024 * 1024, context)).toString("utf8"), "REGISTRY_TOKEN_INVALID");
  const token = tokenDocument?.token ?? tokenDocument?.access_token;
  if (typeof token !== "string" || token.length < 16 || token.length > 16_384) fail("REGISTRY_TOKEN_INVALID");
  return { token, manifestUrl };
}

function validateRegistryDescriptor(descriptor, code) {
  if (!isPlainObject(descriptor) || !DIGEST_PATTERN.test(descriptor.digest ?? "") || !Number.isSafeInteger(descriptor.size) || descriptor.size < 0 || descriptor.size > 8 * 1024 * 1024 * 1024 || typeof descriptor.mediaType !== "string") fail(code);
  return descriptor;
}

async function writeAll(handle, buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesWritten } = await handle.write(buffer, offset, buffer.length - offset);
    if (bytesWritten <= 0) fail("FILE_WRITE_FAILED");
    offset += bytesWritten;
  }
}

async function downloadRegistryBlob({ url, authorization, descriptor, destination, allowedOrigins, fetcher, deadlines, signal }) {
  const context = { deadlines, signal };
  const response = await registryRequest(url, { method: "GET", headers: { Authorization: authorization, Accept: descriptor.mediaType } }, allowedOrigins, fetcher, context);
  if (response.status !== 200) fail("REGISTRY_BLOB_DOWNLOAD_FAILED");
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) !== descriptor.size) fail("REGISTRY_BLOB_SIZE_MISMATCH");
  const partial = `${destination}.partial`;
  const handle = await open(partial, "wx", 0o600);
  const hash = createHash("sha256");
  let size = 0;
  try {
    await withDeadline(async (bodySignal) => {
      if (!response.body) fail("REGISTRY_RESPONSE_BODY_MISSING");
      const reader = response.body.getReader();
      const abort = () => { void reader.cancel(bodySignal.reason); };
      bodySignal.addEventListener("abort", abort, { once: true });
      try {
        for (;;) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          if (bodySignal.aborted) throw bodySignal.reason;
          const bytes = Buffer.from(chunk);
          size += bytes.length;
          if (size > descriptor.size || size > 8 * 1024 * 1024 * 1024) fail("REGISTRY_BLOB_SIZE_MISMATCH");
          hash.update(bytes);
          await writeAll(handle, bytes);
        }
      } catch (error) {
        try { await reader.cancel(error); } catch {}
        throw error;
      } finally {
        bodySignal.removeEventListener("abort", abort);
        reader.releaseLock();
      }
    }, { timeoutMs: deadlines.bodyMs, code: "REGISTRY_BODY_TIMEOUT", parentSignal: signal });
  } finally {
    await handle.close();
  }
  const actualDigest = `sha256:${hash.digest("hex")}`;
  if (size !== descriptor.size || actualDigest !== descriptor.digest) {
    await rm(partial, { force: true });
    fail("REGISTRY_BLOB_DIGEST_MISMATCH");
  }
  if (signal?.aborted) {
    await rm(partial, { force: true });
    throw signal.reason;
  }
  await rename(partial, destination);
}

function writeTarOctal(header, offset, length, value) {
  const octal = value.toString(8);
  if (octal.length > length - 1) fail("OCI_TAR_FIELD_OVERFLOW");
  header.write(`${octal.padStart(length - 1, "0")}\0`, offset, length, "ascii");
}

function tarHeader(name, size, mtime) {
  const header = Buffer.alloc(512);
  if (Buffer.byteLength(name) > 100) fail("OCI_TAR_PATH_TOO_LONG");
  header.write(name, 0, 100, "utf8");
  writeTarOctal(header, 100, 8, 0o644);
  writeTarOctal(header, 108, 8, 0);
  writeTarOctal(header, 116, 8, 0);
  writeTarOctal(header, 124, 12, size);
  writeTarOctal(header, 136, 12, mtime);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  return header;
}

async function createOciTar(layoutRoot, archivePath, sourceDateEpoch, signal) {
  const entries = (await walkRegularFiles(layoutRoot)).sort((left, right) => left.path.localeCompare(right.path, "en"));
  const partial = `${archivePath}.partial`;
  const output = await open(partial, "wx", 0o600);
  const archiveHash = createHash("sha256");
  const writeArchive = async (bytes) => {
    await writeAll(output, bytes);
    archiveHash.update(bytes);
  };
  try {
    for (const entry of entries) {
      if (signal?.aborted) throw signal.reason;
      await writeArchive(tarHeader(entry.path, entry.bytes, sourceDateEpoch));
      for await (const chunk of createReadStream(resolve(layoutRoot, entry.path))) {
        if (signal?.aborted) throw signal.reason;
        await writeArchive(Buffer.from(chunk));
      }
      const padding = (512 - (entry.bytes % 512)) % 512;
      if (padding) await writeArchive(Buffer.alloc(padding));
    }
    await writeArchive(Buffer.alloc(1024));
    await output.sync();
  } finally {
    await output.close();
  }
  if (signal?.aborted) throw signal.reason;
  await rename(partial, archivePath);
  return { archiveSha256: `sha256:${archiveHash.digest("hex")}`, entryCount: entries.length };
}

async function exportPinnedCaddyOciWithinDeadline({ reference, archivePath, layoutRoot, sourceDateEpoch, allowedOrigins, fetcher, deadlines, signal }) {
  if ((fetcher !== undefined && typeof fetcher !== "function") || reference !== PINNED_POLICY.images.caddy.reference) fail("CADDY_EXPORT_OPTIONS_INVALID");
  const origins = new Set(allowedOrigins);
  const context = { deadlines, signal };
  const { token, manifestUrl } = await anonymousRegistryToken(reference, origins, fetcher, context);
  const authorization = `Bearer ${token}`;
  const manifestResponse = await registryRequest(manifestUrl, { method: "GET", headers: { Authorization: authorization, Accept: [...OCI_MANIFEST_TYPES].join(", ") } }, origins, fetcher, context);
  if (manifestResponse.status !== 200) fail("REGISTRY_MANIFEST_DOWNLOAD_FAILED");
  const manifestBytes = await responseBytes(manifestResponse, 16 * 1024 * 1024, context);
  const expectedDigest = reference.split("@")[1];
  const declaredDigest = manifestResponse.headers.get("docker-content-digest");
  if (declaredDigest !== null && declaredDigest !== expectedDigest) fail("REGISTRY_MANIFEST_DIGEST_MISMATCH");
  if (digest(manifestBytes) !== expectedDigest) fail("REGISTRY_MANIFEST_DIGEST_MISMATCH");
  const manifest = parseStrict(manifestBytes.toString("utf8"), "REGISTRY_MANIFEST_INVALID");
  if (!isPlainObject(manifest) || manifest.schemaVersion !== 2 || manifest.mediaType !== OCI_IMAGE_MANIFEST_TYPE || !Array.isArray(manifest.layers)) fail("CADDY_REFERENCE_NOT_OCI_PLATFORM_MANIFEST");
  const config = validateRegistryDescriptor(manifest.config, "REGISTRY_CONFIG_DESCRIPTOR_INVALID");
  const layers = manifest.layers.map((layer) => validateRegistryDescriptor(layer, "REGISTRY_LAYER_DESCRIPTOR_INVALID"));
  if (config.mediaType !== OCI_IMAGE_CONFIG_TYPE || layers.some((layer) => layer.mediaType !== OCI_GZIP_LAYER_TYPE)) fail("CADDY_OCI_MEDIA_TYPE_UNSUPPORTED");
  if (layers.length === 0 || layers.length > 4090) fail("REGISTRY_LAYER_COUNT_INVALID");
  const descriptors = [config, ...layers];
  const totalBytes = manifestBytes.length + descriptors.reduce((sum, descriptor) => sum + descriptor.size, 0);
  if (totalBytes > 32 * 1024 * 1024 * 1024) fail("REGISTRY_IMAGE_TOO_LARGE");
  await mkdir(resolve(layoutRoot, "blobs/sha256"), { recursive: true, mode: 0o700 });
  if (signal.aborted) throw signal.reason;
  const manifestPath = resolve(layoutRoot, `blobs/sha256/${expectedDigest.slice(7)}`);
  await writeFile(manifestPath, manifestBytes, { flag: "wx", mode: 0o600 });
  const seen = new Map();
  for (const descriptor of descriptors) {
    if (signal.aborted) throw signal.reason;
    if (seen.has(descriptor.digest)) {
      if (seen.get(descriptor.digest) !== descriptor.size) fail("REGISTRY_DESCRIPTOR_CONFLICT");
      continue;
    }
    seen.set(descriptor.digest, descriptor.size);
    await downloadRegistryBlob({
      url: `https://registry-1.docker.io/v2/library/caddy/blobs/${descriptor.digest}`,
      authorization,
      descriptor,
      destination: resolve(layoutRoot, `blobs/sha256/${descriptor.digest.slice(7)}`),
      allowedOrigins: origins,
      fetcher,
      deadlines,
      signal,
    });
  }
  const configDocument = parseStrict(await readFile(resolve(layoutRoot, `blobs/sha256/${config.digest.slice(7)}`), "utf8"), "REGISTRY_CONFIG_INVALID");
  if (configDocument?.os !== "linux" || configDocument?.architecture !== "amd64") fail("CADDY_PLATFORM_MISMATCH");
  await writeCanonical(resolve(layoutRoot, "oci-layout"), { imageLayoutVersion: "1.0.0" });
  await writeCanonical(resolve(layoutRoot, "index.json"), {
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.index.v1+json",
    manifests: [{
      mediaType: manifest.mediaType,
      digest: expectedDigest,
      size: manifestBytes.length,
      platform: { architecture: "amd64", os: "linux" },
      annotations: { "org.opencontainers.image.ref.name": reference },
    }],
  });
  if (signal.aborted) throw signal.reason;
  const archive = await createOciTar(layoutRoot, archivePath, sourceDateEpoch, signal);
  return { manifestDigest: expectedDigest, platform: "linux/amd64", layerCount: layers.length, contentBytes: totalBytes, ...archive };
}

export async function exportPinnedCaddyOci(options) {
  const deadlines = normalizeRegistryDeadlines(options?.deadlines);
  const archivePath = options?.archivePath;
  const layoutRoot = options?.layoutRoot;
  assertString(archivePath, null, "CADDY_EXPORT_OPTIONS_INVALID");
  assertString(layoutRoot, null, "CADDY_EXPORT_OPTIONS_INVALID");
  if (!await pathMissing(archivePath) || !await pathMissing(`${archivePath}.partial`) || !await pathMissing(layoutRoot)) {
    fail("CADDY_EXPORT_PATH_COLLISION");
  }
  let succeeded = false;
  try {
    const result = await withDeadline(
      (signal) => exportPinnedCaddyOciWithinDeadline({ ...options, deadlines, signal }),
      { timeoutMs: deadlines.exportMs, code: "REGISTRY_EXPORT_TIMEOUT" },
    );
    succeeded = true;
    return result;
  } finally {
    await rm(`${archivePath}.partial`, { force: true });
    if (!succeeded) {
      await rm(archivePath, { force: true });
      await rm(layoutRoot, { recursive: true, force: true });
    }
  }
}

async function walkRegularFiles(root, base = root, records = []) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    const info = await lstat(path);
    if (info.isSymbolicLink()) fail("UNSAFE_EVIDENCE_FILE");
    if (entry.isDirectory()) await walkRegularFiles(path, base, records);
    else if (entry.isFile()) {
      if (info.nlink !== 1) fail("UNSAFE_EVIDENCE_FILE");
      records.push({ path: relative(base, path).replaceAll("\\", "/"), bytes: info.size, sha256: await hashFile(path) });
    }
    else fail("UNSAFE_EVIDENCE_FILE");
  }
  return records;
}

async function assertTreeOwner(root, uid, gid) {
  const visit = async (path) => {
    const info = await lstat(path);
    if (info.isSymbolicLink() || info.uid !== uid || info.gid !== gid) fail("CANDIDATE_ISOLATION_OWNERSHIP_INVALID");
    if (info.isDirectory()) {
      for (const entry of await readdir(path)) await visit(resolve(path, entry));
    } else if (!info.isFile()) fail("CANDIDATE_ISOLATION_OWNERSHIP_INVALID");
  };
  await visit(root);
}

export async function prepareCandidatePhaseRoot(root, candidateIsolation, trustedIdentity) {
  const info = await lstat(root);
  if (
    !info.isDirectory() || info.isSymbolicLink() || info.uid !== trustedIdentity.uid ||
    info.gid !== trustedIdentity.gid || (info.mode & 0o077) !== 0 || (await readdir(root)).length !== 0
  ) fail("CANDIDATE_PHASE_ROOT_NOT_EMPTY");
  await setTreeAccess(root, { ...candidateIsolation, writable: true });
  await assertTreeOwner(root, candidateIsolation.uid, candidateIsolation.gid);
}

async function freezeWheelArtifact(wheelRoot, trustedIdentity) {
  const entries = await readdir(wheelRoot);
  if (entries.length !== 1 || entries[0] !== "chaotang_os_backend-0.1.0-py3-none-any.whl") fail("BACKEND_WHEEL_SET_INVALID");
  const wheelPath = resolve(wheelRoot, entries[0]);
  const info = await lstat(wheelPath);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size <= 0) fail("BACKEND_WHEEL_SET_INVALID");
  const wheel = { path: entries[0], bytes: info.size, sha256: await hashFile(wheelPath) };
  await setTreeAccess(wheelRoot, { ...trustedIdentity, writable: false });
  await assertFrozenTree(wheelRoot, trustedIdentity.uid, trustedIdentity.gid);
  return wheel;
}

async function setTreeAccess(root, { uid, gid, writable }) {
  const visit = async (path) => {
    const info = await lstat(path);
    await lchown(path, uid, gid);
    if (info.isSymbolicLink()) return;
    if (info.isDirectory()) {
      await chmod(path, writable ? 0o700 : 0o555);
      for (const entry of await readdir(path)) await visit(resolve(path, entry));
      return;
    }
    if (!info.isFile() || info.nlink !== 1) fail("CANDIDATE_SOURCE_ENTRY_INVALID");
    await chmod(path, writable ? ((info.mode & 0o111) === 0 ? 0o600 : 0o700) : ((info.mode & 0o111) === 0 ? 0o444 : 0o555));
  };
  await visit(root);
}

export async function removeIsolationTree(root) {
  if (await pathMissing(root)) return;
  const prepareDirectory = async (path) => {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isDirectory()) return;
    await chmod(path, 0o700);
    for (const entry of await readdir(path)) await prepareDirectory(resolve(path, entry));
  };
  await prepareDirectory(root);
  await rm(root, { recursive: true, force: true });
}

export async function assertFrozenTree(root, uid, gid) {
  const canonicalRoot = await realpath(root);
  const visit = async (path) => {
    const info = await lstat(path);
    if (info.uid !== uid || info.gid !== gid) fail("FROZEN_TREE_OWNERSHIP_INVALID");
    if (info.isSymbolicLink()) {
      const target = await realpath(path);
      const relation = relative(canonicalRoot, target);
      if (relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) fail("FROZEN_TREE_SYMLINK_ESCAPE");
      return;
    }
    if ((info.mode & 0o222) !== 0) fail("FROZEN_TREE_WRITABLE");
    if (info.isDirectory()) {
      for (const entry of await readdir(path)) await visit(resolve(path, entry));
    } else if (!info.isFile() || info.nlink !== 1) fail("FROZEN_TREE_ENTRY_INVALID");
  };
  await visit(root);
}

export async function protectedTestSourceDigest(testSource, dependencyRoot, candidateIsolation, trustedIdentity) {
  const dependencyLink = resolve(testSource, "frontend/node_modules");
  const frontendOutput = resolve(testSource, "frontend/.next");
  const typecheckOutput = resolve(testSource, "frontend/tsconfig.tsbuildinfo");
  const records = [];
  const visit = async (path) => {
    const relation = relative(testSource, path).replaceAll("\\", "/");
    const info = await lstat(path);
    if (path === dependencyLink) {
      if (!info.isSymbolicLink() || info.uid !== trustedIdentity.uid || info.gid !== trustedIdentity.gid) fail("TEST_DEPENDENCY_LINK_INVALID");
      if (await realpath(path) !== await realpath(dependencyRoot)) fail("TEST_DEPENDENCY_LINK_INVALID");
      if (isAbsolute(await readlink(path)) !== true) fail("TEST_DEPENDENCY_LINK_INVALID");
      records.push({ path: relation, type: "dependency-link" });
      return;
    }
    if (path === frontendOutput || path === typecheckOutput) {
      const expectedType = path === frontendOutput ? info.isDirectory() : info.isFile();
      if (!expectedType || info.isSymbolicLink() || info.uid !== candidateIsolation.uid || info.gid !== candidateIsolation.gid || (info.mode & 0o077) !== 0) {
        fail("TEST_OUTPUT_BOUNDARY_INVALID");
      }
      records.push({ path: relation, type: path === frontendOutput ? "writable-directory" : "writable-file" });
      return;
    }
    if (info.isSymbolicLink() || info.uid !== trustedIdentity.uid || info.gid !== trustedIdentity.gid || (info.mode & 0o222) !== 0) {
      fail("TEST_SOURCE_NOT_IMMUTABLE");
    }
    if (info.isDirectory()) {
      records.push({ path: relation, type: "directory" });
      for (const entry of await readdir(path)) await visit(resolve(path, entry));
    } else if (info.isFile() && info.nlink === 1) {
      records.push({ path: relation, type: "file", bytes: info.size, sha256: await hashFile(path) });
    } else fail("TEST_SOURCE_ENTRY_INVALID");
  };
  await visit(testSource);
  records.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return { digest: digest(Buffer.from(canonicalize(records))), fileCount: records.length };
}

async function treeDigest(root) {
  const records = (await walkRegularFiles(root)).sort((a, b) => a.path.localeCompare(b.path, "en"));
  return { digest: digest(Buffer.from(canonicalize(records))), fileCount: records.length };
}

function parseOneObject(text, code) {
  const parsed = parseStrict(text, code);
  if (Array.isArray(parsed)) {
    if (parsed.length !== 1 || !isPlainObject(parsed[0])) fail(code);
    return parsed[0];
  }
  if (!isPlainObject(parsed)) fail(code);
  return parsed;
}

function assertPolicyShape(policy) {
  const required = ["schemaVersion", "platform", "archiveLimits", "databaseRegistry", "images", "hostTools", "provenance", "validationEgress", "vulnerabilityPolicy"].sort();
  if (!isPlainObject(policy) || !sameStrings(Object.keys(policy).sort(), required)) fail("POLICY_SCHEMA_INVALID");
  if (policy.platform !== "linux/amd64" || !isPlainObject(policy.images) || !isPlainObject(policy.hostTools)) fail("POLICY_SCHEMA_INVALID");
  for (const name of ["caddy", "grype", "node", "python", "syft"]) {
    if (!isPlainObject(policy.images[name]) || !DIGEST_PATTERN.test(policy.images[name].reference?.split("@")[1] ?? "")) fail("POLICY_SCHEMA_INVALID");
    if (policy.images[name].reference !== PINNED_POLICY.images[name].reference) fail("POLICY_IDENTITY_MISMATCH");
  }
}

async function validatePolicyAndSource(options, results) {
  if ((results.get("git-status")?.stdout ?? "").length !== 0) fail("SOURCE_NOT_CLEAN");
  if (results.get("git-head")?.stdout.trim() !== options.candidateCommit) fail("SOURCE_IDENTITY_MISMATCH");
  if (results.get("git-tree")?.stdout.trim() !== options.candidateTree) fail("SOURCE_IDENTITY_MISMATCH");
  const parentLine = results.get("git-parent-line")?.stdout.trim().split(/\s+/) ?? [];
  if (parentLine.length !== 2 || parentLine[0] !== options.candidateCommit || !SHA_PATTERN.test(parentLine[1])) fail("CANDIDATE_PARENT_INVALID");
  if (Number(results.get("git-source-epoch")?.stdout.trim()) !== options.sourceDateEpoch) fail("SOURCE_DATE_EPOCH_MISMATCH");
  const approval = parseStrict(results.get("approval-parent")?.stdout ?? "", "APPROVAL_PARENT_INVALID");
  if (!isPlainObject(approval) || approval.state !== "APPROVED_FOR_ONE_CHILD" || !Array.isArray(approval.request?.productPaths)) fail("APPROVAL_PARENT_INVALID");
  const actualPaths = (results.get("git-product-paths")?.stdout ?? "").split(/\r?\n/).filter(Boolean).sort();
  if (!sameStrings(actualPaths, [...approval.request.productPaths].sort())) fail("CANDIDATE_PATHSET_MISMATCH");
  const parentTaskBytes = Buffer.from(results.get("policy-parent")?.stdout ?? "", "utf8");
  const taskPath = resolve(options.repositoryRoot, TASK_PATH);
  const taskInfo = await lstat(taskPath);
  if (!taskInfo.isFile() || taskInfo.isSymbolicLink() || taskInfo.nlink !== 1) fail("POLICY_WORKTREE_INVALID");
  if (!parentTaskBytes.equals(await readFile(taskPath))) fail("POLICY_WORKTREE_MISMATCH");
  const policy = extractFrozenPolicy(parentTaskBytes.toString("utf8"));
  assertPolicyShape(policy);
  if (digest(Buffer.from(canonicalize(policy))) !== POLICY_DIGEST) fail("POLICY_DIGEST_MISMATCH");
  const expectedProjection = [
    `NODE_IMAGE=${policy.images.node.reference}`,
    `PYTHON_IMAGE=${policy.images.python.reference}`,
    `CADDY_IMAGE=${policy.images.caddy.reference}`,
    "",
  ].join("\n");
  if ((await readFile(resolve(options.repositoryRoot, "deploy/images.env.example"), "utf8")) !== expectedProjection) fail("BASE_IMAGES_PROJECTION_MISMATCH");
  if (!sameStrings([...options.egressEvidence.allowedOrigins].sort(), [...policy.validationEgress.allowedHttpsOrigins].sort())) fail("EGRESS_POLICY_MISMATCH");
  return policy;
}

function validateToolResults(options, policy, results) {
  if (results.get("time-sync")?.stdout.trim() !== "yes") fail("NTP_NOT_SYNCHRONIZED");
  const context = parseOneObject(results.get("docker-context")?.stdout ?? "", "DOCKER_CONTEXT_INVALID");
  if (context.Name !== options.dockerContext || context.Endpoints?.docker?.Host !== options.dockerEndpoint) fail("DOCKER_CONTEXT_ENDPOINT_MISMATCH");
  const version = parseOneObject(results.get("docker-version")?.stdout ?? "", "DOCKER_VERSION_INVALID");
  const host = policy.hostTools;
  if (version.Client?.Version !== host.dockerClientVersion || version.Client?.GitCommit !== host.dockerClientGitCommit || version.Server?.Version !== host.dockerServerVersion || version.Server?.GitCommit !== host.dockerServerGitCommit) fail("DOCKER_VERSION_MISMATCH");
  const buildx = results.get("buildx-version")?.stdout ?? "";
  if (!buildx.includes(host.buildxVersion) || !buildx.includes(host.buildxGitCommit)) fail("BUILDX_VERSION_MISMATCH");
  const inspect = parseOneObject(results.get("buildx-inspect")?.stdout ?? "", "BUILDKIT_VERSION_INVALID");
  const nodes = Array.isArray(inspect.Nodes) ? inspect.Nodes : [];
  if (nodes.length === 0 || nodes.some((node) => node.Buildkit !== host.buildkitVersion)) fail("BUILDKIT_VERSION_MISMATCH");
  if (results.get("node-version")?.stdout.trim() !== `v${policy.images.node.expectedVersion}` || results.get("python-version")?.stdout.trim() !== `Python ${policy.images.python.expectedVersion}`) fail("TOOL_VERSION_MISMATCH");
  if (!/^\d+\.\d+\.\d+$/.test(results.get("npm-version")?.stdout.trim() ?? "")) fail("TOOL_VERSION_MISMATCH");
  for (const name of ["unshare", "setpriv"]) {
    if (results.get(`${name}-version`)?.stdout.trim() !== `${name} from util-linux ${ISOLATION_TOOL_VERSION}`) fail("ISOLATION_TOOL_VERSION_MISMATCH");
  }
  for (const name of ["caddy", "syft", "grype"]) {
    const output = `${results.get(`${name}-version`)?.stdout ?? ""}\n${results.get(`${name}-version`)?.stderr ?? ""}`;
    if (!new RegExp(`(?:^|[^0-9])v?${policy.images[name].expectedVersion.replaceAll(".", "\\.")}(?:[^0-9]|$)`).test(output)) fail("TOOL_VERSION_MISMATCH");
  }
  return {
    docker: `${host.dockerClientVersion}+${host.dockerClientGitCommit}`,
    buildx: `${host.buildxVersion}+${host.buildxGitCommit}`,
    buildkit: host.buildkitVersion,
    node: policy.images.node.expectedVersion,
    python: policy.images.python.expectedVersion,
    caddy: policy.images.caddy.expectedVersion,
    syft: policy.images.syft.expectedVersion,
    grype: policy.images.grype.expectedVersion,
  };
}

function exactToolVersions(policy, results, candidateIsolation) {
  const host = policy.hostTools;
  return {
    buildkit: { version: host.buildkitVersion },
    buildx: { version: host.buildxVersion, gitCommit: host.buildxGitCommit },
    caddy: { version: policy.images.caddy.expectedVersion },
    dockerClient: { version: host.dockerClientVersion, gitCommit: host.dockerClientGitCommit },
    dockerServer: { version: host.dockerServerVersion, gitCommit: host.dockerServerGitCommit },
    grype: { version: policy.images.grype.expectedVersion },
    node: { version: policy.images.node.expectedVersion },
    npm: { version: results.get("npm-version").stdout.trim() },
    python: { version: policy.images.python.expectedVersion },
    syft: { version: policy.images.syft.expectedVersion },
    isolation: {
      mode: ISOLATION_MODE,
      uid: candidateIsolation.uid,
      gid: candidateIsolation.gid,
      setpriv: ISOLATION_TOOL_VERSION,
      unshare: ISOLATION_TOOL_VERSION,
    },
  };
}

function validateFrontendAudit(text) {
  const report = parseStrict(text, "NPM_AUDIT_INVALID");
  if (!isPlainObject(report) || !isPlainObject(report.metadata?.vulnerabilities)) fail("NPM_AUDIT_INVALID");
  if (report.metadata.vulnerabilities.high !== 0 || report.metadata.vulnerabilities.critical !== 0) fail("NPM_AUDIT_BLOCKED");
}

function expectedNpmAuditPayload(lockText) {
  const lock = parseStrict(lockText, "NPM_AUDIT_LOCK_INVALID");
  if (!isPlainObject(lock) || !isPlainObject(lock.packages)) fail("NPM_AUDIT_LOCK_INVALID");
  const expected = {};
  for (const [path, record] of Object.entries(lock.packages)) {
    const marker = "node_modules/";
    const index = path.lastIndexOf(marker);
    if (index < 0 || !isPlainObject(record) || record.dev === true) continue;
    const name = path.slice(index + marker.length);
    if (!name || name.includes("/node_modules/") || typeof record.version !== "string") {
      fail("NPM_AUDIT_LOCK_INVALID");
    }
    expected[name] ??= [];
    if (!expected[name].includes(record.version)) expected[name].push(record.version);
  }
  for (const versions of Object.values(expected)) versions.sort();
  return expected;
}


export function validateNpmAuditBinding(actual, expected, lockText) {
  if (
    !isPlainObject(actual) ||
    actual.method !== "POST" ||
    actual.origin !== NPM_AUDIT_ORIGIN ||
    actual.path !== NPM_AUDIT_PATH ||
    !Buffer.isBuffer(actual.body)
  ) fail("NPM_AUDIT_REQUEST_INVALID");
  const binding = {
    method: actual.method,
    origin: actual.origin,
    path: actual.path,
    bodyDerivedFromExactLock: true,
    bodySha256: digest(actual.body),
    bodyBytes: actual.body.length,
  };
  const bodyDocument = parseStrict(actual.body.toString("utf8"), "NPM_AUDIT_REQUEST_INVALID");
  if (canonicalize(bodyDocument) !== canonicalize(expectedNpmAuditPayload(lockText))) {
    fail("NPM_AUDIT_NOT_DERIVED_FROM_LOCK");
  }
  if (
    !isPlainObject(expected) ||
    binding.method !== expected.method ||
    binding.origin !== expected.origin ||
    binding.path !== expected.path ||
    expected.bodyDerivedFromExactLock !== true ||
    binding.bodySha256 !== expected.bodySha256 ||
    binding.bodyBytes !== expected.bodyBytes
  ) fail("NPM_AUDIT_BODY_MISMATCH");
  return binding;
}

function readIncomingBody(request, limit, timeoutMs) {
  return withDeadline(async (signal) => {
    const chunks = [];
    let length = 0;
    const abort = () => request.destroy(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    try {
      for await (const chunk of request) {
        if (signal.aborted) throw signal.reason;
        const bytes = Buffer.from(chunk);
        length += bytes.length;
        if (length > limit) fail("NPM_AUDIT_BODY_TOO_LARGE");
        chunks.push(bytes);
      }
    } catch (error) {
      request.destroy(error);
      throw error;
    } finally {
      signal.removeEventListener("abort", abort);
    }
    return Buffer.concat(chunks, length);
  }, { timeoutMs, code: "NPM_AUDIT_BODY_TIMEOUT" });
}

export async function awaitNpmAuditCommand({ entry, execute, captured, timeoutMs }) {
  const commandAbort = new AbortController();
  let commandTask;
  const boundedCapture = withDeadline(() => captured, {
    timeoutMs,
    code: "NPM_AUDIT_REQUEST_TIMEOUT",
  }).catch((error) => {
    commandAbort.abort(error);
    throw error;
  });
  try {
    commandTask = execute(entry, { signal: commandAbort.signal });
    const [commandResult, requestResult] = await Promise.all([
      commandTask,
      boundedCapture,
    ]);
    return { commandResult, requestResult };
  } catch (error) {
    commandAbort.abort(error);
    await Promise.race([
      Promise.resolve(commandTask).catch(() => undefined),
      new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000)),
    ]);
    throw error;
  } finally {
    commandAbort.abort(new AcceptanceError("NPM_AUDIT_PROXY_CLOSED"));
  }
}

export async function defaultNpmAuditRunner({ entry, execute, expectedRequest, allowedOrigins, fetcher, deadlines }) {
  const lockText = await readFile(resolve(entry.cwd, "package-lock.json"), "utf8");
  let settleRequest;
  let rejectRequest;
  const captured = new Promise((resolvePromise, rejectPromise) => {
    settleRequest = resolvePromise;
    rejectRequest = rejectPromise;
  });
  let handled = false;
  const server = createServer((request, response) => {
    void (async () => {
      try {
        if (handled) fail("NPM_AUDIT_MULTIPLE_REQUESTS");
        handled = true;
        const body = await readIncomingBody(request, 4_194_304, deadlines.bodyMs);
        const binding = validateNpmAuditBinding({
          method: request.method,
          origin: NPM_AUDIT_ORIGIN,
          path: request.url,
          body,
        }, expectedRequest, lockText);
        const upstream = await registryRequest(
          `${NPM_AUDIT_ORIGIN}${NPM_AUDIT_PATH}`,
          { method: "POST", headers: { Accept: "application/json", "Content-Type": request.headers["content-type"] ?? "application/json" }, body },
          new Set(allowedOrigins),
          fetcher,
          { deadlines },
        );
        const upstreamBody = await responseBytes(upstream, 16 * 1024 * 1024, { deadlines });
        response.statusCode = upstream.status;
        response.setHeader("content-type", upstream.headers.get("content-type") ?? "application/json");
        response.end(upstreamBody);
        settleRequest(binding);
      } catch (error) {
        response.statusCode = 502;
        response.end("audit proxy rejected request");
        rejectRequest(error);
      }
    })();
  });
  try {
    await new Promise((resolvePromise, rejectPromise) => {
      server.once("error", rejectPromise);
      server.listen(0, "127.0.0.1", resolvePromise);
    });
    const address = server.address();
    if (!isPlainObject(address) || !Number.isSafeInteger(address.port)) fail("NPM_AUDIT_PROXY_FAILED");
    const boundEntry = {
      ...entry,
      args: [...entry.args, `--registry=http://127.0.0.1:${address.port}`],
    };
    const { commandResult, requestResult } = await awaitNpmAuditCommand({
      entry: boundEntry,
      execute,
      captured,
      timeoutMs: deadlines.requestMs,
    });
    return { result: commandResult, binding: requestResult };
  } finally {
    if (server.listening) {
      await new Promise((resolvePromise) => {
        server.close(() => resolvePromise());
        server.closeAllConnections?.();
      });
    } else {
      server.closeAllConnections?.();
    }
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function validateCleanupAbsence(kind, name, result) {
  if (!['container', 'image', 'network'].includes(kind) || typeof name !== "string" || !isPlainObject(result)) {
    fail("CLEANUP_ABSENCE_UNPROVEN");
  }
  const message = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const escaped = escapeRegex(name);
  const absent = kind === "container"
    ? new RegExp(`(?:No such container:\\s*${escaped})(?:\\s|$)`, "i").test(message)
    : kind === "image"
      ? new RegExp(`(?:No such image:\\s*${escaped})(?:\\s|$)`, "i").test(message)
      : new RegExp(`(?:network\\s+${escaped}\\s+not found|No such network:\\s*${escaped})(?:\\s|$)`, "i").test(message);
  if (result.code === 1 && absent) return true;
  if (/cannot connect|connection refused|daemon.*(?:unavailable|not running)|context deadline exceeded/i.test(message)) {
    fail("CLEANUP_DAEMON_UNREACHABLE");
  }
  fail("CLEANUP_ABSENCE_UNPROVEN");
}

function validateImageInspect(name, text, options, policy, expectedConfigDigest = null) {
  const image = parseOneObject(text, "IMAGE_INSPECT_INVALID");
  if (image.Os !== "linux" || image.Architecture !== "amd64") fail("IMAGE_PLATFORM_MISMATCH");
  if (name === "caddy") {
    if (!Array.isArray(image.RepoDigests) || !image.RepoDigests.includes(policy.images.caddy.reference)) fail("IMAGE_DIGEST_MISMATCH");
  } else {
    const labels = image.Config?.Labels;
    if (labels?.["org.opencontainers.image.revision"] !== options.candidateCommit || labels?.["io.chaotang.source.tree"] !== options.candidateTree || labels?.["org.opencontainers.image.created"] !== sourceCreated(options.sourceDateEpoch)) fail("IMAGE_SOURCE_IDENTITY_MISMATCH");
    if (!image.Config?.User || /^(?:0|root)(?::(?:0|root))?$/.test(image.Config.User)) fail("IMAGE_ROOT_USER");
    if (!DIGEST_PATTERN.test(expectedConfigDigest ?? "") || image.Id !== expectedConfigDigest) fail("LOADED_IMAGE_CONFIG_DIGEST_MISMATCH");
  }
}

async function buildMetadata(path) {
  const metadata = parseStrict(await readFile(path, "utf8"), "BUILD_METADATA_INVALID");
  const imageDigest = metadata?.["containerimage.digest"];
  const configDigest = metadata?.["containerimage.config.digest"];
  const provenance = metadata?.["buildx.build.provenance"];
  if (!DIGEST_PATTERN.test(imageDigest ?? "") || !DIGEST_PATTERN.test(configDigest ?? "") || !isPlainObject(provenance)) fail("BUILD_METADATA_INVALID");
  return { imageDigest, configDigest, provenance };
}

function validateSbom(value, imageReference, syftVersion) {
  const toolComponents = value?.metadata?.tools?.components;
  if (
    !isPlainObject(value) ||
    value.bomFormat !== "CycloneDX" ||
    !Array.isArray(value.components) || value.components.length === 0 ||
    !Array.isArray(toolComponents) ||
    !toolComponents.some((tool) => String(tool?.name ?? "").toLowerCase() === "syft" && tool?.version === syftVersion) ||
    value.metadata?.component?.type !== "container" ||
    value.metadata?.component?.name !== imageReference ||
    value.metadata?.component?.version !== imageReference.split("@")[1]
  ) fail("SBOM_INVALID");
}

async function normalizeSyftSbom(path, imageReference, syftVersion, sourceDateEpoch) {
  const document = parseStrict(await readFile(path, "utf8"), "SBOM_INVALID");
  const toolComponents = document?.metadata?.tools?.components;
  if (!isPlainObject(document) || document.bomFormat !== "CycloneDX" || !Array.isArray(document.components) || document.components.length === 0 || !Array.isArray(toolComponents) || !toolComponents.some((tool) => String(tool?.name ?? "").toLowerCase() === "syft" && tool?.version === syftVersion)) fail("SBOM_INVALID");
  const existing = isPlainObject(document.metadata.component) ? document.metadata.component : {};
  const properties = Array.isArray(existing.properties) ? existing.properties.filter((property) => property?.name !== "io.chaotang.image.reference") : [];
  document.metadata.component = {
    ...existing,
    type: "container",
    name: imageReference,
    version: imageReference.split("@")[1],
    properties: [...properties, { name: "io.chaotang.image.reference", value: imageReference }],
  };
  const serial = createHash("sha256").update(imageReference).digest("hex").slice(0, 32);
  document.serialNumber = `urn:uuid:${serial.slice(0, 8)}-${serial.slice(8, 12)}-4${serial.slice(13, 16)}-8${serial.slice(17, 20)}-${serial.slice(20)}`;
  document.version = 1;
  document.metadata.timestamp = sourceCreated(sourceDateEpoch);
  await writeFile(path, Buffer.from(canonicalize(document)), { mode: 0o600 });
  validateSbom(document, imageReference, syftVersion);
}

function validateGrypeReport(value, forbiddenSeverities) {
  if (!isPlainObject(value) || !Array.isArray(value.matches) || !Array.isArray(value.ignoredMatches)) fail("GRYPE_REPORT_INVALID");
  if (value.ignoredMatches.length !== 0) fail("GRYPE_IGNORED_MATCH");
  const forbidden = new Set(forbiddenSeverities.map((entry) => entry.toLowerCase()));
  if (value.matches.some((match) => forbidden.has(String(match?.vulnerability?.severity ?? "").toLowerCase()))) fail("GRYPE_VULNERABILITY_BLOCKED");
  return { matchCount: value.matches.length, ignoredCount: value.ignoredMatches.length };
}

function uniqueDeepValue(value, keys) {
  const values = [];
  const visit = (item) => {
    if (Array.isArray(item)) return item.forEach(visit);
    if (!isPlainObject(item)) return;
    for (const [key, nested] of Object.entries(item)) {
      if (keys.includes(key.toLowerCase()) && ["string", "number"].includes(typeof nested)) values.push(String(nested));
      visit(nested);
    }
  };
  visit(value);
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : null;
}

function validateDatabaseStatus(text, policy, observedAt, contentDigest) {
  const status = parseStrict(text, "GRYPE_DB_STATUS_INVALID");
  const built = uniqueDeepValue(status, ["built", "builtat", "buildtime"]);
  const schemaVersion = uniqueDeepValue(status, ["schemaversion", "schema_version"]);
  const producerDigest = uniqueDeepValue(status, ["checksum", "digest"]);
  if (!built || !schemaVersion || !DIGEST_PATTERN.test(producerDigest ?? "") || !RFC3339_UTC_PATTERN.test(built)) fail("GRYPE_DB_STATUS_INVALID");
  const builtEpoch = Date.parse(built);
  const observedEpoch = Date.parse(observedAt);
  if (!Number.isFinite(builtEpoch) || builtEpoch > observedEpoch + policy.vulnerabilityPolicy.databaseMaxFutureSkewSeconds * 1000 || observedEpoch - builtEpoch > policy.vulnerabilityPolicy.databaseMaxAgeHours * 3_600_000) fail("GRYPE_DB_STALE");
  return { built, schemaVersion, producerDigest, contentDigest };
}

function outputSnapshot(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).sort();
  return { lineCount: lines.length, digest: digest(Buffer.from(lines.join("\n"))) };
}

function hostResidualState(results) {
  const processPattern = /(?:verify_integration\.mjs|run_accounting_synthetic_acceptance\.py|uvicorn|next-server|next start)/i;
  const listenerPattern = /(?:verify_integration|uvicorn|next-server|node|python)/i;
  const select = (id, pattern) => (results.get(id)?.stdout ?? "").split(/\r?\n/).map((line) => line.trim()).filter((line) => pattern.test(line)).sort();
  const processResidualFree = sameStrings(select("host-processes-before", processPattern), select("host-processes-after", processPattern));
  const listenerResidualFree = sameStrings(select("host-listeners-before", listenerPattern), select("host-listeners-after", listenerPattern));
  const baselineProcessClean = select("host-processes-before", processPattern).length === 0;
  const baselineListenerClean = select("host-listeners-before", listenerPattern).length === 0;
  return {
    listenersBefore: outputSnapshot(results.get("host-listeners-before")?.stdout ?? ""),
    listenersAfter: outputSnapshot(results.get("host-listeners-after")?.stdout ?? ""),
    processesBefore: outputSnapshot(results.get("host-processes-before")?.stdout ?? ""),
    processesAfter: outputSnapshot(results.get("host-processes-after")?.stdout ?? ""),
    processResidualFree,
    listenerResidualFree,
    baselineProcessClean,
    baselineListenerClean,
  };
}

async function writeCanonical(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, Buffer.from(canonicalize(value)), { flag: "wx", mode: 0o600 });
}

function inspectRawBuildkitProvenance(raw, imageReference, baseReference) {
  if (!isPlainObject(raw)) fail("BUILDKIT_PROVENANCE_INVALID");
  const predicate = isPlainObject(raw.predicate) ? raw.predicate : raw;
  const definition = isPlainObject(predicate.buildDefinition) ? predicate.buildDefinition : null;
  const buildType = definition?.buildType ?? predicate.buildType;
  const builderId = predicate.runDetails?.builder?.id ?? predicate.builder?.id;
  const materials = definition?.resolvedDependencies ?? predicate.materials;
  const completeness = predicate.runDetails?.metadata?.completeness ?? predicate.metadata?.completeness;
  const expectedImageDigest = imageReference.slice(imageReference.lastIndexOf("sha256:") + 7);
  const expectedBaseDigest = baseReference.slice(baseReference.lastIndexOf("sha256:") + 7);
  const subjects = Array.isArray(raw.subject) ? raw.subject : Array.isArray(predicate.subject) ? predicate.subject : [];
  const subjectBound = subjects.some((subject) => isPlainObject(subject?.digest) && subject.digest.sha256 === expectedImageDigest);
  const baseBound = Array.isArray(materials) && materials.some((material) => (
    isPlainObject(material?.digest) && material.digest.sha256 === expectedBaseDigest
  ));
  if (
    buildType !== "https://mobyproject.org/buildkit@v1" ||
    typeof builderId !== "string" ||
    !/^https:\/\/mobyproject\.org\/buildkit\/v0\.31\.1(?:$|\/)/.test(builderId) ||
    completeness?.parameters !== true ||
    completeness?.materials !== true ||
    completeness?.environment !== true ||
    !subjectBound ||
    !baseBound
  ) fail("BUILDKIT_PROVENANCE_NOT_MAX");
  return { buildType, builderId, materials };
}

function chaotangProvenanceParameters(imageName, imageReference, options, policy) {
  const isCaddy = imageName === "caddy";
  return {
    baseImageReference: isCaddy
      ? policy.images.caddy.reference
      : policy.images[imageName === "backend" ? "python" : "node"].reference,
    imageReference,
    policyDigest: POLICY_DIGEST,
    sourceCommit: isCaddy ? null : options.candidateCommit,
    sourceDateEpoch: options.sourceDateEpoch,
    sourceTree: isCaddy ? null : options.candidateTree,
  };
}

function boundProvenancePredicate(raw, imageName, imageReference, options, policy) {
  const baseReference = imageName === "backend" ? policy.images.python.reference : policy.images.node.reference;
  const rawEvidence = inspectRawBuildkitProvenance(raw, imageReference, baseReference);
  const { buildType, builderId } = rawEvidence;
  const releaseBinding = chaotangProvenanceParameters(imageName, imageReference, options, policy);
  const resolvedDependencies = [
    { uri: `git+https://gitee.com/msxn/chaotang-os@${options.candidateCommit}`, digest: { gitCommit: options.candidateCommit, gitTree: options.candidateTree } },
    { uri: `file://${TASK_PATH}#approved-toolchain-policy`, digest: { sha256: POLICY_DIGEST.slice(7) } },
    { uri: baseReference.split("@")[0], digest: { sha256: baseReference.split("sha256:")[1] } },
  ];
  const invocationId = digest(Buffer.from(canonicalize({ buildType, builderId, imageName, releaseBinding, resolvedDependencies })));
  return {
    buildDefinition: {
      buildType,
      externalParameters: {
        buildkit: raw.predicate?.buildDefinition?.externalParameters ?? raw.predicate?.invocation?.parameters ?? raw.invocation?.parameters ?? {},
        chaotang: releaseBinding,
      },
      internalParameters: {
        buildkitMode: "max",
        rawProvenanceDigest: digest(Buffer.from(canonicalize(raw))),
        rawBuildkitProvenance: raw,
      },
      resolvedDependencies,
    },
    runDetails: {
      builder: { id: builderId },
      metadata: {
        invocationId,
        startedOn: sourceCreated(options.sourceDateEpoch),
        finishedOn: sourceCreated(options.sourceDateEpoch),
      },
    },
  };
}

async function materializeReleaseInputs(options, work, policy, tools) {
  const metadata = {
    backend: await buildMetadata(resolve(work, "metadata/backend.json")),
    frontend: await buildMetadata(resolve(work, "metadata/frontend.json")),
  };
  const imageReferences = {
    backend: `chaotang-backend@${metadata.backend.imageDigest}`,
    caddy: policy.images.caddy.reference,
    frontend: `chaotang-frontend@${metadata.frontend.imageDigest}`,
  };
  const imagesEnvPath = resolve(work, "deploy/images.env");
  await mkdir(dirname(imagesEnvPath), { recursive: true, mode: 0o700 });
  await writeFile(imagesEnvPath, `BACKEND_IMAGE=${imageReferences.backend}\nCADDY_IMAGE=${imageReferences.caddy}\nFRONTEND_IMAGE=${imageReferences.frontend}\n`, { flag: "wx", mode: 0o600 });
  const imageEvidence = [];
  for (const name of IMAGE_ORDER) {
    const paths = imagePaths(work, name);
    const sbom = parseStrict(await readFile(paths.sbom, "utf8"), "SBOM_INVALID");
    validateSbom(sbom, imageReferences[name], policy.images.syft.expectedVersion);
    const grype = parseStrict(await readFile(paths.grype, "utf8"), "GRYPE_REPORT_INVALID");
    const counts = validateGrypeReport(grype, policy.vulnerabilityPolicy.forbiddenSeverities);
    const statement = name === "caddy" ? {
      _type: "https://in-toto.io/Statement/v1",
      subject: [{ name: imageReferences.caddy.split("@")[0], digest: { sha256: imageReferences.caddy.split("sha256:")[1] } }],
      predicateType: policy.provenance.predicateType,
      predicate: {
        buildDefinition: {
          buildType: "https://chaotang.local/buildtypes/upstream-pinned-image-adoption/v1",
          externalParameters: { chaotang: chaotangProvenanceParameters(name, imageReferences.caddy, options, policy) },
          internalParameters: { adoptionMode: "pinned-upstream" },
          resolvedDependencies: [
            { uri: imageReferences.caddy.split("@")[0], digest: { sha256: imageReferences.caddy.split("sha256:")[1] } },
            { uri: `git+https://gitee.com/msxn/chaotang-os@${options.candidateCommit}`, digest: { gitCommit: options.candidateCommit, gitTree: options.candidateTree } },
            { uri: `file://${TASK_PATH}#approved-toolchain-policy`, digest: { sha256: POLICY_DIGEST.slice(7) } },
          ],
        },
        runDetails: {
          builder: { id: "https://github.com/docker/buildx" },
          metadata: { invocationId: digest(Buffer.from(imageReferences.caddy)), startedOn: sourceCreated(options.sourceDateEpoch), finishedOn: sourceCreated(options.sourceDateEpoch) },
        },
      },
    } : {
      _type: "https://in-toto.io/Statement/v1",
      subject: [{ name: imageReferences[name].split("@")[0], digest: { sha256: metadata[name].imageDigest.slice(7) } }],
      predicateType: policy.provenance.predicateType,
      predicate: boundProvenancePredicate(metadata[name].provenance, name, imageReferences[name], options, policy),
    };
    await writeCanonical(paths.provenance, statement);
    imageEvidence.push({ name, reference: imageReferences[name], archiveSha256: await hashFile(paths.archive), sbomSha256: await hashFile(paths.sbom), provenanceSha256: await hashFile(paths.provenance), grypeReportSha256: await hashFile(paths.grype), matchCount: counts.matchCount, ignoredCount: counts.ignoredCount });
  }
  const artifact = (bundlePath, sourcePath, kind) => ({ bundlePath, sourcePath, kind });
  const artifacts = [
    artifact("deploy/Caddyfile", resolve(options.repositoryRoot, "deploy/Caddyfile"), "deployment"),
    artifact("deploy/README.md", resolve(options.repositoryRoot, "deploy/README.md"), "documentation"),
    artifact("deploy/compose.yaml", resolve(options.repositoryRoot, "deploy/compose.yaml"), "deployment"),
    artifact("deploy/images.env", imagesEnvPath, "deployment"),
    artifact("locks/backend.requirements-runtime.lock", resolve(options.repositoryRoot, "backend/requirements-runtime.lock"), "lock"),
    artifact("locks/frontend.package-lock.json", resolve(options.repositoryRoot, "frontend/package-lock.json"), "lock"),
  ];
  const images = [];
  for (const name of IMAGE_ORDER) {
    const paths = imagePaths(work, name);
    const archivePath = `images/${name}.oci.tar`;
    const sbomPath = `images/${name}.sbom.json`;
    const provenancePath = `images/${name}.provenance.json`;
    artifacts.push(artifact(archivePath, paths.archive, "oci-archive"), artifact(sbomPath, paths.sbom, "sbom"), artifact(provenancePath, paths.provenance, "provenance"));
    images.push({ name, reference: imageReferences[name], archivePath, sbomPath, provenancePath, sourceRevision: name === "caddy" ? null : options.candidateCommit, sourceTree: name === "caddy" ? null : options.candidateTree });
  }
  const descriptor = {
    schemaVersion: "chaotang-release-input.v2",
    platform: policy.platform,
    runtimeRegistryDigest: "sha256:7caed69599c964b7fc908229d86795008a0956fdae90628a904f8e4ec87dcabe",
    source: { commit: options.candidateCommit, tree: options.candidateTree, sourceDateEpoch: options.sourceDateEpoch },
    tools,
    artifacts,
    locks: [{ path: "locks/backend.requirements-runtime.lock" }, { path: "locks/frontend.package-lock.json" }],
    deployment: { composePath: "deploy/compose.yaml", caddyfilePath: "deploy/Caddyfile", imagesEnvPath: "deploy/images.env" },
    images,
  };
  await writeCanonical(resolve(work, "release-input.json"), descriptor);
  return imageEvidence;
}

async function bindSmokeToVerifiedBundle(plan, work, imageEvidence) {
  const expected = new Map(imageEvidence.map((image) => [image.name, image.reference]));
  const imagesEnv = await readFile(resolve(work, "verified-bundle/deploy/images.env"), "utf8");
  const expectedBytes = [
    `BACKEND_IMAGE=${expected.get("backend")}`,
    `CADDY_IMAGE=${expected.get("caddy")}`,
    `FRONTEND_IMAGE=${expected.get("frontend")}`,
    "",
  ].join("\n");
  if (imagesEnv !== expectedBytes) fail("BUNDLE_IMAGE_REFERENCE_MISMATCH");
  const replacements = new Map([
    ["__BUNDLE_BACKEND_IMAGE__", expected.get("backend")],
    ["__BUNDLE_CADDY_IMAGE__", expected.get("caddy")],
    ["__BUNDLE_FRONTEND_IMAGE__", expected.get("frontend")],
  ]);
  for (const entry of plan) {
    entry.args = entry.args.map((arg) => replacements.get(arg) ?? arg);
  }
  if (plan.some((entry) => entry.args.some((arg) => /^__BUNDLE_[A-Z]+_IMAGE__$/.test(arg)))) {
    fail("BUNDLE_IMAGE_REFERENCE_MISMATCH");
  }
  return Object.fromEntries(IMAGE_ORDER.map((name) => [name, expected.get(name)]));
}

async function materializeBaseImageEvidence(work, policy) {
  const evidence = [];
  for (const name of BASE_SCAN_NAMES) {
    const paths = imagePaths(work, `base-${name}`);
    const reference = policy.images[name].reference;
    const sbom = parseStrict(await readFile(paths.sbom, "utf8"), "SBOM_INVALID");
    validateSbom(sbom, reference, policy.images.syft.expectedVersion);
    const grype = parseStrict(await readFile(paths.grype, "utf8"), "GRYPE_REPORT_INVALID");
    const counts = validateGrypeReport(grype, policy.vulnerabilityPolicy.forbiddenSeverities);
    evidence.push({
      name,
      reference,
      sbomSha256: await hashFile(paths.sbom),
      grypeReportSha256: await hashFile(paths.grype),
      matchCount: counts.matchCount,
      ignoredCount: counts.ignoredCount,
    });
  }
  return evidence;
}

function validateSmokeInspect(text) {
  const containers = parseStrict(text, "SMOKE_INSPECT_INVALID");
  if (!Array.isArray(containers) || containers.length !== 3) fail("SMOKE_INSPECT_INVALID");
  for (const container of containers) {
    const user = container.Config?.User;
    const host = container.HostConfig;
    const ports = container.NetworkSettings?.Ports ?? {};
    if (!user || /^(?:0|root)(?::(?:0|root))?$/.test(user) || host?.ReadonlyRootfs !== true || !host?.CapDrop?.includes("ALL") || !host?.SecurityOpt?.includes("no-new-privileges") || Object.values(ports).some((bindings) => Array.isArray(bindings) && bindings.length > 0) || container.State?.Running !== true) fail("SMOKE_SECURITY_INVALID");
  }
  return containers.map((container) => container.Name?.replace(/^\//, "")).sort();
}

function secureEnvironment(work, sourceDateEpoch) {
  return {
    PATH: "/usr/bin:/bin",
    HOME: resolve(work, "home"),
    DOCKER_CONFIG: resolve(work, "docker-config"),
    npm_config_userconfig: resolve(work, "npmrc-empty"),
    npm_config_globalconfig: "/dev/null",
    PIP_CONFIG_FILE: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    SOURCE_DATE_EPOCH: String(sourceDateEpoch),
    LANG: "C.UTF-8",
  };
}

function secureCandidateEnvironment(isolationRoot, sourceDateEpoch) {
  return {
    PATH: "/usr/bin:/bin",
    HOME: resolve(isolationRoot, "work/home"),
    npm_config_userconfig: resolve(isolationRoot, "work/npmrc-empty"),
    npm_config_globalconfig: "/dev/null",
    PIP_CONFIG_FILE: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    PYTHONDONTWRITEBYTECODE: "1",
    TMPDIR: resolve(isolationRoot, "work/tmp"),
    CHAOTANG_INTEGRATION_PYTHON: resolve(isolationRoot, "runtime/backend-runtime-venv/bin/python"),
    SOURCE_DATE_EPOCH: String(sourceDateEpoch),
    LANG: "C.UTF-8",
  };
}

function defaultCandidateIsolation() {
  const euid = typeof process.geteuid === "function" ? process.geteuid() : null;
  if (euid !== 0) fail("CANDIDATE_ISOLATION_REQUIRES_ROOT");
  return { mode: ISOLATION_MODE, uid: UNTRUSTED_UID, gid: UNTRUSTED_GID };
}

async function pathMissing(path) {
  try {
    await lstat(path);
    return false;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

async function validateDockerContextConfigDir(path) {
  let info;
  try {
    info = await lstat(path);
  } catch {
    fail("DOCKER_CONTEXT_CONFIG_INVALID");
  }
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path || !await pathMissing(resolve(path, "config.json"))) fail("DOCKER_CONTEXT_CONFIG_INVALID");
  const records = await walkRegularFiles(path);
  if (records.length !== 1 || !/^contexts\/meta\/[0-9a-f]{64}\/meta\.json$/.test(records[0].path)) fail("DOCKER_CONTEXT_CONFIG_INVALID");
}

export async function runAcceptance(rawOptions, dependencies = {}) {
  const options = validateAcceptanceOptions(rawOptions);
  if (options.evidenceDir === options.repositoryRoot || options.evidenceDir.startsWith(`${options.repositoryRoot}${sep}`)) fail("EVIDENCE_INSIDE_REPOSITORY");
  await prepareEvidenceDirectory(options.evidenceDir);
  const evidenceIdentity = await directoryIdentity(options.evidenceDir);
  if (options.dockerContextConfigDir === options.evidenceDir || options.dockerContextConfigDir.startsWith(`${options.evidenceDir}${sep}`)) fail("DOCKER_CONTEXT_CONFIG_INVALID");
  await validateDockerContextConfigDir(options.dockerContextConfigDir);
  const executor = dependencies.executor ?? defaultExecutor;
  const registryExporter = dependencies.registryExporter ?? exportPinnedCaddyOci;
  const npmAuditRunner = dependencies.npmAuditRunner ?? defaultNpmAuditRunner;
  const coldBackupRunner = dependencies.coldBackupRunner ?? runColdBackupRehearsal;
  const dockerEndpointValidator = dependencies.dockerEndpointValidator ?? validateDockerSocketEndpoint;
  const candidateIsolation = dependencies.candidateIsolation ?? defaultCandidateIsolation();
  const trustedIdentity = {
    uid: typeof process.geteuid === "function" ? process.geteuid() : -1,
    gid: typeof process.getegid === "function" ? process.getegid() : -1,
  };
  if (
    !isPlainObject(candidateIsolation) || candidateIsolation.mode !== ISOLATION_MODE ||
    !Number.isSafeInteger(candidateIsolation.uid) || !Number.isSafeInteger(candidateIsolation.gid) ||
    candidateIsolation.uid < 1 || candidateIsolation.gid < 1
  ) fail("CANDIDATE_ISOLATION_INVALID");
  if (
    dependencies.candidateIsolation === undefined &&
    (trustedIdentity.uid !== 0 || trustedIdentity.gid !== 0 || candidateIsolation.uid !== UNTRUSTED_UID || candidateIsolation.gid !== UNTRUSTED_GID)
  ) fail("CANDIDATE_ISOLATION_REQUIRES_ROOT");
  const registryDeadlines = normalizeRegistryDeadlines(dependencies.registryDeadlines);
  const now = dependencies.now ?? (() => new Date());
  const egressExpiresAt = Date.parse(options.egressEvidence.expiresAt);
  const assertEgressActive = () => {
    const instant = now().getTime();
    if (
      !Number.isFinite(instant) ||
      instant < Date.parse(options.egressEvidence.activatedAt) ||
      instant >= Date.parse(options.egressEvidence.expiresAt)
    ) fail("EGRESS_LIFECYCLE_INACTIVE");
  };
  const remainingEgressMs = () => {
    return boundedEgressTimeout(now().getTime(), egressExpiresAt);
  };
  const activeRegistryDeadlines = () => {
    const remaining = remainingEgressMs();
    return Object.fromEntries(Object.entries(registryDeadlines).map(([key, value]) => [key, Math.max(1, Math.min(value, remaining))]));
  };
  assertEgressActive();
  const dockerSocketIdentity = await dockerEndpointValidator(options.dockerEndpoint);
  const rounds = [];
  let frozenRoundIdentity = null;
  for (let round = 1; round <= options.rounds; round += 1) {
    const workRoot = resolve(options.evidenceDir, `work-${String(round).padStart(3, "0")}`);
    const isolationRoot = isolationRootFor(options, workRoot);
    if (!await pathMissing(isolationRoot)) fail("CANDIDATE_ISOLATION_PATH_COLLISION");
    await mkdir(workRoot, { recursive: false, mode: 0o700 });
    const workIdentity = await directoryIdentity(workRoot);
    for (const path of ["metadata", "images", "scan", "provenance", "grype-db", "home", "docker-config", "build-source"]) await mkdir(resolve(workRoot, path), { mode: 0o700 });
    await writeFile(resolve(workRoot, "npmrc-empty"), "", { flag: "wx", mode: 0o600 });
    await writeFile(
      resolve(workRoot, "release-expectation.json"),
      `${canonicalize(options.releaseExpectation)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    await writeFile(
      resolve(workRoot, "release-phase.json"),
      `${canonicalize(options.releasePhase)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    await mkdir(isolationRoot, { mode: 0o711 });
    await mkdir(resolve(isolationRoot, "test-source"), { mode: 0o700 });
    await mkdir(resolve(isolationRoot, "install-source"), { mode: 0o700 });
    await mkdir(resolve(isolationRoot, "test-runtime"), { mode: 0o700 });
    await mkdir(resolve(isolationRoot, "runtime"), { mode: 0o700 });
    await mkdir(resolve(isolationRoot, "wheel"), { mode: 0o700 });
    await mkdir(resolve(isolationRoot, "work/home"), { recursive: true, mode: 0o700 });
    await mkdir(resolve(isolationRoot, "work/tmp"), { mode: 0o700 });
    await mkdir(resolve(isolationRoot, "work/smoke-stage"), { mode: 0o700 });
    await writeFile(resolve(isolationRoot, "work/npmrc-empty"), "", { flag: "wx", mode: 0o600 });
    const env = secureEnvironment(workRoot, options.sourceDateEpoch);
    const candidateEnv = secureCandidateEnvironment(isolationRoot, options.sourceDateEpoch);
    const commands = [];
    const results = new Map();
    const plan = buildAcceptancePlan(options, workRoot);
    const smoke = smokeNames(options, workRoot);
    let networkCreated = false;
    let failure = null;
    let policy = null;
    let tools = null;
    let toolVersions = null;
    let observedAt = null;
    let completedAt = null;
    let imageEvidence = null;
    let baseImageEvidence = null;
    let grypeDatabase = null;
    let bundle = null;
    let backup = null;
    let coldBackup = null;
    let smokeEvidence = null;
    let hostState = null;
    let caddyExport = null;
    let npmAuditBinding = null;
    let bundleImageReferences = null;
    let buildSourceIdentity = null;
    let candidateIsolationReady = false;
    let testSourceReady = false;
    let testSourceIdentity = null;
    let testRuntimeFrozen = false;
    let backendTestLockDigest = null;
    let runtimeFrozen = false;
    let wheelEvidence = null;
    const testSource = resolve(isolationRoot, "test-source");
    const installSource = resolve(isolationRoot, "install-source");
    const untrustedWork = resolve(isolationRoot, "work");
    const testRuntimeRoot = resolve(isolationRoot, "test-runtime");
    const runtimeRoot = resolve(isolationRoot, "runtime");
    const wheelRoot = resolve(isolationRoot, "wheel");
    const runtimePython = resolve(runtimeRoot, "backend-runtime-venv/bin/python");
    const runtimeRequired = new Set(["backend-runtime-contract", "sqlite-backup", "sqlite-smoke-seed", "integration", "accounting"]);
    const execute = async (entry, executionOptions = {}) => {
      await assertDirectoryIdentity(evidenceIdentity);
      await assertDirectoryIdentity(workIdentity, "WORK_ROOT_CHANGED");
      let timeoutMs = MAX_COMMAND_MS;
      if (executionOptions.cleanup !== true) {
        assertEgressActive();
        timeoutMs = Math.min(timeoutMs, remainingEgressMs());
      }
      if (entry.tool === "/usr/bin/docker") {
        const before = await dockerEndpointValidator(options.dockerEndpoint);
        if (!sameSocketIdentity(before, dockerSocketIdentity)) fail("DOCKER_ENDPOINT_CHANGED");
      }
      if (entry.isolation !== null && !candidateIsolationReady) fail("CANDIDATE_ISOLATION_NOT_READY");
      if (entry.isolation !== null && entry.id !== "frontend-clean-install" && !testSourceReady) fail("IMMUTABLE_TEST_SOURCE_NOT_READY");
      if (["backend-tests", "backend-ruff"].includes(entry.id) && !testRuntimeFrozen) {
        fail("FROZEN_TEST_RUNTIME_NOT_READY");
      }
      if (runtimeRequired.has(entry.id) && !runtimeFrozen) fail("FROZEN_RUNTIME_NOT_READY");
      const commandEnv = entry.isolation !== null
        ? candidateEnv
        : entry.id === "docker-context" ? { ...env, DOCKER_CONFIG: options.dockerContextConfigDir } : env;
      const executedIsolation = entry.isolation === null ? null : candidateIsolation;
      const result = await executor(entry.tool, entry.args, {
        id: entry.id,
        cwd: entry.cwd,
        timeoutMs,
        env: commandEnv,
        isolation: executedIsolation,
        signal: executionOptions.signal,
      });
      if (entry.tool === "/usr/bin/docker") {
        const after = await dockerEndpointValidator(options.dockerEndpoint);
        if (!sameSocketIdentity(after, dockerSocketIdentity)) fail("DOCKER_ENDPOINT_CHANGED");
      }
      await assertDirectoryIdentity(evidenceIdentity);
      await assertDirectoryIdentity(workIdentity, "WORK_ROOT_CHANGED");
      if (entry.isolation !== null && testSourceReady) {
        const currentTestSource = await protectedTestSourceDigest(
          testSource,
          resolve(installSource, "frontend/node_modules"),
          candidateIsolation,
          trustedIdentity,
        );
        if (canonicalize(currentTestSource) !== canonicalize(testSourceIdentity)) fail("TEST_SOURCE_CHANGED_DURING_COMMAND");
      }
      commands.push(commandEvidence({ ...entry, isolation: executedIsolation }, result));
      results.set(entry.id, result);
      if (!entry.expectedCodes.includes(result.code)) fail(`ACCEPTANCE_COMMAND_FAILED:${entry.id}`);
      return result;
    };
    try {
      for (const entry of plan) {
        if (entry.id === "backend-test-venv") {
          await prepareCandidatePhaseRoot(testRuntimeRoot, candidateIsolation, trustedIdentity);
        }
        if (entry.id === "backend-builder-venv" || entry.id === "backend-runtime-venv") {
          await prepareCandidatePhaseRoot(runtimeRoot, candidateIsolation, trustedIdentity);
        }
        if (entry.id === "backend-runtime-wheel") {
          await prepareCandidatePhaseRoot(wheelRoot, candidateIsolation, trustedIdentity);
        }
        if (entry.id === "bundle-build") {
          imageEvidence = await materializeReleaseInputs(options, workRoot, policy, tools);
          if (imageEvidence.find((image) => image.name === "caddy")?.archiveSha256 !== caddyExport?.archiveSha256) fail("CADDY_OCI_EXPORT_DIGEST_MISMATCH");
        }
        if (entry.id === "smoke-network") networkCreated = true;
        let result;
        if (entry.id === "frontend-audit") {
          const audit = await npmAuditRunner({
            entry,
            execute,
            expectedRequest: options.egressEvidence.npmAuditRequest,
            allowedOrigins: options.egressEvidence.allowedOrigins,
            fetcher: dependencies.fetch,
            deadlines: activeRegistryDeadlines(),
          });
          if (!isPlainObject(audit) || !isPlainObject(audit.result) || !isPlainObject(audit.binding)) fail("NPM_AUDIT_BINDING_MISSING");
          result = audit.result;
          npmAuditBinding = audit.binding;
          if (canonicalize(npmAuditBinding) !== canonicalize(options.egressEvidence.npmAuditRequest)) fail("NPM_AUDIT_BODY_MISMATCH");
        } else {
          result = await execute(entry);
        }
        if (entry.id === "policy-parent") policy = await validatePolicyAndSource(options, results);
        else if (entry.id === "extract-install-source") {
          await setTreeAccess(testSource, { ...trustedIdentity, writable: false });
          await setTreeAccess(installSource, { ...candidateIsolation, writable: true });
          await setTreeAccess(untrustedWork, { ...candidateIsolation, writable: true });
          await assertTreeOwner(installSource, candidateIsolation.uid, candidateIsolation.gid);
          await assertTreeOwner(untrustedWork, candidateIsolation.uid, candidateIsolation.gid);
          candidateIsolationReady = true;
        }
        else if (entry.id === "time-sync") {
          if (result.stdout.trim() !== "yes") fail("NTP_NOT_SYNCHRONIZED");
          observedAt = now().toISOString();
          assertEgressActive();
        } else if (entry.id === "grype-version") {
          tools = validateToolResults(options, policy, results);
          toolVersions = exactToolVersions(policy, results, candidateIsolation);
        }
        else if (entry.id === "frontend-clean-install") {
          for (const name of ["package.json", "package-lock.json"]) {
            const trustedBytes = await readFile(resolve(testSource, "frontend", name));
            const installedBytes = await readFile(resolve(installSource, "frontend", name));
            if (!trustedBytes.equals(installedBytes)) fail("FRONTEND_INSTALL_MANIFEST_CHANGED");
          }
          const dependencyRoot = resolve(installSource, "frontend/node_modules");
          const dependencyInfo = await lstat(dependencyRoot);
          if (!dependencyInfo.isDirectory() || dependencyInfo.isSymbolicLink()) fail("FRONTEND_DEPENDENCIES_MISSING");
          await setTreeAccess(installSource, { ...trustedIdentity, writable: false });
          await assertFrozenTree(installSource, trustedIdentity.uid, trustedIdentity.gid);
          const frontendRoot = resolve(testSource, "frontend");
          await chmod(frontendRoot, 0o700);
          try {
            await symlink(dependencyRoot, resolve(frontendRoot, "node_modules"), "dir");
            await mkdir(resolve(frontendRoot, ".next"), { mode: 0o700 });
            await writeFile(resolve(frontendRoot, "tsconfig.tsbuildinfo"), "", { flag: "wx", mode: 0o600 });
          } finally {
            await chmod(frontendRoot, 0o555);
          }
          await lchown(resolve(testSource, "frontend/.next"), candidateIsolation.uid, candidateIsolation.gid);
          await lchown(resolve(testSource, "frontend/tsconfig.tsbuildinfo"), candidateIsolation.uid, candidateIsolation.gid);
          testSourceIdentity = await protectedTestSourceDigest(testSource, dependencyRoot, candidateIsolation, trustedIdentity);
          testSourceReady = true;
        }
        else if (entry.id === "backend-test-lock-install") {
          backendTestLockDigest = await hashFile(resolve(testSource, "backend/requirements-runtime.lock"));
        }
        else if (entry.id === "backend-test-app-install") {
          await setTreeAccess(testRuntimeRoot, { ...trustedIdentity, writable: false });
          await assertFrozenTree(testRuntimeRoot, trustedIdentity.uid, trustedIdentity.gid);
          testRuntimeFrozen = true;
        }
        else if (entry.id === "backend-runtime-wheel") {
          wheelEvidence = await freezeWheelArtifact(wheelRoot, trustedIdentity);
          await setTreeAccess(runtimeRoot, { ...trustedIdentity, writable: true });
          await rm(runtimeRoot, { recursive: true, force: false });
          await mkdir(runtimeRoot, { mode: 0o700 });
          await lchown(runtimeRoot, trustedIdentity.uid, trustedIdentity.gid);
        }
        else if (entry.id === "backend-runtime-app-install") {
          const interpreter = await lstat(runtimePython);
          if (!interpreter.isFile() || interpreter.isSymbolicLink() || interpreter.nlink !== 1) fail("RUNTIME_INTERPRETER_INVALID");
          await setTreeAccess(runtimeRoot, { ...trustedIdentity, writable: false });
          await assertFrozenTree(runtimeRoot, trustedIdentity.uid, trustedIdentity.gid);
          runtimeFrozen = true;
        }
        else if (entry.id === "frontend-audit") validateFrontendAudit(result.stdout);
        else if (entry.id === "extract-build-source") {
          buildSourceIdentity = await treeDigest(resolve(workRoot, "build-source"));
          if (buildSourceIdentity.fileCount === 0) fail("BUILD_SOURCE_SNAPSHOT_EMPTY");
        }
        else if (entry.id === "build-frontend") {
          if (!buildSourceIdentity || canonicalize(await treeDigest(resolve(workRoot, "build-source"))) !== canonicalize(buildSourceIdentity)) {
            fail("BUILD_SOURCE_CHANGED");
          }
        }
        else if (entry.id === "pull-caddy") {
          const exported = await registryExporter({
            reference: policy.images.caddy.reference,
            archivePath: imagePaths(workRoot, "caddy").archive,
            layoutRoot: resolve(workRoot, "caddy-oci-layout"),
            sourceDateEpoch: options.sourceDateEpoch,
            allowedOrigins: options.egressEvidence.allowedOrigins,
            fetcher: dependencies.fetch,
            deadlines: activeRegistryDeadlines(),
          });
          if (
            !hasExactKeys(exported, ["manifestDigest", "platform", "layerCount", "contentBytes", "archiveSha256", "entryCount"]) ||
            exported.manifestDigest !== policy.images.caddy.reference.split("@")[1] ||
            exported.platform !== "linux/amd64" ||
            !DIGEST_PATTERN.test(exported.archiveSha256 ?? "") ||
            !Number.isSafeInteger(exported.layerCount) || exported.layerCount <= 0 ||
            !Number.isSafeInteger(exported.entryCount) || exported.entryCount < 5 ||
            !Number.isSafeInteger(exported.contentBytes) || exported.contentBytes <= 0
          ) fail("CADDY_OCI_EXPORT_INVALID");
          caddyExport = { ...exported };
        }
        else if (/^syft-(?:backend|caddy|frontend|base-node|base-python)$/.test(entry.id)) {
          const name = entry.id.slice("syft-".length);
          const imageReference = name.startsWith("base-")
            ? policy.images[name.slice("base-".length)].reference
            : name === "caddy"
              ? policy.images.caddy.reference
              : `chaotang-${name}@${(await buildMetadata(resolve(workRoot, `metadata/${name}.json`))).imageDigest}`;
          await normalizeSyftSbom(imagePaths(workRoot, name).sbom, imageReference, policy.images.syft.expectedVersion, options.sourceDateEpoch);
        }
        else if (/^inspect-(?:imported-)?(?:backend|caddy|frontend)$/.test(entry.id)) {
          const name = entry.id.replace(/^inspect-(?:imported-)?/, "");
          const expectedConfigDigest = name === "caddy" ? null : (await buildMetadata(resolve(workRoot, `metadata/${name}.json`))).configDigest;
          validateImageInspect(name, result.stdout, options, policy, expectedConfigDigest);
        }
        else if (entry.id.startsWith("grype-") && !["grype-version", "grype-db-status"].includes(entry.id)) {
          const name = entry.id.slice("grype-".length);
          const report = parseStrict(result.stdout, "GRYPE_REPORT_INVALID");
          validateGrypeReport(report, policy.vulnerabilityPolicy.forbiddenSeverities);
          await writeCanonical(imagePaths(workRoot, name).grype, report);
        } else if (entry.id === "grype-db-status") {
          const cache = await treeDigest(resolve(workRoot, "grype-db"));
          if (cache.fileCount === 0) fail("GRYPE_DB_CONTENT_MISSING");
          grypeDatabase = validateDatabaseStatus(result.stdout, policy, observedAt, cache.digest);
          baseImageEvidence = await materializeBaseImageEvidence(workRoot, policy);
        } else if (entry.id === "bundle-build") {
          const built = parseOneObject(result.stdout, "BUNDLE_BUILD_RESULT_INVALID");
          if (
            built.phase?.mode !== "POST_ACCEPTANCE_FINAL" ||
            built.phase?.nonAuthorizing !== true ||
            !DIGEST_PATTERN.test(built.buildManifestDigest ?? "") ||
            !DIGEST_PATTERN.test(built.verificationDigest ?? "") ||
            !DIGEST_PATTERN.test(built.bundleVerificationDigest ?? "") ||
            built.finalRelease?.bundleDigest !== built.buildManifestDigest
          ) fail("BUNDLE_BUILD_RESULT_INVALID");
          const tree = await treeDigest(resolve(workRoot, "bundle"));
          bundle = { manifestDigest: built.buildManifestDigest, treeDigest: tree.digest, fileCount: tree.fileCount };
          bundleImageReferences = await bindSmokeToVerifiedBundle(plan, workRoot, imageEvidence);
        } else if (/^(?:remove-prebundle|assert-prebundle-absent)-(?:backend|caddy|frontend)$/.test(entry.id) && result.code === 1) {
          const reference = entry.args.at(-1);
          validateCleanupAbsence("image", reference, result);
        }
        else if (entry.id === "sqlite-backup") {
          const value = parseOneObject(result.stdout, "BACKUP_RESULT_INVALID");
          if (!HEX_64_PATTERN.test(value.manifestSha256 ?? "") || !DIGEST_PATTERN.test(value.sourceSnapshotIdentity ?? "")) fail("BACKUP_RESULT_INVALID");
          backup = { manifestSha256: `sha256:${value.manifestSha256}`, sourceSnapshotIdentity: value.sourceSnapshotIdentity };
        } else if (entry.id === "sqlite-smoke-seed") {
          const value = parseOneObject(result.stdout, "SMOKE_SEED_INVALID");
          if (!backup || !hasExactKeys(value, ["sourceSnapshotIdentity"]) || value.sourceSnapshotIdentity !== backup.sourceSnapshotIdentity) fail("SMOKE_SEED_INVALID");
          const staged = resolve(untrustedWork, "smoke-stage/data");
          const stagedInfo = await lstat(staged);
          if (!stagedInfo.isDirectory() || stagedInfo.isSymbolicLink() || await realpath(staged) !== staged) fail("SMOKE_SEED_INVALID");
          const smokeIdentity = dependencies.candidateIsolation === undefined
            ? { uid: 10_002, gid: 10_002 }
            : trustedIdentity;
          await setTreeAccess(staged, { ...smokeIdentity, writable: true });
          await rename(staged, resolve(workRoot, "smoke-data"));
        } else if (entry.id === "accounting") {
          coldBackup = validateColdBackupResult(await coldBackupRunner({
            backendContainer: smoke.backend,
            dockerEndpoint: options.dockerEndpoint,
            environment: env,
            execute,
            runtimePython,
            candidateCommit: options.candidateCommit,
            candidateTree: options.candidateTree,
            sourceRoot: resolve(workRoot, "smoke-data"),
            workRoot,
          }));
        } else if (entry.id === "inspect-smoke") smokeEvidence = { containers: validateSmokeInspect(result.stdout), network: smoke.network };
        else if (entry.id === "git-tree-after") {
          if (results.get("git-status-after")?.stdout !== "" || results.get("git-head-after")?.stdout.trim() !== options.candidateCommit || result.stdout.trim() !== options.candidateTree) fail("SOURCE_CHANGED_DURING_ACCEPTANCE");
        }
        else if (entry.id === "host-processes-after") {
          hostState = hostResidualState(results);
          if (!hostState.baselineProcessClean || !hostState.baselineListenerClean) fail("HOST_BASELINE_NOT_CLEAN");
          if (!hostState.processResidualFree) fail("HOST_PROCESS_RESIDUAL");
          if (!hostState.listenerResidualFree) fail("HOST_LISTENER_RESIDUAL");
        }
      }
      if (!policy || !tools || !toolVersions || !observedAt || !npmAuditBinding || !buildSourceIdentity || !testSourceIdentity || !testRuntimeFrozen || !backendTestLockDigest || !runtimeFrozen || !wheelEvidence || !imageEvidence || !baseImageEvidence || !grypeDatabase || !bundle || !bundleImageReferences || !backup || !coldBackup || !smokeEvidence || !hostState || !caddyExport) fail("ACCEPTANCE_EVIDENCE_INCOMPLETE");
      const observedEpoch = Date.parse(observedAt);
      if (observedEpoch < Date.parse(options.egressEvidence.activatedAt)) fail("EGRESS_LIFECYCLE_INACTIVE");
      const roundIdentity = {
        backupSourceSnapshotIdentity: backup.sourceSnapshotIdentity,
        coldBackupSourceSnapshotIdentity: coldBackup.sourceSnapshotIdentity,
        buildSourceSnapshotDigest: buildSourceIdentity.digest,
        testSourceSnapshotDigest: testSourceIdentity.digest,
        backendTestLockDigest,
        backendWheelDigest: wheelEvidence.sha256,
        bundleManifestDigest: bundle.manifestDigest,
        imageReferences: imageEvidence.map(({ name, reference }) => ({ name, reference })),
        baseImageReferences: baseImageEvidence.map(({ name, reference }) => ({ name, reference })),
        toolVersions,
      };
      if (frozenRoundIdentity === null) frozenRoundIdentity = roundIdentity;
      else if (canonicalize(roundIdentity) !== canonicalize(frozenRoundIdentity)) fail("ROUND_IDENTITY_DRIFT");
    } catch (error) {
      failure = error instanceof AcceptanceError ? error : new AcceptanceError("ACCEPTANCE_INTERNAL_ERROR");
      if (!(error instanceof AcceptanceError)) failure.cause = error;
    } finally {
      let containersRemoved = !networkCreated;
      let networkRemoved = !networkCreated;
      if (results.has("host-processes-before") && !results.has("host-processes-after")) {
        try {
          await execute(command("host-listeners-after", "/usr/bin/ss", ["-H", "-ltnp"], options.repositoryRoot));
          await execute(command("host-processes-after", "/usr/bin/ps", ["-eo", "pid=,ppid=,comm=,args="], options.repositoryRoot));
          hostState = hostResidualState(results);
          if (!hostState.baselineProcessClean || !hostState.baselineListenerClean) failure ??= new AcceptanceError("HOST_BASELINE_NOT_CLEAN");
          if (!hostState.processResidualFree) failure ??= new AcceptanceError("HOST_PROCESS_RESIDUAL");
          if (!hostState.listenerResidualFree) failure ??= new AcceptanceError("HOST_LISTENER_RESIDUAL");
        } catch (error) {
          failure ??= error instanceof AcceptanceError ? error : new AcceptanceError("HOST_STATE_CLEANUP_CHECK_FAILED");
        }
      }
      if (networkCreated) {
        const cleanupErrors = [];
        const attempt = async (operation) => {
          try {
            await operation();
            return true;
          } catch (error) {
            cleanupErrors.push(error instanceof AcceptanceError ? error : new AcceptanceError("CLEANUP_INTERNAL_ERROR"));
            return false;
          }
        };
        const removeOwned = async (kind, name, id) => {
          const inspected = await execute(
            dockerCommand(`cleanup-inspect-${kind}-${id}`, options.dockerEndpoint, [kind, "inspect", name], options.repositoryRoot, [0, 1]),
            { cleanup: true },
          );
          if (inspected.code === 1) {
            validateCleanupAbsence(kind, name, inspected);
            return;
          }
          const identity = parseOneObject(inspected.stdout, "CLEANUP_RESOURCE_IDENTITY_INVALID");
          const labels = kind === "container" ? identity.Config?.Labels : identity.Labels;
          if (
            !HEX_64_PATTERN.test(identity.Id ?? "") ||
            labels?.["io.chaotang.acceptance.owner"] !== smoke.ownership
          ) fail("CLEANUP_RESOURCE_NOT_OWNED");
          const args = kind === "container"
            ? ["container", "rm", "--force", identity.Id]
            : ["network", "rm", identity.Id];
          const removed = await execute(
            dockerCommand(`cleanup-${kind}-${id}`, options.dockerEndpoint, args, options.repositoryRoot, [0, 1]),
            { cleanup: true },
          );
          if (removed.code === 1) validateCleanupAbsence(kind, name, removed);
        };
        for (const [name, value] of [["backend", smoke.backend], ["caddy", smoke.caddy], ["frontend", smoke.frontend]]) {
          await attempt(() => removeOwned("container", value, name));
        }
        await attempt(() => removeOwned("network", smoke.network, "network"));
        await attempt(() => execute(
          dockerCommand("cleanup-daemon-health", options.dockerEndpoint, ["version", "--format", "{{json .Server}}"], options.repositoryRoot),
          { cleanup: true },
        ));
        const containerAbsence = [];
        for (const [name, value] of [["backend", smoke.backend], ["caddy", smoke.caddy], ["frontend", smoke.frontend]]) {
          containerAbsence.push(await attempt(async () => {
            const absent = await execute(
              dockerCommand(`assert-container-absent-${name}`, options.dockerEndpoint, ["container", "inspect", value], options.repositoryRoot, [1]),
              { cleanup: true },
            );
            validateCleanupAbsence("container", value, absent);
          }));
        }
        const networkAbsent = await attempt(async () => {
          const absent = await execute(
            dockerCommand("assert-network-absent", options.dockerEndpoint, ["network", "inspect", smoke.network], options.repositoryRoot, [1]),
            { cleanup: true },
          );
          validateCleanupAbsence("network", smoke.network, absent);
        });
        containersRemoved = containerAbsence.every(Boolean);
        networkRemoved = networkAbsent;
        if (cleanupErrors.length > 0) failure ??= cleanupErrors[0];
      }
      completedAt = now().toISOString();
      const completedEpoch = Date.parse(completedAt);
      if (observedAt !== null && (completedEpoch < Date.parse(observedAt) || completedEpoch >= Date.parse(options.egressEvidence.expiresAt))) {
        failure ??= new AcceptanceError("EGRESS_LIFECYCLE_INACTIVE");
      }
      try {
        await assertDirectoryIdentity(evidenceIdentity);
        await assertDirectoryIdentity(workIdentity, "WORK_ROOT_CHANGED");
        await rm(workRoot, { recursive: true, force: true });
      } catch (error) {
        failure ??= new AcceptanceError(`WORK_ROOT_CLEANUP_FAILED:${error?.code ?? "UNKNOWN"}`);
      }
      const workRootRemoved = await pathMissing(workRoot);
      if (!workRootRemoved) failure ??= new AcceptanceError("WORK_ROOT_CLEANUP_FAILED");
      try {
        await removeIsolationTree(isolationRoot);
      } catch (error) {
        failure ??= new AcceptanceError(`ISOLATION_ROOT_CLEANUP_FAILED:${error?.code ?? "UNKNOWN"}`);
      }
      const isolationRootRemoved = await pathMissing(isolationRoot);
      if (!isolationRootRemoved) failure ??= new AcceptanceError("ISOLATION_ROOT_CLEANUP_FAILED");
      const evidence = {
        schemaVersion: "rc1-acceptance-round.v1",
        status: failure ? "FAILED" : "PASSED",
        failureCode: failure ? String(failure.code ?? failure.message ?? "RC1_ACCEPTANCE_FAILED") : null,
        candidateCommit: options.candidateCommit,
        candidateTree: options.candidateTree,
        policyDigest: POLICY_DIGEST,
        egressRuleDigest: options.egressEvidence.ruleDigest,
        egress: {
          lifecycleCommandDigest: options.egressEvidence.lifecycleCommandDigest,
          npmAuditBodySha256: npmAuditBinding?.bodySha256 ?? null,
          npmAuditBodyBytes: npmAuditBinding?.bodyBytes ?? null,
          enforcementAuthority: options.egressEvidence.enforcementAuthority,
        },
        isolationId: options.egressEvidence.isolationId,
        observedAt,
        completedAt,
        round,
        tools,
        toolVersions,
        commands,
        images: imageEvidence,
        baseImages: baseImageEvidence,
        buildSource: buildSourceIdentity === null ? null : { ...buildSourceIdentity, sourceTree: options.candidateTree },
        testSource: testSourceIdentity === null ? null : {
          ...testSourceIdentity,
          sourceTree: options.candidateTree,
          immutable: true,
          dependencyInstallScriptsDisabled: true,
          candidateUid: candidateIsolation.uid,
          candidateGid: candidateIsolation.gid,
        },
        backendTestEnvironment: { exactLockSha256: backendTestLockDigest, frozenBeforeFullSuite: testRuntimeFrozen },
        backendWheel: wheelEvidence,
        caddyExport,
        grypeDatabase,
        bundle: bundle === null ? null : { ...bundle, imageReferences: bundleImageReferences },
        backup,
        coldBackup,
        smoke: smokeEvidence,
        hostState,
        integration: failure ? null : { verifyIntegration: true, accountingSynthetic: true },
        cleanup: { containersRemoved, networkRemoved, workRootRemoved, isolationRootRemoved },
      };
      const bytes = Buffer.from(canonicalize(evidence), "utf8");
      await writeFile(resolve(options.evidenceDir, `round-${String(round).padStart(3, "0")}.json`), bytes, { flag: "wx", mode: 0o600 });
      rounds.push({ round, status: evidence.status, digest: digest(bytes), commandCount: commands.length });
    }
    if (failure) throw failure;
  }
  const summary = { schemaVersion: "rc1-acceptance-summary.v1", candidateCommit: options.candidateCommit, candidateTree: options.candidateTree, policyDigest: POLICY_DIGEST, rounds };
  const summaryBytes = Buffer.from(canonicalize(summary), "utf8");
  const evidenceDigest = digest(summaryBytes);
  await writeFile(resolve(options.evidenceDir, "summary.json"), summaryBytes, { flag: "wx", mode: 0o600 });
  await writeFile(resolve(options.evidenceDir, "summary.sha256"), `${evidenceDigest}\n`, { flag: "wx", mode: 0o600 });
  return { roundsCompleted: rounds.length, evidenceDigest };
}

function parseCli(argv) {
  const values = {};
  const allowed = ACCEPTANCE_CLI_KEYS;
  if (argv.length % 2 !== 0) fail("CLI_INVALID");
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.includes(key) || !value || Object.hasOwn(values, key)) fail("CLI_INVALID");
    values[key.slice(2)] = value;
  }
  if (Object.keys(values).length !== allowed.length) fail("CLI_INVALID");
  return values;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    if (process.argv.length === 4 && process.argv[2] === "--operator-inputs") {
      const inputPath = resolve(process.argv[3]);
      const inputInfo = await lstat(inputPath);
      if (!inputInfo.isFile() || inputInfo.isSymbolicLink() || inputInfo.nlink !== 1) {
        fail("OPERATOR_INPUTS_INVALID");
      }
      const raw = await readFile(inputPath, "utf8");
      const operatorInputs = validateOperatorInputsDocument(parseJsonStrict(raw));
      if (raw !== `${canonicalize(operatorInputs)}\n`) fail("OPERATOR_INPUTS_INVALID");
      const result = await runColdReleaseFromOperatorInputs(operatorInputs);
      process.stdout.write(`${canonicalize(result)}\n`);
      process.exitCode = 0;
    } else {
    const cli = parseCli(process.argv.slice(2));
    const egressEvidence = parseJsonStrict(await readFile(resolve(cli["egress-evidence"]), "utf8"));
    const releaseExpectation = parseJsonStrict(await readFile(resolve(cli["release-expectation"]), "utf8"));
    const releasePhase = parseJsonStrict(await readFile(resolve(cli["release-phase"]), "utf8"));
    const result = await runAcceptance({
      candidateCommit: cli.candidate,
      candidateTree: cli.tree,
      sourceDateEpoch: Number(cli["source-date-epoch"]),
      dockerEndpoint: cli["docker-endpoint"],
      dockerContext: cli["docker-context"],
      dockerContextConfigDir: resolve(cli["docker-context-config-dir"]),
      evidenceDir: resolve(cli["evidence-dir"]),
      egressEvidence,
      releaseExpectation,
      releasePhase,
      rounds: Number(cli.rounds),
      repositoryRoot: resolve(cli.repository),
    });
    process.stdout.write(`${canonicalize(result)}\n`);
    }
  } catch (error) {
    process.stderr.write(`${error?.code ?? error?.message ?? "RC1_ACCEPTANCE_FAILED"}\n`);
    process.exitCode = 1;
  }
}

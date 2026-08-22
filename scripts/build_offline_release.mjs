#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  realpath,
  readdir,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalDigest as approvalCanonicalDigest,
  validateApprovalManifest,
  verifyProductCandidate,
} from "./product-authority.mjs";
import {
  parseJsonStrict,
  validateReleaseExpectation,
  verifyOfflineRelease,
} from "./verify_offline_release.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const RUNTIME_REGISTRY_DIGEST = "sha256:014a4d2e5467b70cb2e12b7ab2954771040dc0f6c9f170ae20cf5759d9dcaf52";
const MAX_ENTRY_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 32 * 1024 * 1024 * 1024;
const RESERVED_BUNDLE_PATHS = new Set(["manifest.json", "manifest.sha256"]);
const REQUIRED_ARTIFACT_KINDS = new Map([
  ["deploy/Caddyfile", "deployment"],
  ["deploy/README.md", "documentation"],
  ["deploy/compose.yaml", "deployment"],
  ["deploy/images.env", "deployment"],
  ["locks/backend.requirements-runtime.lock", "lock"],
  ["locks/frontend.package-lock.json", "lock"],
  ...["backend", "caddy", "frontend"].flatMap((name) => [
    [`images/${name}.oci.tar`, "oci-archive"],
    [`images/${name}.provenance.json`, "provenance"],
    [`images/${name}.sbom.json`, "sbom"],
  ]),
]);
const ALLOWED_KINDS = new Set([
  "deployment",
  "documentation",
  "lock",
  "oci-archive",
  "provenance",
  "sbom",
]);
const TRUSTED_REPOSITORY_SOURCES = new Map([
  ["deploy/Caddyfile", "deploy/Caddyfile"],
  ["deploy/README.md", "deploy/README.md"],
  ["deploy/compose.yaml", "deploy/compose.yaml"],
  ["locks/backend.requirements-runtime.lock", "backend/requirements-runtime.lock"],
  ["locks/frontend.package-lock.json", "frontend/package-lock.json"],
]);
const TRUSTED_STAGING_SOURCES = new Map([
  ["deploy/images.env", "deploy/images.env"],
  ...["backend", "caddy", "frontend"].flatMap((name) => [
    [`images/${name}.oci.tar`, `images/${name}.oci.tar`],
    [`images/${name}.sbom.json`, `images/${name}.sbom.json`],
    [`images/${name}.provenance.json`, `provenance/${name}.intoto.json`],
  ]),
]);
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const FORBIDDEN_OUTPUT_ROOTS = ["/etc", "/opt", "/srv", "/var/lib/chaotang-os"];
const CLOSED_GIT_ENV = Object.freeze({
  PATH: "/usr/bin:/bin",
  HOME: "/nonexistent",
  LANG: "C",
  LC_ALL: "C",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_TERMINAL_PROMPT: "0",
});
const CLOSED_GIT_OPTIONS = [
  "-c", "core.fsmonitor=false",
  "-c", "core.hooksPath=/dev/null",
  "-c", "core.preloadIndex=false",
];

export class ReleaseBuildError extends Error {
  constructor(code) {
    super(code);
    this.name = "ReleaseBuildError";
    this.code = code;
  }
}

function fail(code) {
  throw new ReleaseBuildError(code);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertClosed(value, keys, code = "INPUT_SCHEMA_INVALID") {
  if (!isPlainObject(value)) fail(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(code);
  }
}

function assertString(value, pattern = null, code = "INPUT_SCHEMA_INVALID") {
  if (typeof value !== "string" || value.length === 0 || value.length > 16_384) fail(code);
  assertUnicodeScalarString(value, code);
  if (pattern && !pattern.test(value)) fail(code);
}

function assertUnicodeScalarString(value, code = "CANONICAL_JSON_INVALID") {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail(code);
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      fail(code);
    }
  }
}

export function canonicalize(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    assertUnicodeScalarString(value);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("CANONICAL_JSON_INVALID");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (!isPlainObject(value)) fail("CANONICAL_JSON_INVALID");
  return `{${Object.keys(value).sort().map((key) => {
    assertUnicodeScalarString(key);
    if (value[key] === undefined) fail("CANONICAL_JSON_INVALID");
    return `${JSON.stringify(key)}:${canonicalize(value[key])}`;
  }).join(",")}}`;
}

export function digestBytes(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

const PROVISIONAL_RECEIPT_KEYS = [
  "schemaVersion",
  "candidateCommit",
  "candidateTree",
  "approvalDigest",
  "toolchainDigest",
  "sourceDateEpoch",
  "runtimeLockDigest",
  "configDigest",
  "bundleDigest",
  "verificationDigest",
  "createdAt",
  "receiptDigest",
];
const CANONICAL_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const TASK_ID_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,127}$/;
const FIXED_GITEE_EXT_DEV = "git@gitee.com:msxn/chaotang-os.git";

function digestCanonical(value) {
  return digestBytes(Buffer.from(canonicalize(value), "utf8"));
}

function releaseIdentity(value) {
  assertString(value.candidateCommit, SHA_PATTERN, "PROVISIONAL_RECEIPT_INVALID");
  assertString(value.candidateTree, SHA_PATTERN, "PROVISIONAL_RECEIPT_INVALID");
  assertString(value.approvalDigest, DIGEST_PATTERN, "PROVISIONAL_RECEIPT_INVALID");
  assertString(value.bundleDigest, DIGEST_PATTERN, "PROVISIONAL_RECEIPT_INVALID");
  assertString(value.verificationDigest, DIGEST_PATTERN, "PROVISIONAL_RECEIPT_INVALID");
  if (!Number.isSafeInteger(value.sourceDateEpoch) || value.sourceDateEpoch < 0) {
    fail("PROVISIONAL_RECEIPT_INVALID");
  }
  return {
    candidateCommit: value.candidateCommit,
    candidateTree: value.candidateTree,
    approvalDigest: value.approvalDigest,
    toolchainDigest: digestCanonical(value.tools),
    sourceDateEpoch: value.sourceDateEpoch,
    runtimeLockDigest: digestCanonical(value.locks),
    configDigest: digestCanonical(value.deployment),
    bundleDigest: value.bundleDigest,
    verificationDigest: value.verificationDigest,
  };
}

export function createProvisionalReceipt(value) {
  assertString(value.createdAt, CANONICAL_UTC_PATTERN, "PROVISIONAL_RECEIPT_INVALID");
  const payload = {
    schemaVersion: "chaotang.p15-provisional-receipt.v1",
    ...releaseIdentity(value),
    createdAt: value.createdAt,
  };
  return { ...payload, receiptDigest: digestCanonical(payload) };
}

export function validateProvisionalReceipt(receipt) {
  assertClosed(receipt, PROVISIONAL_RECEIPT_KEYS, "PROVISIONAL_RECEIPT_INVALID");
  if (receipt.schemaVersion !== "chaotang.p15-provisional-receipt.v1") {
    fail("PROVISIONAL_RECEIPT_INVALID");
  }
  for (const key of [
    "approvalDigest", "toolchainDigest", "runtimeLockDigest", "configDigest",
    "bundleDigest", "verificationDigest", "receiptDigest",
  ]) assertString(receipt[key], DIGEST_PATTERN, "PROVISIONAL_RECEIPT_INVALID");
  assertString(receipt.candidateCommit, SHA_PATTERN, "PROVISIONAL_RECEIPT_INVALID");
  assertString(receipt.candidateTree, SHA_PATTERN, "PROVISIONAL_RECEIPT_INVALID");
  assertString(receipt.createdAt, CANONICAL_UTC_PATTERN, "PROVISIONAL_RECEIPT_INVALID");
  if (!Number.isSafeInteger(receipt.sourceDateEpoch) || receipt.sourceDateEpoch < 0) {
    fail("PROVISIONAL_RECEIPT_INVALID");
  }
  const { receiptDigest, ...payload } = receipt;
  if (receiptDigest !== digestCanonical(payload)) fail("PROVISIONAL_RECEIPT_DIGEST_MISMATCH");
  return receipt;
}

export function assertFinalReleaseMatchesProvisional(receipt, finalRelease) {
  validateProvisionalReceipt(receipt);
  const identity = releaseIdentity(finalRelease);
  for (const key of [
    "candidateCommit", "candidateTree", "approvalDigest", "toolchainDigest",
    "sourceDateEpoch", "runtimeLockDigest", "configDigest", "bundleDigest", "verificationDigest",
  ]) {
    if (receipt[key] !== identity[key]) fail("FINAL_RELEASE_IDENTITY_MISMATCH");
  }
  return true;
}

export function validateReleasePhase(value) {
  if (!isPlainObject(value)) fail("RELEASE_PHASE_INVALID");
  for (const key of ["approvalCommit", "candidateCommit", "parentCommit", "liveRemoteBefore", "liveRemoteAfter"]) {
    assertString(value[key], SHA_PATTERN, "RELEASE_PHASE_INVALID");
  }
  if (value.parentCommit !== value.approvalCommit) fail("RELEASE_PHASE_INVALID");
  if (value.mode === "PRE_ACCEPTANCE_PROVISIONAL") {
    assertClosed(value, [
      "mode", "approvalCommit", "candidateCommit", "parentCommit", "liveRemoteBefore",
      "liveRemoteAfter", "candidateVerificationStatus",
    ], "RELEASE_PHASE_INVALID");
    if (
      value.liveRemoteBefore !== value.approvalCommit ||
      value.liveRemoteAfter !== value.approvalCommit ||
      value.candidateVerificationStatus !== "VERIFIED_EXACT_SINGLE_CHILD"
    ) fail("RELEASE_PHASE_INVALID");
    return { mode: value.mode, nonAuthorizing: true };
  }
  if (value.mode === "POST_ACCEPTANCE_FINAL") {
    assertClosed(value, [
      "mode", "approvalCommit", "candidateCommit", "parentCommit", "liveRemoteBefore",
      "liveRemoteAfter", "provisionalReceipt", "finalRelease", "acceptanceReferenceDigest",
    ], "RELEASE_PHASE_INVALID");
    assertString(value.acceptanceReferenceDigest, DIGEST_PATTERN, "RELEASE_PHASE_INVALID");
    if (
      value.liveRemoteBefore !== value.candidateCommit ||
      value.liveRemoteAfter !== value.candidateCommit
    ) fail("RELEASE_PHASE_INVALID");
    assertFinalReleaseMatchesProvisional(value.provisionalReceipt, value.finalRelease);
    return { mode: value.mode, nonAuthorizing: true };
  }
  fail("RELEASE_PHASE_INVALID");
}

export function resolveLiveGiteeExtDevHeadWithExecutor(executor = execFileSync) {
  const output = executor("/usr/bin/git", [
    "--no-replace-objects",
    "-c", "credential.helper=",
    "-c", "core.fsmonitor=false",
    "-c", "core.untrackedCache=false",
    "-c", "core.hooksPath=/dev/null",
    "-c", "core.sshCommand=/usr/bin/ssh -F /dev/null -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/ubuntu/.ssh/known_hosts",
    "ls-remote",
    "--heads",
    FIXED_GITEE_EXT_DEV,
    "refs/heads/ext-dev",
  ], {
    cwd: "/tmp",
    encoding: "utf8",
    env: {
      PATH: "/usr/bin:/bin",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: "/bin/false",
      GIT_NO_REPLACE_OBJECTS: "1",
      GIT_OPTIONAL_LOCKS: "0",
    },
    maxBuffer: 1024 * 1024,
    timeout: 15_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const match = /^([0-9a-f]{40})\trefs\/heads\/ext-dev$/u.exec(output);
  if (!match) fail("REMOTE_HEAD_UNVERIFIED");
  return match[1];
}

function localGitText(repositoryRoot, ...args) {
  return execFileSync("/usr/bin/git", [
    ...CLOSED_GIT_OPTIONS,
    "--no-replace-objects",
    ...args,
  ], {
    cwd: repositoryRoot,
    env: { ...CLOSED_GIT_ENV, GIT_OPTIONAL_LOCKS: "0" },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 20_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export async function inspectLocalReleaseCandidate(value) {
  assertClosed(value, [
    "approvalCommit", "approvalDigest", "candidateCommit", "candidateTree", "parentCommit",
    "repositoryRoot", "taskId",
  ], "RELEASE_PHASE_INVALID");
  for (const key of ["approvalCommit", "candidateCommit", "candidateTree", "parentCommit"]) {
    assertString(value[key], SHA_PATTERN, "RELEASE_PHASE_INVALID");
  }
  assertString(value.approvalDigest, DIGEST_PATTERN, "RELEASE_PHASE_INVALID");
  assertString(value.repositoryRoot, null, "RELEASE_PHASE_INVALID");
  assertString(value.taskId, TASK_ID_PATTERN, "RELEASE_PHASE_INVALID");
  if (value.parentCommit !== value.approvalCommit) fail("RELEASE_PHASE_INVALID");
  const root = resolve(value.repositoryRoot);
  let status;
  let commit;
  let tree;
  let parent;
  let manifest;
  let productPaths;
  try {
    status = localGitText(root, "status", "--porcelain=v1", "--untracked-files=all");
    commit = localGitText(root, "rev-parse", "HEAD");
    tree = localGitText(root, "rev-parse", "HEAD^{tree}");
    parent = localGitText(root, "rev-parse", "HEAD^");
    manifest = validateApprovalManifest(parseJsonStrict(localGitText(
      root,
      "show",
      `${value.approvalCommit}:.harness/approvals/${value.taskId}.json`,
    )));
    productPaths = localGitText(
      root,
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      value.candidateCommit,
    ).split("\n").filter(Boolean).sort();
  } catch {
    fail("RELEASE_CANDIDATE_UNVERIFIED");
  }
  if (
    status !== "" ||
    commit !== value.candidateCommit ||
    tree !== value.candidateTree ||
    parent !== value.parentCommit ||
    manifest.taskId !== value.taskId ||
    approvalCanonicalDigest(manifest) !== value.approvalDigest ||
    canonicalize(productPaths) !== canonicalize([...manifest.request.productPaths].sort())
  ) fail("RELEASE_CANDIDATE_UNVERIFIED");
  return { approvalDigest: value.approvalDigest, commit, tree, parent };
}

export async function runReleasePhaseWithLiveAuthority(
  value,
  operation,
  dependencies = {},
) {
  if (typeof operation !== "function") fail("RELEASE_PHASE_INVALID");
  const commonKeys = [
    "mode", "approvalCommit", "approvalDigest", "candidateCommit", "candidateTree", "parentCommit",
    "repositoryRoot", "taskId",
  ];
  if (value?.mode === "PRE_ACCEPTANCE_PROVISIONAL") {
    assertClosed(value, commonKeys, "RELEASE_PHASE_INVALID");
  } else if (value?.mode === "POST_ACCEPTANCE_FINAL") {
    assertClosed(value, [
      ...commonKeys, "provisionalReceipt", "acceptanceReferenceDigest",
    ], "RELEASE_PHASE_INVALID");
  } else {
    fail("RELEASE_PHASE_INVALID");
  }
  const identity = Object.fromEntries(commonKeys.filter((key) => key !== "mode").map((key) => [key, value[key]]));
  const candidateInspector = dependencies.candidateInspector ?? inspectLocalReleaseCandidate;
  const remoteHeadResolver = dependencies.remoteHeadResolver ?? (async () => resolveLiveGiteeExtDevHeadWithExecutor());
  const candidateVerifier = dependencies.candidateVerifier ?? (async ({ repositoryRoot, taskId }) => (
    verifyProductCandidate({ cwd: repositoryRoot, taskId })
  ));
  const inspectedBefore = await candidateInspector(identity);
  if (
    inspectedBefore.commit !== value.candidateCommit ||
    inspectedBefore.tree !== value.candidateTree ||
    inspectedBefore.parent !== value.parentCommit ||
    inspectedBefore.approvalDigest !== value.approvalDigest
  ) fail("RELEASE_CANDIDATE_UNVERIFIED");
  const liveRemoteBefore = await remoteHeadResolver();
  let candidateVerificationStatus = null;
  if (value.mode === "PRE_ACCEPTANCE_PROVISIONAL") {
    const verification = await candidateVerifier({
      repositoryRoot: value.repositoryRoot,
      taskId: value.taskId,
    });
    if (
      verification?.decision !== "PASS" ||
      verification.canAcceptProductCandidate !== true ||
      verification.candidateCommit !== value.candidateCommit ||
      verification.candidateTree !== value.candidateTree
    ) fail("RELEASE_CANDIDATE_UNVERIFIED");
    candidateVerificationStatus = "VERIFIED_EXACT_SINGLE_CHILD";
  }
  const output = await operation();
  const liveRemoteAfter = await remoteHeadResolver();
  const inspectedAfter = await candidateInspector(identity);
  if (canonicalize(inspectedAfter) !== canonicalize(inspectedBefore)) {
    fail("RELEASE_CANDIDATE_UNVERIFIED");
  }
  const phase = value.mode === "PRE_ACCEPTANCE_PROVISIONAL"
    ? validateReleasePhase({
      mode: value.mode,
      approvalCommit: value.approvalCommit,
      candidateCommit: value.candidateCommit,
      parentCommit: value.parentCommit,
      liveRemoteBefore,
      liveRemoteAfter,
      candidateVerificationStatus,
    })
    : validateReleasePhase({
      mode: value.mode,
      approvalCommit: value.approvalCommit,
      candidateCommit: value.candidateCommit,
      parentCommit: value.parentCommit,
      liveRemoteBefore,
      liveRemoteAfter,
      provisionalReceipt: value.provisionalReceipt,
      finalRelease: output,
      acceptanceReferenceDigest: value.acceptanceReferenceDigest,
    });
  return { phase, output };
}

const RELEASE_PHASE_INPUT_KEYS = [
  "schemaVersion",
  "mode",
  "taskId",
  "approvalCommit",
  "approvalDigest",
  "candidateCommit",
  "candidateTree",
  "parentCommit",
  "createdAt",
  "provisionalReceipt",
  "acceptanceReferenceDigest",
];

export function validateReleasePhaseInput(value) {
  assertClosed(value, RELEASE_PHASE_INPUT_KEYS, "RELEASE_PHASE_INVALID");
  if (value.schemaVersion !== "chaotang.p15-release-phase-input.v1") fail("RELEASE_PHASE_INVALID");
  assertString(value.taskId, TASK_ID_PATTERN, "RELEASE_PHASE_INVALID");
  for (const key of ["approvalCommit", "candidateCommit", "candidateTree", "parentCommit"]) {
    assertString(value[key], SHA_PATTERN, "RELEASE_PHASE_INVALID");
  }
  assertString(value.approvalDigest, DIGEST_PATTERN, "RELEASE_PHASE_INVALID");
  assertString(value.createdAt, CANONICAL_UTC_PATTERN, "RELEASE_PHASE_INVALID");
  if (value.parentCommit !== value.approvalCommit) fail("RELEASE_PHASE_INVALID");
  if (value.mode === "PRE_ACCEPTANCE_PROVISIONAL") {
    if (value.provisionalReceipt !== null || value.acceptanceReferenceDigest !== null) {
      fail("RELEASE_PHASE_INVALID");
    }
  } else if (value.mode === "POST_ACCEPTANCE_FINAL") {
    validateProvisionalReceipt(value.provisionalReceipt);
    assertString(value.acceptanceReferenceDigest, DIGEST_PATTERN, "RELEASE_PHASE_INVALID");
  } else {
    fail("RELEASE_PHASE_INVALID");
  }
  return value;
}

export async function runGovernedOfflineRelease(value, dependencies = {}) {
  assertClosed(value, [
    "descriptor", "expectation", "outputDir", "repositoryRoot", "snapshotOutput",
    "stagingRoot", "gitIdentity", "phase",
  ], "RELEASE_PHASE_INVALID");
  const phaseInput = validateReleasePhaseInput(value.phase);
  let expectation = null;
  if (phaseInput.mode === "PRE_ACCEPTANCE_PROVISIONAL") {
    if (value.expectation !== null || value.snapshotOutput !== null) fail("RELEASE_PHASE_INVALID");
  } else {
    expectation = validateReleaseExpectation(value.expectation);
    assertString(value.snapshotOutput, null, "RELEASE_PHASE_INVALID");
  }
  if (
    value.descriptor?.source?.commit !== phaseInput.candidateCommit ||
    value.descriptor?.source?.tree !== phaseInput.candidateTree ||
    (expectation !== null && (
      expectation.candidateCommit !== phaseInput.candidateCommit ||
      expectation.candidateTree !== phaseInput.candidateTree ||
      expectation.approvalDigest !== phaseInput.approvalDigest ||
      expectation.provisionalReceiptDigest !== phaseInput.provisionalReceipt.receiptDigest ||
      expectation.acceptanceReferenceDigest !== phaseInput.acceptanceReferenceDigest
    ))
  ) fail("RELEASE_PHASE_INVALID");
  const builder = dependencies.builder ?? buildOfflineRelease;
  const verifier = dependencies.verifier ?? verifyOfflineRelease;
  const phaseValue = {
    mode: phaseInput.mode,
    approvalCommit: phaseInput.approvalCommit,
    approvalDigest: phaseInput.approvalDigest,
    candidateCommit: phaseInput.candidateCommit,
    candidateTree: phaseInput.candidateTree,
    parentCommit: phaseInput.parentCommit,
    repositoryRoot: value.repositoryRoot,
    taskId: phaseInput.taskId,
    ...(phaseInput.mode === "POST_ACCEPTANCE_FINAL" ? {
      provisionalReceipt: phaseInput.provisionalReceipt,
      acceptanceReferenceDigest: phaseInput.acceptanceReferenceDigest,
    } : {}),
  };
  let buildResult;
  let bundleVerificationResult = null;
  const governed = await runReleasePhaseWithLiveAuthority(
    phaseValue,
    async () => {
      buildResult = await builder({
        descriptor: value.descriptor,
        outputDir: value.outputDir,
        repositoryRoot: value.repositoryRoot,
        stagingRoot: value.stagingRoot,
        gitIdentity: value.gitIdentity,
      });
      if (
        !isPlainObject(buildResult) ||
        !isPlainObject(buildResult.manifest) ||
        !DIGEST_PATTERN.test(buildResult.manifestDigest ?? "") ||
        !Number.isSafeInteger(buildResult.filesWritten) ||
        buildResult.filesWritten < 1 ||
        (expectation !== null && buildResult.manifestDigest !== expectation.releaseManifestDigest)
      ) fail("RELEASE_BUILD_RESULT_INVALID");
      if (expectation !== null) {
        bundleVerificationResult = await verifier(value.outputDir, {
          expectation,
          snapshotOutput: value.snapshotOutput,
        });
        if (
          bundleVerificationResult?.ok !== true ||
          bundleVerificationResult.snapshotRetained !== true ||
          bundleVerificationResult.manifestDigest !== buildResult.manifestDigest
        ) fail("RELEASE_VERIFY_RESULT_INVALID");
      }
      const buildVerification = {
        schemaVersion: "chaotang.p15-build-verification.v1",
        manifestDigest: buildResult.manifestDigest,
        filesWritten: buildResult.filesWritten,
      };
      return {
        candidateCommit: phaseInput.candidateCommit,
        candidateTree: phaseInput.candidateTree,
        approvalDigest: phaseInput.approvalDigest,
        tools: value.descriptor.tools,
        sourceDateEpoch: value.descriptor.source.sourceDateEpoch,
        locks: buildResult.manifest.locks,
        deployment: buildResult.manifest.deployment,
        bundleDigest: buildResult.manifestDigest,
        verificationDigest: digestCanonical(buildVerification),
        createdAt: phaseInput.createdAt,
      };
    },
    dependencies.phaseDependencies,
  );
  const common = {
    phase: governed.phase,
    buildManifestDigest: buildResult.manifestDigest,
    verificationDigest: governed.output.verificationDigest,
  };
  if (phaseInput.mode === "PRE_ACCEPTANCE_PROVISIONAL") {
    return { ...common, provisionalReceipt: createProvisionalReceipt(governed.output) };
  }
  return {
    ...common,
    bundleVerificationDigest: digestCanonical(bundleVerificationResult),
    finalRelease: governed.output,
  };
}

export function assertSafeBundlePath(value) {
  assertString(value, null, "UNSAFE_BUNDLE_PATH");
  if (
    isAbsolute(value) ||
    value.includes("\\") ||
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") > 512
  ) fail("UNSAFE_BUNDLE_PATH");
  const segments = value.split("/");
  if (
    segments.length > 16 ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) fail("UNSAFE_BUNDLE_PATH");
  return value;
}

function validateDescriptor(descriptor) {
  assertClosed(descriptor, [
    "schemaVersion", "platform", "runtimeRegistryDigest", "source", "tools", "artifacts", "locks", "deployment", "images",
  ]);
  if (descriptor.schemaVersion !== "chaotang-release-input.v2") fail("INPUT_SCHEMA_INVALID");
  if (descriptor.platform !== "linux/amd64") fail("INPUT_SCHEMA_INVALID");
  if (descriptor.runtimeRegistryDigest !== RUNTIME_REGISTRY_DIGEST) fail("RUNTIME_REGISTRY_MISMATCH");
  assertClosed(descriptor.source, ["commit", "tree", "sourceDateEpoch"]);
  assertString(descriptor.source.commit, SHA_PATTERN);
  assertString(descriptor.source.tree, SHA_PATTERN);
  if (!Number.isSafeInteger(descriptor.source.sourceDateEpoch) || descriptor.source.sourceDateEpoch < 0) {
    fail("INPUT_SCHEMA_INVALID");
  }
  const toolKeys = ["docker", "buildx", "buildkit", "node", "python", "caddy", "syft", "grype"];
  assertClosed(descriptor.tools, toolKeys);
  for (const key of toolKeys) assertString(descriptor.tools[key]);

  if (!Array.isArray(descriptor.artifacts) || descriptor.artifacts.length !== REQUIRED_ARTIFACT_KINDS.size) {
    fail("INPUT_SCHEMA_INVALID");
  }
  const paths = new Set();
  const kindsByPath = new Map();
  const casefoldPaths = new Set();
  for (const artifact of descriptor.artifacts) {
    assertClosed(artifact, ["bundlePath", "sourcePath", "kind"]);
    const bundlePath = assertSafeBundlePath(artifact.bundlePath);
    assertString(artifact.sourcePath);
    if (!isAbsolute(artifact.sourcePath) || RESERVED_BUNDLE_PATHS.has(bundlePath)) {
      fail("INPUT_SCHEMA_INVALID");
    }
    if (!ALLOWED_KINDS.has(artifact.kind)) fail("INPUT_SCHEMA_INVALID");
    const folded = bundlePath.toLocaleLowerCase("en-US");
    if (paths.has(bundlePath) || casefoldPaths.has(folded)) fail("DUPLICATE_BUNDLE_PATH");
    paths.add(bundlePath);
    kindsByPath.set(bundlePath, artifact.kind);
    casefoldPaths.add(folded);
  }
  for (const [path, kind] of REQUIRED_ARTIFACT_KINDS) {
    if (kindsByPath.get(path) !== kind) fail("INPUT_SCHEMA_INVALID");
  }

  if (!Array.isArray(descriptor.locks) || descriptor.locks.length !== 2) fail("INPUT_SCHEMA_INVALID");
  const lockPaths = ["locks/backend.requirements-runtime.lock", "locks/frontend.package-lock.json"];
  for (const [index, lock] of descriptor.locks.entries()) {
    assertClosed(lock, ["path"]);
    assertSafeBundlePath(lock.path);
    if (lock.path !== lockPaths[index] || !paths.has(lock.path)) fail("INPUT_SCHEMA_INVALID");
  }
  assertClosed(descriptor.deployment, ["composePath", "caddyfilePath", "imagesEnvPath"]);
  for (const key of ["composePath", "caddyfilePath", "imagesEnvPath"]) {
    assertSafeBundlePath(descriptor.deployment[key]);
    if (!paths.has(descriptor.deployment[key])) fail("INPUT_SCHEMA_INVALID");
  }
  if (
    descriptor.deployment.composePath !== "deploy/compose.yaml" ||
    descriptor.deployment.caddyfilePath !== "deploy/Caddyfile" ||
    descriptor.deployment.imagesEnvPath !== "deploy/images.env"
  ) fail("INPUT_SCHEMA_INVALID");
  if (!Array.isArray(descriptor.images) || descriptor.images.length !== 3) fail("INPUT_SCHEMA_INVALID");
  const imageNames = new Set();
  for (const image of descriptor.images) {
    assertClosed(image, [
      "name", "reference", "archivePath", "sbomPath", "provenancePath", "sourceRevision", "sourceTree",
    ]);
    assertString(image.name, /^(?:backend|caddy|frontend)$/);
    if (imageNames.has(image.name)) fail("INPUT_SCHEMA_INVALID");
    imageNames.add(image.name);
    assertString(image.reference, /^[^\s@]+@sha256:[0-9a-f]{64}$/);
    if (
      image.archivePath !== `images/${image.name}.oci.tar` ||
      image.sbomPath !== `images/${image.name}.sbom.json` ||
      image.provenancePath !== `images/${image.name}.provenance.json`
    ) fail("INPUT_SCHEMA_INVALID");
    for (const key of ["archivePath", "sbomPath", "provenancePath"]) {
      assertSafeBundlePath(image[key]);
      if (!paths.has(image[key])) fail("INPUT_SCHEMA_INVALID");
    }
    if (image.name === "caddy") {
      if (image.sourceRevision !== null || image.sourceTree !== null) fail("INPUT_SCHEMA_INVALID");
    } else {
      assertString(image.sourceRevision, SHA_PATTERN);
      assertString(image.sourceTree, SHA_PATTERN);
      if (image.sourceRevision !== descriptor.source.commit || image.sourceTree !== descriptor.source.tree) {
        fail("SOURCE_IDENTITY_MISMATCH");
      }
    }
  }
  if (![...imageNames].sort().every((name, index) => name === ["backend", "caddy", "frontend"][index])) {
    fail("INPUT_SCHEMA_INVALID");
  }
  return descriptor;
}

function outputPathForbidden(outputDir) {
  return FORBIDDEN_OUTPUT_ROOTS.some((root) => (
    outputDir === root || outputDir.startsWith(`${root}/`)
  ));
}

async function assertOutputBinding(outputDir, expected) {
  let actual;
  try {
    actual = await lstat(outputDir);
  } catch {
    fail("OUTPUT_REPLACED_DURING_BUILD");
  }
  if (!actual.isDirectory() || actual.dev !== expected.dev || actual.ino !== expected.ino) {
    fail("OUTPUT_REPLACED_DURING_BUILD");
  }
}

async function openEmptyDirectory(outputDir) {
  if (!isAbsolute(outputDir)) fail("OUTPUT_NOT_DIRECTORY");
  outputDir = resolve(outputDir);
  if (outputPathForbidden(outputDir)) fail("OUTPUT_PATH_FORBIDDEN");
  let info;
  let handle;
  try {
    info = await lstat(outputDir);
  } catch (error) {
    if (error?.code !== "ENOENT") fail("OUTPUT_NOT_DIRECTORY");
    const parent = dirname(outputDir);
    let parentInfo;
    let parentHandle;
    try {
      parentInfo = await lstat(parent);
    } catch {
      fail("OUTPUT_NOT_DIRECTORY");
    }
    if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) fail("OUTPUT_NOT_DIRECTORY");
    if (await realpath(parent) !== resolve(parent)) fail("OUTPUT_NOT_DIRECTORY");
    try {
      parentHandle = await open(parent, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      const openedParent = await parentHandle.stat();
      if (openedParent.dev !== parentInfo.dev || openedParent.ino !== parentInfo.ino) fail("OUTPUT_NOT_DIRECTORY");
      const heldOutput = resolve(`/proc/self/fd/${parentHandle.fd}`, basename(outputDir));
      await mkdir(heldOutput, { recursive: false, mode: 0o700 });
      handle = await open(heldOutput, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      info = await handle.stat();
    } finally {
      await parentHandle?.close();
    }
  }
  const euid = typeof process.geteuid === "function" ? process.geteuid() : null;
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (euid !== null && info.uid !== euid) ||
    (info.mode & 0o022) !== 0
  ) fail("OUTPUT_NOT_PRIVATE");
  if (await realpath(outputDir) !== resolve(outputDir)) {
    await handle?.close();
    fail("OUTPUT_NOT_DIRECTORY");
  }
  handle ??= await open(outputDir, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  const opened = await handle.stat();
  if (!opened.isDirectory() || opened.dev !== info.dev || opened.ino !== info.ino) {
    await handle.close();
    fail("OUTPUT_CHANGED_DURING_OPEN");
  }
  if ((await readdir(`/proc/self/fd/${handle.fd}`)).length !== 0) {
    await handle.close();
    fail("OUTPUT_NOT_EMPTY");
  }
  await assertOutputBinding(outputDir, opened);
  return { handle, status: opened, heldPath: `/proc/self/fd/${handle.fd}` };
}

async function openBundleDirectories(output) {
  const directories = new Map();
  try {
    for (const name of ["deploy", "images", "locks"]) {
      const path = resolve(output.heldPath, name);
      await mkdir(path, { recursive: false, mode: 0o700 });
      const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      const status = await handle.stat();
      if (!status.isDirectory() || (status.mode & 0o022) !== 0) fail("OUTPUT_CHANGED_DURING_OPEN");
      directories.set(name, { handle, status, heldPath: `/proc/self/fd/${handle.fd}` });
    }
    return directories;
  } catch (error) {
    await Promise.allSettled([...directories.values()].map((entry) => entry.handle.close()));
    throw error;
  }
}

async function assertBundleDirectoryBindings(output, directories) {
  for (const [name, expected] of directories) {
    const actual = await lstat(resolve(output.heldPath, name));
    if (!actual.isDirectory() || actual.dev !== expected.status.dev || actual.ino !== expected.status.ino) {
      fail("OUTPUT_REPLACED_DURING_BUILD");
    }
  }
}

async function hashHandle(handle, size) {
  const hash = createHash("sha256");
  const buffer = Buffer.alloc(Math.min(1024 * 1024, Math.max(size, 1)));
  let offset = 0;
  while (offset < size) {
    const length = Math.min(buffer.length, size - offset);
    const result = await handle.read(buffer, 0, length, offset);
    if (result.bytesRead !== length) fail("INPUT_CHANGED_DURING_READ");
    hash.update(buffer.subarray(0, length));
    offset += length;
  }
  return `sha256:${hash.digest("hex")}`;
}

async function readHandleText(handle, size) {
  if (size > 1024 * 1024) fail("INPUT_SCHEMA_INVALID");
  const buffer = Buffer.alloc(size);
  const result = await handle.read(buffer, 0, size, 0);
  if (result.bytesRead !== size) fail("INPUT_CHANGED_DURING_READ");
  try {
    return UTF8_DECODER.decode(buffer);
  } catch {
    fail("INPUT_SCHEMA_INVALID");
  }
}

async function readDescriptor(path) {
  const descriptorPath = resolve(path);
  const info = await lstat(descriptorPath);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 16 * 1024 * 1024) {
    fail("INPUT_SCHEMA_INVALID");
  }
  const handle = await open(descriptorPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (opened.dev !== info.dev || opened.ino !== info.ino || opened.size !== info.size) {
      fail("INPUT_CHANGED_DURING_OPEN");
    }
    return parseJsonStrict(await readHandleText(handle, opened.size));
  } finally {
    await handle.close();
  }
}

async function inspectArtifacts(descriptor, repositoryRoot, stagingRoot) {
  const records = new Map();
  let totalBytes = 0;
  try {
    for (const artifact of descriptor.artifacts) {
      const sourcePath = resolve(artifact.sourcePath);
      const repositoryPath = TRUSTED_REPOSITORY_SOURCES.get(artifact.bundlePath);
      if (repositoryPath && sourcePath !== resolve(repositoryRoot, repositoryPath)) {
        fail("REPOSITORY_ARTIFACT_SOURCE_MISMATCH");
      }
      if (!repositoryPath) {
        const staged = relative(stagingRoot, sourcePath);
        if (
          !staged ||
          staged.startsWith("..") ||
          isAbsolute(staged) ||
          TRUSTED_STAGING_SOURCES.get(artifact.bundlePath) !== staged.replaceAll("\\", "/")
        ) {
          fail("GENERATED_ARTIFACT_OUTSIDE_STAGING");
        }
      }
      let resolvedSource;
      try {
        resolvedSource = await realpath(sourcePath);
      } catch {
        fail("INPUT_NOT_REGULAR");
      }
      if (resolvedSource !== sourcePath) fail("INPUT_NOT_REGULAR");
      const info = await lstat(sourcePath);
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) fail("INPUT_NOT_REGULAR");
      if (info.size > MAX_ENTRY_BYTES) fail("INPUT_TOO_LARGE");
      const handle = await open(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      const opened = await handle.stat();
      if (
        !opened.isFile() ||
        opened.nlink !== 1 ||
        opened.dev !== info.dev ||
        opened.ino !== info.ino ||
        opened.size !== info.size
      ) {
        await handle.close();
        fail("INPUT_CHANGED_DURING_OPEN");
      }
      totalBytes += info.size;
      if (totalBytes > MAX_BUNDLE_BYTES) {
        await handle.close();
        fail("INPUT_TOO_LARGE");
      }
      records.set(artifact.bundlePath, {
        path: artifact.bundlePath,
        bytes: info.size,
        sha256: await hashHandle(handle, info.size),
        kind: artifact.kind,
        sourcePath,
        handle,
      });
    }
  } catch (error) {
    await Promise.allSettled([...records.values()].map((record) => record.handle.close()));
    throw error;
  }
  return records;
}

async function copyRecord(record, destination) {
  const output = await open(
    destination,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  const hash = createHash("sha256");
  const buffer = Buffer.alloc(Math.min(1024 * 1024, Math.max(record.bytes, 1)));
  let offset = 0;
  try {
    while (offset < record.bytes) {
      const length = Math.min(buffer.length, record.bytes - offset);
      const result = await record.handle.read(buffer, 0, length, offset);
      if (result.bytesRead !== length) fail("INPUT_CHANGED_DURING_COPY");
      const chunk = buffer.subarray(0, length);
      hash.update(chunk);
      let written = 0;
      while (written < chunk.length) {
        const result = await output.write(chunk, written, chunk.length - written, offset + written);
        if (result.bytesWritten <= 0) fail("OUTPUT_COPY_MISMATCH");
        written += result.bytesWritten;
      }
      offset += length;
    }
    await output.sync();
  } finally {
    await output.close();
  }
  const current = await record.handle.stat();
  if (current.size !== record.bytes || `sha256:${hash.digest("hex")}` !== record.sha256) {
    fail("INPUT_CHANGED_DURING_COPY");
  }
}

function fileIdentity(records, path) {
  const record = records.get(path);
  if (!record) fail("INPUT_SCHEMA_INVALID");
  return record;
}

function expectedImagesEnv(images) {
  const references = new Map(images.map((image) => [image.name, image.reference]));
  return [
    `BACKEND_IMAGE=${references.get("backend")}`,
    `CADDY_IMAGE=${references.get("caddy")}`,
    `FRONTEND_IMAGE=${references.get("frontend")}`,
    "",
  ].join("\n");
}

export async function readGitIdentity(repositoryRoot = process.cwd()) {
  const gitArgs = (...args) => [...CLOSED_GIT_OPTIONS, "--no-replace-objects", ...args];
  const gitText = (...args) => execFileSync("/usr/bin/git", args, {
    cwd: repositoryRoot,
    env: CLOSED_GIT_ENV,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const status = gitText(...gitArgs("status", "--porcelain=v1", "--untracked-files=all"));
  const commit = gitText(...gitArgs("rev-parse", "HEAD"));
  const tree = gitText(...gitArgs("rev-parse", "HEAD^{tree}"));
  const trustedFiles = {};
  for (const [bundlePath, repositoryPath] of TRUSTED_REPOSITORY_SOURCES) {
    const bytes = execFileSync("/usr/bin/git", gitArgs("show", `${tree}:${repositoryPath}`), {
      cwd: repositoryRoot,
      env: CLOSED_GIT_ENV,
      encoding: null,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    trustedFiles[bundlePath] = { bytes: bytes.length, sha256: digestBytes(bytes) };
  }
  return {
    clean: status.length === 0,
    commit,
    tree,
    trustedFiles,
  };
}

function sameGitIdentity(left, right) {
  return left?.clean === true &&
    right?.clean === true &&
    left.commit === right.commit &&
    left.tree === right.tree &&
    canonicalize(left.trustedFiles) === canonicalize(right.trustedFiles);
}

export async function buildOfflineRelease({
  descriptor,
  outputDir,
  gitIdentity,
  repositoryRoot,
  stagingRoot = repositoryRoot,
  testHooks = {},
}) {
  validateDescriptor(descriptor);
  assertString(outputDir);
  assertString(repositoryRoot);
  assertString(stagingRoot);
  const trustedRoot = resolve(repositoryRoot);
  let resolvedRoot;
  try {
    resolvedRoot = await realpath(trustedRoot);
  } catch {
    fail("REPOSITORY_ROOT_INVALID");
  }
  const rootInfo = await lstat(trustedRoot);
  if (resolvedRoot !== trustedRoot || !rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    fail("REPOSITORY_ROOT_INVALID");
  }
  const trustedStaging = resolve(stagingRoot);
  let resolvedStaging;
  try {
    resolvedStaging = await realpath(trustedStaging);
  } catch {
    fail("STAGING_ROOT_INVALID");
  }
  const stagingInfo = await lstat(trustedStaging);
  const euid = typeof process.geteuid === "function" ? process.geteuid() : null;
  if (
    resolvedStaging !== trustedStaging ||
    !stagingInfo.isDirectory() ||
    stagingInfo.isSymbolicLink() ||
    (euid !== null && stagingInfo.uid !== euid) ||
    (stagingInfo.mode & 0o077) !== 0 ||
    outputPathForbidden(trustedStaging)
  ) fail("STAGING_ROOT_INVALID");
  const observedGitIdentity = await readGitIdentity(trustedRoot);
  if (!sameGitIdentity(gitIdentity, observedGitIdentity)) fail("SOURCE_IDENTITY_MISMATCH");
  if (observedGitIdentity.commit !== descriptor.source.commit || observedGitIdentity.tree !== descriptor.source.tree) {
    fail("SOURCE_IDENTITY_MISMATCH");
  }
  const normalizedOutput = resolve(outputDir);
  const output = await openEmptyDirectory(normalizedOutput);
  let outputDirectories = new Map();
  let records = new Map();
  try {
    if (typeof testHooks.afterOutputOpened === "function") {
      await testHooks.afterOutputOpened(normalizedOutput);
    }
    outputDirectories = await openBundleDirectories(output);
    if (typeof testHooks.afterDirectoriesOpened === "function") {
      await testHooks.afterDirectoriesOpened(normalizedOutput);
    }
    records = await inspectArtifacts(descriptor, trustedRoot, trustedStaging);
    for (const bundlePath of TRUSTED_REPOSITORY_SOURCES.keys()) {
      const record = fileIdentity(records, bundlePath);
      const tracked = observedGitIdentity.trustedFiles[bundlePath];
      if (!tracked || tracked.bytes !== record.bytes || tracked.sha256 !== record.sha256) {
        fail("REPOSITORY_ARTIFACT_NOT_FROM_SOURCE_TREE");
      }
    }
    const imagesEnv = fileIdentity(records, "deploy/images.env");
    if (await readHandleText(imagesEnv.handle, imagesEnv.bytes) !== expectedImagesEnv(descriptor.images)) {
      fail("IMAGE_REFERENCE_MISMATCH");
    }

    for (const artifact of descriptor.artifacts) {
      const [directory, leaf, ...extra] = artifact.bundlePath.split("/");
      if (extra.length !== 0 || !leaf || !outputDirectories.has(directory)) fail("UNSAFE_BUNDLE_PATH");
      const destination = resolve(outputDirectories.get(directory).heldPath, leaf);
      const source = records.get(artifact.bundlePath);
      await copyRecord(source, destination);
    }
    if (!sameGitIdentity(observedGitIdentity, await readGitIdentity(trustedRoot))) {
      fail("SOURCE_CHANGED_DURING_BUILD");
    }

  const files = [...records.values()]
    .map(({ sourcePath: _sourcePath, handle: _handle, ...record }) => record)
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
  const manifest = {
    schemaVersion: "chaotang-offline-release.v2",
    platform: descriptor.platform,
    runtimeRegistryDigest: descriptor.runtimeRegistryDigest,
    source: { ...descriptor.source },
    tools: { ...descriptor.tools },
    locks: descriptor.locks
      .map(({ path }) => ({ path, sha256: fileIdentity(records, path).sha256 }))
      .sort((left, right) => left.path.localeCompare(right.path, "en")),
    deployment: {
      composePath: descriptor.deployment.composePath,
      composeSha256: fileIdentity(records, descriptor.deployment.composePath).sha256,
      caddyfilePath: descriptor.deployment.caddyfilePath,
      caddyfileSha256: fileIdentity(records, descriptor.deployment.caddyfilePath).sha256,
      imagesEnvPath: descriptor.deployment.imagesEnvPath,
      imagesEnvSha256: fileIdentity(records, descriptor.deployment.imagesEnvPath).sha256,
    },
    images: descriptor.images
      .map((image) => ({
        name: image.name,
        reference: image.reference,
        archivePath: image.archivePath,
        archiveSha256: fileIdentity(records, image.archivePath).sha256,
        sbomPath: image.sbomPath,
        sbomSha256: fileIdentity(records, image.sbomPath).sha256,
        provenancePath: image.provenancePath,
        provenanceSha256: fileIdentity(records, image.provenancePath).sha256,
        sourceRevision: image.sourceRevision,
        sourceTree: image.sourceTree,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "en")),
    files,
  };
  const manifestBytes = Buffer.from(canonicalize(manifest), "utf8");
  const manifestDigest = digestBytes(manifestBytes);
  await writeFile(resolve(output.heldPath, "manifest.json"), manifestBytes, { mode: 0o600, flag: "wx" });
  await writeFile(resolve(output.heldPath, "manifest.sha256"), `${manifestDigest}\n`, { mode: 0o600, flag: "wx" });
    await assertBundleDirectoryBindings(output, outputDirectories);
    await assertOutputBinding(normalizedOutput, output.status);
    return { manifest, manifestDigest, filesWritten: files.length };
  } finally {
    await Promise.allSettled([...records.values()].map((record) => record.handle.close()));
    await Promise.allSettled([...outputDirectories.values()].map((entry) => entry.handle.close()));
    await output.handle.close();
  }
}

export function parseBuildCli(argv) {
  const values = {};
  if (argv.length % 2 !== 0) fail("CLI_INVALID");
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (![
      "--descriptor", "--expectation", "--output", "--phase", "--repository", "--snapshot-output",
    ].includes(key) || !value || Object.hasOwn(values, key.slice(2))) fail("CLI_INVALID");
    values[key.slice(2)] = value;
  }
  for (const required of ["descriptor", "output", "phase", "repository"]) {
    if (!Object.hasOwn(values, required)) fail("CLI_INVALID");
  }
  if (Object.hasOwn(values, "expectation") !== Object.hasOwn(values, "snapshot-output")) fail("CLI_INVALID");
  if (![4, 6].includes(Object.keys(values).length)) fail("CLI_INVALID");
  return values;
}

async function readCanonicalJsonFile(path, code) {
  const inputPath = resolve(path);
  let info;
  let handle;
  try {
    info = await lstat(inputPath);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 16 * 1024 * 1024) fail(code);
    handle = await open(inputPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await handle.stat();
    if (opened.dev !== info.dev || opened.ino !== info.ino || opened.size !== info.size) fail(code);
    const raw = await readHandleText(handle, opened.size);
    const value = parseJsonStrict(raw);
    if (raw !== `${canonicalize(value)}\n`) fail(code);
    return value;
  } catch (error) {
    if (error instanceof ReleaseBuildError) throw error;
    fail(code);
  } finally {
    await handle?.close();
  }
}

export async function validateCliStagingRoot(descriptorPath, repositoryRoot) {
  const descriptor = resolve(descriptorPath);
  const stagingRoot = dirname(descriptor);
  const repository = resolve(repositoryRoot);
  if (
    basename(descriptor) !== "release-input.json" ||
    !/^work-[0-9]{3}$/.test(basename(stagingRoot)) ||
    stagingRoot === repository ||
    stagingRoot.startsWith(`${repository}/`)
  ) fail("STAGING_ROOT_INVALID");
  const parent = dirname(stagingRoot);
  let stagingInfo;
  let parentInfo;
  try {
    stagingInfo = await lstat(stagingRoot);
    parentInfo = await lstat(parent);
  } catch {
    fail("STAGING_ROOT_INVALID");
  }
  const euid = typeof process.geteuid === "function" ? process.geteuid() : null;
  if (
    !stagingInfo.isDirectory() || stagingInfo.isSymbolicLink() ||
    !parentInfo.isDirectory() || parentInfo.isSymbolicLink() ||
    await realpath(stagingRoot) !== stagingRoot || await realpath(parent) !== parent ||
    (euid !== null && (stagingInfo.uid !== euid || parentInfo.uid !== euid)) ||
    (stagingInfo.mode & 0o077) !== 0 || (parentInfo.mode & 0o077) !== 0 ||
    outputPathForbidden(stagingRoot)
  ) fail("STAGING_ROOT_INVALID");
  return stagingRoot;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const cli = parseBuildCli(process.argv.slice(2));
    const descriptor = await readDescriptor(cli.descriptor);
    const stagingRoot = await validateCliStagingRoot(cli.descriptor, cli.repository);
    const expectation = cli.expectation
      ? await readCanonicalJsonFile(cli.expectation, "RELEASE_EXPECTATION_INVALID")
      : null;
    const phase = await readCanonicalJsonFile(cli.phase, "RELEASE_PHASE_INVALID");
    const result = await runGovernedOfflineRelease({
      descriptor,
      expectation,
      outputDir: resolve(cli.output),
      repositoryRoot: resolve(cli.repository),
      snapshotOutput: cli["snapshot-output"] ? resolve(cli["snapshot-output"]) : null,
      stagingRoot,
      gitIdentity: await readGitIdentity(resolve(cli.repository)),
      phase,
    });
    process.stdout.write(`${canonicalize(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.code ?? error?.message ?? "RELEASE_BUILD_FAILED"}\n`);
    process.exitCode = 1;
  }
}

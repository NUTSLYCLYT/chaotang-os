#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  canonicalizeRfc8785,
  digestBytes,
  digestCanonical,
  parseJsonNoDuplicateKeys,
} from "./execution_authority_ext.mjs";

export const AUTHORITY_ID = "product-authority.m0.v1";
export const REPOSITORY_IDENTITY = "gitee.com/msxn/chaotang-os";
export const TARGET_BRANCH = "ext-dev";
export const APPROVAL_SCHEMA_VERSION = "product-authority.m0.approval.v1";
export const RESULT_SCHEMA_VERSION = "product-authority.m0.result.v1";

const GIT_EXECUTABLE = "/usr/bin/git";
const TASK_ID_PATTERN = /^[A-Z0-9][A-Z0-9._-]{2,127}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const MAX_GIT_OUTPUT = 4 * 1024 * 1024;
const MAX_COMMAND_OUTPUT = 1024 * 1024;
const TOOL_PATHS = Object.freeze({
  node: process.execPath,
  npm: "/usr/bin/npm",
  python3: "/usr/bin/python3",
});
const PROTECTED_PRODUCT_PATHS = Object.freeze([
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/",
  ".claude/",
  ".codex/",
  ".github/workflows/",
  ".superpowers/",
  ".harness/",
  "backend/AGENTS.md",
  "backend/CLAUDE.md",
  "docs/contracts/execution-authority-ext-attestation.schema.json",
  "docs/contracts/execution-authority-ext-grant.schema.json",
  "docs/contracts/execution-authority-ext-trust-root.schema.json",
  "docs/decisions/",
  "docs/product/tasks/2026-08-15-ext-root-harness-bootstrap-g1.md",
  "docs/product/tasks/2026-08-15-ext-root-harness-convergence.md",
  "docs/product/tasks/2026-08-15-ext-successor-execution-authority.md",
  "docs/product/tasks/2026-08-16-ext-dev-proportional-governance-reset.md",
  "docs/product/tasks/2026-08-16-ext-root-observation-kernel-g1-corrective.md",
  "docs/product/tasks/2026-08-16-ext-root-observation-kernel-g1.md",
  "docs/product/tasks/2026-08-16-m0-solo-owner-product-authority.md",
  "docs/superpowers/plans/2026-08-15-ext-root-harness-bootstrap-g1.md",
  "docs/superpowers/plans/2026-08-15-ext-root-harness-convergence.md",
  "docs/superpowers/plans/2026-08-15-ext-successor-execution-authority.md",
  "docs/superpowers/plans/2026-08-16-ext-dev-proportional-governance-reset.md",
  "docs/superpowers/plans/2026-08-16-ext-root-observation-kernel-g1-corrective.md",
  "docs/superpowers/plans/2026-08-16-ext-root-observation-kernel-g1.md",
  "docs/superpowers/plans/2026-08-16-m0-solo-owner-product-authority.md",
  "frontend/AGENTS.md",
  "frontend/CLAUDE.md",
  "scripts/check_harness.mjs",
  "scripts/execution_authority_ext.mjs",
  "scripts/execution_authority_ext.test.mjs",
  "scripts/harness-doctor.mjs",
  "scripts/harness-doctor.test.mjs",
  "scripts/product-authority.mjs",
  "scripts/product-authority.test.mjs",
  "scripts/fixtures/execution-authority-ext-canonical-vectors.json",
]);

export class ProductAuthorityError extends Error {
  constructor(code) {
    super(code);
    this.name = "ProductAuthorityError";
    this.code = code;
  }
}

function fail(code) {
  throw new ProductAuthorityError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertClosedObject(value, fields, code = "APPROVAL_SCHEMA_INVALID") {
  if (!isPlainObject(value) || Object.keys(value).length !== fields.length) fail(code);
  if (fields.some((field) => !Object.hasOwn(value, field))) fail(code);
  if (Object.keys(value).some((field) => !fields.includes(field))) fail(code);
}

function assertString(value, { pattern = null, maxLength = 16_384, code = "APPROVAL_SCHEMA_INVALID" } = {}) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) fail(code);
  if (value.includes("\0") || (pattern && !pattern.test(value))) fail(code);
}

function isSafeRepositoryPath(value, { allowDot = false } = {}) {
  if (value === ".") return allowDot;
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return false;
  if (value.startsWith("/") || value.includes("\\") || /[\u0000-\u001f\u007f]/u.test(value) || value.includes("//")) return false;
  if (value.includes("*") || value.includes("?")) return false;
  const segments = value.split("/");
  return !segments.some((segment) => segment === "" || segment === "." || segment === "..")
    && path.posix.normalize(value) === value;
}

function validateOrderedPaths(paths, code, { product = false, maxItems = 128 } = {}) {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > maxItems) fail(code);
  if (paths.some((entry) => !isSafeRepositoryPath(entry))) fail(code);
  if (new Set(paths).size !== paths.length || JSON.stringify([...paths].sort()) !== JSON.stringify(paths)) fail(code);
  if (product && paths.some((entry) => PROTECTED_PRODUCT_PATHS.some((protectedPath) => (
    protectedPath.endsWith("/") ? entry.startsWith(protectedPath) : entry === protectedPath
  )))) fail("PRODUCT_PATH_PROTECTED");
  return paths;
}

function validateApprovalCommitPath(pathValue, approvalPath) {
  if (pathValue === approvalPath) return true;
  return (pathValue.startsWith("docs/product/tasks/") || pathValue.startsWith("docs/superpowers/plans/"))
    && pathValue.endsWith(".md");
}

export function approvalPathForTask(taskId) {
  assertString(taskId, { pattern: TASK_ID_PATTERN, maxLength: 128, code: "TASK_ID_INVALID" });
  return `.harness/approvals/${taskId}.json`;
}

export function parseJsonStrict(text) {
  return parseJsonNoDuplicateKeys(text);
}

export function canonicalDigest(value) {
  return digestCanonical(value);
}

export function validateApprovalManifest(manifest) {
  assertClosedObject(manifest, [
    "schemaVersion",
    "authorityId",
    "taskId",
    "repository",
    "request",
    "nonGoals",
    "verification",
    "state",
  ]);
  if (manifest.schemaVersion !== APPROVAL_SCHEMA_VERSION || manifest.authorityId !== AUTHORITY_ID) {
    fail("APPROVAL_IDENTITY_INVALID");
  }
  assertString(manifest.taskId, { pattern: TASK_ID_PATTERN, maxLength: 128, code: "TASK_ID_INVALID" });
  assertClosedObject(manifest.repository, ["identity", "targetBranch"]);
  if (manifest.repository.identity !== REPOSITORY_IDENTITY || manifest.repository.targetBranch !== TARGET_BRANCH) {
    fail("REPOSITORY_IDENTITY_INVALID");
  }
  assertClosedObject(manifest.request, [
    "baseCommit",
    "baseTree",
    "approvalPath",
    "approvalCommitPaths",
    "productPaths",
  ]);
  if (!SHA_PATTERN.test(manifest.request.baseCommit) || !SHA_PATTERN.test(manifest.request.baseTree)) {
    fail("REQUEST_BASE_INVALID");
  }
  const expectedApprovalPath = approvalPathForTask(manifest.taskId);
  if (manifest.request.approvalPath !== expectedApprovalPath) fail("APPROVAL_PATH_INVALID");
  const approvalPaths = validateOrderedPaths(
    manifest.request.approvalCommitPaths,
    "APPROVAL_PATH_SCOPE_INVALID",
    { maxItems: 16 },
  );
  if (!approvalPaths.includes(expectedApprovalPath)
    || approvalPaths.some((entry) => !validateApprovalCommitPath(entry, expectedApprovalPath))) {
    fail("APPROVAL_PATH_SCOPE_INVALID");
  }
  validateOrderedPaths(manifest.request.productPaths, "PRODUCT_PATH_SCOPE_INVALID", { product: true });
  if (!Array.isArray(manifest.nonGoals) || manifest.nonGoals.length === 0 || manifest.nonGoals.length > 64) {
    fail("NON_GOALS_INVALID");
  }
  for (const entry of manifest.nonGoals) {
    assertString(entry, { pattern: /^[A-Z][A-Z0-9_]{2,127}$/, maxLength: 128, code: "NON_GOALS_INVALID" });
  }
  if (new Set(manifest.nonGoals).size !== manifest.nonGoals.length
    || JSON.stringify([...manifest.nonGoals].sort()) !== JSON.stringify(manifest.nonGoals)) {
    fail("NON_GOALS_INVALID");
  }
  if (!Array.isArray(manifest.verification) || manifest.verification.length === 0 || manifest.verification.length > 32) {
    fail("VERIFICATION_MATRIX_INVALID");
  }
  const verificationIds = [];
  for (const entry of manifest.verification) {
    assertClosedObject(entry, ["id", "tool", "args", "cwd", "timeoutMs"], "VERIFICATION_MATRIX_INVALID");
    assertString(entry.id, { pattern: IDENTIFIER_PATTERN, maxLength: 128, code: "VERIFICATION_MATRIX_INVALID" });
    if (!Object.hasOwn(TOOL_PATHS, entry.tool)) fail("VERIFICATION_MATRIX_INVALID");
    if (!Array.isArray(entry.args) || entry.args.length > 64) fail("VERIFICATION_MATRIX_INVALID");
    for (const argument of entry.args) {
      if (typeof argument !== "string" || argument.length > 4096 || argument.includes("\0")) {
        fail("VERIFICATION_MATRIX_INVALID");
      }
    }
    if (!isSafeRepositoryPath(entry.cwd, { allowDot: true })) fail("VERIFICATION_MATRIX_INVALID");
    if (!Number.isSafeInteger(entry.timeoutMs) || entry.timeoutMs < 1_000 || entry.timeoutMs > 300_000) {
      fail("VERIFICATION_MATRIX_INVALID");
    }
    verificationIds.push(entry.id);
  }
  if (new Set(verificationIds).size !== verificationIds.length
    || JSON.stringify([...verificationIds].sort()) !== JSON.stringify(verificationIds)) {
    fail("VERIFICATION_MATRIX_INVALID");
  }
  if (manifest.state !== "APPROVED_FOR_ONE_CHILD") fail("APPROVAL_STATE_INVALID");
  return manifest;
}

function gitEnvironment() {
  return {
    PATH: "/usr/bin:/bin",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_TERMINAL_PROMPT: "0",
  };
}

function runGit(args, { cwd, encoding = "utf8", code = "GIT_INSPECTION_FAILED", timeout = 10_000 } = {}) {
  try {
    const output = execFileSync(GIT_EXECUTABLE, ["--no-replace-objects", ...args], {
      cwd,
      encoding,
      env: gitEnvironment(),
      maxBuffer: MAX_GIT_OUTPUT,
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return typeof output === "string" ? output.trim() : output;
  } catch {
    fail(code);
  }
}

function ensureRepositoryIdentity(cwd) {
  const remote = runGit(["config", "--get", "remote.origin.url"], { cwd, code: "REPOSITORY_IDENTITY_INVALID" });
  const normalized = remote.replace(/^https?:\/\//, "").replace(/^git@/, "").replace(":", "/").replace(/\.git$/, "");
  if (normalized !== REPOSITORY_IDENTITY) fail("REPOSITORY_IDENTITY_INVALID");
  if (runGit(["rev-parse", "--is-shallow-repository"], { cwd }) !== "false") fail("SHALLOW_REPOSITORY_UNSUPPORTED");
}

function ensureCleanWorktree(cwd, code = "WORKTREE_DIRTY") {
  if (runGit(["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd, encoding: null }).length !== 0) {
    fail(code);
  }
}

function commitParents(cwd, commit) {
  return runGit(["show", "-s", "--format=%P", commit], { cwd }).split(/\s+/).filter(Boolean);
}

function parseNameStatus(raw) {
  if (!Buffer.isBuffer(raw)) fail("GIT_INSPECTION_FAILED");
  const fields = raw.toString("utf8").split("\0");
  if (fields.at(-1) === "") fields.pop();
  const changes = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (!/^[AMD]$/.test(status) || index >= fields.length) fail("UNSUPPORTED_GIT_CHANGE");
    changes.push({ status, path: fields[index++] });
  }
  return changes;
}

function treeEntry(cwd, commit, repositoryPath) {
  const row = runGit(["ls-tree", commit, "--", repositoryPath], { cwd });
  if (row === "") return null;
  const match = row.match(/^(\d{6}) ([a-z]+) ([0-9a-f]{40})\t(.+)$/);
  if (!match || match[4] !== repositoryPath) fail("UNSUPPORTED_GIT_ENTRY_MODE");
  return { mode: match[1], type: match[2], object: match[3], path: match[4] };
}

function changedPaths(cwd, base, commit) {
  const raw = runGit(["diff-tree", "-r", "--no-commit-id", "--name-status", "-z", base, commit], {
    cwd,
    encoding: null,
  });
  const changes = parseNameStatus(raw);
  if (changes.some((entry) => entry.status === "D" || !isSafeRepositoryPath(entry.path))) fail("UNSUPPORTED_GIT_CHANGE");
  for (const change of changes) {
    const currentEntry = treeEntry(cwd, commit, change.path);
    if (!currentEntry || currentEntry.type !== "blob" || !["100644", "100755"].includes(currentEntry.mode)) {
      fail("UNSUPPORTED_GIT_ENTRY_MODE");
    }
    const baseEntry = treeEntry(cwd, base, change.path);
    if (change.status === "M" && (!baseEntry || baseEntry.mode !== currentEntry.mode)) {
      fail("UNSUPPORTED_GIT_ENTRY_MODE");
    }
  }
  return changes.map((entry) => entry.path).sort();
}

function readManifestAtCommit(cwd, commit, taskId) {
  const approvalPath = approvalPathForTask(taskId);
  let text;
  try {
    text = execFileSync(GIT_EXECUTABLE, ["--no-replace-objects", "show", `${commit}:${approvalPath}`], {
      cwd,
      encoding: "utf8",
      env: gitEnvironment(),
      maxBuffer: MAX_GIT_OUTPUT,
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fail("APPROVAL_NOT_FOUND");
  }
  let manifest;
  try {
    manifest = parseJsonStrict(text);
  } catch (error) {
    if (error?.code === "DUPLICATE_JSON_KEY") fail("DUPLICATE_JSON_KEY");
    fail("APPROVAL_JSON_INVALID");
  }
  validateApprovalManifest(manifest);
  if (manifest.taskId !== taskId) fail("TASK_MISMATCH");
  return manifest;
}

export function inspectApprovalCommit({ cwd = process.cwd(), taskId, commit = null } = {}) {
  ensureRepositoryIdentity(cwd);
  const approvalCommit = commit ?? runGit(["rev-parse", "HEAD"], { cwd });
  if (!SHA_PATTERN.test(approvalCommit)) fail("APPROVAL_COMMIT_INVALID");
  const manifest = readManifestAtCommit(cwd, approvalCommit, taskId);
  const parents = commitParents(cwd, approvalCommit);
  if (parents.length !== 1 || parents[0] !== manifest.request.baseCommit) fail("APPROVAL_COMMIT_PARENT_INVALID");
  if (runGit(["rev-parse", `${manifest.request.baseCommit}^{tree}`], { cwd }) !== manifest.request.baseTree) {
    fail("REQUEST_BASE_INVALID");
  }
  const paths = changedPaths(cwd, manifest.request.baseCommit, approvalCommit);
  if (JSON.stringify(paths) !== JSON.stringify(manifest.request.approvalCommitPaths)) {
    fail("APPROVAL_COMMIT_SCOPE_INVALID");
  }
  if (treeEntry(cwd, approvalCommit, manifest.request.approvalPath)?.mode !== "100644") {
    fail("APPROVAL_FILE_MODE_INVALID");
  }
  return {
    commit: approvalCommit,
    tree: runGit(["rev-parse", `${approvalCommit}^{tree}`], { cwd }),
    parent: parents[0],
    manifest,
    manifestDigest: canonicalDigest(manifest),
    paths,
  };
}

async function defaultRemoteHeadResolver({ cwd, targetBranch }) {
  const output = runGit(["ls-remote", "--heads", "origin", targetBranch], {
    cwd,
    code: "REMOTE_HEAD_UNVERIFIED",
    timeout: 15_000,
  });
  const match = output.match(/^([0-9a-f]{40})\trefs\/heads\/([^\s]+)$/);
  if (!match || match[2] !== targetBranch) fail("REMOTE_HEAD_UNVERIFIED");
  return match[1];
}

async function requireRemoteHead(context, remoteHeadResolver, expectedCommit) {
  let remoteHead;
  try {
    remoteHead = await remoteHeadResolver({
      cwd: context.cwd,
      targetBranch: context.approval.manifest.repository.targetBranch,
    });
  } catch (error) {
    if (error instanceof ProductAuthorityError) throw error;
    fail("REMOTE_HEAD_UNVERIFIED");
  }
  if (remoteHead !== expectedCommit) fail("REMOTE_HEAD_MOVED");
}

function result(fields) {
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    authorityId: AUTHORITY_ID,
    command: fields.command,
    taskId: fields.taskId ?? null,
    decision: fields.decision,
    canExecuteProductWork: fields.canExecuteProductWork ?? false,
    canAcceptProductCandidate: fields.canAcceptProductCandidate ?? false,
    approvalDigest: fields.approvalDigest ?? null,
    candidateCommit: fields.candidateCommit ?? null,
    candidateTree: fields.candidateTree ?? null,
    evidenceDigest: fields.evidenceDigest ?? null,
    reason: fields.reason,
  };
}

export async function authorizeProductWork({
  cwd = process.cwd(),
  taskId,
} = {}) {
  ensureCleanWorktree(cwd);
  const approval = inspectApprovalCommit({ cwd, taskId });
  await requireRemoteHead({ cwd, approval }, defaultRemoteHeadResolver, approval.commit);
  ensureCleanWorktree(cwd);
  await requireRemoteHead({ cwd, approval }, defaultRemoteHeadResolver, approval.commit);
  return result({
    command: "authorize",
    taskId,
    decision: "GO",
    canExecuteProductWork: true,
    approvalDigest: approval.manifestDigest,
    reason: "APPROVED_FOR_ONE_CHILD",
  });
}

function verificationEnvironment() {
  return {
    PATH: "/usr/bin:/bin",
    CI: "1",
    NODE_ENV: "test",
    PYTHONDONTWRITEBYTECODE: "1",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    NO_COLOR: "1",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

export function runVerificationMatrix({ cwd, verification, expectedCommit = null }) {
  const evidence = [];
  let repositoryRoot;
  try {
    repositoryRoot = realpathSync(cwd);
  } catch {
    fail("VERIFICATION_CWD_INVALID");
  }
  for (const entry of verification) {
    if (expectedCommit !== null && runGit(["rev-parse", "HEAD"], { cwd }) !== expectedCommit) {
      fail("PRODUCT_CANDIDATE_MOVED_DURING_VERIFICATION");
    }
    const executable = TOOL_PATHS[entry.tool];
    let commandCwd;
    try {
      commandCwd = realpathSync(entry.cwd === "." ? cwd : path.join(cwd, entry.cwd));
      if (!statSync(commandCwd).isDirectory()
        || (commandCwd !== repositoryRoot && !commandCwd.startsWith(`${repositoryRoot}${path.sep}`))) {
        fail("VERIFICATION_CWD_INVALID");
      }
    } catch (error) {
      if (error instanceof ProductAuthorityError) throw error;
      fail("VERIFICATION_CWD_INVALID");
    }
    const completed = spawnSync(executable, entry.args, {
      cwd: commandCwd,
      encoding: null,
      env: verificationEnvironment(),
      timeout: entry.timeoutMs,
      maxBuffer: MAX_COMMAND_OUTPUT,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (completed.error || completed.signal || completed.status !== 0) fail("VERIFICATION_FAILED");
    if (expectedCommit !== null && runGit(["rev-parse", "HEAD"], { cwd }) !== expectedCommit) {
      fail("PRODUCT_CANDIDATE_MOVED_DURING_VERIFICATION");
    }
    if (expectedCommit !== null) ensureCleanWorktree(cwd, "WORKTREE_DIRTY_AFTER_VERIFICATION");
    evidence.push({
      id: entry.id,
      exitCode: completed.status,
      stdoutDigest: digestBytes(completed.stdout ?? Buffer.alloc(0)),
      stderrDigest: digestBytes(completed.stderr ?? Buffer.alloc(0)),
    });
  }
  return { evidence, evidenceDigest: canonicalDigest(evidence) };
}

export async function verifyProductCandidate({
  cwd = process.cwd(),
  taskId,
} = {}) {
  ensureRepositoryIdentity(cwd);
  ensureCleanWorktree(cwd);
  const candidateCommit = runGit(["rev-parse", "HEAD"], { cwd });
  const parents = commitParents(cwd, candidateCommit);
  if (parents.length !== 1) fail("PRODUCT_CANDIDATE_PARENT_INVALID");
  const approval = inspectApprovalCommit({ cwd, taskId, commit: parents[0] });
  await requireRemoteHead({ cwd, approval }, defaultRemoteHeadResolver, approval.commit);
  const productPaths = changedPaths(cwd, approval.commit, candidateCommit);
  if (JSON.stringify(productPaths) !== JSON.stringify(approval.manifest.request.productPaths)) {
    fail("PRODUCT_COMMIT_SCOPE_INVALID");
  }
  const verificationResult = runVerificationMatrix({
    cwd,
    verification: approval.manifest.verification,
    expectedCommit: candidateCommit,
  });
  if (runGit(["rev-parse", "HEAD"], { cwd }) !== candidateCommit) {
    fail("PRODUCT_CANDIDATE_MOVED_DURING_VERIFICATION");
  }
  ensureCleanWorktree(cwd, "WORKTREE_DIRTY_AFTER_VERIFICATION");
  await requireRemoteHead({ cwd, approval }, defaultRemoteHeadResolver, approval.commit);
  return result({
    command: "verify-candidate",
    taskId,
    decision: "PASS",
    canAcceptProductCandidate: true,
    approvalDigest: approval.manifestDigest,
    candidateCommit,
    candidateTree: runGit(["rev-parse", `${candidateCommit}^{tree}`], { cwd }),
    evidenceDigest: verificationResult.evidenceDigest,
    reason: "CANDIDATE_ELIGIBLE_FOR_OWNER_ACCEPTANCE",
  });
}

function parseCli(argv) {
  if (argv.length === 1 && argv[0] === "--status") return { command: "status", taskId: null };
  if (argv.length === 3 && argv[1] === "--task" && TASK_ID_PATTERN.test(argv[2])) {
    if (argv[0] === "--digest") return { command: "digest", taskId: argv[2] };
    if (argv[0] === "--authorize") return { command: "authorize", taskId: argv[2] };
    if (argv[0] === "--verify-candidate") return { command: "verify-candidate", taskId: argv[2] };
  }
  return { command: "invalid", taskId: null };
}

export async function runCli(argv = process.argv.slice(2), { cwd = process.cwd() } = {}) {
  const parsed = parseCli(argv);
  if (parsed.command === "invalid") {
    process.stdout.write(`${JSON.stringify(result({ command: "invalid", decision: "STOP", reason: "USAGE_INVALID" }))}\n`);
    return 64;
  }
  if (parsed.command === "status") {
    process.stdout.write(`${JSON.stringify(result({ command: "status", decision: "STOP", reason: "APPROVAL_NOT_SELECTED" }))}\n`);
    return 0;
  }
  try {
    let response;
    if (parsed.command === "digest") {
      ensureCleanWorktree(cwd);
      const approval = inspectApprovalCommit({ cwd, taskId: parsed.taskId });
      response = result({
        command: "digest",
        taskId: parsed.taskId,
        decision: "DIGEST",
        approvalDigest: approval.manifestDigest,
        reason: "APPROVAL_DIGEST_VALID",
      });
    } else if (parsed.command === "authorize") {
      response = await authorizeProductWork({ cwd, taskId: parsed.taskId });
    } else {
      response = await verifyProductCandidate({ cwd, taskId: parsed.taskId });
    }
    process.stdout.write(`${JSON.stringify(response)}\n`);
    return 0;
  } catch (error) {
    const reason = error instanceof ProductAuthorityError ? error.code : "INTERNAL_ERROR";
    process.stdout.write(`${JSON.stringify(result({
      command: parsed.command,
      taskId: parsed.taskId,
      decision: "STOP",
      reason,
    }))}\n`);
    return 2;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = await runCli();
}

export { canonicalizeRfc8785 };

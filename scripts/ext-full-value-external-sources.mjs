#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseJsonNoDuplicateKeys } from "./execution_authority_ext.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = dirname(dirname(scriptPath));

export const EXTERNAL_SOURCE_PATH =
  "docs/migrations/2026-08-20-ext-external-capability-source-snapshot.v1.json";

const CAPABILITY_INVENTORY_PATH =
  "docs/migrations/2026-08-14-capability-island-inventory.json";
const TARGET_REF = "origin/ext-dev";
const SENSITIVE_PATH_MARKERS = [
  "/.openclaw",
  "/.battery_knowledge",
  "/super_brain_backend",
];
const ALLOWED_EXTERNAL_PATHS = new Set([
  "/home/ubuntu/.battery_knowledge",
  "/home/ubuntu/.openclaw",
  "/home/ubuntu/.openclaw-snapshots",
  "/home/ubuntu/CourtOS-Brain",
  "/home/ubuntu/CourtOS-Brain.migrated-2026-07-13",
  "/home/ubuntu/Projects/chaotang-ext-certification",
  "/home/ubuntu/Projects/chaotang-ext-certification-evidence",
  "/home/ubuntu/Projects/chaotang-ext-gongbu-egb0",
  "/home/ubuntu/Projects/chaotang-os-rc0-d5df61c",
  "/home/ubuntu/Projects/chaotang-release-evidence",
  "/home/ubuntu/battery-rd-os",
  "/home/ubuntu/chaotang-archive",
  "/home/ubuntu/chaotang-archive/qintian-2026-07-04",
  "/home/ubuntu/chaotang-concept",
  "/home/ubuntu/chaotang-intel",
  "/home/ubuntu/chaotang-landing",
  "/home/ubuntu/chaotang-libu-studio",
  "/home/ubuntu/chaotang-logs",
  "/home/ubuntu/chaotang-weblyt",
  "/home/ubuntu/courtos-docs-salvage",
  "/home/ubuntu/design-system",
  "/home/ubuntu/hermes-agent",
  "/home/ubuntu/legal-agent",
  "/home/ubuntu/legal-agent-worktrees/demo-workflow",
  "/home/ubuntu/legal-verify-core",
  "/home/ubuntu/super_brain_backend",
  "/mnt/c/Users/admin/.agents/skills",
  "/mnt/c/Users/admin/.agents/skills/expert-council",
]);
const CONTENT_HASH_ALLOWED_PATHS = [
  "/home/ubuntu/legal-verify-core",
  "/home/ubuntu/chaotang-weblyt",
  "/home/ubuntu/chaotang-archive/qintian-2026-07-04",
  "/home/ubuntu/chaotang-concept",
  "/home/ubuntu/courtos-docs-salvage",
  "/mnt/c/Users/admin/.agents/skills",
];
const MAX_DIRECTORY_FILES = 10_000;
const MAX_DIRECTORY_ENTRIES = 10_000;
const MAX_DIRECTORY_DEPTH = 64;
const MAX_DIRECTORY_BYTES = 256 * 1024 * 1024;
const MAX_SINGLE_FILE_BYTES = 32 * 1024 * 1024;
const SELECTOR_PREFIX_ALIASES = Object.freeze({
  "council graph/store/observer/activation": "backend/app/council_graph",
});
const SOURCE_KEYS = Object.freeze([
  "sourceId", "capabilityId", "capabilityName", "declaredSource",
  "observationKind", "state", "privacyMode", "observedPath", "revision",
  "expectedPin", "head", "tree", "pinState", "selector", "selectorState",
  "matchedPathCount", "matchedRefsSha256", "trackedFileCount",
  "trackedDirtyCount", "allDirtyCount", "directoryFileCount",
  "directoryContentSha256", "canonicalDonorEligible", "blockedReason",
  "nonAuthorizing",
]);

function git(root, args, encoding = "utf8") {
  return execFileSync("/usr/bin/git", [
    "--no-replace-objects",
    "-c", "core.fsmonitor=false",
    "-c", "core.untrackedCache=false",
    "-c", "core.hooksPath=/dev/null",
    ...args,
  ], {
    cwd: root,
    encoding,
    env: {
      PATH: "/usr/bin:/bin",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_NO_REPLACE_OBJECTS: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
    },
    maxBuffer: 32 * 1024 * 1024,
    timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseStrict(bytes) {
  return parseJsonNoDuplicateKeys(Buffer.isBuffer(bytes) ? bytes.toString("utf8") : bytes);
}

function hasExactKeys(value, expected) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function countFiles(root) {
  let count = 0;
  let visitedEntries = 0;
  const pending = [{ path: root, depth: 0 }];
  while (pending.length > 0) {
    const { path: current, depth } = pending.pop();
    let entries;
    entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      visitedEntries += 1;
      if (visitedEntries > MAX_DIRECTORY_ENTRIES) {
        throw new Error("DIRECTORY_ENTRY_BUDGET_EXCEEDED");
      }
      const path = resolve(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error("DIRECTORY_SYMLINK_REQUIRES_REVIEW");
      if (entry.isDirectory()) {
        if (depth + 1 > MAX_DIRECTORY_DEPTH) {
          throw new Error("DIRECTORY_DEPTH_BUDGET_EXCEEDED");
        }
        pending.push({ path, depth: depth + 1 });
      }
      if (entry.isFile()) count += 1;
      if (!entry.isDirectory() && !entry.isFile()) {
        throw new Error("DIRECTORY_SPECIAL_FILE_REQUIRES_REVIEW");
      }
      if (count > MAX_DIRECTORY_FILES) throw new Error("DIRECTORY_FILE_BUDGET_EXCEEDED");
    }
  }
  return count;
}

function hashDirectory(root, selector = null) {
  const records = [];
  let totalBytes = 0;
  let visitedEntries = 0;
  let matchedRootCount = 0;
  const pending = [{ path: root, depth: 0 }];
  const perspectivePattern = selector?.includes("*-perspective") ?? false;
  while (pending.length > 0) {
    const { path: current, depth } = pending.pop();
    let entries;
    entries = readdirSync(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      visitedEntries += 1;
      if (visitedEntries > MAX_DIRECTORY_ENTRIES) {
        throw new Error("DIRECTORY_ENTRY_BUDGET_EXCEEDED");
      }
      const path = resolve(current, entry.name);
      const relative = path.slice(root.length + 1);
      if (perspectivePattern && depth === 0) {
        if (!entry.name.endsWith("-perspective")) continue;
        if (entry.isSymbolicLink()) throw new Error("DIRECTORY_SYMLINK_REQUIRES_REVIEW");
        if (!entry.isDirectory()) throw new Error("DIRECTORY_SELECTOR_MATCH_TYPE_INVALID");
        matchedRootCount += 1;
      }
      if (entry.isSymbolicLink()) throw new Error("DIRECTORY_SYMLINK_REQUIRES_REVIEW");
      if (entry.isDirectory()) {
        if (depth + 1 > MAX_DIRECTORY_DEPTH) {
          throw new Error("DIRECTORY_DEPTH_BUDGET_EXCEEDED");
        }
        pending.push({ path, depth: depth + 1 });
      }
      if (entry.isFile()) {
        const size = lstatSync(path).size;
        if (size > MAX_SINGLE_FILE_BYTES) throw new Error("DIRECTORY_FILE_BUDGET_EXCEEDED");
        totalBytes += size;
        if (totalBytes > MAX_DIRECTORY_BYTES) throw new Error("DIRECTORY_BYTE_BUDGET_EXCEEDED");
        if (records.length >= MAX_DIRECTORY_FILES) {
          throw new Error("DIRECTORY_FILE_BUDGET_EXCEEDED");
        }
        const bytes = readFileSync(path);
        const mode = (lstatSync(path).mode & 0o777).toString(8).padStart(3, "0");
        records.push(`${relative}\0${mode}\0${bytes.length}\0${sha256(bytes)}`);
      }
      if (!entry.isDirectory() && !entry.isFile()) {
        throw new Error("DIRECTORY_SPECIAL_FILE_REQUIRES_REVIEW");
      }
    }
  }
  if (perspectivePattern && matchedRootCount === 0) {
    throw new Error("DIRECTORY_SELECTOR_NO_MATCH");
  }
  records.sort();
  return {
    directoryFileCount: records.length,
    directoryContentSha256: sha256(records.join("\n")),
    matchedPathCount: perspectivePattern ? matchedRootCount : null,
    selectorState: perspectivePattern ? "MATCHED" : null,
  };
}

export function hashDirectoryForTest(root, selector = null) {
  return hashDirectory(root, selector);
}

function windowsPathToWsl(path) {
  const match = /^([A-Za-z]):\/(.*)$/u.exec(path);
  return match ? `/mnt/${match[1].toLowerCase()}/${match[2]}` : path;
}

function splitPinnedPath(source) {
  const match = /^(\/[^@]+)@([0-9a-f]{7,40})(?:\s.*)?$/u.exec(source);
  if (!match) return null;
  return { path: match[1], expectedPin: match[2] };
}

function wildcardPattern(value) {
  return new RegExp(`^${value.split("*").map(
    (part) => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
  ).join(".*")}$`, "u");
}

function resolveDeclaredSource(source, repositoryRoot) {
  const pinned = splitPinnedPath(source);
  if (pinned) return ALLOWED_EXTERNAL_PATHS.has(pinned.path)
    ? { ...pinned, kind: "FILESYSTEM_PATH" }
    : { kind: "DECLARATION_ONLY", reason: "EXTERNAL_PATH_NOT_ALLOWLISTED" };
  if (source.startsWith("/")) {
    const path = source.replace(/\s+\([^)]*\)\s*$/u, "");
    return ALLOWED_EXTERNAL_PATHS.has(path) ? {
      path,
      expectedPin: null,
      kind: "FILESYSTEM_PATH",
    } : { kind: "DECLARATION_ONLY", reason: "EXTERNAL_PATH_NOT_ALLOWLISTED" };
  }
  const refPin = /^([^\s@]+)@([0-9a-f]{7,40})$/u.exec(source);
  if (refPin) {
    try {
      return {
        kind: "REPOSITORY_GIT_OBJECT",
        revision: refPin[1],
        commit: git(repositoryRoot, ["rev-parse", `${refPin[1]}^{commit}`]).trim(),
        expectedPin: refPin[2],
        selector: null,
      };
    } catch {
      return { kind: "DECLARATION_ONLY", reason: "PINNED_REF_NOT_RESOLVED" };
    }
  }
  const refPattern = source.replace(/\s+refs$/u, "");
  if (refPattern.includes("*")) {
    const pattern = wildcardPattern(refPattern);
    const matches = git(repositoryRoot, [
      "for-each-ref",
      "--format=%(refname:short)|%(objectname)",
      "refs/heads",
      "refs/remotes",
    ]).split("\n").filter(Boolean).filter((line) => pattern.test(line.split("|")[0]));
    if (matches.length > 0) {
      return { kind: "REPOSITORY_REF_PATTERN", revision: refPattern, matches };
    }
  }
  if (/^[A-Za-z0-9][A-Za-z0-9._/-]+$/u.test(source)) {
    try {
      return {
        kind: "REPOSITORY_GIT_OBJECT",
        revision: source,
        commit: git(repositoryRoot, ["rev-parse", `${source}^{commit}`]).trim(),
        expectedPin: null,
        selector: null,
      };
    } catch {
      // Descriptive identifiers intentionally fall through to declaration-only.
    }
  }
  if (/^[A-Za-z]:\//u.test(source)) {
    const path = windowsPathToWsl(source);
    const wildcardIndex = path.indexOf("*");
    const observationPath = wildcardIndex >= 0
      ? path.slice(0, wildcardIndex).replace(/\/$/u, "")
      : path;
    return ALLOWED_EXTERNAL_PATHS.has(observationPath) ? {
      path: observationPath,
      expectedPin: null,
      selector: wildcardIndex >= 0 ? source : null,
      kind: "FILESYSTEM_PATH",
    } : { kind: "DECLARATION_ONLY", reason: "EXTERNAL_PATH_NOT_ALLOWLISTED" };
  }
  const colon = source.indexOf(":");
  if (colon > 0) {
    const revision = source.slice(0, colon);
    try {
      const commit = git(repositoryRoot, ["rev-parse", `${revision}^{commit}`]).trim();
      return {
        kind: "REPOSITORY_GIT_OBJECT",
        revision,
        commit,
        selector: source.slice(colon + 1),
      };
    } catch {
      return { kind: "DECLARATION_ONLY", reason: "REVISION_NOT_RESOLVED" };
    }
  }
  if (/^(?:frontend|backend|docs|scripts|\.harness)\//u.test(source)) {
    return {
      kind: "REPOSITORY_GIT_OBJECT",
      revision: TARGET_REF,
      commit: git(repositoryRoot, ["rev-parse", `${TARGET_REF}^{commit}`]).trim(),
      selector: source,
    };
  }
  return { kind: "DECLARATION_ONLY", reason: "SOURCE_IS_DESCRIPTIVE_OR_AMBIGUOUS" };
}

function observeRepositoryObject(resolved, repositoryRoot) {
  const tree = git(repositoryRoot, ["rev-parse", `${resolved.commit}^{tree}`]).trim();
  const rawSelector = resolved.selector?.trim() ?? "";
  const selector = SELECTOR_PREFIX_ALIASES[rawSelector] ?? rawSelector;
  let selectorState = selector === "" ? null : "DESCRIPTIVE_SELECTOR_REVIEW_REQUIRED";
  let matchedPathCount = 0;
  if (selector !== "" && !/\s(?:and|or)\s|\(|\)|,/iu.test(selector)) {
    const hasWildcard = selector.includes("*");
    const prefix = selector.split("*")[0].replace(/\/$/u, "");
    const paths = git(repositoryRoot, [
      "-c",
      "core.quotePath=false",
      "ls-tree",
      "-r",
      "--name-only",
      resolved.commit,
    ])
      .split("\n").filter(Boolean);
    matchedPathCount = paths.filter((path) => path === prefix
      || path.startsWith(hasWildcard ? prefix : `${prefix}/`))
      .length;
    selectorState = matchedPathCount > 0 ? "MATCHED" : "NO_MATCH_REVIEW_REQUIRED";
  }
  return {
    observationKind: "REPOSITORY_GIT_OBJECT",
    state: selectorState === null || selectorState === "MATCHED"
      ? "FROZEN"
      : "BLOCKED_REVIEW_REQUIRED",
    privacyMode: "CONTENT_ADDRESSED_GIT_METADATA",
    observedPath: null,
    revision: resolved.revision,
    expectedPin: resolved.expectedPin ?? null,
    head: resolved.commit,
    tree,
    pinState: resolved.expectedPin
      ? resolved.commit.startsWith(resolved.expectedPin) ? "MATCH" : "DRIFTED"
      : "CONTENT_ADDRESSED",
    selector: rawSelector || null,
    selectorState: rawSelector !== selector && selectorState === "MATCHED"
      ? "MATCHED_BY_DECLARED_ALIAS"
      : selectorState,
    matchedPathCount,
    trackedFileCount: null,
    trackedDirtyCount: 0,
    allDirtyCount: 0,
    directoryFileCount: null,
    canonicalDonorEligible: (selectorState === null || selectorState === "MATCHED")
      && (!resolved.expectedPin || resolved.commit.startsWith(resolved.expectedPin)),
    blockedReason: selectorState === null || selectorState === "MATCHED"
      ? resolved.expectedPin && !resolved.commit.startsWith(resolved.expectedPin)
        ? "DECLARED_PIN_DRIFTED" : null
      : "SELECTOR_NOT_EXACTLY_RESOLVED",
  };
}

function observeRepositoryRefPattern(resolved) {
  return {
    observationKind: "REPOSITORY_REF_PATTERN",
    state: "FROZEN",
    privacyMode: "CONTENT_ADDRESSED_GIT_METADATA",
    observedPath: null,
    revision: resolved.revision,
    expectedPin: null,
    head: null,
    tree: null,
    pinState: "MULTIPLE_CONTENT_ADDRESSED_REFS",
    selector: resolved.revision,
    selectorState: "MATCHED",
    matchedPathCount: resolved.matches.length,
    matchedRefsSha256: sha256([...resolved.matches].sort().join("\n")),
    trackedFileCount: null,
    trackedDirtyCount: 0,
    allDirtyCount: 0,
    directoryFileCount: null,
    canonicalDonorEligible: false,
    blockedReason: null,
  };
}

function blockedFilesystemPath(resolved, observedPath, sensitive, blockedReason) {
  return {
    observationKind: "FILESYSTEM_PATH",
    state: "BLOCKED_REVIEW_REQUIRED",
    privacyMode: sensitive ? "SENSITIVE_COUNTS_ONLY" : "METADATA_ONLY_NO_CONTENT_FREEZE",
    observedPath,
    revision: null,
    expectedPin: resolved.expectedPin,
    head: null,
    tree: null,
    pinState: "NOT_OBSERVED_PATH_IDENTITY_BLOCKED",
    selector: resolved.selector ?? null,
    selectorState: resolved.selector ? "PATH_IDENTITY_BLOCKED" : null,
    matchedPathCount: null,
    trackedFileCount: null,
    trackedDirtyCount: null,
    allDirtyCount: null,
    directoryFileCount: null,
    directoryContentSha256: null,
    canonicalDonorEligible: false,
    blockedReason,
  };
}

function observeFilesystemPath(resolved) {
  let sensitive = SENSITIVE_PATH_MARKERS.some((marker) => resolved.path.includes(marker));
  let path;
  try {
    if (lstatSync(resolved.path).isSymbolicLink()) {
      return blockedFilesystemPath(
        resolved,
        resolved.path,
        sensitive,
        "SOURCE_ROOT_SYMLINK_REQUIRES_REVIEW",
      );
    }
    path = realpathSync(resolved.path);
    lstatSync(path);
    sensitive = sensitive || SENSITIVE_PATH_MARKERS.some((marker) => path.includes(marker));
    if (path !== resolve(resolved.path)) {
      return blockedFilesystemPath(
        resolved,
        path,
        sensitive,
        "SOURCE_REALPATH_DIFFERS_FROM_ALLOWLISTED_PATH",
      );
    }
  } catch {
    return {
      observationKind: "FILESYSTEM_PATH",
      state: "UNAVAILABLE",
      privacyMode: sensitive ? "SENSITIVE_COUNTS_ONLY" : "METADATA_ONLY",
      observedPath: resolved.path,
      revision: null,
      expectedPin: resolved.expectedPin,
      head: null,
      tree: null,
      pinState: "UNAVAILABLE",
      selector: resolved.selector ?? null,
      selectorState: resolved.selector ? "UNRESOLVED" : null,
      matchedPathCount: 0,
      trackedFileCount: null,
      trackedDirtyCount: null,
      allDirtyCount: null,
      directoryFileCount: null,
      canonicalDonorEligible: false,
      blockedReason: "SOURCE_PATH_UNAVAILABLE",
    };
  }
  if (sensitive) {
    return {
      observationKind: "FILESYSTEM_PATH",
      state: "BLOCKED_REVIEW_REQUIRED",
      privacyMode: "SENSITIVE_COUNTS_ONLY",
      observedPath: path,
      revision: null,
      expectedPin: resolved.expectedPin,
      head: null,
      tree: null,
      pinState: "NOT_OBSERVED_PRIVACY_BLOCKED",
      selector: resolved.selector ?? null,
      selectorState: resolved.selector ? "PRIVACY_BLOCKED" : null,
      matchedPathCount: null,
      trackedFileCount: null,
      trackedDirtyCount: null,
      allDirtyCount: null,
      directoryFileCount: null,
      canonicalDonorEligible: false,
      blockedReason: "SENSITIVE_RUNTIME_CONTENT_NOT_OBSERVED",
    };
  }
  try {
    const head = git(path, ["rev-parse", "HEAD"]).trim();
    const tree = git(path, ["rev-parse", "HEAD^{tree}"]).trim();
    const trackedFileCount = Number(git(path, ["ls-files"]).split("\n").filter(Boolean).length);
    const trackedDirtyCount = git(path, ["status", "--porcelain=v1", "-uno"])
      .split("\n").filter(Boolean).length;
    const allDirtyCount = git(path, ["status", "--porcelain=v1", "--untracked-files=all"])
      .split("\n").filter(Boolean).length;
    const pinState = resolved.expectedPin === null
      ? "UNPINNED"
      : head.startsWith(resolved.expectedPin) ? "MATCH" : "DRIFTED";
    const clean = allDirtyCount === 0;
    const pinned = resolved.expectedPin !== null && pinState === "MATCH";
    return {
      observationKind: "EXTERNAL_GIT_WORKTREE",
      state: sensitive || !clean || pinState === "DRIFTED"
        ? "BLOCKED_REVIEW_REQUIRED"
        : "FROZEN",
      privacyMode: sensitive ? "SENSITIVE_COUNTS_ONLY" : "CONTENT_ADDRESSED_GIT_METADATA",
      observedPath: path,
      revision: null,
      expectedPin: resolved.expectedPin,
      head,
      tree,
      pinState,
      selector: resolved.selector ?? null,
      selectorState: resolved.selector ? "REVIEW_REQUIRED" : null,
      matchedPathCount: null,
      trackedFileCount,
      trackedDirtyCount,
      allDirtyCount,
      directoryFileCount: null,
      canonicalDonorEligible: !sensitive && clean && pinState !== "DRIFTED"
        && (pinned || pinState === "UNPINNED"),
      blockedReason: sensitive
        ? "SENSITIVE_RUNTIME_CONTENT_NOT_ENUMERATED"
        : !clean ? "DIRTY_CONTENT_REQUIRES_SEPARATE_FREEZE"
          : pinState === "DRIFTED" ? "DECLARED_PIN_DRIFTED" : null,
    };
  } catch {
    const contentHashAllowed = CONTENT_HASH_ALLOWED_PATHS.some(
      (allowed) => path === allowed || path.startsWith(`${allowed}/`),
    );
    let directoryFacts;
    try {
      directoryFacts = sensitive
        ? { directoryFileCount: null, directoryContentSha256: null }
        : contentHashAllowed
          ? hashDirectory(path, resolved.selector ?? null)
          : { directoryFileCount: countFiles(path), directoryContentSha256: null };
    } catch (error) {
      directoryFacts = {
        directoryFileCount: null,
        directoryContentSha256: null,
        error: error instanceof Error ? error.message : "DIRECTORY_OBSERVATION_FAILED",
      };
    }
    const safelyFrozen = contentHashAllowed && !directoryFacts.error;
    return {
      observationKind: "EXTERNAL_DIRECTORY",
      state: safelyFrozen ? "FROZEN" : "BLOCKED_REVIEW_REQUIRED",
      privacyMode: sensitive ? "SENSITIVE_COUNTS_ONLY"
        : safelyFrozen ? "CONTENT_HASHED_DIRECTORY" : "METADATA_ONLY_NO_CONTENT_FREEZE",
      observedPath: path,
      revision: null,
      expectedPin: resolved.expectedPin,
      head: null,
      tree: null,
      pinState: resolved.expectedPin ? "NOT_A_GIT_WORKTREE" : "UNPINNED",
      selector: resolved.selector ?? null,
      selectorState: resolved.selector
        ? directoryFacts.selectorState ?? "REVIEW_REQUIRED"
        : null,
      matchedPathCount: directoryFacts.matchedPathCount ?? null,
      trackedFileCount: null,
      trackedDirtyCount: null,
      allDirtyCount: null,
      directoryFileCount: directoryFacts.directoryFileCount,
      directoryContentSha256: directoryFacts.directoryContentSha256,
      canonicalDonorEligible: safelyFrozen,
      blockedReason: sensitive
        ? "SENSITIVE_DIRECTORY_CONTENT_NOT_ENUMERATED"
        : safelyFrozen ? null
          : directoryFacts.error ?? "DIRECTORY_CONTENT_REQUIRES_SEPARATE_FREEZE",
    };
  }
}

export function observeFilesystemPathForTest(resolved) {
  return observeFilesystemPath(resolved);
}

function deriveSummary(sources) {
  const countBy = (selector) => Object.fromEntries([...sources.reduce((map, source) => {
    const key = selector(source);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map())].sort(([a], [b]) => a.localeCompare(b)));
  return {
    declaredSourceCount: sources.length,
    capabilityCount: new Set(sources.map((source) => source.capabilityId)).size,
    canonicalDonorEligibleCount: sources.filter((source) => source.canonicalDonorEligible).length,
    blockedSourceCount: sources.filter((source) => source.state !== "FROZEN").length,
    byObservationKind: countBy((source) => source.observationKind),
    byState: countBy((source) => source.state),
    byPrivacyMode: countBy((source) => source.privacyMode),
  };
}

export function observeExternalSources(repositoryRoot = defaultRoot) {
  const inventory = parseStrict(readFileSync(resolve(repositoryRoot, CAPABILITY_INVENTORY_PATH)));
  const sources = [];
  for (const capability of inventory.islands) {
    for (const [sourceIndex, declaredSource] of (capability.sources ?? []).entries()) {
      const resolved = resolveDeclaredSource(declaredSource, repositoryRoot);
      let observation;
      if (resolved.kind === "REPOSITORY_GIT_OBJECT") {
        observation = observeRepositoryObject(resolved, repositoryRoot);
      } else if (resolved.kind === "REPOSITORY_REF_PATTERN") {
        observation = observeRepositoryRefPattern(resolved);
      } else if (resolved.kind === "FILESYSTEM_PATH") {
        observation = observeFilesystemPath(resolved);
      } else {
        observation = {
          observationKind: "DECLARATION_ONLY",
          state: "BLOCKED_REVIEW_REQUIRED",
          privacyMode: "DECLARATION_ONLY",
          observedPath: null,
          revision: null,
          expectedPin: null,
          head: null,
          tree: null,
          pinState: "NOT_APPLICABLE",
          selector: null,
          selectorState: null,
          matchedPathCount: null,
          trackedFileCount: null,
          trackedDirtyCount: null,
          allDirtyCount: null,
          directoryFileCount: null,
          canonicalDonorEligible: false,
          blockedReason: resolved.reason,
        };
      }
      const sourceRecord = {
        sourceId: `${capability.id}:${String(sourceIndex + 1).padStart(2, "0")}`,
        capabilityId: capability.id,
        capabilityName: capability.name,
        declaredSource,
        ...observation,
        nonAuthorizing: true,
      };
      for (const key of SOURCE_KEYS) {
        if (!Object.hasOwn(sourceRecord, key)) sourceRecord[key] = null;
      }
      sources.push(sourceRecord);
    }
  }
  const snapshot = {
    schemaVersion: "ext-full-value-external-capability-sources.v1",
    capturedAt: new Date().toISOString(),
    targetRef: TARGET_REF,
    nonAuthorizing: true,
    authorityDecision: "STOP",
    policy: {
      safeDeclaredCodeDirectoryHashingAllowed: true,
      sensitiveRuntimeContentReadAllowed: false,
      dirtyContentRequiresSeparateFreeze: true,
      directoryContentRequiresSeparateFreeze: true,
      canonicalDonorRequiresContentAddressedCleanSource: true,
    },
    inventoryBinding: {
      path: CAPABILITY_INVENTORY_PATH,
      sha256: sha256(readFileSync(resolve(repositoryRoot, CAPABILITY_INVENTORY_PATH))),
    },
    sources,
    summary: null,
  };
  snapshot.summary = deriveSummary(sources);
  return snapshot;
}

export function validateExternalSourceSnapshot(snapshot, frozenInputs = null) {
  const errors = [];
  if (snapshot?.schemaVersion !== "ext-full-value-external-capability-sources.v1") {
    return ["external source snapshot schemaVersion is invalid"];
  }
  if (snapshot.nonAuthorizing !== true || snapshot.authorityDecision !== "STOP") {
    errors.push("external source snapshot must remain non-authorizing and STOP");
  }
  if (snapshot.targetRef !== TARGET_REF) {
    errors.push("external source snapshot targetRef must be origin/ext-dev");
  }
  if (typeof snapshot.capturedAt !== "string"
      || Number.isNaN(Date.parse(snapshot.capturedAt))) {
    errors.push("external source snapshot capturedAt is invalid");
  }
  if (!hasExactKeys(snapshot, [
    "schemaVersion", "capturedAt", "targetRef", "nonAuthorizing",
    "authorityDecision", "policy", "inventoryBinding", "sources", "summary",
  ])) {
    errors.push("external source snapshot has an invalid field set");
  }
  if (!hasExactKeys(snapshot.policy, [
    "safeDeclaredCodeDirectoryHashingAllowed",
    "sensitiveRuntimeContentReadAllowed",
    "dirtyContentRequiresSeparateFreeze",
    "directoryContentRequiresSeparateFreeze",
    "canonicalDonorRequiresContentAddressedCleanSource",
  ]) || snapshot.policy.safeDeclaredCodeDirectoryHashingAllowed !== true
      || snapshot.policy.sensitiveRuntimeContentReadAllowed !== false
      || snapshot.policy.dirtyContentRequiresSeparateFreeze !== true
      || snapshot.policy.directoryContentRequiresSeparateFreeze !== true
      || snapshot.policy.canonicalDonorRequiresContentAddressedCleanSource !== true) {
    errors.push("external source snapshot policy is invalid");
  }
  if (!Array.isArray(snapshot.sources)
      || new Set(snapshot.sources.map((source) => source.sourceId)).size !== snapshot.sources.length) {
    errors.push("external source snapshot source ids are invalid or duplicated");
  }
  if (snapshot.sources?.some((source) => source.nonAuthorizing !== true
      || typeof source.capabilityId !== "string"
      || typeof source.declaredSource !== "string"
      || typeof source.state !== "string")) {
    errors.push("external source snapshot contains an invalid source record");
  }
  const allowedKinds = new Set([
    "DECLARATION_ONLY", "EXTERNAL_DIRECTORY", "EXTERNAL_GIT_WORKTREE",
    "FILESYSTEM_PATH", "REPOSITORY_GIT_OBJECT", "REPOSITORY_REF_PATTERN",
  ]);
  const allowedStates = new Set(["FROZEN", "BLOCKED_REVIEW_REQUIRED", "UNAVAILABLE"]);
  for (const [index, source] of (snapshot.sources ?? []).entries()) {
    const label = `external source ${index}`;
    if (!hasExactKeys(source, SOURCE_KEYS)) {
      errors.push(`${label} has an invalid field set`);
      continue;
    }
    if (!allowedKinds.has(source.observationKind) || !allowedStates.has(source.state)) {
      errors.push(`${label} has an invalid observation kind or state`);
    }
    const sensitive = SENSITIVE_PATH_MARKERS.some((marker) => (
      source.declaredSource.includes(marker) || source.observedPath?.includes(marker)
    ));
    if (sensitive && (source.privacyMode !== "SENSITIVE_COUNTS_ONLY"
        || source.canonicalDonorEligible !== false
        || source.state !== "BLOCKED_REVIEW_REQUIRED"
        || source.directoryContentSha256 !== null)) {
      errors.push(`${label} violates the sensitive-source privacy boundary`);
    }
    if (source.state === "FROZEN" && source.blockedReason !== null) {
      errors.push(`${label} cannot be frozen with a blocked reason`);
    }
    if (source.state !== "FROZEN" && (typeof source.blockedReason !== "string"
        || source.blockedReason.length === 0)) {
      errors.push(`${label} must explain why it is not frozen`);
    }
    if (source.observationKind === "EXTERNAL_DIRECTORY") {
      const selectorResolved = source.selector === null
        || (source.selectorState === "MATCHED"
          && Number.isSafeInteger(source.matchedPathCount)
          && source.matchedPathCount > 0);
      const eligible = source.state === "FROZEN"
        && source.privacyMode === "CONTENT_HASHED_DIRECTORY"
        && /^[0-9a-f]{64}$/u.test(source.directoryContentSha256 ?? "")
        && Number.isSafeInteger(source.directoryFileCount)
        && source.directoryFileCount >= 0
        && selectorResolved;
      if (source.canonicalDonorEligible !== eligible) {
        errors.push(`${label} directory donor eligibility is inconsistent`);
      }
    }
    if (source.observationKind === "EXTERNAL_GIT_WORKTREE") {
      const eligible = source.state === "FROZEN" && source.allDirtyCount === 0
        && source.trackedDirtyCount === 0 && !sensitive
        && /^[0-9a-f]{40}$/u.test(source.head ?? "")
        && /^[0-9a-f]{40}$/u.test(source.tree ?? "")
        && source.pinState !== "DRIFTED";
      if (source.canonicalDonorEligible !== eligible) {
        errors.push(`${label} Git worktree donor eligibility is inconsistent`);
      }
    }
    if (source.observationKind === "REPOSITORY_GIT_OBJECT") {
      const selectorResolved = source.selectorState === null
        || ["MATCHED", "MATCHED_BY_DECLARED_ALIAS"].includes(source.selectorState);
      const eligible = source.state === "FROZEN" && selectorResolved
        && /^[0-9a-f]{40}$/u.test(source.head ?? "")
        && /^[0-9a-f]{40}$/u.test(source.tree ?? "")
        && source.pinState !== "DRIFTED";
      if (source.canonicalDonorEligible !== eligible) {
        errors.push(`${label} repository object donor eligibility is inconsistent`);
      }
    }
    if (["DECLARATION_ONLY", "FILESYSTEM_PATH", "REPOSITORY_REF_PATTERN"].includes(
      source.observationKind,
    ) && source.canonicalDonorEligible !== false) {
      errors.push(`${label} cannot be a canonical donor`);
    }
  }
  if (JSON.stringify(snapshot.summary) !== JSON.stringify(deriveSummary(snapshot.sources ?? []))) {
    errors.push("external source snapshot summary does not match detail");
  }
  if (frozenInputs === null) {
    errors.push("external source validation requires the frozen capability inventory");
  } else {
    const expectedDeclarations = frozenInputs.capabilityInventory.islands.flatMap(
      (capability) => (capability.sources ?? []).map((declaredSource, sourceIndex) => ({
        sourceId: `${capability.id}:${String(sourceIndex + 1).padStart(2, "0")}`,
        capabilityId: capability.id,
        capabilityName: capability.name,
        declaredSource,
      })),
    );
    const actualDeclarations = (snapshot.sources ?? []).map((source) => ({
      sourceId: source.sourceId,
      capabilityId: source.capabilityId,
      capabilityName: source.capabilityName,
      declaredSource: source.declaredSource,
    }));
    if (JSON.stringify(actualDeclarations) !== JSON.stringify(expectedDeclarations)) {
      errors.push("external source declarations do not match the frozen capability inventory");
    }
    if (snapshot.inventoryBinding?.path !== CAPABILITY_INVENTORY_PATH
        || snapshot.inventoryBinding?.sha256 !== frozenInputs.inventoryFileSha256) {
      errors.push("external source inventory binding is invalid");
    }
  }
  return errors;
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function runExternalSourceCli(argv, root = defaultRoot) {
  if (argv.length === 1 && argv[0] === "--observe") {
    print(observeExternalSources(root));
    return 0;
  }
  if (argv.length === 1 && ["--check", "--live-check", "--summary"].includes(argv[0])) {
    const frozen = parseStrict(readFileSync(resolve(root, EXTERNAL_SOURCE_PATH)));
    const inventoryBytes = readFileSync(resolve(root, CAPABILITY_INVENTORY_PATH));
    const errors = validateExternalSourceSnapshot(frozen, {
      capabilityInventory: parseStrict(inventoryBytes),
      inventoryFileSha256: sha256(inventoryBytes),
    });
    if (argv[0] === "--live-check") {
      const live = observeExternalSources(root);
      const normalize = (value) => ({ ...value, capturedAt: null });
      if (JSON.stringify(normalize(frozen)) !== JSON.stringify(normalize(live))) {
        errors.push("external source live observation drifted from the frozen snapshot");
      }
    }
    print({
      schemaVersion: "ext-full-value-external-capability-sources.result.v1",
      command: argv[0].slice(2),
      decision: errors.length === 0 ? "PASS" : "STOP",
      nonAuthorizing: true,
      errors,
      summary: frozen.summary,
    });
    return errors.length === 0 ? 0 : 2;
  }
  process.stderr.write([
    "Usage:",
    "  node scripts/ext-full-value-external-sources.mjs --observe",
    "  node scripts/ext-full-value-external-sources.mjs --check",
    "  node scripts/ext-full-value-external-sources.mjs --live-check",
    "  node scripts/ext-full-value-external-sources.mjs --summary",
  ].join("\n") + "\n");
  return 64;
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  try {
    process.exitCode = runExternalSourceCli(process.argv.slice(2));
  } catch (error) {
    print({
      schemaVersion: "ext-full-value-external-capability-sources.result.v1",
      command: "error",
      decision: "STOP",
      nonAuthorizing: true,
      errors: [error instanceof Error ? error.message : String(error)],
    });
    process.exitCode = 2;
  }
}

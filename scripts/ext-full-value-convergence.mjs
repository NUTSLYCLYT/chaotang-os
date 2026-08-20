#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  realpathSync,
} from "node:fs";
import { basename, dirname, isAbsolute, posix, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validateSemanticLedger } from "./ext-full-value-semantics.mjs";
import { validateOwnerReviewProposal } from "./ext-full-value-owner-review.mjs";
import {
  validateExternalSourceSnapshot,
} from "./ext-full-value-external-sources.mjs";
import { parseJsonNoDuplicateKeys } from "./execution_authority_ext.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = dirname(dirname(scriptPath));

export const MANIFEST_PATH =
  "docs/migrations/2026-08-20-ext-full-value-convergence.v2.json";

export const ALLOWED_DISPOSITIONS = Object.freeze([
  "ABSORB_ADAPT",
  "REBUILD",
  "SUPERSEDED_VERIFY",
  "ARCHIVE",
  "REJECT",
  "DUPLICATE",
  "BLOCKED_WIP",
]);

export const ALLOWED_CATALOG_STATUSES = Object.freeze([
  "FROZEN",
  "FROZEN_REVIEW_REQUIRED",
  "BLOCKED_UNCOMMITTED",
]);

export const ALLOWED_PACKET_STATUSES = Object.freeze([
  "PROPOSED_NOT_AUTHORIZED",
  "BLOCKED",
]);

const FULL_COMMIT = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const TOP_LEVEL_KEYS = [
  "schemaVersion",
  "snapshot",
  "policy",
  "sourceCatalogs",
  "capabilityIndex",
  "proposedPackets",
];
const SNAPSHOT_KEYS = [
  "capturedAt",
  "targetRef",
  "targetHead",
  "targetTree",
  "mode",
  "authorityDecision",
  "authorityCanExecuteProductWork",
];
const POLICY_KEYS = [
  "sourceFreezeRule",
  "deduplicationOrder",
  "allowedDispositions",
  "packetGateOrder",
  "uncommittedSourceRule",
  "destructiveActionsAllowed",
];
const CATALOG_KEYS = [
  "id",
  "kind",
  "path",
  "sha256",
  "itemCount",
  "classifiedItemCount",
  "groupCount",
  "uniqueContentCount",
  "dispositionCounts",
  "status",
];
const REQUIRED_SINGLETON_CATALOG_KINDS = Object.freeze([
  "legacy-branch-ledger",
  "worktree-dispositions",
  "ext-capability-stocktake",
  "six-ministry-inventory",
  "six-ministry-family-matrix",
  "capability-island-inventory",
  "runtime-readiness",
  "ref-snapshot",
  "worktree-snapshot",
  "semantic-ledger",
  "external-capability-sources",
  "owner-review-proposal",
]);
const CAPABILITY_INDEX_KEYS = [
  "catalogId",
  "capabilityCount",
  "semanticCoverageStatus",
  "unresolvedRefTreeCount",
  "unresolvedWorktreeEntryCount",
  "unavailableWorktreeCount",
  "migrationAuthorizedCount",
];
const PACKET_KEYS = [
  "id",
  "capabilityId",
  "priority",
  "disposition",
  "status",
  "targetOwners",
  "authorityTask",
  "blockedReason",
];
const REF_SNAPSHOT_KEYS = ["schemaVersion", "capturedAt", "target", "summary", "refs"];
const REF_TARGET_KEYS = ["ref", "head", "tree"];
const REF_SUMMARY_KEYS = [
  "refCount",
  "commitRefCount",
  "nonCommitRefCount",
  "uniqueTips",
  "exactDuplicateRefs",
  "uniqueTrees",
  "exactTreeDuplicateRefs",
  "legacy99CoveredNames",
  "legacy99CoveredRefs",
  "legacy99TipMatchedNames",
  "legacy99TipDriftedNames",
  "reviewRequiredRefs",
  "reviewRequiredUniqueTrees",
  "byRelation",
  "byGrade",
];
const REF_RECORD_KEYS = [
  "name",
  "refname",
  "refObject",
  "objectType",
  "commitTip",
  "tree",
  "relationToTarget",
  "exactTipRefCount",
  "exactTreeRefCount",
  "canonicalTipRef",
  "canonicalTreeRef",
  "legacy99NamedCoverage",
  "legacy99TipState",
  "grade",
];
const WORKTREE_SNAPSHOT_KEYS = [
  "schemaVersion",
  "capturedAt",
  "repository",
  "summary",
  "worktrees",
];
const WORKTREE_REPOSITORY_KEYS = ["head", "tree", "commonDirSha256"];
const WORKTREE_SUMMARY_KEYS = [
  "registeredWorktrees",
  "availableWorktrees",
  "unavailableWorktrees",
  "excludedCandidateWorktrees",
  "dirtyWorktrees",
  "cleanWorktrees",
  "statusEntryCount",
  "uniqueContentHashes",
  "byState",
  "byPathResolution",
  "byObservationNote",
];
const WORKTREE_RECORD_KEYS = [
  "id",
  "pathSha256",
  "registeredHead",
  "registeredTree",
  "registeredCommonDirSha256",
  "branchRef",
  "state",
  "head",
  "tree",
  "observedBranchRef",
  "observedCommonDirSha256",
  "identityVerified",
  "entryCount",
  "entries",
  "pathResolution",
  "observationNote",
];
const WORKTREE_ENTRY_KEYS = ["status", "path", "originalPath", "sha256", "grade"];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isNullableNonNegativeInteger(value) {
  return value === null || isNonNegativeInteger(value);
}

function isSafeRelativePath(value) {
  return typeof value === "string"
    && value.length > 0
    && value !== "."
    && !isAbsolute(value)
    && !value.includes("\\")
    && posix.normalize(value) === value
    && !value.startsWith("../");
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fileSha256(path) {
  return sha256(readFileSync(path));
}

function countBy(values, selector) {
  const result = {};
  for (const value of values) {
    const key = selector(value);
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function jsonEquals(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function legacySourceName(ref) {
  if (ref.refname?.startsWith("refs/heads/")) return ref.refname.slice("refs/heads/".length);
  if (ref.refname?.startsWith("refs/remotes/origin/")) {
    return ref.refname.slice("refs/remotes/origin/".length);
  }
  return ref.name;
}

export function deriveRefSummary(refs) {
  const commitRefs = refs.filter((ref) => ref.commitTip !== null && ref.tree !== null);
  const reviewRefs = refs.filter((ref) => ref.grade?.endsWith("_REVIEW_REQUIRED"));
  return {
    refCount: refs.length,
    commitRefCount: commitRefs.length,
    nonCommitRefCount: refs.length - commitRefs.length,
    uniqueTips: new Set(commitRefs.map((ref) => ref.commitTip)).size,
    exactDuplicateRefs: commitRefs.length - new Set(commitRefs.map((ref) => ref.commitTip)).size,
    uniqueTrees: new Set(commitRefs.map((ref) => ref.tree)).size,
    exactTreeDuplicateRefs: commitRefs.length - new Set(commitRefs.map((ref) => ref.tree)).size,
    legacy99CoveredNames: new Set(
      refs.filter((ref) => ref.legacy99NamedCoverage).map(legacySourceName),
    ).size,
    legacy99CoveredRefs: refs.filter((ref) => ref.legacy99NamedCoverage).length,
    legacy99TipMatchedNames: new Set(refs.filter(
      (ref) => ref.refname.startsWith("refs/heads/") && ref.legacy99TipState === "MATCH",
    ).map(legacySourceName)).size,
    legacy99TipDriftedNames: new Set(refs.filter(
      (ref) => ref.refname.startsWith("refs/heads/") && ref.legacy99TipState === "DRIFTED",
    ).map(legacySourceName)).size,
    reviewRequiredRefs: reviewRefs.length,
    reviewRequiredUniqueTrees: new Set(
      reviewRefs.map((ref) => ref.tree).filter(Boolean),
    ).size,
    byRelation: countBy(refs, (ref) => ref.relationToTarget),
    byGrade: countBy(refs, (ref) => ref.grade),
  };
}

export function validateRefSnapshot(document, label = "refSnapshot", errors = []) {
  if (!hasExactKeys(document, REF_SNAPSHOT_KEYS)) {
    errors.push(`${label} ref snapshot has an invalid field set`);
    return errors;
  }
  if (document.schemaVersion !== "ext-full-value-ref-snapshot.v2") {
    errors.push(`${label} ref snapshot schemaVersion is invalid`);
  }
  if (typeof document.capturedAt !== "string" || Number.isNaN(Date.parse(document.capturedAt))) {
    errors.push(`${label} ref snapshot capturedAt is invalid`);
  }
  if (!hasExactKeys(document.target, REF_TARGET_KEYS)) {
    errors.push(`${label} ref snapshot target has an invalid field set`);
  }
  if (!hasExactKeys(document.summary, REF_SUMMARY_KEYS)) {
    errors.push(`${label} ref snapshot summary has an invalid field set`);
  }
  if (!Array.isArray(document.refs)) {
    errors.push(`${label} ref snapshot refs must be an array`);
    return errors;
  }
  const refnames = new Set();
  const validCommitRefs = [];
  for (const [index, ref] of document.refs.entries()) {
    const refLabel = `${label}.refs[${index}]`;
    if (!hasExactKeys(ref, REF_RECORD_KEYS)) {
      errors.push(`${refLabel} has an invalid field set`);
      continue;
    }
    if (typeof ref.refname !== "string" || !ref.refname.startsWith("refs/")) {
      errors.push(`${refLabel}.refname is invalid`);
    }
    if (refnames.has(ref.refname)) errors.push(`${refLabel}.refname is duplicated`);
    refnames.add(ref.refname);
    if (!FULL_COMMIT.test(ref.refObject ?? "")) errors.push(`${refLabel}.refObject is invalid`);
    if (typeof ref.objectType !== "string" || ref.objectType === "") {
      errors.push(`${refLabel}.objectType is invalid`);
    }
    const commitPairIsNull = ref.commitTip === null && ref.tree === null;
    const commitPairIsValid = FULL_COMMIT.test(ref.commitTip ?? "")
      && FULL_COMMIT.test(ref.tree ?? "");
    if (!commitPairIsNull && !commitPairIsValid) {
      errors.push(`${refLabel} commitTip/tree must both be hashes or null`);
    }
    if (commitPairIsValid) validCommitRefs.push(ref);
    if (!isNonNegativeInteger(ref.exactTipRefCount)
        || !isNonNegativeInteger(ref.exactTreeRefCount)) {
      errors.push(`${refLabel} duplicate counts are invalid`);
    }
    if ((ref.canonicalTipRef !== null && typeof ref.canonicalTipRef !== "string")
        || (ref.canonicalTreeRef !== null && typeof ref.canonicalTreeRef !== "string")) {
      errors.push(`${refLabel} canonical refs are invalid`);
    }
    if (commitPairIsNull
        && (ref.exactTipRefCount !== 0
          || ref.exactTreeRefCount !== 0
          || ref.canonicalTipRef !== null
          || ref.canonicalTreeRef !== null
          || ref.relationToTarget !== "NON_COMMIT"
          || ref.grade !== "NON_COMMIT_REF_ARCHIVE")) {
      errors.push(`${refLabel} non-commit facts are invalid`);
    }
    if (commitPairIsValid
        && (!isNonNegativeInteger(ref.exactTipRefCount)
          || ref.exactTipRefCount < 1
          || !isNonNegativeInteger(ref.exactTreeRefCount)
          || ref.exactTreeRefCount < 1
          || typeof ref.canonicalTipRef !== "string"
          || typeof ref.canonicalTreeRef !== "string")) {
      errors.push(`${refLabel} commit duplicate/canonical facts are invalid`);
    }
    if (!["TARGET", "TARGET_CONTAINS", "TARGET_IS_ANCESTOR", "DIVERGED", "NON_COMMIT"]
      .includes(ref.relationToTarget)) {
      errors.push(`${refLabel}.relationToTarget is invalid`);
    }
    if (!["TARGET", "TARGET_CONTAINED", "DUPLICATE_TIP_REVIEW_REQUIRED",
      "DUPLICATE_TREE_REVIEW_REQUIRED", "UNIQUE_TREE_REVIEW_REQUIRED",
      "NON_COMMIT_REF_ARCHIVE"].includes(ref.grade)) {
      errors.push(`${refLabel}.grade is invalid`);
    }
    if (typeof ref.legacy99NamedCoverage !== "boolean") {
      errors.push(`${refLabel}.legacy99NamedCoverage must be boolean`);
    }
    if (!["MATCH", "DRIFTED", "NOT_LISTED"].includes(ref.legacy99TipState)
        || (ref.legacy99NamedCoverage === (ref.legacy99TipState === "NOT_LISTED"))) {
      errors.push(`${refLabel}.legacy99TipState is invalid`);
    }
  }
  const refsByTip = new Map();
  const refsByTree = new Map();
  for (const ref of validCommitRefs) {
    if (!refsByTip.has(ref.commitTip)) refsByTip.set(ref.commitTip, []);
    refsByTip.get(ref.commitTip).push(ref.refname);
    if (!refsByTree.has(ref.tree)) refsByTree.set(ref.tree, []);
    refsByTree.get(ref.tree).push(ref.refname);
  }
  for (const ref of validCommitRefs) {
    const tipRefs = refsByTip.get(ref.commitTip).sort();
    const treeRefs = refsByTree.get(ref.tree).sort();
    if (ref.exactTipRefCount !== tipRefs.length
        || ref.canonicalTipRef !== tipRefs[0]
        || ref.exactTreeRefCount !== treeRefs.length
        || ref.canonicalTreeRef !== treeRefs[0]) {
      errors.push(`${label} ref duplicate/canonical facts drift for ${ref.refname}`);
    }
  }
  const derived = deriveRefSummary(document.refs);
  if (!jsonEquals(document.summary, derived)) {
    errors.push(`${label} ref snapshot summary does not match refs`);
  }
  return errors;
}

function deriveWorktreeSummary(worktrees) {
  const available = worktrees.filter((worktree) => ["DIRTY", "CLEAN"].includes(worktree.state));
  const entries = worktrees.flatMap((worktree) => worktree.entries);
  return {
    registeredWorktrees: worktrees.length,
    availableWorktrees: available.length,
    unavailableWorktrees: worktrees.filter((worktree) => worktree.state === "UNAVAILABLE").length,
    excludedCandidateWorktrees: worktrees.filter(
      (worktree) => worktree.state === "EXCLUDED_CURRENT_CANDIDATE",
    ).length,
    dirtyWorktrees: worktrees.filter((worktree) => worktree.state === "DIRTY").length,
    cleanWorktrees: worktrees.filter((worktree) => worktree.state === "CLEAN").length,
    statusEntryCount: entries.length,
    uniqueContentHashes: new Set(entries.map((entry) => entry.sha256).filter(Boolean)).size,
    byState: countBy(worktrees, (worktree) => worktree.state),
    byPathResolution: countBy(worktrees, (worktree) => worktree.pathResolution),
    byObservationNote: countBy(
      worktrees.filter((worktree) => worktree.observationNote !== null),
      (worktree) => worktree.observationNote,
    ),
  };
}

export function validateWorktreeSnapshot(
  document,
  label = "worktreeSnapshot",
  errors = [],
) {
  if (!hasExactKeys(document, WORKTREE_SNAPSHOT_KEYS)) {
    errors.push(`${label} worktree snapshot has an invalid field set`);
    return errors;
  }
  if (document.schemaVersion !== "ext-full-value-worktree-snapshot.v5") {
    errors.push(`${label} worktree snapshot schemaVersion is invalid`);
  }
  if (typeof document.capturedAt !== "string" || Number.isNaN(Date.parse(document.capturedAt))) {
    errors.push(`${label} worktree snapshot capturedAt is invalid`);
  }
  if (!hasExactKeys(document.repository, WORKTREE_REPOSITORY_KEYS)
      || !FULL_COMMIT.test(document.repository.head ?? "")
      || !FULL_COMMIT.test(document.repository.tree ?? "")
      || !SHA256.test(document.repository.commonDirSha256 ?? "")) {
    errors.push(`${label} worktree snapshot repository is invalid`);
  }
  if (!hasExactKeys(document.summary, WORKTREE_SUMMARY_KEYS)) {
    errors.push(`${label} worktree snapshot summary has an invalid field set`);
  }
  if (!Array.isArray(document.worktrees)) {
    errors.push(`${label} worktree snapshot worktrees must be an array`);
    return errors;
  }
  const ids = new Set();
  const pathHashes = new Set();
  for (const [index, worktree] of document.worktrees.entries()) {
    const worktreeLabel = `${label}.worktrees[${index}]`;
    if (!hasExactKeys(worktree, WORKTREE_RECORD_KEYS)) {
      errors.push(`${worktreeLabel} has an invalid field set`);
      continue;
    }
    if (ids.has(worktree.id) || pathHashes.has(worktree.pathSha256)) {
      errors.push(`${worktreeLabel} duplicates a worktree identity`);
    }
    ids.add(worktree.id);
    pathHashes.add(worktree.pathSha256);
    if (!SHA256.test(worktree.pathSha256 ?? "")
        || !FULL_COMMIT.test(worktree.registeredHead ?? "")
        || !FULL_COMMIT.test(worktree.registeredTree ?? "")
        || !SHA256.test(worktree.registeredCommonDirSha256 ?? "")) {
      errors.push(`${worktreeLabel} hashes are invalid`);
    }
    if (worktree.registeredCommonDirSha256 !== document.repository.commonDirSha256) {
      errors.push(`${worktreeLabel} registered common-dir does not match repository anchor`);
    }
    if (typeof worktree.id !== "string" || worktree.id === ""
        || (worktree.branchRef !== null && typeof worktree.branchRef !== "string")
        || (worktree.observedBranchRef !== null
          && typeof worktree.observedBranchRef !== "string")
        || (worktree.observedCommonDirSha256 !== null
          && !SHA256.test(worktree.observedCommonDirSha256 ?? ""))
        || typeof worktree.identityVerified !== "boolean"
        || !FULL_COMMIT.test(worktree.head ?? "")
        || !FULL_COMMIT.test(worktree.tree ?? "")) {
      errors.push(`${worktreeLabel} identity/head/tree fields are invalid`);
    }
    if (!["DIRTY", "CLEAN", "UNAVAILABLE", "EXCLUDED_CURRENT_CANDIDATE"].includes(worktree.state)) {
      errors.push(`${worktreeLabel}.state is invalid`);
    }
    if (!["REGISTERED_PATH", "WSL_UNC_ALIAS", "UNRESOLVED"]
      .includes(worktree.pathResolution)) {
      errors.push(`${worktreeLabel}.pathResolution is invalid`);
    }
    if (worktree.observationNote !== null
        && !["MISSING_WORKTREE_PATH", "OBSERVATION_FAILED",
          "PATH_ALIAS_BROKEN_BUT_OBSERVABLE", "IDENTITY_MISMATCH"]
          .includes(worktree.observationNote)) {
      errors.push(`${worktreeLabel}.observationNote is invalid`);
    }
    if (worktree.pathResolution === "WSL_UNC_ALIAS"
        && worktree.observationNote !== "PATH_ALIAS_BROKEN_BUT_OBSERVABLE") {
      errors.push(`${worktreeLabel} WSL alias must retain an observation note`);
    }
    if (worktree.pathResolution === "UNRESOLVED" && worktree.state !== "UNAVAILABLE") {
      errors.push(`${worktreeLabel} unresolved path must be unavailable`);
    }
    const wasObserved = ["DIRTY", "CLEAN"].includes(worktree.state);
    if (wasObserved && (!worktree.identityVerified
        || worktree.head !== worktree.registeredHead
        || worktree.tree !== worktree.registeredTree
        || worktree.observedBranchRef !== worktree.branchRef
        || worktree.observedCommonDirSha256 !== worktree.registeredCommonDirSha256)) {
      errors.push(`${worktreeLabel} observed identity does not match registered identity`);
    }
    if (!wasObserved && (worktree.identityVerified
        || worktree.observedBranchRef !== null
        || worktree.observedCommonDirSha256 !== null)) {
      errors.push(`${worktreeLabel} unobserved identity must remain unverified`);
    }
    if (!Array.isArray(worktree.entries)
        || worktree.entryCount !== worktree.entries.length) {
      errors.push(`${worktreeLabel}.entryCount does not match entries`);
      continue;
    }
    if (worktree.state === "DIRTY" && worktree.entries.length === 0) {
      errors.push(`${worktreeLabel} DIRTY worktree must contain entries`);
    }
    if (worktree.state !== "DIRTY" && worktree.entries.length !== 0) {
      errors.push(`${worktreeLabel} non-DIRTY worktree must not contain entries`);
    }
    for (const [entryIndex, entry] of worktree.entries.entries()) {
      const entryLabel = `${worktreeLabel}.entries[${entryIndex}]`;
      if (!hasExactKeys(entry, WORKTREE_ENTRY_KEYS)) {
        errors.push(`${entryLabel} has an invalid field set`);
        continue;
      }
      if (!isSafeRelativePath(entry.path)
          || (entry.originalPath !== null && !isSafeRelativePath(entry.originalPath))) {
        errors.push(`${entryLabel} paths are invalid`);
      }
      if (entry.sha256 !== null && !SHA256.test(entry.sha256)) {
        errors.push(`${entryLabel}.sha256 is invalid`);
      }
      if (typeof entry.status !== "string" || entry.status.length !== 2) {
        errors.push(`${entryLabel}.status is invalid`);
      }
      if (entry.grade !== "BLOCKED_UNCOMMITTED") {
        errors.push(`${entryLabel}.grade must be BLOCKED_UNCOMMITTED`);
      }
    }
  }
  const derived = deriveWorktreeSummary(document.worktrees);
  if (!jsonEquals(document.summary, derived)) {
    errors.push(`${label} worktree snapshot summary does not match worktrees`);
  }
  return errors;
}

export function validateWorktreeRefLinks(worktreeSnapshot, refSnapshot, errors = []) {
  const refs = new Map((refSnapshot?.refs ?? []).map((ref) => [ref.refname, ref]));
  for (const worktree of worktreeSnapshot?.worktrees ?? []) {
    if (worktree.branchRef === null) continue;
    const ref = refs.get(worktree.branchRef);
    if (!ref || ref.commitTip !== worktree.registeredHead
        || ref.tree !== worktree.registeredTree) {
      errors.push(`worktree ${worktree.id} registered identity does not match frozen ref`);
    }
  }
  return errors;
}

export function resolveCatalogPath(root, catalogPath) {
  if (!isSafeRelativePath(catalogPath)) throw new Error("catalog path is unsafe");
  const rootRealPath = realpathSync(root);
  const absolutePath = resolve(rootRealPath, catalogPath);
  if (!absolutePath.startsWith(`${rootRealPath}/`) || !existsSync(absolutePath)) {
    throw new Error("catalog path does not exist inside the repository");
  }
  const catalogRealPath = realpathSync(absolutePath);
  if (!catalogRealPath.startsWith(`${rootRealPath}/`) || !lstatSync(catalogRealPath).isFile()) {
    throw new Error("catalog path resolves outside the repository or is not a file");
  }
  return catalogRealPath;
}

export function catalogDerivedFacts(catalog, document) {
  switch (catalog.kind) {
    case "legacy-branch-ledger":
      return {
        itemCount: document.branches?.length,
        classifiedItemCount: document.branches?.length,
        groupCount: document.assetFamilies?.length,
        uniqueContentCount: new Set(document.branches?.map((entry) => entry.tip)).size,
        dispositionCounts: countBy(document.branches ?? [], (entry) => entry.disposition),
      };
    case "worktree-dispositions":
      return {
        itemCount: document.entries?.length,
        classifiedItemCount: document.entries?.length,
        groupCount: Object.keys(countBy(document.entries ?? [], (entry) => entry.disposition)).length,
        uniqueContentCount: new Set(
          (document.entries ?? []).map((entry) => entry.sourceSha256).filter(Boolean),
        ).size,
        dispositionCounts: countBy(document.entries ?? [], (entry) => entry.disposition),
      };
    case "ext-capability-stocktake":
      return {
        itemCount: document.summary?.totalEntries,
        classifiedItemCount: document.summary?.totalEntries,
        groupCount: Object.keys(document.summary?.byKind ?? {}).length,
        uniqueContentCount: Object.values(document.summary?.uniqueBlobsByKind ?? {})
          .reduce((sum, count) => sum + count, 0),
        dispositionCounts: {},
      };
    case "six-ministry-inventory":
      return {
        itemCount: document.summary?.totalAssets,
        classifiedItemCount: document.summary?.totalAssets,
        groupCount: 2,
        uniqueContentCount: null,
        dispositionCounts: {
          EXCLUDED: document.summary?.excludedAssets,
          INCLUDED: document.summary?.includedAssets,
        },
      };
    case "six-ministry-family-matrix":
      return {
        itemCount: document.summary?.includedSourceAssets,
        classifiedItemCount: document.summary?.assignedSourceAssets,
        groupCount: document.summary?.familyCount,
        uniqueContentCount: document.summary?.uniqueSourceBlobs,
        dispositionCounts: document.summary?.byImplementationStatus ?? {},
      };
    case "capability-island-inventory":
      return {
        itemCount: document.islands?.length,
        classifiedItemCount: document.islands?.length,
        groupCount: document.islands?.length,
        uniqueContentCount: document.islands?.length,
        dispositionCounts: countBy(document.islands ?? [], (entry) => entry.verdict),
      };
    case "runtime-readiness":
      return {
        itemCount: document.summary?.families,
        classifiedItemCount: document.summary?.families,
        groupCount: 3,
        uniqueContentCount: document.summary?.families,
        dispositionCounts: {
          ACTIVE: document.summary?.activeFamilies,
          BUSINESS_SUCCESS_MEASURED: document.summary?.businessSuccessMeasuredFamilies,
          RETIRED: document.summary?.retiredFamilies,
        },
      };
    case "ref-snapshot":
      return {
        itemCount: document.refs?.length,
        classifiedItemCount: document.refs?.length,
        groupCount: Object.keys(document.summary?.byGrade ?? {}).length,
        uniqueContentCount: new Set(
          (document.refs ?? []).map((entry) => entry.tree).filter(Boolean),
        ).size,
        dispositionCounts: countBy(document.refs ?? [], (entry) => entry.grade),
      };
    case "worktree-snapshot":
      {
        const entries = (document.worktrees ?? []).flatMap((worktree) => worktree.entries ?? []);
      return {
        itemCount: entries.length,
        classifiedItemCount: 0,
        groupCount: document.worktrees?.length,
        uniqueContentCount: new Set(
          entries.map((entry) => entry.sha256).filter(Boolean),
        ).size,
        dispositionCounts: { BLOCKED_UNCOMMITTED: entries.length },
      };
      }
    case "semantic-ledger":
      return {
        itemCount: document.summary?.semanticItemCount,
        classifiedItemCount: document.summary?.confirmedSemanticItemCount,
        groupCount: Object.keys(document.summary?.byAssetClass ?? {}).length,
        uniqueContentCount: (document.summary?.refTreeGroupCount ?? 0) + new Set(
          (document.worktreeEntries ?? []).map((entry) => entry.sha256).filter(Boolean),
        ).size,
        dispositionCounts: document.summary?.byDisposition ?? {},
      };
    case "external-capability-sources":
      return {
        itemCount: document.summary?.declaredSourceCount,
        classifiedItemCount: document.summary?.declaredSourceCount,
        groupCount: document.summary?.capabilityCount,
        uniqueContentCount: new Set((document.sources ?? []).map((source) => {
          if (source.observationKind === "REPOSITORY_GIT_OBJECT" && source.tree) {
            return `git-object:${source.tree}:${source.selector ?? ""}`;
          }
          if (source.observationKind === "EXTERNAL_GIT_WORKTREE" && source.tree) {
            return `git-tree:${source.tree}`;
          }
          if (source.directoryContentSha256) return `directory:${source.directoryContentSha256}`;
          if (source.matchedRefsSha256) return `refs:${source.matchedRefsSha256}`;
          return null;
        }).filter(Boolean)).size,
        dispositionCounts: document.summary?.byState ?? {},
      };
    case "owner-review-proposal":
      return {
        itemCount: document.summary?.totalReviewUnitCount,
        classifiedItemCount: document.summary?.confirmedReviewUnitCount,
        groupCount: document.summary?.reviewBatchCount,
        uniqueContentCount: new Set(
          (document.reviewUnits ?? []).map((unit) => unit.reviewUnitId),
        ).size,
        dispositionCounts: document.summary?.byProposedDisposition ?? {},
      };
    default:
      return null;
  }
}

export function loadManifest(root = defaultRoot) {
  return parseJsonNoDuplicateKeys(readFileSync(resolve(root, MANIFEST_PATH), "utf8"));
}

export function validateManifest(manifest, root = defaultRoot) {
  const errors = [];
  if (!hasExactKeys(manifest, TOP_LEVEL_KEYS)) {
    return ["manifest has an invalid field set"];
  }
  if (manifest.schemaVersion !== "ext-full-value-convergence.v2") {
    errors.push("schemaVersion must be ext-full-value-convergence.v2");
  }
  if (!hasExactKeys(manifest.snapshot, SNAPSHOT_KEYS)) {
    errors.push("snapshot has an invalid field set");
  }
  if (!hasExactKeys(manifest.policy, POLICY_KEYS)) {
    errors.push("policy has an invalid field set");
  }
  if (!Array.isArray(manifest.sourceCatalogs)) {
    errors.push("sourceCatalogs must be an array");
  }
  if (!hasExactKeys(manifest.capabilityIndex, CAPABILITY_INDEX_KEYS)) {
    errors.push("capabilityIndex has an invalid field set");
  }
  if (!Array.isArray(manifest.proposedPackets)) {
    errors.push("proposedPackets must be an array");
  }
  if (errors.length > 0) return errors;

  if (!FULL_COMMIT.test(manifest.snapshot.targetHead ?? "")) {
    errors.push("snapshot.targetHead must be a lowercase 40-character commit");
  }
  if (!FULL_COMMIT.test(manifest.snapshot.targetTree ?? "")) {
    errors.push("snapshot.targetTree must be a lowercase 40-character tree");
  }
  if (manifest.snapshot.targetRef !== "origin/ext-dev") {
    errors.push("snapshot.targetRef must be origin/ext-dev");
  }
  if (typeof manifest.snapshot.capturedAt !== "string"
      || Number.isNaN(Date.parse(manifest.snapshot.capturedAt))) {
    errors.push("snapshot.capturedAt must be an ISO-compatible date-time");
  }
  if (manifest.snapshot.mode !== "READ_ONLY_FREEZE") {
    errors.push("snapshot.mode must be READ_ONLY_FREEZE");
  }
  if (manifest.snapshot.authorityDecision !== "STOP"
      || manifest.snapshot.authorityCanExecuteProductWork !== false) {
    errors.push("snapshot must preserve the observed product STOP decision");
  }
  if (manifest.policy.destructiveActionsAllowed !== false) {
    errors.push("policy.destructiveActionsAllowed must be false");
  }
  if (!jsonEquals(manifest.policy.allowedDispositions, ALLOWED_DISPOSITIONS)) {
    errors.push("policy.allowedDispositions must match the V2 disposition contract");
  }
  if (!Array.isArray(manifest.policy.deduplicationOrder)
      || manifest.policy.deduplicationOrder.length === 0) {
    errors.push("policy.deduplicationOrder must be non-empty");
  }
  if (!Array.isArray(manifest.policy.packetGateOrder)
      || manifest.policy.packetGateOrder.length === 0) {
    errors.push("policy.packetGateOrder must be non-empty");
  }

  const catalogIds = new Set();
  const catalogDocuments = new Map();
  for (const [index, catalog] of manifest.sourceCatalogs.entries()) {
    const label = `sourceCatalogs[${index}]`;
    if (!hasExactKeys(catalog, CATALOG_KEYS)) {
      errors.push(`${label} has an invalid field set`);
      continue;
    }
    if (!ID.test(catalog.id ?? "")) errors.push(`${label}.id is invalid`);
    if (catalogIds.has(catalog.id)) errors.push(`duplicate source catalog: ${catalog.id}`);
    catalogIds.add(catalog.id);
    if (!isSafeRelativePath(catalog.path)) errors.push(`${label}.path is unsafe`);
    if (!SHA256.test(catalog.sha256 ?? "")) errors.push(`${label}.sha256 is invalid`);
    if (!isNonNegativeInteger(catalog.itemCount)) errors.push(`${label}.itemCount is invalid`);
    if (!isNonNegativeInteger(catalog.classifiedItemCount)) {
      errors.push(`${label}.classifiedItemCount is invalid`);
    }
    if (!isNonNegativeInteger(catalog.groupCount)) {
      errors.push(`${label}.groupCount is invalid`);
    }
    if (!isNullableNonNegativeInteger(catalog.uniqueContentCount)) {
      errors.push(`${label}.uniqueContentCount is invalid`);
    }
    if (!isObject(catalog.dispositionCounts)
        || Object.values(catalog.dispositionCounts).some((value) => !isNonNegativeInteger(value))) {
      errors.push(`${label}.dispositionCounts is invalid`);
    }
    if (!ALLOWED_CATALOG_STATUSES.includes(catalog.status)) {
      errors.push(`${label}.status is invalid`);
    }
    if (!isSafeRelativePath(catalog.path)) continue;
    let catalogRealPath;
    try {
      catalogRealPath = resolveCatalogPath(root, catalog.path);
    } catch (error) {
      errors.push(`${label}.path is invalid: ${error.message}`);
      continue;
    }
    if (SHA256.test(catalog.sha256 ?? "")) {
      const actualSha = fileSha256(catalogRealPath);
      if (actualSha !== catalog.sha256) {
        errors.push(`${label}.sha256 drift: expected ${catalog.sha256}, got ${actualSha}`);
      }
    }
    let document;
    try {
      document = parseJsonNoDuplicateKeys(readFileSync(catalogRealPath, "utf8"));
    } catch (error) {
      errors.push(`${label}.path is not valid JSON: ${error.message}`);
      continue;
    }
    catalogDocuments.set(catalog.id, document);
    if (catalog.kind === "ref-snapshot") validateRefSnapshot(document, label, errors);
    if (catalog.kind === "worktree-snapshot") {
      validateWorktreeSnapshot(document, label, errors);
    }
    const derived = catalogDerivedFacts(catalog, document);
    if (derived === null) {
      errors.push(`${label}.kind is unsupported: ${catalog.kind}`);
      continue;
    }
    for (const key of [
      "itemCount",
      "classifiedItemCount",
      "groupCount",
      "uniqueContentCount",
      "dispositionCounts",
    ]) {
      if (!jsonEquals(catalog[key], derived[key])) {
        errors.push(`${label}.${key} does not match the frozen source catalog`);
      }
    }
  }

  for (const kind of REQUIRED_SINGLETON_CATALOG_KINDS) {
    const count = manifest.sourceCatalogs.filter((catalog) => catalog.kind === kind).length;
    if (count !== 1) {
      errors.push(`exactly one ${kind} catalog is required`);
    }
  }

  const refCatalog = manifest.sourceCatalogs.find(
    (catalog) => catalog.kind === "ref-snapshot",
  );
  const refDocument = refCatalog ? catalogDocuments.get(refCatalog.id) : null;
  const worktreeCatalog = manifest.sourceCatalogs.find(
    (catalog) => catalog.kind === "worktree-snapshot",
  );
  const worktreeDocument = worktreeCatalog
    ? catalogDocuments.get(worktreeCatalog.id)
    : null;
  if (!refDocument) {
    errors.push("one valid ref-snapshot catalog is required");
  } else if (refDocument.target?.ref !== manifest.snapshot.targetRef
      || refDocument.target?.head !== manifest.snapshot.targetHead
      || refDocument.target?.tree !== manifest.snapshot.targetTree) {
    errors.push("snapshot target must match the frozen ref-snapshot target");
  }
  const legacyCatalog = manifest.sourceCatalogs.find(
    (catalog) => catalog.kind === "legacy-branch-ledger",
  );
  const legacyDocument = legacyCatalog ? catalogDocuments.get(legacyCatalog.id) : null;
  if (refDocument && legacyDocument) {
    const localRefs = new Map(refDocument.refs.map((ref) => [ref.refname, ref]));
    for (const legacy of legacyDocument.branches ?? []) {
      const current = localRefs.get(`refs/heads/${legacy.branch}`);
      if (!current || current.legacy99NamedCoverage !== true
          || current.legacy99TipState
            !== (current.commitTip === legacy.tip ? "MATCH" : "DRIFTED")) {
        errors.push(`legacy-99 ref coverage drift for ${legacy.branch}`);
      }
    }
  }
  if (!worktreeDocument) errors.push("one valid worktree-snapshot catalog is required");
  if (refDocument && worktreeDocument) {
    validateWorktreeRefLinks(worktreeDocument, refDocument, errors);
  }

  if (!catalogIds.has(manifest.capabilityIndex.catalogId)) {
    errors.push("capabilityIndex.catalogId must reference a source catalog");
  }
  if (!isNonNegativeInteger(manifest.capabilityIndex.capabilityCount)
      || !isNonNegativeInteger(manifest.capabilityIndex.unresolvedRefTreeCount)
      || !isNonNegativeInteger(manifest.capabilityIndex.unresolvedWorktreeEntryCount)
      || !isNonNegativeInteger(manifest.capabilityIndex.unavailableWorktreeCount)
      || !isNonNegativeInteger(manifest.capabilityIndex.migrationAuthorizedCount)) {
    errors.push("capabilityIndex counts must be non-negative integers");
  }
  const capabilityCatalog = manifest.sourceCatalogs.find(
    (catalog) => catalog.id === manifest.capabilityIndex.catalogId,
  );
  const capabilityDocument = capabilityCatalog
    ? catalogDocuments.get(capabilityCatalog.id)
    : null;
  const externalSourceCatalogs = manifest.sourceCatalogs.filter(
    (catalog) => catalog.kind === "external-capability-sources",
  );
  const externalSourceCatalog = externalSourceCatalogs.length === 1
    ? externalSourceCatalogs[0]
    : null;
  const externalSourceDocument = externalSourceCatalog
    ? catalogDocuments.get(externalSourceCatalog.id)
    : null;
  if (externalSourceCatalogs.length !== 1 || !externalSourceDocument) {
    errors.push("exactly one valid external-capability-sources catalog is required");
  } else if (capabilityDocument && capabilityCatalog) {
    errors.push(...validateExternalSourceSnapshot(externalSourceDocument, {
      capabilityInventory: capabilityDocument,
      inventoryFileSha256: capabilityCatalog.sha256,
    }).map((error) => `external capability sources ${error}`));
  }
  const semanticCatalog = manifest.sourceCatalogs.find(
    (catalog) => catalog.kind === "semantic-ledger",
  );
  const semanticDocument = semanticCatalog ? catalogDocuments.get(semanticCatalog.id) : null;
  if (semanticDocument) {
    const semanticInputs = {
      refSnapshot: refDocument,
      worktreeSnapshot: worktreeDocument,
      legacyLedger: legacyDocument,
      capabilityInventory: capabilityDocument,
    };
    if (Object.values(semanticInputs).some((document) => !document)) {
      errors.push("semantic ledger requires all frozen source inputs");
    } else {
      errors.push(...validateSemanticLedger(semanticDocument, semanticInputs).map(
        (error) => `semantic ledger ${error}`,
      ));
    }
  } else {
    errors.push("one valid semantic-ledger catalog is required");
  }
  const ownerReviewCatalogs = manifest.sourceCatalogs.filter(
    (catalog) => catalog.kind === "owner-review-proposal",
  );
  const ownerReviewDocument = ownerReviewCatalogs.length === 1
    ? catalogDocuments.get(ownerReviewCatalogs[0].id)
    : null;
  if (ownerReviewCatalogs.length !== 1 || !ownerReviewDocument) {
    errors.push("one valid owner-review-proposal catalog is required");
  } else if (semanticDocument && capabilityDocument && externalSourceDocument) {
    errors.push(...validateOwnerReviewProposal(ownerReviewDocument, {
      semanticLedger: semanticDocument,
      convergenceManifest: manifest,
      capabilityInventory: capabilityDocument,
      externalSourceSnapshot: externalSourceDocument,
    }).map((error) => `owner review proposal ${error}`));
  }
  if (capabilityCatalog
      && manifest.capabilityIndex.capabilityCount !== capabilityCatalog.itemCount) {
    errors.push("capabilityIndex.capabilityCount must match its catalog itemCount");
  }
  if (!['COMPLETE', 'REVIEW_REQUIRED'].includes(manifest.capabilityIndex.semanticCoverageStatus)) {
    errors.push("capabilityIndex.semanticCoverageStatus is invalid");
  }
  if (refDocument
      && manifest.capabilityIndex.unresolvedRefTreeCount
        !== refDocument.summary?.reviewRequiredUniqueTrees) {
    errors.push("capabilityIndex.unresolvedRefTreeCount must match the ref snapshot");
  }
  if (worktreeDocument
      && manifest.capabilityIndex.unresolvedWorktreeEntryCount
        !== worktreeDocument.summary?.statusEntryCount) {
    errors.push("capabilityIndex.unresolvedWorktreeEntryCount must match the worktree snapshot");
  }
  if (worktreeDocument
      && manifest.capabilityIndex.unavailableWorktreeCount
        !== worktreeDocument.summary?.unavailableWorktrees) {
    errors.push("capabilityIndex.unavailableWorktreeCount must match the worktree snapshot");
  }
  const hasUnresolvedSources = manifest.capabilityIndex.unresolvedRefTreeCount > 0
    || manifest.capabilityIndex.unresolvedWorktreeEntryCount > 0
    || manifest.capabilityIndex.unavailableWorktreeCount > 0;
  if (manifest.capabilityIndex.semanticCoverageStatus
      !== (hasUnresolvedSources ? "REVIEW_REQUIRED" : "COMPLETE")) {
    errors.push("capabilityIndex.semanticCoverageStatus does not match unresolved sources");
  }
  if (manifest.capabilityIndex.migrationAuthorizedCount !== 0) {
    errors.push("capabilityIndex.migrationAuthorizedCount must remain zero in Wave 0");
  }

  const packetIds = new Set();
  const capabilityIds = new Set();
  if (capabilityDocument) {
    for (const capability of capabilityDocument.islands ?? []) capabilityIds.add(capability.id);
  }
  for (const candidate of semanticDocument?.newCapabilityCandidates ?? []) {
    capabilityIds.add(candidate.id);
  }
  for (const [index, packet] of manifest.proposedPackets.entries()) {
    const label = `proposedPackets[${index}]`;
    if (!hasExactKeys(packet, PACKET_KEYS)) {
      errors.push(`${label} has an invalid field set`);
      continue;
    }
    if (!ID.test(packet.id ?? "")) errors.push(`${label}.id is invalid`);
    if (packetIds.has(packet.id)) errors.push(`duplicate proposed packet: ${packet.id}`);
    packetIds.add(packet.id);
    if (!capabilityIds.has(packet.capabilityId)) {
      errors.push(`${label}.capabilityId is not in the canonical or review candidate index`);
    }
    if (!isNonNegativeInteger(packet.priority) || packet.priority < 1) {
      errors.push(`${label}.priority must be a positive integer`);
    }
    if (!ALLOWED_DISPOSITIONS.includes(packet.disposition)) {
      errors.push(`${label}.disposition is invalid`);
    }
    if (!ALLOWED_PACKET_STATUSES.includes(packet.status)) {
      errors.push(`${label}.status is invalid`);
    }
    if (!Array.isArray(packet.targetOwners)
        || packet.targetOwners.length === 0
        || packet.targetOwners.some((owner) => !["root", "frontend", "backend"].includes(owner))) {
      errors.push(`${label}.targetOwners is invalid`);
    }
    if (packet.authorityTask !== null) {
      errors.push(`${label}.authorityTask must remain null in Wave 0`);
    }
    if (typeof packet.blockedReason !== "string" || packet.blockedReason.trim() === "") {
      errors.push(`${label}.blockedReason must explain why migration has not started`);
    }
  }
  const priorities = manifest.proposedPackets.map((packet) => packet.priority);
  if (new Set(priorities).size !== priorities.length) {
    errors.push("proposedPackets priorities must be unique");
  }

  return errors;
}

export function summarize(manifest) {
  return {
    targetRef: manifest.snapshot.targetRef,
    targetHead: manifest.snapshot.targetHead,
    targetTree: manifest.snapshot.targetTree,
    mode: manifest.snapshot.mode,
    authorityDecision: manifest.snapshot.authorityDecision,
    catalogCount: manifest.sourceCatalogs.length,
    frozenCatalogCount: manifest.sourceCatalogs.filter(
      (catalog) => catalog.status === "FROZEN",
    ).length,
    reviewRequiredCatalogCount: manifest.sourceCatalogs.filter(
      (catalog) => catalog.status === "FROZEN_REVIEW_REQUIRED",
    ).length,
    blockedCatalogCount: manifest.sourceCatalogs.filter(
      (catalog) => catalog.status === "BLOCKED_UNCOMMITTED",
    ).length,
    observedItems: manifest.sourceCatalogs.reduce(
      (sum, catalog) => sum + catalog.itemCount,
      0,
    ),
    canonicalCapabilityCount: manifest.capabilityIndex.capabilityCount,
    semanticCoverageStatus: manifest.capabilityIndex.semanticCoverageStatus,
    unresolvedRefTreeCount: manifest.capabilityIndex.unresolvedRefTreeCount,
    unresolvedWorktreeEntryCount: manifest.capabilityIndex.unresolvedWorktreeEntryCount,
    unavailableWorktreeCount: manifest.capabilityIndex.unavailableWorktreeCount,
    migrationAuthorizedCount: manifest.capabilityIndex.migrationAuthorizedCount,
    proposedPacketCount: manifest.proposedPackets.length,
  };
}

export function selectCatalog(manifest, id) {
  return manifest.sourceCatalogs.find((catalog) => catalog.id === id) ?? null;
}

export function loadCapabilities(manifest, root = defaultRoot) {
  const catalog = selectCatalog(manifest, manifest.capabilityIndex.catalogId);
  if (!catalog) return [];
  const catalogRealPath = resolveCatalogPath(root, catalog.path);
  const document = parseJsonNoDuplicateKeys(readFileSync(catalogRealPath, "utf8"));
  return [...(document.islands ?? [])].sort((a, b) => a.id.localeCompare(b.id));
}

function loadCatalogDocument(manifest, catalogId, root) {
  const catalog = selectCatalog(manifest, catalogId);
  if (!catalog) throw new Error(`source catalog not found: ${catalogId}`);
  return parseJsonNoDuplicateKeys(readFileSync(resolveCatalogPath(root, catalog.path), "utf8"));
}

export function listUnresolvedSources(manifest, root = defaultRoot) {
  const refCatalog = manifest.sourceCatalogs.find((catalog) => catalog.kind === "ref-snapshot");
  const worktreeCatalog = manifest.sourceCatalogs.find(
    (catalog) => catalog.kind === "worktree-snapshot",
  );
  if (!refCatalog || !worktreeCatalog) throw new Error("unresolved source catalogs are missing");
  const refDocument = loadCatalogDocument(manifest, refCatalog.id, root);
  const worktreeDocument = loadCatalogDocument(manifest, worktreeCatalog.id, root);
  const reviewRefs = refDocument.refs.filter((ref) => ref.grade.endsWith("_REVIEW_REQUIRED"));
  const refsByTree = new Map();
  for (const ref of reviewRefs) {
    if (!refsByTree.has(ref.tree)) refsByTree.set(ref.tree, []);
    refsByTree.get(ref.tree).push(ref);
  }
  const refTrees = [...refsByTree.entries()].map(([tree, refs]) => ({
    tree,
    canonicalRef: [...refs.map((ref) => ref.canonicalTreeRef)].sort()[0],
    refCount: refs.length,
    refs: refs.map((ref) => ref.refname).sort(),
    relations: [...new Set(refs.map((ref) => ref.relationToTarget))].sort(),
    grades: [...new Set(refs.map((ref) => ref.grade))].sort(),
    legacy99Covered: refs.some((ref) => ref.legacy99NamedCoverage),
  })).sort((a, b) => a.canonicalRef.localeCompare(b.canonicalRef));
  const worktreeEntries = worktreeDocument.worktrees.flatMap((worktree) =>
    worktree.entries.map((entry) => ({
      worktreeId: worktree.id,
      branchRef: worktree.branchRef,
      head: worktree.head,
      path: entry.path,
      originalPath: entry.originalPath,
      status: entry.status,
      sha256: entry.sha256,
    }))).sort((a, b) => `${a.worktreeId}\0${a.path}`.localeCompare(`${b.worktreeId}\0${b.path}`));
  const unavailableWorktrees = worktreeDocument.worktrees.filter(
    (worktree) => worktree.state === "UNAVAILABLE",
  ).map((worktree) => ({
    worktreeId: worktree.id,
    branchRef: worktree.branchRef,
    registeredHead: worktree.registeredHead,
  })).sort((a, b) => a.worktreeId.localeCompare(b.worktreeId));
  return {
    summary: {
      refTreeCount: refTrees.length,
      worktreeEntryCount: worktreeEntries.length,
      unavailableWorktreeCount: unavailableWorktrees.length,
    },
    refTrees,
    worktreeEntries,
    unavailableWorktrees,
  };
}

function git(root, args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function gitPredicate(root, args) {
  try {
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch (error) {
    if (error.status === 1) return false;
    throw new Error(`cannot evaluate git predicate ${args.join(" ")}: ${error.message}`);
  }
}

function gitMaybe(root, args) {
  try {
    return git(root, args);
  } catch (error) {
    const stderr = String(error.stderr ?? "");
    if (error.status === 128
        && /expected commit type|Needed a single revision|unknown revision/u.test(stderr)) {
      return null;
    }
    throw new Error(`cannot inspect Git object ${args.join(" ")}: ${error.message}`);
  }
}

function refRelation(root, tip, targetHead) {
  if (tip === targetHead) return "TARGET";
  if (gitPredicate(root, ["merge-base", "--is-ancestor", tip, targetHead])) {
    return "TARGET_CONTAINS";
  }
  if (gitPredicate(root, ["merge-base", "--is-ancestor", targetHead, tip])) {
    return "TARGET_IS_ANCESTOR";
  }
  return "DIVERGED";
}

export function observeRefs(root = defaultRoot, targetRef = "origin/ext-dev") {
  if (typeof targetRef !== "string" || targetRef.startsWith("-")) {
    throw new Error("target ref must be a non-option Git branch name");
  }
  const normalizedTargetRef = git(root, ["check-ref-format", "--branch", targetRef]);
  if (normalizedTargetRef !== targetRef) throw new Error("target ref did not normalize exactly");
  const targetHead = git(root, ["rev-parse", "--verify", `${targetRef}^{commit}`]);
  const targetTree = git(root, ["rev-parse", "--verify", `${targetRef}^{tree}`]);
  const raw = git(root, [
    "for-each-ref",
    "--format=%(refname)%00%(refname:short)%00%(objectname)%00%(objecttype)",
  ]);
  const rows = raw === "" ? [] : raw.split("\n").map((line) => {
    const [refname, name, refObject, objectType] = line.split("\0");
    const commitTip = gitMaybe(root, ["rev-parse", "--verify", `${refname}^{commit}`]);
    return { refname, name, refObject, objectType, commitTip };
  });
  const commitTips = [...new Set(rows.map((row) => row.commitTip).filter(Boolean))];
  const factsByTip = new Map(commitTips.map((commitTip) => [commitTip, {
    tree: git(root, ["rev-parse", "--verify", `${commitTip}^{tree}`]),
    relationToTarget: refRelation(root, commitTip, targetHead),
  }]));
  const commitRows = rows.filter((row) => row.commitTip !== null).map((row) => ({
    ...row,
    tree: factsByTip.get(row.commitTip).tree,
  }));
  const tipCounts = countBy(commitRows, (row) => row.commitTip);
  const treeCounts = countBy(commitRows, (row) => row.tree);
  const canonicalTipRefs = new Map();
  const canonicalTreeRefs = new Map();
  for (const row of commitRows) {
    if (!canonicalTipRefs.has(row.commitTip)) canonicalTipRefs.set(row.commitTip, []);
    canonicalTipRefs.get(row.commitTip).push(row.refname);
    if (!canonicalTreeRefs.has(row.tree)) canonicalTreeRefs.set(row.tree, []);
    canonicalTreeRefs.get(row.tree).push(row.refname);
  }
  for (const refs of canonicalTipRefs.values()) refs.sort();
  for (const refs of canonicalTreeRefs.values()) refs.sort();
  const legacyPath = resolve(
    root,
    "docs/migrations/2026-08-03-ext-legacy-99-ref-ledger.v1.json",
  );
  const legacyTips = existsSync(legacyPath)
    ? new Map(parseJsonNoDuplicateKeys(readFileSync(legacyPath, "utf8")).branches.map(
      (entry) => [entry.branch, entry.tip],
    ))
    : new Map();
  const refs = rows.map((row) => {
    const facts = row.commitTip === null ? null : factsByTip.get(row.commitTip);
    let grade;
    if (facts === null) grade = "NON_COMMIT_REF_ARCHIVE";
    else if (facts.relationToTarget === "TARGET") grade = "TARGET";
    else if (facts.relationToTarget === "TARGET_CONTAINS") grade = "TARGET_CONTAINED";
    else if (tipCounts[row.commitTip] > 1) grade = "DUPLICATE_TIP_REVIEW_REQUIRED";
    else if (treeCounts[facts.tree] > 1) grade = "DUPLICATE_TREE_REVIEW_REQUIRED";
    else grade = "UNIQUE_TREE_REVIEW_REQUIRED";
    const legacyName = row.refname.startsWith("refs/remotes/origin/")
      ? row.refname.slice("refs/remotes/origin/".length)
      : row.name;
    return {
      name: row.name,
      refname: row.refname,
      refObject: row.refObject,
      objectType: row.objectType,
      commitTip: row.commitTip,
      tree: facts?.tree ?? null,
      relationToTarget: facts?.relationToTarget ?? "NON_COMMIT",
      exactTipRefCount: row.commitTip === null ? 0 : tipCounts[row.commitTip],
      exactTreeRefCount: facts === null ? 0 : treeCounts[facts.tree],
      canonicalTipRef: row.commitTip === null ? null : canonicalTipRefs.get(row.commitTip)[0],
      canonicalTreeRef: facts === null ? null : canonicalTreeRefs.get(facts.tree)[0],
      legacy99NamedCoverage: legacyTips.has(legacyName),
      legacy99TipState: legacyTips.has(legacyName)
        ? (row.commitTip === legacyTips.get(legacyName) ? "MATCH" : "DRIFTED")
        : "NOT_LISTED",
      grade,
    };
  }).sort((a, b) => a.refname.localeCompare(b.refname));
  return {
    schemaVersion: "ext-full-value-ref-snapshot.v2",
    capturedAt: new Date().toISOString(),
    target: { ref: targetRef, head: targetHead, tree: targetTree },
    summary: deriveRefSummary(refs),
    refs,
  };
}

export function parsePorcelainV1Z(raw) {
  const fields = raw.split("\0");
  const entries = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (!field) continue;
    const status = field.slice(0, 2);
    const path = field.slice(3);
    const entry = { status, path, originalPath: null };
    if (/[RC]/u.test(status)) {
      index += 1;
      entry.originalPath = fields[index] || null;
    }
    entries.push(entry);
  }
  return entries;
}

function worktreeEntryHash(root, path) {
  const absolutePath = resolve(root, path);
  if (!absolutePath.startsWith(`${resolve(root)}/`) || !existsSync(absolutePath)) return null;
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) return sha256(Buffer.from(readlinkSync(absolutePath)));
  if (!stat.isFile()) return null;
  return fileSha256(absolutePath);
}

export function observeWorktree(sourceRoot, { expectedWslDistro = null } = {}) {
  if (!isAbsolute(sourceRoot)) throw new Error("source worktree must be an absolute path");
  const root = realpathSync(sourceRoot);
  const gitOptions = { expectedWslDistro };
  const head = worktreeGit(root, ["rev-parse", "HEAD"], gitOptions);
  const tree = worktreeGit(root, ["rev-parse", "HEAD^{tree}"], gitOptions);
  const branch = worktreeGit(root, ["branch", "--show-current"], gitOptions);
  const commonDirOutput = worktreeGit(
    root,
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    gitOptions,
  );
  const commonDir = realpathSync(
    isAbsolute(commonDirOutput) ? commonDirOutput : resolve(root, commonDirOutput),
  );
  const raw = worktreeGit(
    root,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { trim: false, expectedWslDistro },
  );
  const entries = parsePorcelainV1Z(raw).map((entry) => ({
    ...entry,
    sha256: worktreeEntryHash(root, entry.path),
    grade: "BLOCKED_UNCOMMITTED",
  })).sort((a, b) => a.path.localeCompare(b.path));
  return {
    schemaVersion: "ext-full-value-uncommitted-snapshot.v1",
    capturedAt: new Date().toISOString(),
    source: {
      label: "primary-shared-worktree",
      branch,
      head,
      tree,
      gitCommonDirSha256: sha256(Buffer.from(commonDir)),
      rootName: relative(dirname(root), root) || "repository",
    },
    summary: {
      entryCount: entries.length,
      uniqueContentHashes: new Set(entries.map((entry) => entry.sha256).filter(Boolean)).size,
      byStatus: countBy(entries, (entry) => entry.status),
      grade: "BLOCKED_UNCOMMITTED",
    },
    entries,
  };
}

export function parseWorktreeListPorcelainZ(raw) {
  const records = [];
  let current = null;
  for (const field of raw.split("\0")) {
    if (field === "") {
      if (current) records.push(current);
      current = null;
      continue;
    }
    const space = field.indexOf(" ");
    const key = space === -1 ? field : field.slice(0, space);
    const value = space === -1 ? true : field.slice(space + 1);
    if (key === "worktree") {
      if (current) records.push(current);
      current = { path: value };
      continue;
    }
    if (!current) throw new Error(`worktree porcelain field before worktree: ${key}`);
    current[key] = value;
  }
  if (current) records.push(current);
  return records;
}

function parseWslUncPath(path) {
  if (typeof path !== "string") return null;
  const normalized = path.replaceAll("\\", "/");
  const match = normalized.match(/^\/\/wsl(?:\.localhost)?\/([^/]+)(\/.*)$/iu);
  return match ? { distro: match[1], nativePath: match[2] } : null;
}

export function resolveWorktreeObservationPath(registeredPath, fs = {}) {
  const exists = fs.exists ?? existsSync;
  const realpath = fs.realpath ?? realpathSync;
  const candidates = [{ path: registeredPath, pathResolution: "REGISTERED_PATH" }];
  const wslAlias = parseWslUncPath(registeredPath);
  if (wslAlias && wslAlias.nativePath !== registeredPath) {
    candidates.push({ path: wslAlias.nativePath, pathResolution: "WSL_UNC_ALIAS" });
  }
  for (const candidate of candidates) {
    if (!exists(candidate.path)) continue;
    try {
      return { path: realpath(candidate.path), pathResolution: candidate.pathResolution };
    } catch {
      // Continue to a native alias candidate when the registered alias cannot resolve.
    }
  }
  return null;
}

export function resolveWorktreeGitDir(worktreeRoot, { expectedWslDistro = null } = {}) {
  const dotGit = resolve(worktreeRoot, ".git");
  if (!existsSync(dotGit) || !lstatSync(dotGit).isFile()) return null;
  const content = readFileSync(dotGit, "utf8").trim();
  const match = content.match(/^gitdir:\s*(.+)$/iu);
  if (!match) return null;
  const rawPointer = match[1];
  const wslPointer = parseWslUncPath(rawPointer);
  if (expectedWslDistro !== null
      && (!wslPointer || wslPointer.distro !== expectedWslDistro)) return null;
  const pointer = isAbsolute(rawPointer) ? rawPointer : resolve(worktreeRoot, rawPointer);
  return resolveWorktreeObservationPath(pointer)?.path ?? null;
}

function worktreeGit(root, args, { trim = true, expectedWslDistro = null } = {}) {
  const run = (gitArgs) => execFileSync(
    "git",
    gitArgs,
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  let output;
  try {
    output = run(args);
  } catch (registeredPathError) {
    const gitDir = resolveWorktreeGitDir(root, { expectedWslDistro });
    if (!gitDir) throw registeredPathError;
    output = run(["--git-dir", gitDir, "--work-tree", root, ...args]);
  }
  return trim ? output.trim() : output;
}

export function worktreeIdentityMatches(registered, observed) {
  const observedBranchRef = observed.source.branch
    ? `refs/heads/${observed.source.branch}`
    : null;
  return observed.source.head === registered.registeredHead
    && observed.source.tree === registered.registeredTree
    && observedBranchRef === registered.branchRef
    && observed.source.gitCommonDirSha256 === registered.registeredCommonDirSha256;
}

export function observeWorktrees(
  repositoryRoot = defaultRoot,
  excludedCandidateRoot = defaultRoot,
) {
  if (!isAbsolute(repositoryRoot) || !isAbsolute(excludedCandidateRoot)) {
    throw new Error("repository and excluded worktree roots must be absolute paths");
  }
  const repository = realpathSync(repositoryRoot);
  const excludedRoot = realpathSync(excludedCandidateRoot);
  const repositoryCommonDirOutput = git(
    repository,
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  );
  const repositoryCommonDir = realpathSync(
    isAbsolute(repositoryCommonDirOutput)
      ? repositoryCommonDirOutput
      : resolve(repository, repositoryCommonDirOutput),
  );
  const registeredCommonDirSha256 = sha256(Buffer.from(repositoryCommonDir));
  const raw = execFileSync(
    "git",
    ["worktree", "list", "--porcelain", "-z"],
    { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const registered = parseWorktreeListPorcelainZ(raw);
  const worktrees = registered.map((record) => {
    const pathSha256 = sha256(Buffer.from(record.path));
    const id = `${basename(record.path).replace(/[^a-zA-Z0-9._-]+/gu, "-")}-${pathSha256.slice(0, 8)}`;
    const registeredHead = record.HEAD;
    const branchRef = typeof record.branch === "string" ? record.branch : null;
    const registeredTree = FULL_COMMIT.test(registeredHead ?? "")
      ? gitMaybe(repository, ["rev-parse", "--verify", `${registeredHead}^{tree}`])
      : null;
    const registeredWsl = parseWslUncPath(record.path);
    const observationPath = resolveWorktreeObservationPath(record.path);
    if (!observationPath) {
      return {
        id,
        pathSha256,
        registeredHead,
        registeredTree,
        registeredCommonDirSha256,
        branchRef,
        state: "UNAVAILABLE",
        head: registeredHead,
        tree: registeredTree,
        observedBranchRef: null,
        observedCommonDirSha256: null,
        identityVerified: false,
        entryCount: 0,
        entries: [],
        pathResolution: "UNRESOLVED",
        observationNote: "MISSING_WORKTREE_PATH",
      };
    }
    const resolvedPath = observationPath.path;
    if (resolvedPath === excludedRoot) {
      return {
        id,
        pathSha256,
        registeredHead,
        registeredTree,
        registeredCommonDirSha256,
        branchRef,
        state: "EXCLUDED_CURRENT_CANDIDATE",
        head: registeredHead,
        tree: registeredTree,
        observedBranchRef: null,
        observedCommonDirSha256: null,
        identityVerified: false,
        entryCount: 0,
        entries: [],
        pathResolution: observationPath.pathResolution,
        observationNote: observationPath.pathResolution === "WSL_UNC_ALIAS"
          ? "PATH_ALIAS_BROKEN_BUT_OBSERVABLE"
          : null,
      };
    }
    try {
      const expectedWslDistro = observationPath.pathResolution === "WSL_UNC_ALIAS"
        ? registeredWsl?.distro ?? null
        : null;
      const observed = observeWorktree(resolvedPath, { expectedWslDistro });
      const observedBranchRef = observed.source.branch
        ? `refs/heads/${observed.source.branch}`
        : null;
      const registeredIdentity = {
        registeredHead,
        registeredTree,
        registeredCommonDirSha256,
        branchRef,
      };
      const identityVerified = worktreeIdentityMatches(registeredIdentity, observed);
      if (!identityVerified) {
        return {
          id,
          pathSha256,
          registeredHead,
          registeredTree,
          registeredCommonDirSha256,
          branchRef,
          state: "UNAVAILABLE",
          head: registeredHead,
          tree: registeredTree,
          observedBranchRef: null,
          observedCommonDirSha256: null,
          identityVerified: false,
          entryCount: 0,
          entries: [],
          pathResolution: observationPath.pathResolution,
          observationNote: "IDENTITY_MISMATCH",
        };
      }
      return {
        id,
        pathSha256,
        registeredHead,
        registeredTree,
        registeredCommonDirSha256,
        branchRef,
        state: observed.entries.length > 0 ? "DIRTY" : "CLEAN",
        head: observed.source.head,
        tree: observed.source.tree,
        observedBranchRef,
        observedCommonDirSha256: observed.source.gitCommonDirSha256,
        identityVerified,
        entryCount: observed.entries.length,
        entries: observed.entries,
        pathResolution: observationPath.pathResolution,
        observationNote: observationPath.pathResolution === "WSL_UNC_ALIAS"
          ? "PATH_ALIAS_BROKEN_BUT_OBSERVABLE"
          : null,
      };
    } catch {
      return {
        id,
        pathSha256,
        registeredHead,
        registeredTree,
        registeredCommonDirSha256,
        branchRef,
        state: "UNAVAILABLE",
        head: registeredHead,
        tree: registeredTree,
        observedBranchRef: null,
        observedCommonDirSha256: null,
        identityVerified: false,
        entryCount: 0,
        entries: [],
        pathResolution: observationPath.pathResolution,
        observationNote: "OBSERVATION_FAILED",
      };
    }
  }).sort((a, b) => a.id.localeCompare(b.id));
  return {
    schemaVersion: "ext-full-value-worktree-snapshot.v5",
    capturedAt: new Date().toISOString(),
    repository: {
      head: git(repository, ["rev-parse", "HEAD"]),
      tree: git(repository, ["rev-parse", "HEAD^{tree}"]),
      commonDirSha256: registeredCommonDirSha256,
    },
    summary: deriveWorktreeSummary(worktrees),
    worktrees,
  };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/ext-full-value-convergence.mjs --check",
    "  node scripts/ext-full-value-convergence.mjs --status",
    "  node scripts/ext-full-value-convergence.mjs --catalog <catalog-id>",
    "  node scripts/ext-full-value-convergence.mjs --capabilities",
    "  node scripts/ext-full-value-convergence.mjs --packet <packet-id>",
    "  node scripts/ext-full-value-convergence.mjs --unresolved",
    "  node scripts/ext-full-value-convergence.mjs --observe-refs [target-ref]",
    "  node scripts/ext-full-value-convergence.mjs --observe-worktree <absolute-path>",
    "  node scripts/ext-full-value-convergence.mjs --observe-worktrees <repository-root>",
  ].join("\n");
}

function print(value, stream = process.stdout) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function runCli(
  argv,
  root = defaultRoot,
  io = { stdout: process.stdout, stderr: process.stderr },
) {
  if (argv.length === 1 && argv[0] === "--help") {
    io.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (argv[0] === "--observe-refs" && argv.length <= 2) {
    print(observeRefs(root, argv[1] ?? "origin/ext-dev"), io.stdout);
    return 0;
  }
  if (argv[0] === "--observe-worktree" && argv.length === 2) {
    print(observeWorktree(argv[1]), io.stdout);
    return 0;
  }
  if (argv[0] === "--observe-worktrees" && argv.length === 2) {
    print(observeWorktrees(argv[1], root), io.stdout);
    return 0;
  }
  const manifest = loadManifest(root);
  const errors = validateManifest(manifest, root);
  if (argv.length === 1 && argv[0] === "--check") {
    print({
      schemaVersion: "ext-full-value-convergence.result.v2",
      command: "check",
      decision: errors.length === 0 ? "PASS" : "STOP",
      nonAuthorizing: true,
      errors,
      summary: summarize(manifest),
    }, io.stdout);
    return errors.length === 0 ? 0 : 2;
  }
  if (errors.length > 0) {
    print({
      schemaVersion: "ext-full-value-convergence.result.v2",
      decision: "STOP",
      nonAuthorizing: true,
      errors,
    }, io.stdout);
    return 2;
  }
  if (argv.length === 1 && argv[0] === "--status") {
    print({
      schemaVersion: "ext-full-value-convergence.result.v2",
      command: "status",
      decision: "OBSERVE",
      nonAuthorizing: true,
      summary: summarize(manifest),
    }, io.stdout);
    return 0;
  }
  if (argv.length === 2 && argv[0] === "--catalog") {
    const catalog = selectCatalog(manifest, argv[1]);
    print({
      schemaVersion: "ext-full-value-convergence.result.v2",
      command: "catalog",
      decision: catalog ? "OBSERVE" : "NOT_FOUND",
      nonAuthorizing: true,
      catalog,
    }, io.stdout);
    return catalog ? 0 : 2;
  }
  if (argv.length === 1 && argv[0] === "--capabilities") {
    print({
      schemaVersion: "ext-full-value-convergence.result.v2",
      command: "capabilities",
      decision: "OBSERVE",
      nonAuthorizing: true,
      capabilities: loadCapabilities(manifest, root),
    }, io.stdout);
    return 0;
  }
  if (argv.length === 1 && argv[0] === "--unresolved") {
    print({
      schemaVersion: "ext-full-value-convergence.result.v2",
      command: "unresolved",
      decision: "REVIEW_REQUIRED",
      nonAuthorizing: true,
      unresolved: listUnresolvedSources(manifest, root),
    }, io.stdout);
    return 0;
  }
  if (argv.length === 2 && argv[0] === "--packet") {
    const packet = manifest.proposedPackets.find((entry) => entry.id === argv[1]) ?? null;
    print({
      schemaVersion: "ext-full-value-convergence.result.v2",
      command: "packet",
      decision: packet ? "OBSERVE" : "NOT_FOUND",
      nonAuthorizing: true,
      packet,
    }, io.stdout);
    return packet ? 0 : 2;
  }
  io.stderr.write(`${usage()}\n`);
  return 64;
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (error) {
    print({
      schemaVersion: "ext-full-value-convergence.result.v2",
      decision: "STOP",
      nonAuthorizing: true,
      errors: [error.message],
    });
    process.exitCode = 2;
  }
}

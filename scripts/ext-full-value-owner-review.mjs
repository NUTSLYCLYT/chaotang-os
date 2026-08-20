#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  digestCanonical,
  parseJsonNoDuplicateKeys,
} from "./execution_authority_ext.mjs";
import { validateManifest } from "./ext-full-value-convergence.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = dirname(dirname(scriptPath));

export const OWNER_REVIEW_PATH =
  "docs/migrations/2026-08-20-ext-full-value-owner-review.v1.json";
export const OWNER_RECEIPT_PATH =
  "docs/migrations/2026-08-20-ext-full-value-owner-receipt.v2.json";

const INPUT_PATHS = Object.freeze({
  semanticLedger: "docs/migrations/2026-08-20-ext-full-value-semantic-ledger.v2.json",
  convergenceManifest: "docs/migrations/2026-08-20-ext-full-value-convergence.v2.json",
  capabilityInventory: "docs/migrations/2026-08-14-capability-island-inventory.json",
  externalSourceSnapshot:
    "docs/migrations/2026-08-20-ext-external-capability-source-snapshot.v1.json",
});

const VERDICT_DISPOSITION = Object.freeze({
  "direct-adapt": "ABSORB_ADAPT",
  "independent-integration": "ABSORB_ADAPT",
  "rewrite-distill": "REBUILD",
  "contract-eval-only": "SUPERSEDED_VERIFY",
  "reference-only": "SUPERSEDED_VERIFY",
  quarantine: "BLOCKED_WIP",
  retire: "REJECT",
});
const RECEIPT_KEYS = Object.freeze([
  "schemaVersion",
  "receiptId",
  "proposalDigest",
  "proposalArtifact",
  "confirmingAuthority",
  "decision",
  "confirmationScope",
  "unavailableSourceDecisions",
  "overrides",
  "confirmedReviewUnitCount",
  "ownerStatement",
  "issuedAt",
  "nonAuthorizing",
  "productAuthorityGranted",
  "packetMigrationAuthorized",
  "state",
]);
const RECEIPT_DECISIONS = Object.freeze([
  "CONFIRM_SEMANTIC_LIST_AS_PROPOSED",
  "CONFIRM_SEMANTIC_LIST_WITH_EXPLICIT_OVERRIDES",
  "REJECT_SEMANTIC_LIST_PROPOSAL",
]);
const UNAVAILABLE_DECISIONS = Object.freeze(["KEEP_BLOCKED", "EXCLUDE_WITH_EVIDENCE"]);
const OVERRIDE_DISPOSITIONS = Object.freeze([
  "ABSORB_ADAPT",
  "REBUILD",
  "SUPERSEDED_VERIFY",
  "ARCHIVE",
  "REJECT",
  "DUPLICATE",
  "BLOCKED_WIP",
  "SPLIT_REQUIRED",
]);

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

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Canonical(value) {
  return digestCanonical(value);
}

function fileSha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function parseOwnerJsonStrict(bytes) {
  return parseJsonNoDuplicateKeys(Buffer.isBuffer(bytes) ? bytes.toString("utf8") : bytes);
}

function isSafeRepositoryPath(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 512
      || value.startsWith("/") || value.includes("\\") || value.includes("//")
      || /[\u0000-\u001f\u007f*?]/u.test(value)) return false;
  const segments = value.split("/");
  return !segments.some((segment) => segment === "" || segment === "." || segment === "..")
    && segments.join("/") === value;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function countBy(values, selector) {
  const counts = {};
  for (const value of values) {
    const keys = selector(value);
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (key === null || key === undefined || key === "") continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function slug(value) {
  return value.toLowerCase().replaceAll("_", "-").replace(/[^a-z0-9-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function ownerScopesForPath(path) {
  if (path.startsWith("frontend/")) return ["frontend"];
  if (path.startsWith("backend/")) return ["backend"];
  if (/^(?:deploy\/|Dockerfile$|docker-compose|Caddyfile)/iu.test(path)) {
    return ["backend", "frontend", "root"];
  }
  return ["root"];
}

function ownerScopesForCapability(capability, packetsByCapability) {
  const packet = packetsByCapability.get(capability.id);
  if (packet) return [...packet.targetOwners].sort();
  const owners = [];
  for (const source of capability.sources ?? []) {
    if (source.includes("frontend")) owners.push("frontend");
    if (source.includes("backend")) owners.push("backend");
    if (source.includes(".harness") || source.includes("scripts/")
        || source.includes("docs/")) owners.push("root");
  }
  if (owners.length === 0) owners.push("root");
  return uniqueSorted(owners);
}

function proposalDigest(proposal) {
  const projection = structuredClone(proposal);
  projection.proposalDigest = null;
  projection.receiptContract.requiredProposalDigest = null;
  return sha256Canonical(projection);
}

function deriveSummary(proposal) {
  const semantic = proposal.reviewUnits.filter((unit) => unit.sourceType !== "UNAVAILABLE_WORKTREE");
  const unavailable = proposal.reviewUnits.filter(
    (unit) => unit.sourceType === "UNAVAILABLE_WORKTREE",
  );
  return {
    semanticReviewUnitCount: semantic.length,
    unavailableSourceReviewUnitCount: unavailable.length,
    totalReviewUnitCount: proposal.reviewUnits.length,
    reviewBatchCount: proposal.reviewBatches.length,
    capabilityReviewCount: proposal.capabilityReviewIndex.length,
    packetReviewCount: proposal.packetReviewIndex.length,
    sourceMappedCapabilityCount: proposal.capabilityReviewIndex.filter(
      (capability) => capability.evidenceCoverageStatus === "SOURCE_MAPPED",
    ).length,
    blockedSourceCapabilityCount: proposal.capabilityReviewIndex.filter(
      (capability) => capability.evidenceCoverageStatus === "DECLARED_SOURCE_BLOCKED",
    ).length,
    inventoryOnlyCapabilityCount: proposal.capabilityReviewIndex.filter(
      (capability) => capability.evidenceCoverageStatus
        === "INVENTORY_ONLY_NO_SEMANTIC_DONOR",
    ).length,
    confirmedReviewUnitCount: 0,
    pendingReviewUnitCount: proposal.reviewUnits.length,
    bySourceType: countBy(proposal.reviewUnits, (unit) => unit.sourceType),
    byBatchCategory: countBy(proposal.reviewBatches, (batch) => batch.category),
    byProposedDisposition: countBy(
      proposal.reviewUnits,
      (unit) => unit.proposedDisposition,
    ),
    byConfidence: countBy(proposal.reviewUnits, (unit) => unit.confidence),
    byReviewOwner: countBy(proposal.reviewUnits, (unit) => unit.reviewOwners),
  };
}

function makeCapabilityIndex({
  semanticLedger,
  convergenceManifest,
  capabilityInventory,
  externalSourceSnapshot,
}) {
  const packetsByCapability = new Map(
    convergenceManifest.proposedPackets.map((packet) => [packet.capabilityId, packet]),
  );
  const semanticCounts = new Map();
  const classifications = [
    ...semanticLedger.refTreeGroups.map((group) => group.classification),
    ...semanticLedger.worktreeEntries.map((entry) => entry.classification),
  ];
  for (const classification of classifications) {
    for (const capabilityId of classification.capabilityIds) {
      semanticCounts.set(capabilityId, (semanticCounts.get(capabilityId) ?? 0) + 1);
    }
  }
  const externalCounts = new Map();
  const eligibleExternalCounts = new Map();
  for (const source of externalSourceSnapshot.sources) {
    externalCounts.set(source.capabilityId, (externalCounts.get(source.capabilityId) ?? 0) + 1);
    if (source.canonicalDonorEligible) {
      eligibleExternalCounts.set(
        source.capabilityId,
        (eligibleExternalCounts.get(source.capabilityId) ?? 0) + 1,
      );
    }
  }
  const canonical = capabilityInventory.islands.map((capability) => {
    const packet = packetsByCapability.get(capability.id);
    const semanticReviewUnitCount = semanticCounts.get(capability.id) ?? 0;
    const declaredExternalSourceCount = externalCounts.get(capability.id) ?? 0;
    const eligibleDonorSourceCount = eligibleExternalCounts.get(capability.id) ?? 0;
    const reviewUnitCount = semanticReviewUnitCount + declaredExternalSourceCount;
    const inventoryRecommendedDisposition = VERDICT_DISPOSITION[capability.verdict]
      ?? "BLOCKED_WIP";
    return {
      capabilityId: capability.id,
      name: capability.name,
      sourceClass: "CANONICAL_CAPABILITY",
      extDevStatus: capability.extDevStatus,
      inventoryRecommendedDisposition,
      packetRecommendedDisposition: packet?.disposition ?? null,
      recommendedDisposition: packet?.disposition ?? inventoryRecommendedDisposition,
      evidenceCoverageStatus: semanticReviewUnitCount > 0 || eligibleDonorSourceCount > 0
        ? "SOURCE_MAPPED"
        : declaredExternalSourceCount > 0
          ? "DECLARED_SOURCE_BLOCKED"
          : "INVENTORY_ONLY_NO_SEMANTIC_DONOR",
      semanticReviewUnitCount,
      declaredExternalSourceCount,
      eligibleDonorSourceCount,
      reviewUnitCount,
      reviewOwners: ownerScopesForCapability(capability, packetsByCapability),
      packetIds: packet ? [packet.id] : [],
      status: "PENDING_OWNER_CONFIRMATION",
      nonAuthorizing: true,
    };
  });
  const candidates = semanticLedger.newCapabilityCandidates.map((candidate) => {
    const packet = packetsByCapability.get(candidate.id);
    const semanticReviewUnitCount = semanticCounts.get(candidate.id) ?? 0;
    const declaredExternalSourceCount = externalCounts.get(candidate.id) ?? 0;
    const eligibleDonorSourceCount = eligibleExternalCounts.get(candidate.id) ?? 0;
    const reviewUnitCount = semanticReviewUnitCount + declaredExternalSourceCount;
    return {
      capabilityId: candidate.id,
      name: candidate.name,
      sourceClass: "NEW_CAPABILITY_CANDIDATE",
      extDevStatus: "review-candidate",
      inventoryRecommendedDisposition: null,
      packetRecommendedDisposition: packet?.disposition ?? null,
      recommendedDisposition: packet?.disposition ?? candidate.defaultDisposition,
      evidenceCoverageStatus: semanticReviewUnitCount > 0 || eligibleDonorSourceCount > 0
        ? "SOURCE_MAPPED"
        : declaredExternalSourceCount > 0
          ? "DECLARED_SOURCE_BLOCKED"
          : "INVENTORY_ONLY_NO_SEMANTIC_DONOR",
      semanticReviewUnitCount,
      declaredExternalSourceCount,
      eligibleDonorSourceCount,
      reviewUnitCount,
      reviewOwners: packet ? [...packet.targetOwners].sort() : ["root"],
      packetIds: packet ? [packet.id] : [],
      status: "PENDING_OWNER_CONFIRMATION",
      nonAuthorizing: true,
    };
  });
  return [...canonical, ...candidates].sort(
    (a, b) => a.capabilityId.localeCompare(b.capabilityId),
  );
}

function batchAssignment(classification, packetsByCapability) {
  const packetMatches = classification.capabilityIds
    .map((capabilityId) => packetsByCapability.get(capabilityId))
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  if (packetMatches.length > 0) {
    return {
      batchId: `packet-review-${packetMatches[0].id}`,
      category: "PACKET",
      subjectId: packetMatches[0].id,
    };
  }
  if (classification.capabilityIds.length > 0) {
    const capabilityId = [...classification.capabilityIds].sort()[0];
    return {
      batchId: `capability-review-${capabilityId}`,
      category: "CAPABILITY",
      subjectId: capabilityId,
    };
  }
  return {
    batchId: `asset-review-${slug(classification.assetClass)}-${slug(
      classification.proposedDisposition,
    )}`,
    category: "NON_PRODUCT_ASSET",
    subjectId: classification.assetClass,
  };
}

function unitOwners({ assignment, classification, path, capabilityOwners, packetsById }) {
  const owners = [];
  if (assignment.category === "PACKET") {
    owners.push(...(packetsById.get(assignment.subjectId)?.targetOwners ?? []));
  }
  for (const capabilityId of classification.capabilityIds) {
    owners.push(...(capabilityOwners.get(capabilityId) ?? []));
  }
  if (path) owners.push(...ownerScopesForPath(path));
  if (owners.length === 0) owners.push("root");
  return uniqueSorted(owners);
}

function buildReviewUnits({
  semanticLedger,
  convergenceManifest,
  capabilityReviewIndex,
  externalSourceSnapshot,
}) {
  const packetsByCapability = new Map(
    convergenceManifest.proposedPackets.map((packet) => [packet.capabilityId, packet]),
  );
  const packetsById = new Map(
    convergenceManifest.proposedPackets.map((packet) => [packet.id, packet]),
  );
  const capabilityOwners = new Map(
    capabilityReviewIndex.map((capability) => [capability.capabilityId, capability.reviewOwners]),
  );
  const units = [];
  for (const group of semanticLedger.refTreeGroups) {
    const assignment = batchAssignment(group.classification, packetsByCapability);
    units.push({
      reviewUnitId: `ref-tree:${group.tree}`,
      sourceType: "REF_TREE",
      sourceKey: group.tree,
      sourceLabel: group.canonicalRef,
      evidenceDigest: sha256Canonical(group),
      batchId: assignment.batchId,
      batchCategory: assignment.category,
      capabilityIds: [...group.classification.capabilityIds],
      assetClass: group.classification.assetClass,
      proposedDisposition: group.classification.proposedDisposition,
      confidence: group.classification.confidence,
      reviewOwners: unitOwners({
        assignment,
        classification: group.classification,
        path: null,
        capabilityOwners,
        packetsById,
      }),
      reviewStatus: "PENDING_OWNER_CONFIRMATION",
      nonAuthorizing: true,
    });
  }
  for (const entry of semanticLedger.worktreeEntries) {
    const assignment = batchAssignment(entry.classification, packetsByCapability);
    units.push({
      reviewUnitId: `worktree-entry:${entry.sourceId}`,
      sourceType: "WORKTREE_ENTRY",
      sourceKey: entry.sourceId,
      sourceLabel: entry.path,
      evidenceDigest: sha256Canonical(entry),
      batchId: assignment.batchId,
      batchCategory: assignment.category,
      capabilityIds: [...entry.classification.capabilityIds],
      assetClass: entry.classification.assetClass,
      proposedDisposition: entry.classification.proposedDisposition,
      confidence: entry.classification.confidence,
      reviewOwners: unitOwners({
        assignment,
        classification: entry.classification,
        path: entry.path,
        capabilityOwners,
        packetsById,
      }),
      reviewStatus: "PENDING_OWNER_CONFIRMATION",
      nonAuthorizing: true,
    });
  }
  for (const source of externalSourceSnapshot.sources) {
    const classification = {
      capabilityIds: [source.capabilityId],
      assetClass: source.privacyMode === "SENSITIVE_COUNTS_ONLY"
        ? "SENSITIVE_EXTERNAL_CAPABILITY_SOURCE"
        : "EXTERNAL_CAPABILITY_SOURCE",
      proposedDisposition: source.canonicalDonorEligible
        ? capabilityReviewIndex.find(
          (capability) => capability.capabilityId === source.capabilityId,
        )?.recommendedDisposition ?? "BLOCKED_WIP"
        : "BLOCKED_WIP",
    };
    const assignment = batchAssignment(classification, packetsByCapability);
    units.push({
      reviewUnitId: `external-source:${source.sourceId}`,
      sourceType: "EXTERNAL_CAPABILITY_SOURCE",
      sourceKey: source.sourceId,
      sourceLabel: source.declaredSource,
      evidenceDigest: sha256Canonical(source),
      batchId: assignment.batchId,
      batchCategory: assignment.category,
      capabilityIds: [source.capabilityId],
      assetClass: classification.assetClass,
      proposedDisposition: classification.proposedDisposition,
      confidence: source.state === "FROZEN" ? "HIGH"
        : source.observationKind === "DECLARATION_ONLY" ? "LOW" : "MEDIUM",
      reviewOwners: unitOwners({
        assignment,
        classification,
        path: null,
        capabilityOwners,
        packetsById,
      }),
      reviewStatus: "PENDING_OWNER_CONFIRMATION",
      nonAuthorizing: true,
    });
  }
  for (const source of semanticLedger.unavailableWorktrees) {
    units.push({
      reviewUnitId: `unavailable-worktree:${source.id}`,
      sourceType: "UNAVAILABLE_WORKTREE",
      sourceKey: source.id,
      sourceLabel: source.branchRef ?? source.id,
      evidenceDigest: sha256Canonical(source),
      batchId: "source-review-unavailable-worktrees",
      batchCategory: "UNAVAILABLE_SOURCE",
      capabilityIds: [],
      assetClass: "SOURCE_UNAVAILABLE",
      proposedDisposition: "KEEP_BLOCKED",
      confidence: "LOW",
      reviewOwners: ["root"],
      reviewStatus: "PENDING_OWNER_CONFIRMATION",
      nonAuthorizing: true,
    });
  }
  return units.sort((a, b) => a.reviewUnitId.localeCompare(b.reviewUnitId));
}

function buildReviewBatches(reviewUnits) {
  const groups = new Map();
  for (const unit of reviewUnits) {
    if (!groups.has(unit.batchId)) groups.set(unit.batchId, []);
    groups.get(unit.batchId).push(unit);
  }
  return [...groups.entries()].map(([batchId, units]) => ({
    batchId,
    category: units[0].batchCategory,
    subjectId: batchId.replace(/^(?:packet|capability|asset|source)-review-/u, ""),
    reviewOwners: uniqueSorted(units.flatMap((unit) => unit.reviewOwners)),
    proposedDispositionCounts: countBy(units, (unit) => unit.proposedDisposition),
    confidenceCounts: countBy(units, (unit) => unit.confidence),
    reviewUnitCount: units.length,
    reviewUnitIds: units.map((unit) => unit.reviewUnitId).sort(),
    status: "PENDING_OWNER_CONFIRMATION",
    nonAuthorizing: true,
  })).sort((a, b) => a.batchId.localeCompare(b.batchId));
}

export function buildOwnerReviewProposal(inputs) {
  const {
    semanticLedger,
    convergenceManifest,
    capabilityInventory,
    externalSourceSnapshot,
  } = inputs;
  const capabilityReviewIndex = makeCapabilityIndex(inputs);
  const reviewUnits = buildReviewUnits({
    semanticLedger,
    convergenceManifest,
    capabilityReviewIndex,
    externalSourceSnapshot,
  });
  const reviewBatches = buildReviewBatches(reviewUnits);
  const packetReviewIndex = convergenceManifest.proposedPackets.map((packet) => ({
    packetId: packet.id,
    capabilityId: packet.capabilityId,
    priority: packet.priority,
    targetOwners: [...packet.targetOwners],
    recommendedDisposition: packet.disposition,
    acknowledgement: "INFORMATIONAL_ONLY_NOT_CONFIRMED",
    status: "PROPOSED_NOT_AUTHORIZED",
    authorityTask: null,
  }));
  const proposal = {
    schemaVersion: "ext-full-value-owner-review-proposal.v1",
    capturedAt: semanticLedger.capturedAt,
    target: { ...semanticLedger.target },
    nonAuthorizing: true,
    status: "PENDING_OWNER_CONFIRMATION",
    proposalDigest: null,
    sourceBindings: {
      semanticLedgerPath: INPUT_PATHS.semanticLedger,
      semanticLedgerCanonicalSha256: sha256Canonical(semanticLedger),
      capabilityInventoryPath: INPUT_PATHS.capabilityInventory,
      capabilityInventoryCanonicalSha256: sha256Canonical(capabilityInventory),
      externalSourceSnapshotPath: INPUT_PATHS.externalSourceSnapshot,
      externalSourceSnapshotCanonicalSha256: sha256Canonical(externalSourceSnapshot),
      convergencePacketPlanCanonicalSha256: sha256Canonical({
        targetRef: convergenceManifest.snapshot.targetRef,
        targetHead: convergenceManifest.snapshot.targetHead,
        targetTree: convergenceManifest.snapshot.targetTree,
        proposedPackets: convergenceManifest.proposedPackets,
      }),
    },
    policy: {
      confirmingAuthority: "REPOSITORY_OWNER",
      confirmationScope: "SEMANTIC_LIST_ONLY",
      productAuthorityGranted: false,
      packetMigrationAuthorized: false,
      batchPartitionRequired: true,
      unavailableSourceDecisionRequired: true,
      allowedSemanticDecisions: [
        "CONFIRM_SEMANTIC_LIST_AS_PROPOSED",
        "CONFIRM_SEMANTIC_LIST_WITH_EXPLICIT_OVERRIDES",
        "REJECT_SEMANTIC_LIST_PROPOSAL",
      ],
      allowedUnavailableDecisions: ["KEEP_BLOCKED", "EXCLUDE_WITH_EVIDENCE"],
    },
    capabilityReviewIndex,
    packetReviewIndex,
    reviewBatches,
    reviewUnits,
    ownerReceipt: null,
    receiptContract: {
      schemaVersion: "ext-full-value-owner-receipt.v2",
      confirmingAuthority: "REPOSITORY_OWNER_VIA_TARGET_HEAD",
      acceptanceTrustRoot: "GITEE_ORIGIN_EXT_DEV_HEAD",
      requiredConfirmationScope: "SEMANTIC_LIST_ONLY",
      requiredReceiptPath: OWNER_RECEIPT_PATH,
      requiredProposalDigest: null,
      requiredReviewUnitCount: reviewUnits.length,
      requiredFields: [...RECEIPT_KEYS],
      allowedDecisions: [...RECEIPT_DECISIONS],
      allowedUnavailableDecisions: [...UNAVAILABLE_DECISIONS],
      allowedOverrideDispositions: [...OVERRIDE_DISPOSITIONS],
      productAuthorityGranted: false,
      packetMigrationAuthorized: false,
    },
    summary: null,
  };
  proposal.summary = deriveSummary(proposal);
  proposal.proposalDigest = proposalDigest(proposal);
  proposal.receiptContract.requiredProposalDigest = proposal.proposalDigest;
  return proposal;
}

function jsonEquals(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateOwnerReviewProposal(proposal, frozenInputs = null) {
  const errors = [];
  if (proposal?.schemaVersion !== "ext-full-value-owner-review-proposal.v1") {
    return ["owner review proposal schemaVersion is invalid"];
  }
  if (proposal.nonAuthorizing !== true || proposal.policy?.productAuthorityGranted !== false
      || proposal.policy?.packetMigrationAuthorized !== false) {
    errors.push("owner review proposal must remain non-authorizing");
  }
  if (proposal.status !== "PENDING_OWNER_CONFIRMATION" || proposal.ownerReceipt !== null
      || proposal.summary?.confirmedReviewUnitCount !== 0) {
    errors.push("owner review proposal must remain pending without an owner receipt");
  }
  if (!Array.isArray(proposal.reviewUnits) || !Array.isArray(proposal.reviewBatches)
      || !Array.isArray(proposal.capabilityReviewIndex)
      || !Array.isArray(proposal.packetReviewIndex)) {
    errors.push("owner review proposal detail arrays are invalid");
    return errors;
  }
  const unitIds = proposal.reviewUnits.map((unit) => unit.reviewUnitId);
  if (new Set(unitIds).size !== unitIds.length) {
    errors.push("owner review proposal contains duplicate review units");
  }
  const batchedIds = proposal.reviewBatches.flatMap((batch) => batch.reviewUnitIds ?? []);
  const batchCounts = countBy(batchedIds, (id) => id);
  if (batchedIds.length !== unitIds.length
      || unitIds.some((id) => batchCounts[id] !== 1)
      || batchedIds.some((id) => !unitIds.includes(id))) {
    errors.push("every review unit must belong to exactly one review batch");
  }
  for (const batch of proposal.reviewBatches) {
    if (batch.reviewUnitCount !== batch.reviewUnitIds.length
        || batch.status !== "PENDING_OWNER_CONFIRMATION"
        || batch.nonAuthorizing !== true) {
      errors.push(`owner review batch is invalid: ${batch.batchId}`);
    }
  }
  if (proposal.receiptContract?.confirmingAuthority !== "REPOSITORY_OWNER_VIA_TARGET_HEAD"
      || proposal.receiptContract?.acceptanceTrustRoot !== "GITEE_ORIGIN_EXT_DEV_HEAD"
      || proposal.receiptContract?.requiredConfirmationScope !== "SEMANTIC_LIST_ONLY"
      || proposal.receiptContract?.requiredReceiptPath !== OWNER_RECEIPT_PATH
      || proposal.receiptContract?.requiredProposalDigest !== proposal.proposalDigest
      || proposal.receiptContract?.productAuthorityGranted !== false
      || proposal.receiptContract?.packetMigrationAuthorized !== false) {
    errors.push("owner receipt contract is invalid or authorizing");
  }
  if (proposal.proposalDigest !== proposalDigest(proposal)) {
    errors.push("owner review proposal digest does not match content");
  }
  const derived = deriveSummary(proposal);
  if (!jsonEquals(proposal.summary, derived)) {
    errors.push("owner review proposal summary does not match detail");
  }
  if (frozenInputs === null) {
    errors.push("owner review validation requires frozen inputs");
  } else {
    const expected = buildOwnerReviewProposal(frozenInputs);
    if (!jsonEquals(proposal, expected)) {
      errors.push("owner review proposal does not match frozen inputs");
    }
  }
  return errors;
}

function validateProposalArtifact(artifact, errors) {
  const keys = [
    "targetRef",
    "proposalPath",
    "receiptPath",
    "proposalCommit",
    "proposalTree",
    "proposalBlob",
    "proposalFileSha256",
  ];
  if (!hasExactKeys(artifact, keys)) {
    errors.push("owner receipt proposal artifact has an invalid field set");
    return;
  }
  if (artifact.targetRef !== "origin/ext-dev"
      || artifact.proposalPath !== OWNER_REVIEW_PATH
      || artifact.receiptPath !== OWNER_RECEIPT_PATH
      || !/^[0-9a-f]{40}$/u.test(artifact.proposalCommit)
      || !/^[0-9a-f]{40}$/u.test(artifact.proposalTree)
      || !/^[0-9a-f]{40}$/u.test(artifact.proposalBlob)
      || !/^[0-9a-f]{64}$/u.test(artifact.proposalFileSha256)) {
    errors.push("owner receipt proposal artifact is invalid");
  }
}

function validateUnavailableDecisions(receipt, proposal, errors) {
  const unavailableUnits = (proposal?.reviewUnits ?? []).filter(
    (unit) => unit.sourceType === "UNAVAILABLE_WORKTREE",
  );
  if (!Array.isArray(receipt.unavailableSourceDecisions)) {
    errors.push("owner receipt unavailable source decisions must be an array");
    return { blockedCount: unavailableUnits.length, confirmedUnavailableCount: 0 };
  }
  const expectedIds = unavailableUnits.map((unit) => unit.reviewUnitId).sort();
  const actualIds = receipt.unavailableSourceDecisions.map(
    (decision) => decision?.reviewUnitId,
  ).sort();
  if (!jsonEquals(actualIds, expectedIds)) {
    errors.push("owner receipt must decide every unavailable source exactly once");
  }
  let blockedCount = 0;
  let confirmedUnavailableCount = 0;
  for (const [index, decision] of receipt.unavailableSourceDecisions.entries()) {
    if (!hasExactKeys(decision, ["reviewUnitId", "decision", "evidenceRefs", "reason"])
        || !expectedIds.includes(decision.reviewUnitId)
        || !UNAVAILABLE_DECISIONS.includes(decision.decision)
        || typeof decision.reason !== "string" || decision.reason.trim().length < 16
        || !Array.isArray(decision.evidenceRefs)) {
      errors.push(`owner receipt unavailable source decision ${index} is invalid`);
      continue;
    }
    if (decision.decision === "KEEP_BLOCKED") {
      blockedCount += 1;
      if (decision.evidenceRefs.length !== 0) {
        errors.push(`KEEP_BLOCKED must not claim exclusion evidence: ${decision.reviewUnitId}`);
      }
      continue;
    }
    confirmedUnavailableCount += 1;
    if (decision.evidenceRefs.length === 0) {
      errors.push(`EXCLUDE_WITH_EVIDENCE requires evidence: ${decision.reviewUnitId}`);
      continue;
    }
    for (const [evidenceIndex, evidence] of decision.evidenceRefs.entries()) {
      if (!hasExactKeys(evidence, ["path", "sha256", "description"])
          || !isSafeRepositoryPath(evidence.path)
          || !/^[0-9a-f]{64}$/u.test(evidence.sha256 ?? "")
          || typeof evidence.description !== "string"
          || evidence.description.trim().length < 16) {
        errors.push(
          `unavailable source evidence ${index}.${evidenceIndex} is invalid`,
        );
      }
    }
  }
  return { blockedCount, confirmedUnavailableCount };
}

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
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
    maxBuffer: 16 * 1024 * 1024,
    timeout: 20_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function resolveLiveGiteeExtDevHeadWithExecutor(executor = execFileSync) {
  const output = executor("/usr/bin/git", [
    "--no-replace-objects",
    "-c", "credential.helper=",
    "-c", "core.sshCommand=/usr/bin/ssh -F /dev/null -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/ubuntu/.ssh/known_hosts",
    "ls-remote",
    "--heads",
    "git@gitee.com:msxn/chaotang-os.git",
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
  if (!match) throw new Error("REMOTE_HEAD_UNVERIFIED");
  return match[1];
}

function resolveLiveGiteeExtDevHead() {
  return resolveLiveGiteeExtDevHeadWithExecutor();
}

function validateReceiptAtTargetHead(
  receipt,
  proposal,
  root,
  errors,
  remoteHeadResolver = resolveLiveGiteeExtDevHead,
) {
  if (typeof root !== "string") {
    errors.push("owner receipt acceptance requires a repository root");
    return;
  }
  try {
    const remote = git(root, ["config", "--get", "remote.origin.url"]).trim();
    const normalizedRemote = remote.replace(/^https?:\/\//u, "").replace(/^git@/u, "")
      .replace(":", "/").replace(/\.git$/u, "");
    if (normalizedRemote !== "gitee.com/msxn/chaotang-os") {
      errors.push("owner receipt repository identity is invalid");
      return;
    }
    if (git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], null).length !== 0) {
      errors.push("owner receipt repository must be clean");
      return;
    }
    const head = git(root, ["rev-parse", "HEAD"]).trim();
    const remoteHeadBefore = remoteHeadResolver();
    if (head !== remoteHeadBefore) {
      errors.push("owner receipt commit must be exact live origin/ext-dev head");
    }
    const parents = git(root, ["show", "-s", "--format=%P", head]).trim()
      .split(/\s+/u).filter(Boolean);
    if (parents.length !== 1 || parents[0] !== receipt.proposalArtifact.proposalCommit) {
      errors.push("owner receipt commit must be the exact single child of the proposal commit");
      return;
    }
    const proposalCommit = parents[0];
    try {
      git(root, ["cat-file", "-e", `${proposalCommit}:${OWNER_RECEIPT_PATH}`]);
      errors.push("owner receipt path must not exist in the proposal commit");
    } catch {
      // Expected: the receipt is added only by the confirmation commit.
    }
    const proposalTree = git(root, ["rev-parse", `${proposalCommit}^{tree}`]).trim();
    if (proposalTree !== receipt.proposalArtifact.proposalTree) {
      errors.push("owner receipt proposal tree binding is invalid");
    }
    const proposalBytes = git(
      root,
      ["show", `${proposalCommit}:${OWNER_REVIEW_PATH}`],
      null,
    );
    const proposalBlob = git(
      root,
      ["rev-parse", `${proposalCommit}:${OWNER_REVIEW_PATH}`],
    ).trim();
    if (proposalBlob !== receipt.proposalArtifact.proposalBlob
        || fileSha256(proposalBytes) !== receipt.proposalArtifact.proposalFileSha256
        || !jsonEquals(parseOwnerJsonStrict(proposalBytes), proposal)) {
      errors.push("owner receipt proposal artifact does not match the frozen proposal");
    }
    const receiptBytes = git(root, ["show", `${head}:${OWNER_RECEIPT_PATH}`], null);
    if (!jsonEquals(parseOwnerJsonStrict(receiptBytes), receipt)) {
      errors.push("owner receipt bytes do not match the target-head receipt");
    }
    for (const decision of receipt.unavailableSourceDecisions ?? []) {
      if (decision?.decision !== "EXCLUDE_WITH_EVIDENCE") continue;
      for (const evidence of decision.evidenceRefs ?? []) {
        try {
          const evidenceBytes = git(
            root,
            ["show", `${proposalCommit}:${evidence.path}`],
            null,
          );
          if (fileSha256(evidenceBytes) !== evidence.sha256) {
            errors.push(`unavailable source evidence hash drift: ${evidence.path}`);
          }
        } catch {
          errors.push(`unavailable source evidence is not in the proposal commit: ${evidence.path}`);
        }
      }
    }
    const commitTime = Date.parse(git(root, ["show", "-s", "--format=%cI", head]).trim());
    const issuedTime = Date.parse(receipt.issuedAt);
    if (!Number.isFinite(commitTime) || !Number.isFinite(issuedTime)
        || issuedTime > commitTime + 5 * 60 * 1000
        || issuedTime < commitTime - 24 * 60 * 60 * 1000) {
      errors.push("owner receipt issuedAt is outside the target-head confirmation window");
    }
    const changedPaths = git(
      root,
      ["diff-tree", "--no-commit-id", "--name-status", "-r", proposalCommit, head],
    ).trim().split("\n").filter(Boolean).sort();
    if (!jsonEquals(changedPaths, [`A\t${OWNER_RECEIPT_PATH}`])) {
      errors.push("owner receipt commit may only add the exact receipt path");
    }
    const receiptEntry = git(root, ["ls-tree", head, "--", OWNER_RECEIPT_PATH]).trim();
    if (!/^100644 blob [0-9a-f]{40}\t/u.test(receiptEntry)) {
      errors.push("owner receipt must be a regular 100644 Git blob");
    }
    const remoteHeadAfter = remoteHeadResolver();
    if (remoteHeadAfter !== head || remoteHeadAfter !== remoteHeadBefore) {
      errors.push("owner receipt live origin/ext-dev head moved during validation");
    }
  } catch {
    errors.push("owner receipt Git target-head evidence is unavailable or invalid");
  }
}

function validateOwnerReceiptCore(
  receipt,
  proposal,
  frozenInputs = null,
  root = null,
  remoteHeadResolver = resolveLiveGiteeExtDevHead,
) {
  const errors = [];
  if (frozenInputs === null) {
    errors.push("owner receipt validation requires frozen proposal inputs");
  } else {
    errors.push(...validateOwnerReviewProposal(proposal, frozenInputs));
    if (root !== null) {
      errors.push(...validateManifest(frozenInputs.convergenceManifest, root).map(
        (error) => `owner receipt upstream ${error}`,
      ));
    }
  }
  if (!hasExactKeys(receipt, RECEIPT_KEYS)) {
    return [...errors, "owner receipt has an invalid field set"];
  }
  if (receipt.schemaVersion !== "ext-full-value-owner-receipt.v2") {
    errors.push("owner receipt schemaVersion is invalid");
  }
  if (typeof receipt.receiptId !== "string"
      || !/^[A-Z0-9][A-Z0-9._-]{2,127}$/u.test(receipt.receiptId)) {
    errors.push("owner receipt id is invalid");
  }
  if (receipt.proposalDigest !== proposal?.proposalDigest) {
    errors.push("owner receipt proposal digest does not match the frozen proposal");
  }
  validateProposalArtifact(receipt.proposalArtifact, errors);
  if (receipt.confirmingAuthority !== "REPOSITORY_OWNER_VIA_TARGET_HEAD") {
    errors.push("owner receipt confirming authority is invalid");
  }
  if (receipt.confirmationScope !== "SEMANTIC_LIST_ONLY") {
    errors.push("owner receipt confirmation scope is invalid");
  }
  if (!RECEIPT_DECISIONS.includes(receipt.decision)) {
    errors.push("owner receipt decision is invalid");
  }
  const unavailable = validateUnavailableDecisions(receipt, proposal, errors);
  const overrides = Array.isArray(receipt.overrides) ? receipt.overrides : [];
  if (!Array.isArray(receipt.overrides)) {
    errors.push("owner receipt overrides must be an array");
  } else {
    const knownUnits = new Set((proposal?.reviewUnits ?? []).map((unit) => unit.reviewUnitId));
    const unavailableUnitIds = new Set((proposal?.reviewUnits ?? []).filter(
      (unit) => unit.sourceType === "UNAVAILABLE_WORKTREE",
    ).map((unit) => unit.reviewUnitId));
    const overrideIds = new Set();
    for (const [index, override] of overrides.entries()) {
      if (!hasExactKeys(override, ["reviewUnitId", "disposition", "reason"])
          || !knownUnits.has(override.reviewUnitId)
          || unavailableUnitIds.has(override.reviewUnitId)
          || !OVERRIDE_DISPOSITIONS.includes(override.disposition)
          || typeof override.reason !== "string" || override.reason.trim().length < 8) {
        errors.push(`owner receipt override ${index} is invalid`);
        continue;
      }
      if (overrideIds.has(override.reviewUnitId)) {
        errors.push(`owner receipt override is duplicated: ${override.reviewUnitId}`);
      }
      overrideIds.add(override.reviewUnitId);
    }
  }
  const expectedCount = (proposal?.summary?.semanticReviewUnitCount ?? 0)
    + unavailable.confirmedUnavailableCount;
  const expectedConfirmedState = unavailable.blockedCount > 0
    ? "OWNER_CONFIRMED_LIST_WITH_BLOCKED_SOURCE"
    : "OWNER_CONFIRMED_SEMANTIC_LIST";
  if (receipt.decision === "CONFIRM_SEMANTIC_LIST_AS_PROPOSED") {
    if (overrides.length !== 0 || receipt.confirmedReviewUnitCount !== expectedCount
        || receipt.state !== expectedConfirmedState) {
      errors.push("as-proposed receipt must cover the semantic list without overrides");
    }
  } else if (receipt.decision === "CONFIRM_SEMANTIC_LIST_WITH_EXPLICIT_OVERRIDES") {
    if (overrides.length === 0 || receipt.confirmedReviewUnitCount !== expectedCount
        || receipt.state !== expectedConfirmedState) {
      errors.push("override receipt must list overrides and cover the exact proposal");
    }
  } else if (receipt.decision === "REJECT_SEMANTIC_LIST_PROPOSAL"
      && (receipt.confirmedReviewUnitCount !== 0
        || receipt.state !== "OWNER_REJECTED_SEMANTIC_LIST")) {
    errors.push("rejection receipt must not confirm review units");
  }
  if (typeof receipt.ownerStatement !== "string" || receipt.ownerStatement.trim().length < 16) {
    errors.push("owner receipt statement is too short");
  }
  if (typeof receipt.issuedAt !== "string"
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(receipt.issuedAt)
      || Number.isNaN(Date.parse(receipt.issuedAt))) {
    errors.push("owner receipt issuedAt is invalid");
  }
  if (receipt.nonAuthorizing !== true || receipt.productAuthorityGranted !== false
      || receipt.packetMigrationAuthorized !== false) {
    errors.push("owner receipt must not grant product or Packet authority");
  }
  if (isObject(receipt.proposalArtifact)) {
    validateReceiptAtTargetHead(receipt, proposal, root, errors, remoteHeadResolver);
  }
  return errors;
}

export function validateOwnerReceipt(receipt, proposal, frozenInputs = null, root = null) {
  return validateOwnerReceiptCore(receipt, proposal, frozenInputs, root);
}

export function validateOwnerReceiptWithTestRemoteHead(
  receipt,
  proposal,
  frozenInputs,
  root,
  remoteHeadResolver,
) {
  if (process.env.EXT_OWNER_RECEIPT_GIT_TESTS !== "1"
      || typeof remoteHeadResolver !== "function") {
    return ["test-only remote head resolver is disabled"];
  }
  return validateOwnerReceiptCore(
    receipt,
    proposal,
    frozenInputs,
    root,
    remoteHeadResolver,
  );
}

function loadInputs(root) {
  const read = (path) => parseOwnerJsonStrict(readFileSync(resolve(root, path)));
  return {
    semanticLedger: read(INPUT_PATHS.semanticLedger),
    convergenceManifest: read(INPUT_PATHS.convergenceManifest),
    capabilityInventory: read(INPUT_PATHS.capabilityInventory),
    externalSourceSnapshot: read(INPUT_PATHS.externalSourceSnapshot),
  };
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function runOwnerReviewCli(argv, root = defaultRoot) {
  const sourceInputs = loadInputs(root);
  const upstreamErrors = validateManifest(sourceInputs.convergenceManifest, root);
  if (argv.length === 1 && argv[0] === "--observe") {
    if (upstreamErrors.length > 0) {
      print({ decision: "STOP", nonAuthorizing: true, errors: upstreamErrors });
      return 2;
    }
    print(buildOwnerReviewProposal(sourceInputs));
    return 0;
  }
  if (argv.length === 1 && ["--check", "--summary", "--capabilities",
    "--receipt-requirements"].includes(argv[0])) {
    const proposal = parseOwnerJsonStrict(readFileSync(resolve(root, OWNER_REVIEW_PATH)));
    const errors = [...upstreamErrors, ...validateOwnerReviewProposal(proposal, sourceInputs)];
    if (argv[0] === "--capabilities") {
      print({
        decision: errors.length === 0 ? "PASS" : "STOP",
        nonAuthorizing: true,
        errors,
        proposalDigest: proposal.proposalDigest,
        capabilities: proposal.capabilityReviewIndex,
      });
    } else if (argv[0] === "--receipt-requirements") {
      print({
        decision: errors.length === 0 ? "PASS" : "STOP",
        nonAuthorizing: true,
        errors,
        proposalDigest: proposal.proposalDigest,
        receiptContract: proposal.receiptContract,
      });
    } else {
      print({
        schemaVersion: "ext-full-value-owner-review-result.v1",
        command: argv[0].slice(2),
        decision: errors.length === 0 ? "PASS" : "STOP",
        nonAuthorizing: true,
        errors,
        proposalDigest: proposal.proposalDigest,
        status: proposal.status,
        summary: proposal.summary,
      });
    }
    return errors.length === 0 ? 0 : 2;
  }
  if (argv.length === 2 && argv[0] === "--batch") {
    const proposal = parseOwnerJsonStrict(readFileSync(resolve(root, OWNER_REVIEW_PATH)));
    const errors = [...upstreamErrors, ...validateOwnerReviewProposal(proposal, sourceInputs)];
    const batch = proposal.reviewBatches.find((entry) => entry.batchId === argv[1]);
    print({
      decision: errors.length === 0 && batch ? "PASS" : "STOP",
      nonAuthorizing: true,
      errors: batch ? errors : [...errors, `owner review batch not found: ${argv[1]}`],
      proposalDigest: proposal.proposalDigest,
      batch: batch ?? null,
    });
    return errors.length === 0 && batch ? 0 : 2;
  }
  process.stderr.write([
    "Usage:",
    "  node scripts/ext-full-value-owner-review.mjs --observe",
    "  node scripts/ext-full-value-owner-review.mjs --check",
    "  node scripts/ext-full-value-owner-review.mjs --summary",
    "  node scripts/ext-full-value-owner-review.mjs --capabilities",
    "  node scripts/ext-full-value-owner-review.mjs --receipt-requirements",
    "  node scripts/ext-full-value-owner-review.mjs --batch <batch-id>",
  ].join("\n") + "\n");
  return 64;
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  try {
    process.exitCode = runOwnerReviewCli(process.argv.slice(2));
  } catch (error) {
    print({
      schemaVersion: "ext-full-value-owner-review-result.v1",
      command: "error",
      decision: "STOP",
      nonAuthorizing: true,
      errors: [error instanceof Error ? error.message : String(error)],
    });
    process.exitCode = 2;
  }
}

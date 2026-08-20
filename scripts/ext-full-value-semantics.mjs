#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseJsonNoDuplicateKeys } from "./execution_authority_ext.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = dirname(dirname(scriptPath));

export const SEMANTIC_LEDGER_PATH =
  "docs/migrations/2026-08-20-ext-full-value-semantic-ledger.v2.json";

const ALLOWED_DISPOSITIONS = new Set([
  "ABSORB_ADAPT",
  "REBUILD",
  "SUPERSEDED_VERIFY",
  "ARCHIVE",
  "REJECT",
  "DUPLICATE",
  "BLOCKED_WIP",
]);
const CAPABILITY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CANDIDATE_KEYS = ["id", "name", "defaultDisposition", "reason"];

const VERDICT_DISPOSITION = Object.freeze({
  "direct-adapt": "ABSORB_ADAPT",
  "independent-integration": "ABSORB_ADAPT",
  "rewrite-distill": "REBUILD",
  "contract-eval-only": "SUPERSEDED_VERIFY",
  "reference-only": "SUPERSEDED_VERIFY",
  quarantine: "BLOCKED_WIP",
  retire: "REJECT",
});

const LEGACY_FAMILY_CAPABILITIES = Object.freeze({
  ANTI_HALLUCINATION_EVIDENCE: ["claim-evidence-truth-gate"],
  COMPANION_PHASE1A: ["local-companion-runtime"],
  COMPANION_PHASE1B: ["local-companion-runtime"],
  COURT_LOOP_CONTRACTS: ["dev-trusted-runtime-kernel"],
  DEEP_MODULE_PROJECTION: ["historical-ui-concepts"],
  DEPARTMENT_RUNTIME_WIRING: ["dev-trusted-runtime-kernel"],
  DEV_EXT_DEMO_DOMAIN: ["legacy-flow-runtime"],
  GONGBU_SCOPE_SAFETY: ["battery-physical-safety-gate"],
  HA_AOS_MASTER_GRAPH: ["historical-ui-concepts"],
  HISTORICAL_ASSET_GRAPH: ["historical-ui-concepts"],
  HUBU_FACT_CARD: ["hubu-professional-accounting"],
  HUBU_W09_ACTIVATION: ["hubu-professional-accounting"],
  JINYIWEI_SOURCE_TRUST: ["jinyiwei-evidence-source-adapters"],
  MASTER_PRD_V2_GRAPH: ["historical-ui-concepts"],
  MENXIA_VETO: ["dev-trusted-runtime-kernel"],
  P20_LEGACY_REVIEW_RESOLUTION: ["legacy-flow-runtime"],
  PROFESSIONAL_AGENT_K0: ["professional-agent-overlay"],
  PROFESSIONAL_AGENT_OVERLAY: ["professional-agent-overlay"],
  PROFESSIONAL_TEN_SAMPLES: ["professional-agent-overlay"],
  RELEASE_HARNESS_FALLBACK: ["certification-release-evidence"],
  SUPER_TASK_DELIVERY: ["historical-ui-concepts"],
  TEMPORAL_DECISION_INTELLIGENCE: ["temporal-decision-intelligence"],
  TRUSTED_KERNEL: ["dev-trusted-runtime-kernel"],
  W05_CANONICAL_CHAIN: ["shiguan-trusted-archive"],
  W08_FULL_CONTRACT_LOOP: ["secure-ingest-product-acceptance"],
  W08_GRAPH_M0: ["dev-trusted-runtime-kernel"],
});

export const NEW_CAPABILITY_CANDIDATES = Object.freeze([
  {
    id: "claim-evidence-truth-gate",
    name: "通用 Claim—Evidence 真实性门",
    defaultDisposition: "ABSORB_ADAPT",
    reason: "旧反幻觉证据门是跨部门通用真值约束，不等同于锦衣卫数据适配器。",
  },
  {
    id: "guoli-truth-metrics-read-model",
    name: "国力真值指标读模型",
    defaultDisposition: "REBUILD",
    reason: "多个 P8 分支形成互补 read-model 与 truth-ledger 失败关闭实现。",
  },
  {
    id: "hanlin-evaluation-read-model",
    name: "翰林评测读模型",
    defaultDisposition: "REBUILD",
    reason: "多个 P9 分支形成评测读模型的不同演进版本。",
  },
  {
    id: "jinyiwei-evidence-source-adapters",
    name: "锦衣卫真实证据源适配器",
    defaultDisposition: "REBUILD",
    reason: "real-fetch、source-trust 与 review 分支是同功能异实现，需要按数据源和负测蒸馏。",
  },
  {
    id: "memorial-reply-visual-system",
    name: "奏折与回奏视觉优先御览体系",
    defaultDisposition: "BLOCKED_WIP",
    reason: "四份独有未提交设计/治理文档定义了尚未获授权的产品体验候选。",
  },
  {
    id: "release-backup-offline-verification-runtime",
    name: "备份、离线发布与验证运行时",
    defaultDisposition: "REBUILD",
    reason: "RC1 候选含真实备份和离线校验能力，但必须在当前发布架构中重建并补齐绿灯。",
  },
  {
    id: "trusted-artifact-delivery",
    name: "可信产物交付与下载",
    defaultDisposition: "REBUILD",
    reason: "两个 W06 工作区含同内容 artifact router、完整性迁移和交付证据，应重建到当前 backend/app 主架构。",
  },
]);

const CAPABILITY_RULES = [
  ["artifact-delivery", /artifact[_-]delivery|artifacts?(?:\.py|\/|[-_])/iu,
    ["trusted-artifact-delivery"]],
  ["memorial-visual", /memorial-reply-visual|visual-first/iu,
    ["memorial-reply-visual-system"]],
  ["jinyiwei-source", /jinyiwei|pkt-a1|ext-a9/iu,
    ["jinyiwei-evidence-source-adapters"]],
  ["guoli-read-model", /guoli|(?:^|[\/_-])p8(?:[\/_-]|$)/iu,
    ["guoli-truth-metrics-read-model"]],
  ["hanlin-read-model", /hanlin|(?:^|[\/_-])p9(?:[\/_-]|$)/iu,
    ["hanlin-evaluation-read-model"]],
  ["release-runtime", /rc1|wheelhouse|sqlite[_-]backup|offline[_-](?:release|bundle)|release-blocker/iu,
    ["release-backup-offline-verification-runtime", "certification-release-evidence"]],
  ["claim-evidence", /anti-hallucination|claim[-_]evidence|truth[-_]gate/iu,
    ["claim-evidence-truth-gate"]],
  ["professional-overlay", /professional-agent|professional_agent/iu,
    ["professional-agent-overlay"]],
  ["companion", /companion/iu, ["local-companion-runtime"]],
  ["hubu-accounting", /hubu|accounting|cash-safety|fact-card/iu,
    ["hubu-professional-accounting"]],
  ["shiguan-outcomes", /shiguan.*outcome|outcome.*ledger|outcome.*learning/iu,
    ["shiguan-outcome-learning"]],
  ["shiguan-archive", /shiguan|daily-memorial|incident-replay|signal-date|playwright-routes/iu,
    ["shiguan-trusted-archive"]],
  ["battery-safety", /gongbu.*(?:safety|scope|explosion)|battery.*(?:safety|scope)|component-scope/iu,
    ["battery-physical-safety-gate"]],
  ["pack-kernel", /pack[-_]rd|battery-stage|cell-library/iu,
    ["pack-battery-rd-kernel"]],
  ["xingbu-legal", /xingbu|legal-kernel|legal-verify/iu,
    ["xingbu-deterministic-legal-kernel"]],
  ["temporal", /temporal|forecast|qintian/iu,
    ["temporal-decision-intelligence", "qintian-prediction-falsification-loop"]],
  ["secure-ingest", /d4a|p0c|full-loop|contract-acceptance|contract-quality|exact-source/iu,
    ["secure-ingest-product-acceptance"]],
  ["dual-orchestration", /dual-orchestration|department-runtime|court-loop|trusted-kernel/iu,
    ["dev-trusted-runtime-kernel"]],
  ["tiandao", /tiandao/iu, ["tiandao-governance-plane"]],
  ["council", /council-graph/iu, ["council-graph-experiment"]],
  ["six-ministry-corpus", /agent-design-convergence|six-ministry|six-capability/iu,
    ["ext-six-ministry-design-corpus"]],
  ["historical-ui", /historical-asset|master-prd|ha-aos|frontend-residual|second-brain/iu,
    ["historical-ui-concepts"]],
];

function countBy(values, selector) {
  const result = {};
  for (const value of values) {
    const keys = selector(value);
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (key === null || key === undefined || key === "") continue;
      result[key] = (result[key] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function normalizedSourceName(refname) {
  if (refname.startsWith("refs/heads/")) return refname.slice("refs/heads/".length);
  if (refname.startsWith("refs/remotes/origin/")) {
    return refname.slice("refs/remotes/origin/".length);
  }
  return refname.replace(/^refs\//u, "");
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function hasExactKeys(value, expected) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function inferCapabilities(text) {
  const capabilityIds = [];
  const ruleIds = [];
  for (const [ruleId, pattern, ids] of CAPABILITY_RULES) {
    if (!pattern.test(text)) continue;
    capabilityIds.push(...ids);
    ruleIds.push(ruleId);
  }
  return { capabilityIds: uniqueSorted(capabilityIds), ruleIds };
}

export function buildCanonicalRefGroups(refSnapshot) {
  const reviewRefs = (refSnapshot.refs ?? []).filter(
    (ref) => typeof ref.grade === "string" && ref.grade.endsWith("_REVIEW_REQUIRED"),
  );
  const byTree = new Map();
  for (const ref of reviewRefs) {
    if (!byTree.has(ref.tree)) byTree.set(ref.tree, []);
    byTree.get(ref.tree).push(ref);
  }
  return [...byTree.entries()].map(([tree, refs]) => {
    const sorted = [...refs].sort((a, b) => a.refname.localeCompare(b.refname));
    return {
      tree,
      canonicalRef: sorted[0].canonicalTreeRef,
      aliases: sorted.map((ref) => ref.refname),
      commitTips: uniqueSorted(sorted.map((ref) => ref.commitTip)),
      legacy99TipStates: uniqueSorted(sorted.map((ref) => ref.legacy99TipState)),
      aliasFacts: sorted.map((ref) => ({
        refname: ref.refname,
        commitTip: ref.commitTip,
        grade: ref.grade,
        relationToTarget: ref.relationToTarget ?? null,
        legacy99TipState: ref.legacy99TipState,
      })),
    };
  }).sort((a, b) => a.canonicalRef.localeCompare(b.canonicalRef));
}

function refAssetClass(canonicalRef, capabilityIds) {
  const source = normalizedSourceName(canonicalRef);
  if (/^(?:archive\/|.*\/archive\/)/iu.test(source)) return "ARCHIVE_HISTORY";
  if (/dev-ext-test/iu.test(source)) return "DEMO_OR_FIXTURE";
  if (/^(?:governance\/|.*(?:authority|amendment|preseal|readiness|reviewer-successor))/iu
    .test(source) && capabilityIds.length === 0) {
    return "GOVERNANCE_AUTHORITY_EVIDENCE";
  }
  if (/^(?:review\/|candidate\/)/iu.test(source) && capabilityIds.length === 0) {
    return "REVIEW_EVIDENCE";
  }
  if (/^docs\//iu.test(source) && capabilityIds.length === 0) {
    return "DESIGN_DOCUMENTATION";
  }
  if (/^wip\//iu.test(source) && capabilityIds.length === 0) return "BLOCKED_WIP_HISTORY";
  if (capabilityIds.length > 0) return "PRODUCT_OR_CONTRACT_CAPABILITY";
  if (/^(?:agent\/|chore\/|codex\/.*(?:composition|convergence|governance|harness)|task\/(?:branch-governance|census|ext-99|ext-unified|resource-census))/iu
    .test(source)) {
    return "GOVERNANCE_OR_ROOT_TOOLING_HISTORY";
  }
  if (/^(?:fix\/|task\/(?:fix-p6|p5|p6|r0-w07)|task0-red|r0-w08-remediation)/iu
    .test(source)) {
    return "TEST_OR_REVIEW_HISTORY";
  }
  if (source === "stash") return "BLOCKED_WIP_HISTORY";
  if (source === "remotes/origin/HEAD") return "BRANCH_POINTER_HISTORY";
  if (/safety\/pre-convergence/iu.test(source)) return "ARCHIVE_HISTORY";
  return "MIXED_SOURCE_REVIEW";
}

function proposedDispositionForRef({ legacyBranches, capabilityIds, capabilityVerdicts, assetClass }) {
  const canonicalLegacy = legacyBranches.find((branch) => branch.canonicalDonor)
    ?? legacyBranches[0];
  if (canonicalLegacy && ALLOWED_DISPOSITIONS.has(canonicalLegacy.disposition)) {
    return canonicalLegacy.disposition;
  }
  if (assetClass === "ARCHIVE_HISTORY" || assetClass === "DESIGN_DOCUMENTATION") return "ARCHIVE";
  if (["GOVERNANCE_AUTHORITY_EVIDENCE", "REVIEW_EVIDENCE"].includes(assetClass)) {
    return "SUPERSEDED_VERIFY";
  }
  if (assetClass === "DEMO_OR_FIXTURE") return "REJECT";
  if (assetClass === "BLOCKED_WIP_HISTORY") return "BLOCKED_WIP";
  for (const capabilityId of capabilityIds) {
    const disposition = capabilityVerdicts.get(capabilityId);
    if (disposition) return disposition;
  }
  return "BLOCKED_WIP";
}

export function classifyRefGroup({
  canonicalRef,
  aliases,
  legacyBranches = [],
  capabilityIds = [],
  capabilityVerdicts = new Map(),
  legacy99TipStates = [],
  inferredRuleIds = [],
}) {
  const normalizedCapabilities = uniqueSorted(capabilityIds);
  const assetClass = refAssetClass(canonicalRef, normalizedCapabilities);
  const ruleIds = [...inferredRuleIds];
  const reasons = [];
  if (legacyBranches.length > 0) {
    ruleIds.push("legacy-99-exact-branch");
    reasons.push("Matched an exact legacy 99 branch name and frozen tip.");
  }
  if (normalizedCapabilities.length > 0) {
    ruleIds.push("capability-signature");
    reasons.push("Source names or legacy families match capability signatures.");
  }
  if (assetClass !== "PRODUCT_OR_CONTRACT_CAPABILITY") {
    ruleIds.push("namespace-asset-class");
    reasons.push(`Namespace classifies this tree as ${assetClass}.`);
  }
  const hasDrift = legacy99TipStates.includes("DRIFTED");
  if (hasDrift) {
    ruleIds.push("legacy-tip-drift");
    reasons.push("A legacy source name moved beyond its frozen tip and requires commit-level splitting.");
  }
  const confidence = hasDrift || ["MIXED_SOURCE_REVIEW", "UNKNOWN_REVIEW_REQUIRED"]
    .includes(assetClass)
    ? "LOW"
    : (legacyBranches.length > 0 || normalizedCapabilities.length > 0 ? "HIGH" : "MEDIUM");
  return {
    semanticStatus: "REVIEW_REQUIRED",
    assetClass,
    capabilityIds: normalizedCapabilities,
    proposedDisposition: proposedDispositionForRef({
      legacyBranches,
      capabilityIds: normalizedCapabilities,
      capabilityVerdicts,
      assetClass,
    }),
    confidence,
    ruleIds: uniqueSorted(ruleIds),
    reasons,
    legacyEvidence: legacyBranches.map((branch) => ({
      branch: branch.branch,
      assetFamily: branch.assetFamily,
      disposition: branch.disposition,
      canonicalDonor: branch.canonicalDonor ?? null,
    })),
    aliasCount: aliases.length,
    nonAuthorizing: true,
  };
}

function worktreeAssetClass(path) {
  if (/^(?:frontend|backend)\/.*(?:^|[\/._-])(?:test|spec|nodetest)(?:[\/._-]|$)/iu
      .test(path)
      || /^(?:frontend|backend)\/(?:test|tests|e2e|harness)\//u.test(path)) {
    return "TEST_OR_EVALUATION_EVIDENCE";
  }
  if (/^frontend\/src\//u.test(path)) return "PRODUCT_UI";
  if (/^backend\/(?:app|src|web|alembic)\//u.test(path)) return "PRODUCT_RUNTIME";
  if (/^(?:deploy\/|Dockerfile$|docker-compose|Caddyfile)/iu.test(path)) {
    return "RELEASE_INFRASTRUCTURE";
  }
  if (/^frontend\/(?:deploy|scripts)\//u.test(path)
      || /^frontend\/(?:package\.json|next\.config|tsconfig)/u.test(path)) {
    return "RELEASE_OR_RUNTIME_TOOLING";
  }
  if (/^(?:frontend\/.*(?:nodetest|playwright.*config)|backend\/requirements.*(?:lock|txt)|(?:frontend|backend)\/Dockerfile)/iu
    .test(path)) {
    return "TEST_OR_RELEASE_CONFIGURATION";
  }
  if (/^(?:output|council-reports|dist|build|coverage)\//u.test(path)) {
    return "GENERATED_OUTPUT";
  }
  if (/^(?:\.harness|docs)\//u.test(path) || /\.md$/iu.test(path)) {
    return "GOVERNANCE_OR_DESIGN_EVIDENCE";
  }
  if (/^(?:\.agents|\.codex)\//u.test(path)) return "AGENT_TOOLING";
  if (/^scripts\//u.test(path)) return "ROOT_TOOLING";
  if (/\.(?:png|jpe?g|webp)$/iu.test(path)) return "VISUAL_EVIDENCE";
  return "UNSCOPED_WORKTREE_FILE";
}

export function classifyWorktreeEntry({ worktree, entry, duplicate }) {
  const pathText = `${entry.path} ${entry.originalPath ?? ""}`;
  const pathInferred = inferCapabilities(pathText);
  const useBranchContext = !Number.isInteger(worktree.entryCount) || worktree.entryCount <= 50;
  const branchInferred = useBranchContext
    ? inferCapabilities(worktree.branchRef ?? "")
    : { capabilityIds: [], ruleIds: ["large-worktree-path-only"] };
  const inferred = {
    capabilityIds: uniqueSorted([
      ...pathInferred.capabilityIds,
      ...branchInferred.capabilityIds,
    ]),
    ruleIds: uniqueSorted([...pathInferred.ruleIds, ...branchInferred.ruleIds]),
  };
  const assetClass = worktreeAssetClass(entry.path);
  const ruleIds = ["worktree-path-asset-class", ...inferred.ruleIds];
  if (duplicate.count > 1) ruleIds.push("exact-content-hash-alias");
  return {
    semanticStatus: "REVIEW_REQUIRED",
    assetClass,
    capabilityIds: inferred.capabilityIds,
    proposedDisposition: "BLOCKED_WIP",
    confidence: ["UNKNOWN_REVIEW_REQUIRED", "UNSCOPED_WORKTREE_FILE"]
      .includes(assetClass) ? "LOW" : "MEDIUM",
    ruleIds: uniqueSorted(ruleIds),
    reasons: [
      "Uncommitted content is inventory-only until independently frozen or committed.",
      ...(duplicate.count > 1
        ? ["Exact content hash appears in multiple worktree entries; semantic equivalence is not assumed."]
        : []),
    ],
    technicalDuplicateCount: duplicate.count,
    canonicalContentSourceId: duplicate.canonicalSourceId,
    nonAuthorizing: true,
  };
}

function capabilityVerdicts(capabilityInventory) {
  const result = new Map();
  for (const island of capabilityInventory.islands ?? []) {
    result.set(island.id, VERDICT_DISPOSITION[island.verdict] ?? "BLOCKED_WIP");
  }
  for (const candidate of NEW_CAPABILITY_CANDIDATES) {
    result.set(candidate.id, candidate.defaultDisposition);
  }
  return result;
}

function addLegacyFamilyCapabilities(capabilityIds, legacyBranches) {
  for (const branch of legacyBranches) {
    capabilityIds.push(...(LEGACY_FAMILY_CAPABILITIES[branch.assetFamily] ?? []));
  }
}

function specialRefCapabilities(canonicalRef) {
  if (canonicalRef === "refs/heads/ext-dev") {
    return ["dev-trusted-runtime-kernel", "jinyiwei-evidence-source-adapters"];
  }
  if (canonicalRef === "refs/heads/codex/professional-agent-overlay-clean") {
    return [
      "professional-agent-overlay",
      "hubu-professional-accounting",
      "shiguan-outcome-learning",
    ];
  }
  return [];
}

function deriveSemanticSummary(ledger) {
  const refItems = ledger.refTreeGroups.map((group) => group.classification);
  const worktreeItems = ledger.worktreeEntries.map((entry) => entry.classification);
  const allItems = [...refItems, ...worktreeItems];
  return {
    refTreeGroupCount: ledger.refTreeGroups.length,
    refAliasCount: ledger.refTreeGroups.reduce((sum, group) => sum + group.aliases.length - 1, 0),
    worktreeEntryCount: ledger.worktreeEntries.length,
    unavailableWorktreeCount: ledger.unavailableWorktrees.length,
    semanticItemCount: allItems.length,
    confirmedSemanticItemCount: allItems.filter(
      (item) => item.semanticStatus === "CONFIRMED",
    ).length,
    reviewRequiredItemCount: allItems.filter(
      (item) => item.semanticStatus === "REVIEW_REQUIRED",
    ).length,
    unknownReviewRequiredCount: allItems.filter(
      (item) => item.assetClass === "UNKNOWN_REVIEW_REQUIRED",
    ).length,
    technicalDuplicateWorktreeEntryCount: worktreeItems.filter(
      (item) => item.technicalDuplicateCount > 1,
    ).length,
    newCapabilityCandidateCount: ledger.newCapabilityCandidates.length,
    byAssetClass: countBy(allItems, (item) => item.assetClass),
    byDisposition: countBy(allItems, (item) => item.proposedDisposition),
    byConfidence: countBy(allItems, (item) => item.confidence),
    byCapability: countBy(allItems, (item) => item.capabilityIds),
  };
}

export function buildSemanticLedger({
  refSnapshot,
  worktreeSnapshot,
  legacyLedger,
  capabilityInventory,
}) {
  const legacyByBranch = new Map(
    (legacyLedger.branches ?? []).map((branch) => [branch.branch, branch]),
  );
  const verdicts = capabilityVerdicts(capabilityInventory);
  const knownCapabilityIds = new Set([
    ...(capabilityInventory.islands ?? []).map((island) => island.id),
    ...NEW_CAPABILITY_CANDIDATES.map((candidate) => candidate.id),
  ]);
  const refTreeGroups = buildCanonicalRefGroups(refSnapshot).map((group) => {
    const exactLegacyBranchesByName = new Map();
    for (const alias of group.aliasFacts) {
      if (alias.legacy99TipState !== "MATCH") continue;
      const legacy = legacyByBranch.get(normalizedSourceName(alias.refname));
      if (legacy) exactLegacyBranchesByName.set(legacy.branch, legacy);
    }
    const exactLegacyBranches = [...exactLegacyBranchesByName.values()]
      .sort((a, b) => a.branch.localeCompare(b.branch));
    const inferred = inferCapabilities(group.aliases.join(" "));
    const inferredCapabilityIds = [...inferred.capabilityIds, ...specialRefCapabilities(
      group.canonicalRef,
    )];
    addLegacyFamilyCapabilities(inferredCapabilityIds, exactLegacyBranches);
    const capabilityIds = uniqueSorted(inferredCapabilityIds).filter(
      (id) => knownCapabilityIds.has(id),
    );
    return {
      ...group,
      classification: classifyRefGroup({
        canonicalRef: group.canonicalRef,
        aliases: group.aliases,
        legacyBranches: exactLegacyBranches,
        capabilityIds,
        capabilityVerdicts: verdicts,
        legacy99TipStates: group.legacy99TipStates,
        inferredRuleIds: inferred.ruleIds,
      }),
    };
  });

  const rawWorktreeEntries = [];
  for (const worktree of worktreeSnapshot.worktrees ?? []) {
    for (const entry of worktree.entries ?? []) {
      const sourceId = `${worktree.id}:${entry.path}`;
      rawWorktreeEntries.push({ sourceId, worktree, entry });
    }
  }
  const byHash = new Map();
  for (const item of rawWorktreeEntries) {
    if (item.entry.sha256 === null) continue;
    if (!byHash.has(item.entry.sha256)) byHash.set(item.entry.sha256, []);
    byHash.get(item.entry.sha256).push(item.sourceId);
  }
  const worktreeEntries = rawWorktreeEntries.map(({ sourceId, worktree, entry }) => {
    const aliases = entry.sha256 === null ? [] : [...byHash.get(entry.sha256)].sort();
    return {
      sourceId,
      worktreeId: worktree.id,
      branchRef: worktree.branchRef,
      path: entry.path,
      originalPath: entry.originalPath,
      status: entry.status,
      sha256: entry.sha256,
      classification: classifyWorktreeEntry({
        worktree,
        entry,
        duplicate: {
          count: aliases.length,
          canonicalSourceId: aliases[0] ?? null,
        },
      }),
    };
  }).sort((a, b) => a.sourceId.localeCompare(b.sourceId));

  const capturedAt = [refSnapshot.capturedAt, worktreeSnapshot.capturedAt]
    .sort().at(-1);
  const ledger = {
    schemaVersion: "ext-full-value-semantic-ledger.v2",
    capturedAt,
    target: { ...refSnapshot.target },
    nonAuthorizing: true,
    authorityDecision: "STOP",
    semanticCoverageStatus: "REVIEW_REQUIRED",
    sourceSnapshots: {
      refCapturedAt: refSnapshot.capturedAt,
      worktreeCapturedAt: worktreeSnapshot.capturedAt,
      legacy99SnapshotHead: legacyLedger.snapshot?.targetHead ?? null,
      capabilityInventoryGeneratedAt: capabilityInventory.generatedAt ?? null,
    },
    newCapabilityCandidates: NEW_CAPABILITY_CANDIDATES.map((candidate) => ({ ...candidate })),
    refTreeGroups,
    worktreeEntries,
    unavailableWorktrees: (worktreeSnapshot.worktrees ?? []).filter(
      (worktree) => worktree.state === "UNAVAILABLE",
    ).map((worktree) => ({
      id: worktree.id,
      branchRef: worktree.branchRef,
      registeredHead: worktree.registeredHead,
      tree: worktree.tree,
      pathResolution: worktree.pathResolution,
      observationNote: worktree.observationNote,
      semanticStatus: "BLOCKED_SOURCE_UNAVAILABLE",
    })),
    summary: null,
  };
  ledger.summary = deriveSemanticSummary(ledger);
  return ledger;
}

function jsonEquals(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateSemanticLedger(ledger, frozenInputs = null) {
  const errors = [];
  if (ledger?.schemaVersion !== "ext-full-value-semantic-ledger.v2") {
    errors.push("semantic ledger schemaVersion is invalid");
    return errors;
  }
  if (ledger.nonAuthorizing !== true || ledger.authorityDecision !== "STOP") {
    errors.push("semantic ledger must remain non-authorizing and STOP");
  }
  if (ledger.semanticCoverageStatus !== "REVIEW_REQUIRED") {
    errors.push("semantic coverage must remain REVIEW_REQUIRED before owner confirmation");
  }
  if (!Array.isArray(ledger.newCapabilityCandidates)) {
    errors.push("semantic candidate capabilities must be an array");
  }
  if (!Array.isArray(ledger.refTreeGroups)
      || !Array.isArray(ledger.worktreeEntries)
      || !Array.isArray(ledger.unavailableWorktrees)) {
    errors.push("semantic ledger detail arrays are invalid");
    return errors;
  }
  if (new Set(ledger.refTreeGroups.map((group) => group.tree)).size
      !== ledger.refTreeGroups.length) {
    errors.push("semantic ledger contains duplicate ref trees");
  }
  if (new Set(ledger.worktreeEntries.map((entry) => entry.sourceId)).size
      !== ledger.worktreeEntries.length) {
    errors.push("semantic ledger contains duplicate worktree source ids");
  }
  const worktreeSourcesByHash = new Map();
  for (const entry of ledger.worktreeEntries) {
    if (entry.sha256 === null) continue;
    if (!worktreeSourcesByHash.has(entry.sha256)) worktreeSourcesByHash.set(entry.sha256, []);
    worktreeSourcesByHash.get(entry.sha256).push(entry.sourceId);
  }
  for (const entry of ledger.worktreeEntries) {
    const sources = entry.sha256 === null
      ? []
      : [...worktreeSourcesByHash.get(entry.sha256)].sort();
    if (entry.classification?.technicalDuplicateCount !== sources.length
        || entry.classification?.canonicalContentSourceId !== (sources[0] ?? null)) {
      errors.push(`semantic duplicate facts drift for ${entry.sourceId}`);
    }
  }
  const allClassifications = [
    ...ledger.refTreeGroups.map((group) => group.classification),
    ...ledger.worktreeEntries.map((entry) => entry.classification),
  ];
  for (const [index, classification] of allClassifications.entries()) {
    if (!classification || classification.semanticStatus !== "REVIEW_REQUIRED") {
      errors.push(`semantic classification ${index} has an invalid status`);
      if (classification?.semanticStatus === "CONFIRMED") {
        errors.push("semantic CONFIRMED is forbidden until an owner receipt schema exists");
      }
    }
    if (!ALLOWED_DISPOSITIONS.has(classification?.proposedDisposition)) {
      errors.push(`semantic classification ${index} has an invalid disposition`);
    }
    if (classification?.nonAuthorizing !== true) {
      errors.push(`semantic classification ${index} must be non-authorizing`);
    }
  }
  const canonicalCapabilityIds = new Set(
    (frozenInputs?.capabilityInventory?.islands ?? []).map((island) => island.id),
  );
  const candidateIds = new Set();
  for (const [index, candidate] of (ledger.newCapabilityCandidates ?? []).entries()) {
    if (!hasExactKeys(candidate, CANDIDATE_KEYS)
        || !CAPABILITY_ID.test(candidate.id ?? "")
        || typeof candidate.name !== "string" || candidate.name.trim() === ""
        || typeof candidate.reason !== "string" || candidate.reason.trim() === ""
        || !ALLOWED_DISPOSITIONS.has(candidate.defaultDisposition)) {
      errors.push(`semantic candidate capability ${index} has an invalid schema`);
      continue;
    }
    if (candidateIds.has(candidate.id) || canonicalCapabilityIds.has(candidate.id)) {
      errors.push(`semantic candidate capability id collides: ${candidate.id}`);
    }
    candidateIds.add(candidate.id);
  }
  const knownCapabilityIds = new Set([...canonicalCapabilityIds, ...candidateIds]);
  for (const [index, classification] of allClassifications.entries()) {
    if (!Array.isArray(classification?.capabilityIds)
        || new Set(classification.capabilityIds).size !== classification.capabilityIds.length
        || classification.capabilityIds.some((id) => !knownCapabilityIds.has(id))) {
      errors.push(`semantic classification ${index} has invalid capability ids`);
    }
  }
  const derived = deriveSemanticSummary(ledger);
  if (!jsonEquals(ledger.summary, derived)) {
    errors.push("semantic ledger summary does not match detail");
  }
  if (frozenInputs === null) {
    errors.push("semantic validation requires frozen source inputs");
  } else {
    const expected = buildSemanticLedger(frozenInputs);
    if (!jsonEquals(ledger, expected)) {
      errors.push("semantic ledger does not match frozen source inputs");
    }
  }
  return errors;
}

function loadInputs(root) {
  const read = (path) => parseJsonNoDuplicateKeys(
    readFileSync(resolve(root, path), "utf8"),
  );
  return {
    refSnapshot: read("docs/migrations/2026-08-20-ext-source-ref-snapshot.json"),
    worktreeSnapshot: read(
      "docs/migrations/2026-08-20-ext-uncommitted-source-snapshot.json",
    ),
    legacyLedger: read("docs/migrations/2026-08-03-ext-legacy-99-ref-ledger.v1.json"),
    capabilityInventory: read(
      "docs/migrations/2026-08-14-capability-island-inventory.json",
    ),
  };
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function runSemanticCli(argv, root = defaultRoot) {
  if (argv.length === 1 && argv[0] === "--observe") {
    print(buildSemanticLedger(loadInputs(root)));
    return 0;
  }
  if (argv.length === 1 && ["--check", "--summary"].includes(argv[0])) {
    const ledger = parseJsonNoDuplicateKeys(
      readFileSync(resolve(root, SEMANTIC_LEDGER_PATH), "utf8"),
    );
    const errors = validateSemanticLedger(ledger, loadInputs(root));
    print({
      schemaVersion: "ext-full-value-semantic-result.v2",
      command: argv[0].slice(2),
      decision: errors.length === 0 ? "PASS" : "STOP",
      nonAuthorizing: true,
      errors,
      summary: ledger.summary,
    });
    return errors.length === 0 ? 0 : 2;
  }
  process.stderr.write([
    "Usage:",
    "  node scripts/ext-full-value-semantics.mjs --observe",
    "  node scripts/ext-full-value-semantics.mjs --check",
    "  node scripts/ext-full-value-semantics.mjs --summary",
  ].join("\n") + "\n");
  return 64;
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  try {
    process.exitCode = runSemanticCli(process.argv.slice(2));
  } catch (error) {
    print({
      schemaVersion: "ext-full-value-semantic-result.v2",
      decision: "STOP",
      nonAuthorizing: true,
      errors: [error.message],
    });
    process.exitCode = 2;
  }
}

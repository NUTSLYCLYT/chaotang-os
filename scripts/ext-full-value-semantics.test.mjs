import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildCanonicalRefGroups,
  buildSemanticLedger,
  classifyRefGroup,
  classifyWorktreeEntry,
  runSemanticCli,
  SEMANTIC_LEDGER_PATH,
  validateSemanticLedger,
} from "./ext-full-value-semantics.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function load(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function semanticInputs() {
  return {
    refSnapshot: load("docs/migrations/2026-08-20-ext-source-ref-snapshot.json"),
    worktreeSnapshot: load(
      "docs/migrations/2026-08-20-ext-uncommitted-source-snapshot.json",
    ),
    legacyLedger: load("docs/migrations/2026-08-03-ext-legacy-99-ref-ledger.v1.json"),
    capabilityInventory: load(
      "docs/migrations/2026-08-14-capability-island-inventory.json",
    ),
  };
}

test("canonical ref groups collapse aliases by tree without dropping review refs", () => {
  const groups = buildCanonicalRefGroups({
    refs: [
      {
        refname: "refs/heads/a",
        tree: "a".repeat(40),
        commitTip: "1".repeat(40),
        canonicalTreeRef: "refs/heads/a",
        grade: "UNIQUE_TREE_REVIEW_REQUIRED",
        legacy99TipState: "NOT_LISTED",
      },
      {
        refname: "refs/remotes/origin/a",
        tree: "a".repeat(40),
        commitTip: "1".repeat(40),
        canonicalTreeRef: "refs/heads/a",
        grade: "DUPLICATE_TIP_REVIEW_REQUIRED",
        legacy99TipState: "NOT_LISTED",
      },
      {
        refname: "refs/heads/contained",
        tree: "b".repeat(40),
        commitTip: "2".repeat(40),
        canonicalTreeRef: "refs/heads/contained",
        grade: "TARGET_CONTAINED",
        legacy99TipState: "NOT_LISTED",
      },
    ],
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].canonicalRef, "refs/heads/a");
  assert.deepEqual(groups[0].aliases, ["refs/heads/a", "refs/remotes/origin/a"]);
});

test("legacy 99 evidence remains visible and never becomes confirmed automatically", () => {
  const classification = classifyRefGroup({
    canonicalRef: "refs/heads/task/fix-gongbu-battery-safety-p17-20260719",
    aliases: ["refs/heads/task/fix-gongbu-battery-safety-p17-20260719"],
    legacyBranches: [{
      branch: "task/fix-gongbu-battery-safety-p17-20260719",
      assetFamily: "GONGBU_SCOPE_SAFETY",
      disposition: "SUPERSEDED_VERIFY",
    }],
    capabilityIds: ["battery-physical-safety-gate"],
  });

  assert.deepEqual(classification.capabilityIds, ["battery-physical-safety-gate"]);
  assert.equal(classification.proposedDisposition, "SUPERSEDED_VERIFY");
  assert.equal(classification.semanticStatus, "REVIEW_REQUIRED");
  assert.ok(classification.ruleIds.includes("legacy-99-exact-branch"));
});

test("clear product and governance names receive different asset classes", () => {
  const professional = classifyRefGroup({
    canonicalRef: "refs/heads/codex/professional-agent-overlay-clean",
    aliases: ["refs/heads/codex/professional-agent-overlay-clean"],
    legacyBranches: [],
    capabilityIds: ["professional-agent-overlay"],
  });
  const governance = classifyRefGroup({
    canonicalRef: "refs/heads/governance/r0-w06-integrity-preseal-20260815",
    aliases: ["refs/heads/governance/r0-w06-integrity-preseal-20260815"],
    legacyBranches: [],
    capabilityIds: [],
  });

  assert.equal(professional.assetClass, "PRODUCT_OR_CONTRACT_CAPABILITY");
  assert.deepEqual(professional.capabilityIds, ["professional-agent-overlay"]);
  assert.equal(governance.assetClass, "GOVERNANCE_AUTHORITY_EVIDENCE");
  assert.deepEqual(governance.capabilityIds, []);
  assert.equal(governance.proposedDisposition, "SUPERSEDED_VERIFY");
});

test("worktree paths distinguish product, release, generated and unknown assets", () => {
  const worktree = { id: "wt", branchRef: "refs/heads/candidate" };
  assert.equal(classifyWorktreeEntry({
    worktree,
    entry: { path: "frontend/src/pages/Hubu.tsx", sha256: "a".repeat(64) },
    duplicate: { count: 1, canonicalSourceId: "wt:frontend/src/pages/Hubu.tsx" },
  }).assetClass, "PRODUCT_UI");
  assert.equal(classifyWorktreeEntry({
    worktree,
    entry: { path: "frontend/src/components/App.nodetest.ts", sha256: "9".repeat(64) },
    duplicate: {
      count: 1,
      canonicalSourceId: "wt:frontend/src/components/App.nodetest.ts",
    },
  }).assetClass, "TEST_OR_EVALUATION_EVIDENCE");
  assert.equal(classifyWorktreeEntry({
    worktree,
    entry: { path: "deploy/Caddyfile", sha256: "b".repeat(64) },
    duplicate: { count: 1, canonicalSourceId: "wt:deploy/Caddyfile" },
  }).assetClass, "RELEASE_INFRASTRUCTURE");
  assert.equal(classifyWorktreeEntry({
    worktree,
    entry: { path: "output/run.json", sha256: "c".repeat(64) },
    duplicate: { count: 1, canonicalSourceId: "wt:output/run.json" },
  }).assetClass, "GENERATED_OUTPUT");
  assert.equal(classifyWorktreeEntry({
    worktree,
    entry: { path: "mystery.bin", sha256: "d".repeat(64) },
    duplicate: { count: 1, canonicalSourceId: "wt:mystery.bin" },
  }).assetClass, "UNSCOPED_WORKTREE_FILE");
});

test("duplicate worktree content records technical aliases without authorizing deletion", () => {
  const classification = classifyWorktreeEntry({
    worktree: { id: "wt-b", branchRef: "refs/heads/b" },
    entry: { path: "docs/same.md", sha256: "e".repeat(64) },
    duplicate: { count: 2, canonicalSourceId: "wt-a:docs/same.md" },
  });

  assert.equal(classification.technicalDuplicateCount, 2);
  assert.equal(classification.canonicalContentSourceId, "wt-a:docs/same.md");
  assert.equal(classification.semanticStatus, "REVIEW_REQUIRED");
  assert.notEqual(classification.proposedDisposition, "DUPLICATE");
});

test("large mixed worktrees do not leak branch-name capability labels into every path", () => {
  const classification = classifyWorktreeEntry({
    worktree: {
      id: "mixed",
      branchRef: "refs/heads/docs/r0-trusted-kernel-amendment-20260720",
      entryCount: 331,
    },
    entry: { path: "frontend/src/pages/Hubu.tsx", sha256: "f".repeat(64) },
    duplicate: { count: 1, canonicalSourceId: "mixed:frontend/src/pages/Hubu.tsx" },
  });

  assert.deepEqual(classification.capabilityIds, ["hubu-professional-accounting"]);
  assert.ok(!classification.capabilityIds.includes("dev-trusted-runtime-kernel"));
  assert.ok(classification.ruleIds.includes("large-worktree-path-only"));
});

test("artifact delivery paths form a distinct candidate without authorizing migration", () => {
  const classification = classifyWorktreeEntry({
    worktree: { id: "artifact", branchRef: "refs/heads/governance/r0-w06", entryCount: 27 },
    entry: {
      path: "backend/web/routers/artifacts.py",
      sha256: "1".repeat(64),
    },
    duplicate: { count: 2, canonicalSourceId: "artifact:backend/web/routers/artifacts.py" },
  });

  assert.deepEqual(classification.capabilityIds, ["trusted-artifact-delivery"]);
  assert.equal(classification.proposedDisposition, "BLOCKED_WIP");
});

test("frozen sources build a complete non-authorizing semantic ledger", () => {
  const inputs = semanticInputs();
  const ledger = buildSemanticLedger(inputs);

  assert.deepEqual(validateSemanticLedger(ledger, inputs), []);
  assert.equal(ledger.nonAuthorizing, true);
  assert.equal(ledger.summary.refTreeGroupCount, 189);
  assert.equal(ledger.summary.worktreeEntryCount, 567);
  assert.equal(ledger.summary.unavailableWorktreeCount, 1);
  assert.equal(ledger.summary.confirmedSemanticItemCount, 0);
  assert.equal(ledger.summary.reviewRequiredItemCount, 756);
  assert.equal(ledger.summary.unknownReviewRequiredCount, 0);
  assert.equal(ledger.refTreeGroups.length, 189);
  assert.equal(ledger.worktreeEntries.length, 567);
  assert.ok(ledger.refTreeGroups.every((entry) => entry.classification));
  assert.ok(ledger.worktreeEntries.every((entry) => entry.classification));
  assert.ok(ledger.newCapabilityCandidates.some(
    (candidate) => candidate.id === "trusted-artifact-delivery",
  ));
  assert.ok(ledger.refTreeGroups.every((group) => {
    const branches = group.classification.legacyEvidence.map((item) => item.branch);
    return new Set(branches).size === branches.length;
  }));

  const duplicateDrift = JSON.parse(JSON.stringify(ledger));
  const duplicateEntry = duplicateDrift.worktreeEntries.find(
    (entry) => entry.classification.technicalDuplicateCount > 1,
  );
  duplicateEntry.classification.technicalDuplicateCount += 1;
  assert.ok(validateSemanticLedger(duplicateDrift, inputs).some(
    (error) => error.includes("duplicate facts drift"),
  ));

  const unreceiptedConfirmation = JSON.parse(JSON.stringify(ledger));
  unreceiptedConfirmation.refTreeGroups[0].classification.semanticStatus = "CONFIRMED";
  unreceiptedConfirmation.summary.confirmedSemanticItemCount += 1;
  unreceiptedConfirmation.summary.reviewRequiredItemCount -= 1;
  assert.ok(validateSemanticLedger(unreceiptedConfirmation, inputs).some(
    (error) => error.includes("owner receipt schema exists"),
  ));

  const missingSource = JSON.parse(JSON.stringify(ledger));
  missingSource.refTreeGroups.pop();
  missingSource.summary.refTreeGroupCount -= 1;
  missingSource.summary.semanticItemCount -= 1;
  missingSource.summary.reviewRequiredItemCount -= 1;
  assert.ok(validateSemanticLedger(missingSource, inputs).some(
    (error) => error.includes("does not match frozen source inputs"),
  ));

  const classificationDrift = JSON.parse(JSON.stringify(ledger));
  classificationDrift.refTreeGroups[0].classification.capabilityIds = [
    "memorial-reply-visual-system",
  ];
  assert.ok(validateSemanticLedger(classificationDrift, inputs).some(
    (error) => error.includes("does not match frozen source inputs"),
  ));

  const candidateCollision = JSON.parse(JSON.stringify(ledger));
  candidateCollision.newCapabilityCandidates[1].id =
    candidateCollision.newCapabilityCandidates[0].id;
  assert.ok(validateSemanticLedger(candidateCollision, inputs).some(
    (error) => error.includes("candidate capability id"),
  ));
});

test("the frozen semantic ledger and its CLI remain deterministic and non-authorizing", () => {
  const inputs = semanticInputs();
  const ledger = load(SEMANTIC_LEDGER_PATH);
  assert.deepEqual(validateSemanticLedger(ledger, inputs), []);
  assert.equal(ledger.summary.semanticItemCount, 756);
  assert.equal(ledger.summary.newCapabilityCandidateCount, 7);
  let stdout = "";
  const originalWrite = process.stdout.write;
  process.stdout.write = (value) => { stdout += value; return true; };
  try {
    assert.equal(runSemanticCli(["--check"], root), 0);
  } finally {
    process.stdout.write = originalWrite;
  }
  const result = JSON.parse(stdout);
  assert.equal(result.decision, "PASS");
  assert.equal(result.nonAuthorizing, true);
});

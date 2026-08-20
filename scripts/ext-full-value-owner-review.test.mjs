import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildOwnerReviewProposal,
  OWNER_RECEIPT_PATH,
  OWNER_REVIEW_PATH,
  parseOwnerJsonStrict,
  resolveLiveGiteeExtDevHeadWithExecutor,
  runOwnerReviewCli,
  validateOwnerReceipt,
  validateOwnerReceiptWithTestRemoteHead,
  validateOwnerReviewProposal,
} from "./ext-full-value-owner-review.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const runGitTests = process.env.EXT_OWNER_RECEIPT_GIT_TESTS === "1";

function load(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function inputs() {
  return {
    semanticLedger: load(
      "docs/migrations/2026-08-20-ext-full-value-semantic-ledger.v2.json",
    ),
    convergenceManifest: load(
      "docs/migrations/2026-08-20-ext-full-value-convergence.v2.json",
    ),
    capabilityInventory: load(
      "docs/migrations/2026-08-14-capability-island-inventory.json",
    ),
    externalSourceSnapshot: load(
      "docs/migrations/2026-08-20-ext-external-capability-source-snapshot.v1.json",
    ),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function git(cwd, args) {
  return execFileSync("/usr/bin/git", args, {
    cwd,
    encoding: "utf8",
    env: { PATH: "/usr/bin:/bin", GIT_CONFIG_NOSYSTEM: "1" },
  }).trim();
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function makeReceiptRepository(sourceInputs, proposal) {
  const tempRoot = mkdtempSync(join("/tmp", "ext-owner-receipt-"));
  const remoteRoot = mkdtempSync(join("/tmp", "ext-owner-remote-"));
  git(remoteRoot, ["init", "--bare"]);
  git(tempRoot, ["init", "-b", "ext-dev"]);
  git(tempRoot, ["config", "user.name", "Repository Owner"]);
  git(tempRoot, ["config", "user.email", "owner@example.invalid"]);
  git(tempRoot, ["remote", "add", "origin", "https://gitee.com/msxn/chaotang-os.git"]);
  git(tempRoot, [
    "config",
    `url.file://${remoteRoot}.insteadOf`,
    "https://gitee.com/msxn/chaotang-os.git",
  ]);
  const paths = new Set([
    ...sourceInputs.convergenceManifest.sourceCatalogs.map((catalog) => catalog.path),
    "docs/migrations/2026-08-20-ext-full-value-convergence.v2.json",
    OWNER_REVIEW_PATH,
  ]);
  for (const path of paths) {
    mkdirSync(dirname(resolve(tempRoot, path)), { recursive: true });
    copyFileSync(resolve(root, path), resolve(tempRoot, path));
  }
  git(tempRoot, ["add", "."]);
  git(tempRoot, ["commit", "-m", "chore: freeze owner review proposal"]);
  const proposalCommit = git(tempRoot, ["rev-parse", "HEAD"]);
  const proposalTree = git(tempRoot, ["rev-parse", "HEAD^{tree}"]);
  const proposalBlob = git(tempRoot, ["rev-parse", `HEAD:${OWNER_REVIEW_PATH}`]);
  const proposalBytes = readFileSync(resolve(tempRoot, OWNER_REVIEW_PATH));
  const receipt = {
    schemaVersion: "ext-full-value-owner-receipt.v2",
    receiptId: "EXT-FULL-VALUE-CONVERGENCE-V2-OWNER-20260820",
    proposalDigest: proposal.proposalDigest,
    proposalArtifact: {
      targetRef: "origin/ext-dev",
      proposalPath: OWNER_REVIEW_PATH,
      receiptPath: OWNER_RECEIPT_PATH,
      proposalCommit,
      proposalTree,
      proposalBlob,
      proposalFileSha256: sha256(proposalBytes),
    },
    confirmingAuthority: "REPOSITORY_OWNER_VIA_TARGET_HEAD",
    decision: "CONFIRM_SEMANTIC_LIST_AS_PROPOSED",
    confirmationScope: "SEMANTIC_LIST_ONLY",
    unavailableSourceDecisions: [{
      reviewUnitId: proposal.reviewUnits.find(
        (unit) => unit.sourceType === "UNAVAILABLE_WORKTREE",
      ).reviewUnitId,
      decision: "KEEP_BLOCKED",
      evidenceRefs: [],
      reason: "The missing worktree remains blocked and is not treated as inspected content.",
    }],
    overrides: [],
    confirmedReviewUnitCount: proposal.summary.semanticReviewUnitCount,
    ownerStatement: "Confirm the semantic list with the unavailable source still blocked; no Packet is authorized.",
    issuedAt: new Date().toISOString(),
    nonAuthorizing: true,
    productAuthorityGranted: false,
    packetMigrationAuthorized: false,
    state: "OWNER_CONFIRMED_LIST_WITH_BLOCKED_SOURCE",
  };
  mkdirSync(dirname(resolve(tempRoot, OWNER_RECEIPT_PATH)), { recursive: true });
  writeFileSync(resolve(tempRoot, OWNER_RECEIPT_PATH), `${JSON.stringify(receipt, null, 2)}\n`);
  git(tempRoot, ["add", OWNER_RECEIPT_PATH]);
  git(tempRoot, ["commit", "-m", "chore: record owner semantic-list receipt"]);
  git(tempRoot, ["push", "origin", "HEAD:refs/heads/ext-dev"]);
  return { tempRoot, remoteRoot, receipt };
}

test("owner review proposal partitions every semantic item and unavailable source once", () => {
  const sourceInputs = inputs();
  const proposal = buildOwnerReviewProposal(sourceInputs);

  assert.deepEqual(validateOwnerReviewProposal(proposal, sourceInputs), []);
  assert.equal(proposal.nonAuthorizing, true);
  assert.equal(proposal.status, "PENDING_OWNER_CONFIRMATION");
  assert.equal(proposal.ownerReceipt, null);
  assert.equal(proposal.summary.semanticReviewUnitCount, 823);
  assert.equal(proposal.summary.unavailableSourceReviewUnitCount, 1);
  assert.equal(proposal.summary.totalReviewUnitCount, 824);
  assert.equal(proposal.summary.confirmedReviewUnitCount, 0);
  assert.equal(proposal.summary.pendingReviewUnitCount, 824);
  assert.equal(proposal.summary.sourceMappedCapabilityCount, 32);
  assert.equal(proposal.summary.blockedSourceCapabilityCount, 6);
  assert.equal(proposal.summary.inventoryOnlyCapabilityCount, 0);
  assert.ok(proposal.capabilityReviewIndex.every((capability) => (
    capability.packetIds.length === 0
      || capability.recommendedDisposition === capability.packetRecommendedDisposition
  )));
  assert.ok(proposal.packetReviewIndex.every(
    (packet) => packet.acknowledgement === "INFORMATIONAL_ONLY_NOT_CONFIRMED",
  ));

  const unitIds = proposal.reviewUnits.map((unit) => unit.reviewUnitId);
  assert.equal(new Set(unitIds).size, 824);
  const batchedIds = proposal.reviewBatches.flatMap((batch) => batch.reviewUnitIds);
  assert.equal(batchedIds.length, 824);
  assert.deepEqual([...batchedIds].sort(), [...unitIds].sort());
  assert.equal(
    proposal.receiptContract.confirmingAuthority,
    "REPOSITORY_OWNER_VIA_TARGET_HEAD",
  );
  assert.equal(proposal.receiptContract.requiredProposalDigest, proposal.proposalDigest);
});

test("owner review proposal fails closed on omissions, double assignment and fake confirmation", () => {
  const sourceInputs = inputs();
  const proposal = buildOwnerReviewProposal(sourceInputs);

  const omitted = clone(proposal);
  omitted.reviewUnits.pop();
  omitted.summary.totalReviewUnitCount -= 1;
  omitted.summary.pendingReviewUnitCount -= 1;
  assert.ok(validateOwnerReviewProposal(omitted, sourceInputs).some(
    (error) => error.includes("does not match frozen inputs"),
  ));

  const doubleAssigned = clone(proposal);
  doubleAssigned.reviewBatches[1].reviewUnitIds.push(
    doubleAssigned.reviewBatches[0].reviewUnitIds[0],
  );
  doubleAssigned.reviewBatches[1].reviewUnitCount += 1;
  assert.ok(validateOwnerReviewProposal(doubleAssigned, sourceInputs).some(
    (error) => error.includes("exactly one review batch"),
  ));

  const fakeConfirmation = clone(proposal);
  fakeConfirmation.status = "OWNER_CONFIRMED";
  fakeConfirmation.summary.confirmedReviewUnitCount = 824;
  fakeConfirmation.summary.pendingReviewUnitCount = 0;
  assert.ok(validateOwnerReviewProposal(fakeConfirmation, sourceInputs).some(
    (error) => error.includes("must remain pending without an owner receipt"),
  ));
});

test("the frozen owner review proposal and CLI remain deterministic and non-authorizing", () => {
  const sourceInputs = inputs();
  const proposal = load(OWNER_REVIEW_PATH);
  assert.deepEqual(validateOwnerReviewProposal(proposal, sourceInputs), []);

  let stdout = "";
  const originalWrite = process.stdout.write;
  process.stdout.write = (value) => { stdout += value; return true; };
  try {
    assert.equal(runOwnerReviewCli(["--check"], root), 0);
  } finally {
    process.stdout.write = originalWrite;
  }
  const result = JSON.parse(stdout);
  assert.equal(result.decision, "PASS");
  assert.equal(result.nonAuthorizing, true);
  assert.equal(result.summary.totalReviewUnitCount, 824);
});

test("owner receipt v2 requires frozen inputs and exact target-head Git evidence", {
  skip: !runGitTests,
}, () => {
  const sourceInputs = inputs();
  const proposal = buildOwnerReviewProposal(sourceInputs);
  const { tempRoot, remoteRoot, receipt } = makeReceiptRepository(sourceInputs, proposal);
  try {
    const remoteHeadResolver = () => git(remoteRoot, ["rev-parse", "refs/heads/ext-dev"]);
    assert.deepEqual(validateOwnerReceiptWithTestRemoteHead(
      receipt,
      proposal,
      sourceInputs,
      tempRoot,
      remoteHeadResolver,
    ), []);
    const monitorMarker = resolve(remoteRoot, "fsmonitor-executed");
    const monitorScript = resolve(remoteRoot, "malicious-fsmonitor.sh");
    writeFileSync(monitorScript, `#!/bin/sh\ntouch '${monitorMarker}'\nexit 0\n`);
    chmodSync(monitorScript, 0o755);
    git(tempRoot, ["config", "core.fsmonitor", monitorScript]);
    assert.deepEqual(validateOwnerReceiptWithTestRemoteHead(
      receipt,
      proposal,
      sourceInputs,
      tempRoot,
      remoteHeadResolver,
    ), []);
    assert.equal(existsSync(monitorMarker), false);
    assert.ok(validateOwnerReceipt(receipt, proposal).some(
      (error) => error.includes("requires frozen proposal inputs"),
    ));

    const wrongDigest = clone(receipt);
    wrongDigest.proposalDigest = "sha256:" + "0".repeat(64);
    assert.ok(validateOwnerReceiptWithTestRemoteHead(
      wrongDigest, proposal, sourceInputs, tempRoot, remoteHeadResolver,
    ).some(
      (error) => error.includes("proposal digest"),
    ));

    const fakeAuthority = clone(receipt);
    fakeAuthority.confirmingAuthority = "REPOSITORY_OWNER";
    assert.ok(validateOwnerReceiptWithTestRemoteHead(
      fakeAuthority, proposal, sourceInputs, tempRoot, remoteHeadResolver,
    ).some(
      (error) => error.includes("confirming authority"),
    ));

    const fakeProductAuthority = clone(receipt);
    fakeProductAuthority.productAuthorityGranted = true;
    assert.ok(validateOwnerReceiptWithTestRemoteHead(
      fakeProductAuthority, proposal, sourceInputs, tempRoot, remoteHeadResolver,
    ).some(
      (error) => error.includes("must not grant product or Packet authority"),
    ));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  }
});

test("unavailable sources cannot be excluded without evidence or changed by generic override", {
  skip: !runGitTests,
}, () => {
  const sourceInputs = inputs();
  const proposal = buildOwnerReviewProposal(sourceInputs);
  const { tempRoot, remoteRoot, receipt } = makeReceiptRepository(sourceInputs, proposal);
  try {
    const remoteHeadResolver = () => git(remoteRoot, ["rev-parse", "refs/heads/ext-dev"]);
    const noEvidence = clone(receipt);
    noEvidence.unavailableSourceDecisions[0].decision = "EXCLUDE_WITH_EVIDENCE";
    assert.ok(validateOwnerReceiptWithTestRemoteHead(
      noEvidence, proposal, sourceInputs, tempRoot, remoteHeadResolver,
    ).some(
      (error) => error.includes("requires evidence"),
    ));

    const contradictoryOverride = clone(receipt);
    contradictoryOverride.decision = "CONFIRM_SEMANTIC_LIST_WITH_EXPLICIT_OVERRIDES";
    contradictoryOverride.overrides = [{
      reviewUnitId: receipt.unavailableSourceDecisions[0].reviewUnitId,
      disposition: "ABSORB_ADAPT",
      reason: "Attempt to absorb an unavailable source is forbidden.",
    }];
    assert.ok(validateOwnerReceiptWithTestRemoteHead(
      contradictoryOverride,
      proposal,
      sourceInputs,
      tempRoot,
      remoteHeadResolver,
    ).some((error) => error.includes("override 0 is invalid")));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  }
});

test("owner JSON rejects duplicate keys before receipt validation", () => {
  assert.throws(
    () => parseOwnerJsonStrict('{"decision":"a","decision":"b"}'),
    /duplicate/iu,
  );
});

test("production remote-head resolver is fixed to isolated Gitee SSH", () => {
  let invocation;
  const head = resolveLiveGiteeExtDevHeadWithExecutor((executable, args, options) => {
    invocation = { executable, args, options };
    return `${"8b548215518c2bf0eebbf53d0c087902715c4aa4"}\trefs/heads/ext-dev\n`;
  });
  assert.equal(head, "8b548215518c2bf0eebbf53d0c087902715c4aa4");
  assert.equal(invocation.executable, "/usr/bin/git");
  assert.ok(invocation.args.includes("git@gitee.com:msxn/chaotang-os.git"));
  assert.equal(invocation.args.some((arg) => arg.startsWith("https://")), false);
  assert.ok(invocation.args.some((arg) => arg.includes("-F /dev/null")));
  assert.ok(invocation.args.some((arg) => arg.includes("StrictHostKeyChecking=yes")));
  assert.equal(invocation.options.cwd, "/tmp");
  assert.equal(invocation.options.env.GIT_CONFIG_GLOBAL, "/dev/null");
  assert.equal(invocation.options.env.GIT_CONFIG_SYSTEM, "/dev/null");
});

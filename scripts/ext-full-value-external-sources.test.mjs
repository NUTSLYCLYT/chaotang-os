import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXTERNAL_SOURCE_PATH,
  hashDirectoryForTest,
  observeExternalSources,
  observeFilesystemPathForTest,
  validateExternalSourceSnapshot,
} from "./ext-full-value-external-sources.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const runLive = process.env.EXT_EXTERNAL_SOURCE_LIVE_TESTS === "1";

function load() {
  return JSON.parse(readFileSync(resolve(root, EXTERNAL_SOURCE_PATH), "utf8"));
}

function frozenInputs() {
  const bytes = readFileSync(resolve(
    root,
    "docs/migrations/2026-08-14-capability-island-inventory.json",
  ));
  return {
    capabilityInventory: JSON.parse(bytes.toString("utf8")),
    inventoryFileSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("external capability source snapshot covers every inventory declaration", () => {
  const snapshot = load();
  assert.deepEqual(validateExternalSourceSnapshot(snapshot, frozenInputs()), []);
  assert.equal(snapshot.summary.declaredSourceCount, 67);
  assert.equal(snapshot.summary.capabilityCount, 31);
  assert.equal(snapshot.summary.canonicalDonorEligibleCount, 44);
  assert.equal(snapshot.summary.blockedSourceCount, 21);
  assert.equal(new Set(snapshot.sources.map((source) => source.sourceId)).size, 67);
  assert.ok(snapshot.sources.every((source) => source.nonAuthorizing === true));
});

test("external capability source snapshot fails closed on duplicated ids and summary drift", () => {
  const duplicated = clone(load());
  duplicated.sources[1].sourceId = duplicated.sources[0].sourceId;
  assert.ok(validateExternalSourceSnapshot(duplicated, frozenInputs()).some(
    (error) => error.includes("duplicated"),
  ));

  const summaryDrift = clone(load());
  summaryDrift.summary.blockedSourceCount -= 1;
  assert.ok(validateExternalSourceSnapshot(summaryDrift, frozenInputs()).some(
    (error) => error.includes("summary"),
  ));

  const authorizing = clone(load());
  authorizing.authorityDecision = "GO";
  assert.ok(validateExternalSourceSnapshot(authorizing, frozenInputs()).some(
    (error) => error.includes("non-authorizing"),
  ));

  const deleted = clone(load());
  deleted.sources.pop();
  deleted.summary.declaredSourceCount -= 1;
  assert.ok(validateExternalSourceSnapshot(deleted, frozenInputs()).some(
    (error) => error.includes("frozen capability inventory"),
  ));

  const fakeSensitiveDonor = clone(load());
  const sensitive = fakeSensitiveDonor.sources.find(
    (source) => source.privacyMode === "SENSITIVE_COUNTS_ONLY",
  );
  sensitive.state = "FROZEN";
  sensitive.canonicalDonorEligible = true;
  sensitive.blockedReason = null;
  fakeSensitiveDonor.summary.canonicalDonorEligibleCount += 1;
  fakeSensitiveDonor.summary.blockedSourceCount -= 1;
  fakeSensitiveDonor.summary.byState.BLOCKED_REVIEW_REQUIRED -= 1;
  fakeSensitiveDonor.summary.byState.FROZEN += 1;
  assert.ok(validateExternalSourceSnapshot(fakeSensitiveDonor, frozenInputs()).some(
    (error) => error.includes("sensitive-source privacy boundary"),
  ));

  const targetDrift = clone(load());
  targetDrift.targetRef = "origin/not-ext-dev";
  assert.ok(validateExternalSourceSnapshot(targetDrift, frozenInputs()).some(
    (error) => error.includes("targetRef"),
  ));
});

test("directory hashing fails closed on symlinks and oversized files", () => {
  const tempRoot = mkdtempSync(join("/tmp", "ext-external-hash-"));
  try {
    mkdirSync(resolve(tempRoot, "links"));
    symlinkSync("../target", resolve(tempRoot, "links", "escape"));
    assert.throws(
      () => hashDirectoryForTest(resolve(tempRoot, "links")),
      /SYMLINK_REQUIRES_REVIEW/u,
    );
    mkdirSync(resolve(tempRoot, "large"));
    const oversizedPath = resolve(tempRoot, "large", "oversized.bin");
    writeFileSync(oversizedPath, "");
    truncateSync(oversizedPath, 32 * 1024 * 1024 + 1);
    assert.throws(
      () => hashDirectoryForTest(resolve(tempRoot, "large")),
      /FILE_BUDGET_EXCEEDED/u,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("directory selectors exclude sibling files and require a real match", () => {
  const tempRoot = mkdtempSync(join("/tmp", "ext-external-selector-"));
  try {
    const selected = resolve(tempRoot, "useful-perspective");
    mkdirSync(selected);
    writeFileSync(resolve(selected, "skill.md"), "selected\n");
    writeFileSync(resolve(tempRoot, "root-secret.txt"), "outside-v1\n");
    const first = hashDirectoryForTest(tempRoot, "C:/skills/*-perspective");
    writeFileSync(resolve(tempRoot, "root-secret.txt"), "outside-v2\n");
    const second = hashDirectoryForTest(tempRoot, "C:/skills/*-perspective");
    assert.deepEqual(first, second);
    assert.equal(first.directoryFileCount, 1);
    assert.equal(first.matchedPathCount, 1);
    assert.equal(first.selectorState, "MATCHED");

    const noMatch = resolve(tempRoot, "no-match");
    mkdirSync(noMatch);
    writeFileSync(resolve(noMatch, "ordinary.txt"), "ordinary\n");
    assert.throws(
      () => hashDirectoryForTest(noMatch, "C:/skills/*-perspective"),
      /DIRECTORY_SELECTOR_NO_MATCH/u,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("directory observation budgets empty entries and rejects a symlink root", () => {
  const tempRoot = mkdtempSync(join("/tmp", "ext-external-entries-"));
  try {
    const many = resolve(tempRoot, "many");
    mkdirSync(many);
    for (let index = 0; index <= 10_000; index += 1) {
      mkdirSync(resolve(many, `entry-${String(index).padStart(5, "0")}`));
    }
    assert.throws(
      () => hashDirectoryForTest(many),
      /DIRECTORY_ENTRY_BUDGET_EXCEEDED/u,
    );

    const target = resolve(tempRoot, "target");
    const link = resolve(tempRoot, "root-link");
    mkdirSync(target);
    symlinkSync(target, link);
    const observation = observeFilesystemPathForTest({
      path: link,
      expectedPin: null,
      selector: null,
    });
    assert.equal(observation.state, "BLOCKED_REVIEW_REQUIRED");
    assert.equal(observation.canonicalDonorEligible, false);
    assert.equal(observation.blockedReason, "SOURCE_ROOT_SYMLINK_REQUIRES_REVIEW");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("live external metadata matches the frozen snapshot", { skip: !runLive }, () => {
  const frozen = load();
  const live = observeExternalSources(root);
  frozen.capturedAt = null;
  live.capturedAt = null;
  assert.deepEqual(live, frozen);
});

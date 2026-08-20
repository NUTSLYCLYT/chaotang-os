import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ALLOWED_DISPOSITIONS,
  loadCapabilities,
  loadManifest,
  MANIFEST_PATH,
  listUnresolvedSources,
  observeRefs,
  observeWorktrees,
  parsePorcelainV1Z,
  parseWorktreeListPorcelainZ,
  resolveWorktreeGitDir,
  resolveWorktreeObservationPath,
  resolveCatalogPath,
  runCli,
  selectCatalog,
  summarize,
  validateRefSnapshot,
  validateManifest,
  validateWorktreeRefLinks,
  validateWorktreeSnapshot,
  worktreeIdentityMatches,
} from "./ext-full-value-convergence.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = dirname(scriptDir);
const manifestPath = resolve(
  root,
  "docs/migrations/2026-08-20-ext-full-value-convergence.v2.json",
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function run(args) {
  let stdout = "";
  let stderr = "";
  const status = runCli(args, root, {
    stdout: { write: (value) => { stdout += value; } },
    stderr: { write: (value) => { stderr += value; } },
  });
  return { status, stdout, stderr };
}

test("the frozen V2 manifest is fail-closed and non-authorizing", () => {
  const manifest = loadManifest(root);
  assert.deepEqual(validateManifest(manifest, root), []);
  assert.deepEqual(manifest.policy.allowedDispositions, ALLOWED_DISPOSITIONS);
  assert.equal(manifest.snapshot.authorityDecision, "STOP");
  assert.equal(manifest.snapshot.authorityCanExecuteProductWork, false);
  assert.equal(manifest.capabilityIndex.semanticCoverageStatus, "REVIEW_REQUIRED");
  assert.equal(manifest.capabilityIndex.unresolvedRefTreeCount, 189);
  assert.equal(manifest.capabilityIndex.unresolvedWorktreeEntryCount, 567);
  assert.equal(manifest.capabilityIndex.unavailableWorktreeCount, 1);
  assert.equal(manifest.capabilityIndex.migrationAuthorizedCount, 0);
  assert.equal(manifest.sourceCatalogs.length, 12);
  assert.equal(manifest.sourceCatalogs.filter(
    (catalog) => catalog.status === "FROZEN_REVIEW_REQUIRED",
  ).length, 3);
  assert.equal(manifest.sourceCatalogs.filter(
    (catalog) => catalog.status === "BLOCKED_UNCOMMITTED",
  ).length, 1);
});

test("catalog hashes, counts and deduplication facts fail closed on drift", () => {
  const hashDrift = clone(loadManifest(root));
  hashDrift.sourceCatalogs[0].sha256 = "0".repeat(64);
  assert.ok(validateManifest(hashDrift, root).some((error) => error.includes("sha256 drift")));

  const countDrift = clone(loadManifest(root));
  countDrift.sourceCatalogs[4].classifiedItemCount -= 1;
  assert.ok(validateManifest(countDrift, root).some(
    (error) => error.includes("classifiedItemCount does not match"),
  ));

  const duplicate = clone(loadManifest(root));
  duplicate.sourceCatalogs[1].id = duplicate.sourceCatalogs[0].id;
  assert.ok(validateManifest(duplicate, root).some(
    (error) => error.includes("duplicate source catalog"),
  ));

  const duplicateExternal = clone(loadManifest(root));
  const external = duplicateExternal.sourceCatalogs.find(
    (catalog) => catalog.kind === "external-capability-sources",
  );
  duplicateExternal.sourceCatalogs.push({
    ...external,
    id: "external-capability-sources-duplicate",
  });
  assert.ok(validateManifest(duplicateExternal, root).some(
    (error) => error.includes("exactly one valid external-capability-sources"),
  ));

  for (const kind of [
    "legacy-branch-ledger",
    "capability-island-inventory",
    "ref-snapshot",
    "worktree-snapshot",
    "semantic-ledger",
  ]) {
    const duplicateSingleton = clone(loadManifest(root));
    const catalog = duplicateSingleton.sourceCatalogs.find((entry) => entry.kind === kind);
    duplicateSingleton.sourceCatalogs.push({
      ...catalog,
      id: `${catalog.id}-duplicate`,
    });
    assert.ok(validateManifest(duplicateSingleton, root).some(
      (error) => error.includes(`exactly one ${kind} catalog is required`),
    ));
  }

  const targetDrift = clone(loadManifest(root));
  targetDrift.snapshot.targetTree = "f".repeat(40);
  assert.ok(validateManifest(targetDrift, root).some(
    (error) => error.includes("frozen ref-snapshot target"),
  ));
});

test("manifest and catalog readers reject duplicate JSON keys", () => {
  const temporary = mkdtempSync(resolve("/tmp", "ext-convergence-json-"));
  try {
    const manifest = loadManifest(root);
    for (const catalog of manifest.sourceCatalogs) {
      const target = resolve(temporary, catalog.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(resolve(root, catalog.path)));
    }
    const temporaryManifest = resolve(temporary, MANIFEST_PATH);
    mkdirSync(dirname(temporaryManifest), { recursive: true });
    const manifestBytes = readFileSync(manifestPath, "utf8");
    const duplicateManifestBytes = manifestBytes.replace(
      /"schemaVersion":\s*("[^"]+"),/u,
      '"schemaVersion": $1,\n  "schemaVersion": $1,',
    );
    writeFileSync(temporaryManifest, duplicateManifestBytes);
    assert.throws(() => loadManifest(temporary), /duplicate/iu);

    const runtimeCatalog = manifest.sourceCatalogs.find(
      (catalog) => catalog.kind === "runtime-readiness",
    );
    const runtimePath = resolve(temporary, runtimeCatalog.path);
    const runtimeBytes = readFileSync(runtimePath, "utf8");
    const duplicateCatalogBytes = runtimeBytes.replace(
      /"schemaVersion":\s*("[^"]+"),/u,
      '"schemaVersion": $1,\n  "schemaVersion": $1,',
    );
    writeFileSync(runtimePath, duplicateCatalogBytes);
    runtimeCatalog.sha256 = createHash("sha256").update(duplicateCatalogBytes).digest("hex");
    writeFileSync(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`);
    assert.ok(validateManifest(manifest, temporary).some(
      (error) => error.includes("path is not valid JSON"),
    ));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("summary distinguishes frozen catalogs from blocked worktree sources", () => {
  const summary = summarize(loadManifest(root));
  assert.equal(summary.targetHead, "8b548215518c2bf0eebbf53d0c087902715c4aa4");
  assert.equal(summary.catalogCount, 12);
  assert.equal(summary.frozenCatalogCount, 8);
  assert.equal(summary.reviewRequiredCatalogCount, 3);
  assert.equal(summary.blockedCatalogCount, 1);
  assert.equal(summary.canonicalCapabilityCount, 31);
  assert.equal(summary.semanticCoverageStatus, "REVIEW_REQUIRED");
  assert.equal(summary.unresolvedRefTreeCount, 189);
  assert.equal(summary.unresolvedWorktreeEntryCount, 567);
  assert.equal(summary.unavailableWorktreeCount, 1);
  assert.equal(summary.migrationAuthorizedCount, 0);
  assert.equal(summary.proposedPacketCount, 16);
});

test("the canonical capability index exposes all 31 islands exactly once", () => {
  const manifest = loadManifest(root);
  const capabilities = loadCapabilities(manifest, root);
  assert.equal(capabilities.length, 31);
  assert.equal(new Set(capabilities.map((entry) => entry.id)).size, 31);
  assert.deepEqual(
    capabilities.map((entry) => entry.id),
    [...capabilities.map((entry) => entry.id)].sort(),
  );
  assert.equal(
    selectCatalog(manifest, "capability-islands-31")?.itemCount,
    capabilities.length,
  );
});

test("the unresolved queue exposes every canonical ref tree and dirty worktree item", () => {
  const unresolved = listUnresolvedSources(loadManifest(root), root);
  assert.equal(unresolved.summary.refTreeCount, 189);
  assert.equal(unresolved.summary.worktreeEntryCount, 567);
  assert.equal(unresolved.summary.unavailableWorktreeCount, 1);
  assert.equal(new Set(unresolved.refTrees.map((entry) => entry.tree)).size, 189);
  assert.ok(unresolved.refTrees.every((entry) => entry.canonicalRef.startsWith("refs/")));
});

test("proposed packets are priorities only and cannot imply product authority", () => {
  const manifest = loadManifest(root);
  assert.equal(manifest.proposedPackets.length, 16);
  for (const packet of manifest.proposedPackets) {
    assert.equal(packet.status, "PROPOSED_NOT_AUTHORIZED");
    assert.equal(packet.authorityTask, null);
    assert.ok(packet.blockedReason.length > 20);
  }
  const semantic = JSON.parse(readFileSync(resolve(
    root,
    "docs/migrations/2026-08-20-ext-full-value-semantic-ledger.v2.json",
  ), "utf8"));
  const packetCapabilityIds = new Set(manifest.proposedPackets.map(
    (packet) => packet.capabilityId,
  ));
  assert.ok(semantic.newCapabilityCandidates.every(
    (candidate) => packetCapabilityIds.has(candidate.id),
  ));
});

test("porcelain parser preserves rename sources without losing the following record", () => {
  const raw = "R  new name.txt\0old name.txt\0?? next.txt\0 M tracked.txt\0";
  assert.deepEqual(parsePorcelainV1Z(raw), [
    { status: "R ", path: "new name.txt", originalPath: "old name.txt" },
    { status: "??", path: "next.txt", originalPath: null },
    { status: " M", path: "tracked.txt", originalPath: null },
  ]);
});

test("frozen ref details independently derive namespace, tip and tree summaries", () => {
  const snapshot = JSON.parse(readFileSync(resolve(
    root,
    "docs/migrations/2026-08-20-ext-source-ref-snapshot.json",
  ), "utf8"));
  assert.deepEqual(validateRefSnapshot(snapshot), []);
  assert.ok(snapshot.refs.some((ref) => ref.refname.startsWith("refs/archive/")));
  assert.ok(snapshot.refs.some((ref) => ref.refname === "refs/stash"));
  assert.ok(snapshot.refs.some((ref) => ref.refname.startsWith("refs/tags/")));
  assert.equal(snapshot.summary.legacy99TipMatchedNames, 97);
  assert.equal(snapshot.summary.legacy99TipDriftedNames, 2);
  assert.equal(snapshot.summary.uniqueTips, 226);
  assert.equal(snapshot.summary.uniqueTrees, 216);
  assert.equal(snapshot.summary.reviewRequiredUniqueTrees, 189);
  assert.ok(snapshot.refs.some((ref) => ref.grade === "DUPLICATE_TREE_REVIEW_REQUIRED"));

  const summaryDrift = clone(snapshot);
  summaryDrift.summary.uniqueTrees += 1;
  assert.ok(validateRefSnapshot(summaryDrift).some(
    (error) => error.includes("summary does not match refs"),
  ));
  const canonicalDrift = clone(snapshot);
  const duplicate = canonicalDrift.refs.find((ref) => ref.exactTreeRefCount > 1);
  duplicate.canonicalTreeRef = "refs/heads/not-canonical";
  assert.ok(validateRefSnapshot(canonicalDrift).some(
    (error) => error.includes("duplicate/canonical facts drift"),
  ));
});

test("frozen worktree detail covers every registered worktree and dirty entry", () => {
  const snapshot = JSON.parse(readFileSync(resolve(
    root,
    "docs/migrations/2026-08-20-ext-uncommitted-source-snapshot.json",
  ), "utf8"));
  assert.deepEqual(validateWorktreeSnapshot(snapshot), []);
  assert.equal(snapshot.summary.registeredWorktrees, 51);
  assert.equal(snapshot.schemaVersion, "ext-full-value-worktree-snapshot.v5");
  assert.equal(snapshot.summary.dirtyWorktrees, 22);
  assert.equal(snapshot.summary.statusEntryCount, 567);
  assert.equal(snapshot.summary.unavailableWorktrees, 1);
  assert.equal(snapshot.summary.excludedCandidateWorktrees, 1);
  assert.equal(snapshot.summary.byPathResolution.WSL_UNC_ALIAS, 1);
  assert.equal(snapshot.summary.byObservationNote.MISSING_WORKTREE_PATH, 1);
  assert.equal(
    snapshot.worktrees.find((worktree) => worktree.pathResolution === "WSL_UNC_ALIAS")
      ?.entryCount,
    4,
  );
  assert.ok(snapshot.worktrees.filter(
    (worktree) => ["DIRTY", "CLEAN"].includes(worktree.state),
  ).every((worktree) => worktree.identityVerified
    && worktree.head === worktree.registeredHead
    && worktree.tree === worktree.registeredTree
    && worktree.observedBranchRef === worktree.branchRef
    && worktree.observedCommonDirSha256 === worktree.registeredCommonDirSha256));

  const drift = clone(snapshot);
  drift.summary.statusEntryCount -= 1;
  assert.ok(validateWorktreeSnapshot(drift).some(
    (error) => error.includes("summary does not match worktrees"),
  ));
});

test("worktree-list parser handles detached, locked and prunable records", () => {
  const raw = [
    "worktree /repo", "HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "branch refs/heads/main", "",
    "worktree /linked", "HEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "detached", "locked reason", "",
    "worktree /missing", "HEAD cccccccccccccccccccccccccccccccccccccccc", "prunable gone", "",
  ].join("\0");
  assert.deepEqual(parseWorktreeListPorcelainZ(raw), [
    { path: "/repo", HEAD: "a".repeat(40), branch: "refs/heads/main" },
    { path: "/linked", HEAD: "b".repeat(40), detached: true, locked: "reason" },
    { path: "/missing", HEAD: "c".repeat(40), prunable: "gone" },
  ]);
});

test("WSL UNC worktree aliases resolve to an existing native path without repairing Git", () => {
  const registered = "//wsl.localhost/Ubuntu-22.04/home/ubuntu/Projects/example";
  const resolved = resolveWorktreeObservationPath(registered, {
    exists: (path) => path === "/home/ubuntu/Projects/example",
    realpath: (path) => path,
  });
  assert.deepEqual(resolved, {
    path: "/home/ubuntu/Projects/example",
    pathResolution: "WSL_UNC_ALIAS",
  });
});

test("an observed WSL alias cannot drift from its registered Git identity", () => {
  const worktrees = JSON.parse(readFileSync(resolve(
    root,
    "docs/migrations/2026-08-20-ext-uncommitted-source-snapshot.json",
  ), "utf8"));
  const alias = worktrees.worktrees.find(
    (worktree) => worktree.pathResolution === "WSL_UNC_ALIAS",
  );
  assert.ok(alias);

  const headDrift = clone(worktrees);
  const driftedAlias = headDrift.worktrees.find((worktree) => worktree.id === alias.id);
  driftedAlias.head = driftedAlias.head === "f".repeat(40) ? "e".repeat(40) : "f".repeat(40);
  assert.ok(validateWorktreeSnapshot(headDrift).some(
    (error) => error.includes("observed identity does not match registered identity"),
  ));

  const commonDirDrift = clone(worktrees);
  const commonDriftedAlias = commonDirDrift.worktrees.find(
    (worktree) => worktree.id === alias.id,
  );
  commonDriftedAlias.observedCommonDirSha256 = "f".repeat(64);
  assert.ok(validateWorktreeSnapshot(commonDirDrift).some(
    (error) => error.includes("observed identity does not match registered identity"),
  ));

  const coordinatedCommonDirDrift = clone(worktrees);
  const coordinatedCommonAlias = coordinatedCommonDirDrift.worktrees.find(
    (worktree) => worktree.id === alias.id,
  );
  coordinatedCommonAlias.registeredCommonDirSha256 = "f".repeat(64);
  coordinatedCommonAlias.observedCommonDirSha256 = "f".repeat(64);
  assert.ok(validateWorktreeSnapshot(coordinatedCommonDirDrift).some(
    (error) => error.includes("registered common-dir does not match repository anchor"),
  ));

  const refSnapshot = JSON.parse(readFileSync(resolve(
    root,
    "docs/migrations/2026-08-20-ext-source-ref-snapshot.json",
  ), "utf8"));
  const coordinatedDrift = clone(worktrees);
  const coordinatedAlias = coordinatedDrift.worktrees.find(
    (worktree) => worktree.id === alias.id,
  );
  coordinatedAlias.registeredHead = "f".repeat(40);
  coordinatedAlias.head = "f".repeat(40);
  coordinatedAlias.registeredTree = "e".repeat(40);
  coordinatedAlias.tree = "e".repeat(40);
  assert.ok(validateWorktreeRefLinks(coordinatedDrift, refSnapshot).some(
    (error) => error.includes("registered identity does not match frozen ref"),
  ));
});

test("same branch, commit and tree from a different Git common-dir is rejected", () => {
  const registered = {
    registeredHead: "a".repeat(40),
    registeredTree: "b".repeat(40),
    branchRef: "refs/heads/example",
    registeredCommonDirSha256: "c".repeat(64),
  };
  const observed = {
    source: {
      head: registered.registeredHead,
      tree: registered.registeredTree,
      branch: "example",
      gitCommonDirSha256: "d".repeat(64),
    },
  };
  assert.equal(worktreeIdentityMatches(registered, observed), false);
  observed.source.gitCommonDirSha256 = registered.registeredCommonDirSha256;
  assert.equal(worktreeIdentityMatches(registered, observed), true);
});

test("broken WSL gitdir pointers resolve read-only to native admin metadata", () => {
  const temporary = mkdtempSync(resolve("/tmp", "ext-convergence-gitdir-"));
  const worktree = resolve(temporary, "linked");
  const admin = resolve(temporary, "admin");
  mkdirSync(worktree);
  mkdirSync(admin);
  writeFileSync(
    resolve(worktree, ".git"),
    `gitdir: //wsl.localhost/Ubuntu-22.04${admin}\n`,
  );
  try {
    assert.equal(resolveWorktreeGitDir(worktree, {
      expectedWslDistro: "Ubuntu-22.04",
    }), admin);
    assert.equal(resolveWorktreeGitDir(worktree, {
      expectedWslDistro: "Different-Distro",
    }), null);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("catalog resolution rejects a repository symlink that escapes the root", () => {
  const temporary = mkdtempSync(resolve("/tmp", "ext-convergence-path-"));
  const repository = resolve(temporary, "repo");
  const outside = resolve(temporary, "outside.json");
  mkdirSync(repository);
  writeFileSync(outside, "{}\n");
  symlinkSync(outside, resolve(repository, "catalog.json"));
  try {
    assert.throws(
      () => resolveCatalogPath(repository, "catalog.json"),
      /outside the repository/u,
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("an escaped capability catalog cannot influence packet capability ids", () => {
  const temporary = mkdtempSync(resolve("/tmp", "ext-convergence-capability-escape-"));
  const outside = resolve(`${temporary}-outside.json`);
  try {
    const manifest = loadManifest(root);
    for (const catalog of manifest.sourceCatalogs) {
      const target = resolve(temporary, catalog.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(resolve(root, catalog.path)));
    }
    const capabilityCatalog = manifest.sourceCatalogs.find(
      (catalog) => catalog.kind === "capability-island-inventory",
    );
    const canary = `${JSON.stringify({
      schemaVersion: "canary.v1",
      islands: [{ id: "outside-canary-capability", name: "outside" }],
    })}\n`;
    writeFileSync(outside, canary);
    const escapedPath = "docs/migrations/capability-escape.json";
    const escapedAbsolute = resolve(temporary, escapedPath);
    mkdirSync(dirname(escapedAbsolute), { recursive: true });
    symlinkSync(outside, escapedAbsolute);
    capabilityCatalog.path = escapedPath;
    capabilityCatalog.sha256 = createHash("sha256").update(canary).digest("hex");
    manifest.proposedPackets[0].capabilityId = "outside-canary-capability";

    const errors = validateManifest(manifest, temporary);
    assert.ok(errors.some((error) => error.includes("path is invalid")));
    assert.ok(errors.some((error) => error.includes("capabilityId is not in")));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
    rmSync(outside, { force: true });
  }
});

test("ref observation rejects option-like target names before invoking Git", () => {
  assert.throws(
    () => observeRefs(root, "--upload-pack=malicious"),
    /non-option Git branch name/u,
  );
});

test("real Git observation covers annotated tags, archive refs, exact trees and linked worktrees", {
  skip: process.env.EXT_CONVERGENCE_GIT_TESTS !== "1",
}, () => {
  const temporary = mkdtempSync(resolve("/tmp", "ext-convergence-git-"));
  const repository = resolve(temporary, "repo");
  const linked = resolve(temporary, "linked");
  const excluded = resolve(temporary, "excluded");
  mkdirSync(repository);
  mkdirSync(excluded);
  const runGit = (args, cwd = repository) => execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    runGit(["init", "-b", "main"]);
    runGit(["config", "user.name", "V2 Test"]);
    runGit(["config", "user.email", "v2@example.invalid"]);
    writeFileSync(resolve(repository, "tracked.txt"), "base\n");
    runGit(["add", "tracked.txt"]);
    runGit(["commit", "-m", "base"]);
    runGit(["branch", "ext-dev"]);
    runGit(["tag", "-a", "frozen", "-m", "frozen tag"]);
    runGit(["update-ref", "refs/archive/frozen", "HEAD"]);
    runGit(["commit", "--allow-empty", "-m", "same tree new tip"]);
    runGit(["worktree", "add", linked, "ext-dev"]);
    writeFileSync(resolve(linked, "tracked.txt"), "dirty\n");

    const refs = observeRefs(repository, "ext-dev");
    assert.ok(refs.refs.some((ref) => ref.refname === "refs/tags/frozen"
      && ref.objectType === "tag" && ref.commitTip !== ref.refObject));
    assert.ok(refs.refs.some((ref) => ref.refname === "refs/archive/frozen"));
    assert.ok(refs.refs.some((ref) => ref.grade === "DUPLICATE_TREE_REVIEW_REQUIRED"));
    const worktrees = observeWorktrees(repository, excluded);
    assert.equal(worktrees.summary.registeredWorktrees, 2);
    assert.equal(worktrees.summary.dirtyWorktrees, 1);
    assert.equal(worktrees.summary.statusEntryCount, 1);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("CLI check, status, catalog and capability views are deterministic and read-only", () => {
  const before = digest(manifestPath);
  const check = run(["--check"]);
  const status = run(["--status"]);
  const catalog = run(["--catalog", "legacy-99-ref-ledger"]);
  const capabilities = run(["--capabilities"]);
  const packet = run(["--packet", "packet-01-battery-safety"]);
  const unresolved = run(["--unresolved"]);
  const after = digest(manifestPath);

  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.equal(JSON.parse(check.stdout).decision, "PASS");
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.equal(JSON.parse(status.stdout).summary.canonicalCapabilityCount, 31);
  assert.equal(catalog.status, 0, catalog.stderr || catalog.stdout);
  assert.equal(JSON.parse(catalog.stdout).catalog.itemCount, 99);
  assert.equal(capabilities.status, 0, capabilities.stderr || capabilities.stdout);
  assert.equal(JSON.parse(capabilities.stdout).capabilities.length, 31);
  assert.equal(packet.status, 0, packet.stderr || packet.stdout);
  assert.equal(JSON.parse(packet.stdout).packet.status, "PROPOSED_NOT_AUTHORIZED");
  assert.equal(unresolved.status, 0, unresolved.stderr || unresolved.stdout);
  assert.equal(JSON.parse(unresolved.stdout).unresolved.summary.refTreeCount, 189);
  assert.equal(before, after);
});

test("CLI rejects mutation flags and unknown selections", () => {
  const mutation = run(["--write"]);
  const missingCatalog = run(["--catalog", "missing"]);
  const missingPacket = run(["--packet", "missing"]);

  assert.equal(mutation.status, 64);
  assert.match(mutation.stderr, /Usage:/u);
  assert.equal(missingCatalog.status, 2);
  assert.equal(JSON.parse(missingCatalog.stdout).decision, "NOT_FOUND");
  assert.equal(missingPacket.status, 2);
  assert.equal(JSON.parse(missingPacket.stdout).decision, "NOT_FOUND");
});

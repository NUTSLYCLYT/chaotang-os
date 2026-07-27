import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkerPath = join(repositoryRoot, "scripts", "check_migration_completeness.mjs");
const temporaryRoots = [];
const expectedSourceHead = "df037478d50f4681103a4d62de4f959e51a55856";
const expectedRestoreCommit = "734b0aad07eb9b48469e9263e24cdd68fee1c4e4";

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function write(root, path, contents) {
  const absolutePath = join(root, ...path.split("/"));
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function inventoryHash(entries) {
  return sha256(canonicalJson(entries));
}

function readRestoreFile(root, restoreCommit, path) {
  const result = spawnSync("git", ["show", `${restoreCommit}:${path}`], {
    cwd: root,
    encoding: null,
  });
  return result.status === 0 ? result.stdout : null;
}

function buildSourceFixture() {
  const root = mkdtempSync(join(tmpdir(), "migration-source-"));
  temporaryRoots.push(root);
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "migration-test@example.invalid"]);
  git(root, ["config", "user.name", "Migration Test"]);
  git(root, ["config", "core.autocrlf", "false"]);

  for (let index = 0; index < 43; index += 1) {
    write(root, `modified/file-${index}.txt`, `source-head-${index}\n`);
  }
  for (let index = 0; index < 4; index += 1) {
    write(root, `deleted/file-${index}.txt`, `source-head-deleted-${index}\n`);
  }
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", "source head"]);
  const sourceHead = git(root, ["rev-parse", "HEAD"]);

  for (let index = 0; index < 28; index += 1) {
    write(root, `modified/file-${index}.txt`, `restore-identical-${index}\n`);
  }
  for (let index = 28; index < 43; index += 1) {
    write(root, `modified/file-${index}.txt`, `restore-intermediate-${index}\n`);
  }
  for (let index = 0; index < 4; index += 1) {
    unlinkSync(join(root, "deleted", `file-${index}.txt`));
  }
  for (let index = 0; index < 26; index += 1) {
    write(root, `untracked/file-${index}.txt`, `restore-identical-${index}\n`);
  }
  for (let index = 26; index < 48; index += 1) {
    write(root, `untracked/file-${index}.txt`, `restore-intermediate-${index}\n`);
  }
  git(root, ["add", "-A"]);
  git(root, ["commit", "-qm", "restore commit"]);
  const restoreCommit = git(root, ["rev-parse", "HEAD"]);

  git(root, ["reset", "--hard", "-q", sourceHead]);
  for (let index = 0; index < 28; index += 1) {
    write(root, `modified/file-${index}.txt`, `restore-identical-${index}\n`);
  }
  for (let index = 28; index < 43; index += 1) {
    write(root, `modified/file-${index}.txt`, `post-restore-${index}\n`);
  }
  for (let index = 0; index < 4; index += 1) {
    unlinkSync(join(root, "deleted", `file-${index}.txt`));
  }
  for (let index = 0; index < 26; index += 1) {
    write(root, `untracked/file-${index}.txt`, `restore-identical-${index}\n`);
  }
  for (let index = 26; index < 48; index += 1) {
    write(root, `untracked/file-${index}.txt`, `post-restore-${index}\n`);
  }
  for (let index = 48; index < 61; index += 1) {
    write(root, `untracked/file-${index}.txt`, `dirty-only-${index}\n`);
  }

  const porcelain = execFileSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { cwd: root },
  )
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const entries = porcelain.map((field) => {
    const sourceStatus = field.slice(0, 2).trim();
    const path = field.slice(3);
    const absolutePath = join(root, ...path.split("/"));
    const sourceContents = existsSync(absolutePath) ? readFileSync(absolutePath) : null;
    const restoreContents = readRestoreFile(root, restoreCommit, path);
    let sourceLayer;
    if (
      (sourceContents === null && restoreContents === null) ||
      (sourceContents !== null &&
        restoreContents !== null &&
        sha256(sourceContents) === sha256(restoreContents))
    ) {
      sourceLayer = "restoreIdentical";
    } else if (restoreContents !== null) {
      sourceLayer = "postRestoreModified";
    } else {
      sourceLayer = "dirtyOnlyAdded";
    }
    return {
      path,
      sourceStatus,
      sourceLayer,
      sourceSha256: sourceContents === null ? null : sha256(sourceContents),
      disposition: "rejected",
      targetPaths: [],
      reason: `Rejected because the fixture contract forbids importing ${path}`,
      verification: [`Verified rejection against fixture-contract/${path}`],
    };
  });

  assert.equal(entries.length, 108);
  assert.deepEqual(
    Object.fromEntries(
      ["M", "D", "??"].map((status) => [
        status,
        entries.filter((entry) => entry.sourceStatus === status).length,
      ]),
    ),
    { M: 43, D: 4, "??": 61 },
  );
  assert.deepEqual(
    Object.fromEntries(
      ["restoreIdentical", "postRestoreModified", "dirtyOnlyAdded"].map((layer) => [
        layer,
        entries.filter((entry) => entry.sourceLayer === layer).length,
      ]),
    ),
    { restoreIdentical: 58, postRestoreModified: 37, dirtyOnlyAdded: 13 },
  );

  return {
    root,
    manifest: {
      sourceHead,
      restoreCommit,
      counts: {
        total: 108,
        modified: 43,
        deleted: 4,
        untracked: 61,
        restoreIdentical: 58,
        postRestoreModified: 37,
        dirtyOnlyAdded: 13,
      },
      canonicalInventorySha256: inventoryHash(entries),
      entries,
    },
  };
}

function clone(value) {
  return structuredClone(value);
}

function defaultManifest() {
  const manifest = clone(sourceFixture.manifest);
  manifest.sourceHead = expectedSourceHead;
  manifest.restoreCommit = expectedRestoreCommit;
  return manifest;
}

function writeManifest(root, manifest) {
  const path = join(
    root,
    "docs",
    "migrations",
    "2026-07-27-only-worktree-dispositions.json",
  );
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

function makeTarget(manifest) {
  const root = mkdtempSync(join(tmpdir(), "migration-target-"));
  temporaryRoots.push(root);
  writeManifest(root, manifest);
  return root;
}

function runChecker(root, args = []) {
  return spawnSync(process.execPath, [checkerPath, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function refreshInventoryHash(manifest) {
  manifest.canonicalInventorySha256 = inventoryHash(manifest.entries);
  return manifest;
}

test.after(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

const sourceFixture = buildSourceFixture();

test("accepts a complete 108-entry fixture in default mode", () => {
  const target = makeTarget(defaultManifest());
  const result = runChecker(target);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("accepts a complete 108-entry fixture in source-worktree mode", () => {
  const target = makeTarget(clone(sourceFixture.manifest));
  const result = runChecker(target, ["--source-worktree", sourceFixture.root]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

const invalidCases = [
  {
    name: "missing disposition",
    mutate(manifest) {
      delete manifest.entries[0].disposition;
      refreshInventoryHash(manifest);
    },
  },
  {
    name: "duplicate source path",
    mutate(manifest) {
      manifest.entries[1] = clone(manifest.entries[0]);
      refreshInventoryHash(manifest);
    },
  },
  {
    name: "count drift",
    mutate(manifest) {
      manifest.counts.total += 1;
    },
  },
  {
    name: "unknown source entry",
    sourceMode: true,
    mutate(manifest) {
      manifest.entries[0].path = "unknown/source-entry.txt";
      refreshInventoryHash(manifest);
    },
  },
  {
    name: "missing target path",
    mutate(manifest) {
      Object.assign(manifest.entries.find((entry) => entry.sourceStatus === "M"), {
        disposition: "integrated",
        targetPaths: ["targets/does-not-exist.txt"],
        reason: "",
      });
      refreshInventoryHash(manifest);
    },
  },
  {
    name: "deleted source target still exists",
    prepareTarget(root, manifest) {
      const entry = manifest.entries.find((candidate) => candidate.sourceStatus === "D");
      Object.assign(entry, {
        disposition: "integrated",
        targetPaths: [entry.path],
        reason: "",
      });
      write(root, entry.path, "this target should have been deleted\n");
      refreshInventoryHash(manifest);
    },
  },
  {
    name: "empty superseded or rejected reason",
    mutate(manifest) {
      manifest.entries[0].reason = "";
      refreshInventoryHash(manifest);
    },
  },
  {
    name: "source sha drift",
    sourceMode: true,
    mutateSource(manifest) {
      const entry = manifest.entries.find((candidate) => candidate.sourceSha256 !== null);
      const absolutePath = join(sourceFixture.root, ...entry.path.split("/"));
      const original = readFileSync(absolutePath);
      writeFileSync(absolutePath, "source SHA drift\n");
      return () => writeFileSync(absolutePath, original);
    },
  },
];

for (const invalidCase of invalidCases) {
  test(`rejects ${invalidCase.name}`, () => {
    const manifest = invalidCase.sourceMode
      ? clone(sourceFixture.manifest)
      : defaultManifest();
    invalidCase.mutate?.(manifest);
    const target = makeTarget(manifest);
    invalidCase.prepareTarget?.(target, manifest);
    writeManifest(target, manifest);
    const restoreSource = invalidCase.mutateSource?.(manifest);
    try {
      const args = invalidCase.sourceMode
        ? ["--source-worktree", sourceFixture.root]
        : [];
      const result = runChecker(target, args);
      assert.notEqual(result.status, 0, "checker unexpectedly accepted invalid manifest");
    } finally {
      restoreSource?.();
    }
  });
}

test("rejects unknown manifest keys", () => {
  const manifest = defaultManifest();
  manifest.unexpected = true;
  const target = makeTarget(manifest);
  const result = runChecker(target);
  assert.notEqual(result.status, 0, "checker unexpectedly accepted an unknown key");
});

test("rejects pending metadata disguised as a rejected disposition", () => {
  const manifest = defaultManifest();
  Object.assign(manifest.entries[0], {
    disposition: "rejected",
    reason: "Pending semantic disposition by migration Tasks 2-7.",
    verification: [
      "Pending target-path and contract verification in migration Tasks 2-7.",
    ],
  });
  refreshInventoryHash(manifest);
  const target = makeTarget(manifest);
  const result = runChecker(target);
  assert.notEqual(result.status, 0, "checker accepted pending disposition metadata");
});

const invalidAuditDetails = [
  {
    name: "placeholder reason",
    reason: "Placeholder rejection reason for later review.",
    verification: ["Verified rejection against fixture-contract/file-0"],
  },
  {
    name: "generic reason",
    reason: "Generic rejection reason.",
    verification: ["Verified rejection against fixture-contract/file-0"],
  },
  {
    name: "non-specific reason",
    reason: "This old file is unnecessary.",
    verification: ["Verified rejection against fixture-contract/file-0"],
  },
  {
    name: "pending verification",
    reason: "Rejected because the fixture contract forbids this file.",
    verification: ["Pending target-path verification."],
  },
  {
    name: "placeholder verification",
    reason: "Rejected because the fixture contract forbids this file.",
    verification: ["Placeholder verification for later."],
  },
  {
    name: "generic verification",
    reason: "Rejected because the fixture contract forbids this file.",
    verification: ["Verified."],
  },
  {
    name: "non-specific verification",
    reason: "Rejected because the fixture contract forbids this file.",
    verification: ["Reviewed by the migration team."],
  },
];

for (const invalidDetail of invalidAuditDetails) {
  test(`rejects ${invalidDetail.name}`, () => {
    const manifest = defaultManifest();
    Object.assign(manifest.entries[0], {
      reason: invalidDetail.reason,
      verification: invalidDetail.verification,
    });
    refreshInventoryHash(manifest);
    const target = makeTarget(manifest);
    const result = runChecker(target);
    assert.notEqual(result.status, 0, `checker accepted ${invalidDetail.name}`);
  });
}

test("rejects default source HEAD drift", () => {
  const manifest = defaultManifest();
  manifest.sourceHead = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const target = makeTarget(manifest);
  const result = runChecker(target);
  assert.notEqual(result.status, 0, "checker accepted source HEAD drift");
});

test("rejects default restore commit drift", () => {
  const manifest = defaultManifest();
  manifest.restoreCommit = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const target = makeTarget(manifest);
  const result = runChecker(target);
  assert.notEqual(result.status, 0, "checker accepted restore commit drift");
});

const invalidPosixPaths = [
  ["dot segment", "foo/./bar"],
  ["empty segment", "foo//bar"],
  ["repository dot", "."],
  ["normalized alias", "foo/../bar"],
];

for (const [name, path] of invalidPosixPaths) {
  test(`rejects POSIX ${name} path`, () => {
    const manifest = defaultManifest();
    manifest.entries[0].path = path;
    refreshInventoryHash(manifest);
    const target = makeTarget(manifest);
    const result = runChecker(target);
    assert.notEqual(result.status, 0, `checker accepted POSIX ${name} path`);
  });
}

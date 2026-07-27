import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, posix } from "node:path";

const MANIFEST_PATH = join(
  "docs",
  "migrations",
  "2026-07-27-only-worktree-dispositions.json",
);
const EXPECTED_SOURCE_HEAD = "df037478d50f4681103a4d62de4f959e51a55856";
const EXPECTED_RESTORE_COMMIT = "734b0aad07eb9b48469e9263e24cdd68fee1c4e4";
const EXPECTED_COUNTS = Object.freeze({
  total: 108,
  modified: 43,
  deleted: 4,
  untracked: 61,
  restoreIdentical: 58,
  postRestoreModified: 37,
  dirtyOnlyAdded: 13,
});
const TOP_LEVEL_KEYS = [
  "sourceHead",
  "restoreCommit",
  "counts",
  "canonicalInventorySha256",
  "entries",
];
const ENTRY_KEYS = [
  "path",
  "sourceStatus",
  "sourceLayer",
  "sourceSha256",
  "disposition",
  "targetPaths",
  "reason",
  "verification",
];
const SOURCE_STATUSES = new Set(["M", "D", "??"]);
const SOURCE_LAYERS = new Set([
  "restoreIdentical",
  "postRestoreModified",
  "dirtyOnlyAdded",
]);
const DISPOSITIONS = new Set(["integrated", "superseded", "rejected"]);
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const GIT_COMMIT_PATTERN = /^[0-9a-f]{40,64}$/;
const PLACEHOLDER_AUDIT_PATTERN =
  /\b(?:pending|placeholder|generic|todo|tbd|later)\b/i;
const GENERIC_AUDIT_PATTERN =
  /^(?:n\/a|none|not needed|obsolete|unused|rejected|superseded|verified|checked|done|complete|completed|reviewed|verification)\.?$/i;
const DISPOSITION_REASON_PATTERNS = Object.freeze({
  integrated: /\b(?:integrat\w*|migrat\w*|restor\w*|implement\w*)\b/i,
  superseded: /\b(?:supersed\w*|replac\w*|equivalent|newer)\b/i,
  rejected: /\b(?:reject\w*|violat\w*|forbid\w*|invariant|contract)\b/i,
});
const DISPOSITION_VERIFICATION_PATTERNS = Object.freeze({
  integrated:
    /\b(?:integrat\w*|target|test\w*|check\w*|sha-?256|build|lint)\b/i,
  superseded:
    /\b(?:supersed\w*|equivalent|replacement|target|test\w*|check\w*|sha-?256)\b/i,
  rejected:
    /\b(?:reject\w*|invariant|contract|test\w*|check\w*|sha-?256)\b/i,
});

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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function checkExactKeys(value, allowedKeys, label, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`${label} has unknown key: ${key}`);
    }
  }
  for (const key of allowedKeys) {
    if (!Object.hasOwn(value, key)) {
      errors.push(`${label} is missing key: ${key}`);
    }
  }
  return true;
}

function isSafeRelativePath(path) {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    path !== "." &&
    !isAbsolute(path) &&
    !path.includes("\\") &&
    posix.normalize(path) === path
  );
}

function validateCounts(manifest, errors) {
  if (!checkExactKeys(manifest.counts, Object.keys(EXPECTED_COUNTS), "counts", errors)) {
    return;
  }
  for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (manifest.counts[key] !== expected) {
      errors.push(`counts.${key} must be ${expected}, got ${manifest.counts[key]}`);
    }
  }
  if (!Array.isArray(manifest.entries)) {
    return;
  }
  const derived = {
    total: manifest.entries.length,
    modified: manifest.entries.filter((entry) => entry?.sourceStatus === "M").length,
    deleted: manifest.entries.filter((entry) => entry?.sourceStatus === "D").length,
    untracked: manifest.entries.filter((entry) => entry?.sourceStatus === "??").length,
    restoreIdentical: manifest.entries.filter(
      (entry) => entry?.sourceLayer === "restoreIdentical",
    ).length,
    postRestoreModified: manifest.entries.filter(
      (entry) => entry?.sourceLayer === "postRestoreModified",
    ).length,
    dirtyOnlyAdded: manifest.entries.filter(
      (entry) => entry?.sourceLayer === "dirtyOnlyAdded",
    ).length,
  };
  for (const [key, value] of Object.entries(derived)) {
    if (manifest.counts?.[key] !== value) {
      errors.push(`counts.${key} does not match entries: expected ${value}`);
    }
  }
}

function validateEntry(entry, index, targetRoot, errors) {
  const label = `entries[${index}]`;
  if (!checkExactKeys(entry, ENTRY_KEYS, label, errors)) {
    return;
  }
  if (!isSafeRelativePath(entry.path)) {
    errors.push(`${label}.path must be a normalized repository-relative path`);
  }
  if (!SOURCE_STATUSES.has(entry.sourceStatus)) {
    errors.push(`${label}.sourceStatus is invalid: ${entry.sourceStatus}`);
  }
  if (!SOURCE_LAYERS.has(entry.sourceLayer)) {
    errors.push(`${label}.sourceLayer is invalid: ${entry.sourceLayer}`);
  }
  if (
    (entry.sourceStatus === "D" && entry.sourceSha256 !== null) ||
    (entry.sourceStatus !== "D" && !SHA256_PATTERN.test(entry.sourceSha256 ?? ""))
  ) {
    errors.push(`${label}.sourceSha256 is invalid for status ${entry.sourceStatus}`);
  }
  if (!DISPOSITIONS.has(entry.disposition)) {
    errors.push(`${label} has missing or invalid disposition: ${entry.disposition}`);
  }
  if (
    !Array.isArray(entry.targetPaths) ||
    entry.targetPaths.some((path) => !isSafeRelativePath(path)) ||
    new Set(entry.targetPaths).size !== entry.targetPaths.length
  ) {
    errors.push(`${label}.targetPaths must contain unique repository-relative paths`);
  }
  if (typeof entry.reason !== "string") {
    errors.push(`${label}.reason must be a string`);
  }
  if (
    !Array.isArray(entry.verification) ||
    entry.verification.length === 0 ||
    entry.verification.some(
      (verification) =>
        typeof verification !== "string" || verification.trim().length === 0,
    )
  ) {
    errors.push(`${label}.verification must contain at least one non-empty check`);
  }

  if (
    !DISPOSITIONS.has(entry.disposition) ||
    !Array.isArray(entry.targetPaths) ||
    typeof entry.reason !== "string" ||
    !Array.isArray(entry.verification)
  ) {
    return;
  }
  const reason = entry.reason.trim();
  if (
    reason.length === 0 ||
    PLACEHOLDER_AUDIT_PATTERN.test(reason) ||
    GENERIC_AUDIT_PATTERN.test(reason) ||
    !DISPOSITION_REASON_PATTERNS[entry.disposition].test(reason)
  ) {
    errors.push(
      `${label} needs a disposition-specific auditable ${entry.disposition} reason`,
    );
  }
  for (const verification of entry.verification) {
    if (
      typeof verification !== "string" ||
      verification.trim().length === 0
    ) {
      continue;
    }
    const auditText = verification.trim();
    if (
      PLACEHOLDER_AUDIT_PATTERN.test(auditText) ||
      GENERIC_AUDIT_PATTERN.test(auditText) ||
      !DISPOSITION_VERIFICATION_PATTERNS[entry.disposition].test(auditText)
    ) {
      errors.push(
        `${label}.verification needs disposition-specific auditable content`,
      );
    }
  }
  if (entry.disposition === "rejected" && entry.targetPaths.length !== 0) {
    errors.push(`${label} rejected entries must not name target paths`);
  }
  if (
    (entry.disposition === "integrated" || entry.disposition === "superseded") &&
    entry.targetPaths.length === 0
  ) {
    errors.push(`${label} ${entry.disposition} entries must name target paths`);
  }

  for (const targetPath of entry.targetPaths) {
    if (!isSafeRelativePath(targetPath)) {
      continue;
    }
    const targetExists = existsSync(join(targetRoot, ...targetPath.split("/")));
    if (entry.sourceStatus === "D" && entry.disposition === "integrated") {
      if (targetExists) {
        errors.push(`${label} deleted source target still exists: ${targetPath}`);
      }
    } else if (!targetExists) {
      errors.push(`${label} target path does not exist: ${targetPath}`);
    }
  }
}

function validateManifest(manifest, targetRoot, enforceFrozenCommits) {
  const errors = [];
  if (!checkExactKeys(manifest, TOP_LEVEL_KEYS, "manifest", errors)) {
    return errors;
  }
  if (!GIT_COMMIT_PATTERN.test(manifest.sourceHead ?? "")) {
    errors.push("manifest.sourceHead must be a lowercase Git object ID");
  }
  if (!GIT_COMMIT_PATTERN.test(manifest.restoreCommit ?? "")) {
    errors.push("manifest.restoreCommit must be a lowercase Git object ID");
  }
  if (enforceFrozenCommits && manifest.sourceHead !== EXPECTED_SOURCE_HEAD) {
    errors.push(
      `manifest.sourceHead drift: expected ${EXPECTED_SOURCE_HEAD}, got ${manifest.sourceHead}`,
    );
  }
  if (
    enforceFrozenCommits &&
    manifest.restoreCommit !== EXPECTED_RESTORE_COMMIT
  ) {
    errors.push(
      `manifest.restoreCommit drift: expected ${EXPECTED_RESTORE_COMMIT}, got ${manifest.restoreCommit}`,
    );
  }
  if (!SHA256_PATTERN.test(manifest.canonicalInventorySha256 ?? "")) {
    errors.push("manifest.canonicalInventorySha256 must be a lowercase SHA-256");
  }
  if (!Array.isArray(manifest.entries)) {
    errors.push("manifest.entries must be an array");
    return errors;
  }

  validateCounts(manifest, errors);
  const seenPaths = new Set();
  manifest.entries.forEach((entry, index) => {
    validateEntry(entry, index, targetRoot, errors);
    if (isPlainObject(entry) && typeof entry.path === "string") {
      if (seenPaths.has(entry.path)) {
        errors.push(`duplicate source path: ${entry.path}`);
      }
      seenPaths.add(entry.path);
    }
  });
  const actualInventoryHash = sha256(canonicalJson(manifest.entries));
  if (manifest.canonicalInventorySha256 !== actualInventoryHash) {
    errors.push(
      `canonical inventory SHA drift: expected ${manifest.canonicalInventorySha256}, got ${actualInventoryHash}`,
    );
  }
  return errors;
}

function parsePorcelain(root) {
  const output = execFileSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { cwd: root },
  ).toString("utf8");
  return output
    .split("\0")
    .filter(Boolean)
    .map((field) => ({
      sourceStatus: field.slice(0, 2).trim(),
      path: field.slice(3),
    }));
}

function restoreTree(root, restoreCommit) {
  const result = spawnSync(
    "git",
    ["ls-tree", "-r", "-z", "--full-tree", restoreCommit],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status !== 0) {
    return { error: result.stderr.trim() || `cannot read restore commit ${restoreCommit}` };
  }
  const blobs = new Map();
  for (const field of result.stdout.split("\0").filter(Boolean)) {
    const tab = field.indexOf("\t");
    const metadata = field.slice(0, tab).split(" ");
    blobs.set(field.slice(tab + 1), metadata[2]);
  }
  return { blobs };
}

function gitBlobId(contents, objectFormat) {
  const header = Buffer.from(`blob ${contents.length}\0`);
  return createHash(objectFormat).update(header).update(contents).digest("hex");
}

function validateSourceWorktree(manifest, sourceRoot) {
  const errors = [];
  let sourceHead;
  let objectFormat;
  let liveRows;
  try {
    sourceHead = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: sourceRoot,
      encoding: "utf8",
    }).trim();
    objectFormat = execFileSync("git", ["rev-parse", "--show-object-format"], {
      cwd: sourceRoot,
      encoding: "utf8",
    }).trim();
    liveRows = parsePorcelain(sourceRoot);
  } catch (error) {
    return [`cannot inspect source worktree: ${error.message}`];
  }
  if (sourceHead !== manifest.sourceHead) {
    errors.push(`source HEAD drift: expected ${manifest.sourceHead}, got ${sourceHead}`);
  }
  const restore = restoreTree(sourceRoot, manifest.restoreCommit);
  if (restore.error) {
    errors.push(restore.error);
    return errors;
  }

  const manifestByPath = new Map(manifest.entries.map((entry) => [entry.path, entry]));
  const liveByPath = new Map(liveRows.map((row) => [row.path, row]));
  for (const row of liveRows) {
    if (!manifestByPath.has(row.path)) {
      errors.push(`unknown source entry: ${row.sourceStatus} ${row.path}`);
    }
  }
  for (const entry of manifest.entries) {
    const live = liveByPath.get(entry.path);
    if (!live) {
      errors.push(`manifest source entry is no longer dirty: ${entry.path}`);
      continue;
    }
    if (live.sourceStatus !== entry.sourceStatus) {
      errors.push(
        `source status drift for ${entry.path}: expected ${entry.sourceStatus}, got ${live.sourceStatus}`,
      );
    }
    const absolutePath = join(sourceRoot, ...entry.path.split("/"));
    const sourceContents = existsSync(absolutePath) ? readFileSync(absolutePath) : null;
    const liveSha = sourceContents === null ? null : sha256(sourceContents);
    if (liveSha !== entry.sourceSha256) {
      errors.push(
        `source SHA drift for ${entry.path}: expected ${entry.sourceSha256}, got ${liveSha}`,
      );
    }
    const restoreBlob = restore.blobs.get(entry.path);
    let liveLayer;
    if (
      (sourceContents === null && restoreBlob === undefined) ||
      (sourceContents !== null &&
        restoreBlob !== undefined &&
        gitBlobId(sourceContents, objectFormat) === restoreBlob)
    ) {
      liveLayer = "restoreIdentical";
    } else if (restoreBlob !== undefined) {
      liveLayer = "postRestoreModified";
    } else {
      liveLayer = "dirtyOnlyAdded";
    }
    if (liveLayer !== entry.sourceLayer) {
      errors.push(
        `source layer drift for ${entry.path}: expected ${entry.sourceLayer}, got ${liveLayer}`,
      );
    }
  }
  return errors;
}

function parseArguments(argv) {
  if (argv.length === 0) {
    return {};
  }
  if (argv.length === 2 && argv[0] === "--source-worktree") {
    if (!isAbsolute(argv[1])) {
      throw new Error("--source-worktree requires an absolute path");
    }
    return { sourceWorktree: argv[1] };
  }
  throw new Error(
    "usage: node scripts/check_migration_completeness.mjs [--source-worktree <absolute-path>]",
  );
}

function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  const targetRoot = process.cwd();
  const manifestPath = join(targetRoot, MANIFEST_PATH);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    console.error(`cannot read migration manifest ${manifestPath}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const errors = validateManifest(manifest, targetRoot, !options.sourceWorktree);
  if (options.sourceWorktree && Array.isArray(manifest.entries)) {
    errors.push(...validateSourceWorktree(manifest, options.sourceWorktree));
  }
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`migration completeness: ${error}`);
    }
    console.error(`migration completeness check failed with ${errors.length} error(s)`);
    process.exitCode = 1;
    return;
  }
  console.log(`Migration completeness check passed: ${manifest.entries.length} entries.`);
}

main();

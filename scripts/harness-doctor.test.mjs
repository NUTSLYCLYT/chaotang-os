import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_MANIFEST,
  observeExtAuthority,
  parseProjectHarnessText,
  readRepositoryFile,
  schemaClosureErrors,
  validateProjectHarnessDisk,
  validateProjectHarnessManifest,
  validateProjectHarnessSchema,
} from "./harness-doctor.mjs";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DOCTOR_PATH = path.join(REPOSITORY_ROOT, "scripts", "harness-doctor.mjs");
const MANIFEST_PATH = path.join(REPOSITORY_ROOT, ".harness", "manifest", "project-harness.json");
const SCHEMA_PATH = path.join(REPOSITORY_ROOT, ".harness", "contracts", "project-harness.schema.json");

function clone(value) {
  return structuredClone(value);
}

function runDoctor(command) {
  return spawnSync(process.execPath, [DOCTOR_PATH, command], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "" },
    timeout: 5_000,
  });
}

async function createDiskFixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "chaotang-g1-doctor-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of [
    ".harness/contracts",
    ".harness/manifest",
    "scripts",
    "frontend",
    "backend/harness",
  ]) await mkdir(path.join(root, directory), { recursive: true });
  for (const file of [
    "AGENTS.md",
    ".harness/contracts/project-harness.schema.json",
    ".harness/manifest/project-harness.json",
    "scripts/harness-doctor.mjs",
    "frontend/AGENTS.md",
    "backend/AGENTS.md",
  ]) await writeFile(path.join(root, file), "fixture\n", "utf8");
  return root;
}

test("strict parser rejects duplicate JSON keys", () => {
  assert.deepEqual(parseProjectHarnessText('{"status":"BOOTSTRAP_OBSERVE"}'), {
    status: "BOOTSTRAP_OBSERVE",
  });
  assert.throws(
    () => parseProjectHarnessText('{"status":"BOOTSTRAP_OBSERVE","status":"READY"}'),
    /DUPLICATE_JSON_KEY/,
  );
});

test("repository reads reject path escape and symbolic links before reading", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "chaotang-g1-read-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "outside.json"), '{"secret":true}\n', "utf8");
  await symlink(path.join(root, "outside.json"), path.join(root, "linked.json"));

  assert.throws(() => readRepositoryFile(root, "../outside.json"), /REPOSITORY_PATH_INVALID/);
  assert.throws(() => readRepositoryFile(root, "linked.json"), /REPOSITORY_FILE_INVALID/);
  assert.equal(readRepositoryFile(root, "outside.json"), '{"secret":true}\n');
});

test("manifest contract is closed and rejects readiness or path impersonation", () => {
  assert.deepEqual(validateProjectHarnessManifest(EXPECTED_MANIFEST), []);

  const unknown = clone(EXPECTED_MANIFEST);
  unknown.ready = true;
  assert.match(validateProjectHarnessManifest(unknown).join("\n"), /MANIFEST_FIELDS_INVALID/);

  const forgedStatus = clone(EXPECTED_MANIFEST);
  forgedStatus.status = "READY";
  assert.match(validateProjectHarnessManifest(forgedStatus).join("\n"), /MANIFEST_STATUS_INVALID/);

  const forgedProduct = clone(EXPECTED_MANIFEST);
  forgedProduct.observedAuthority.canExecuteProductWork = true;
  assert.match(validateProjectHarnessManifest(forgedProduct).join("\n"), /AUTHORITY_PROJECTION_INVALID/);

  const absentWithDoctor = clone(EXPECTED_MANIFEST);
  absentWithDoctor.frontend.doctor = "scripts/harness-doctor.mjs";
  assert.match(validateProjectHarnessManifest(absentWithDoctor).join("\n"), /FRONTEND_LAYER_INVALID/);

  const duplicatePath = clone(EXPECTED_MANIFEST);
  duplicatePath.backend.harnessRoot = duplicatePath.frontend.harnessRoot;
  assert.match(validateProjectHarnessManifest(duplicatePath).join("\n"), /MANIFEST_PATHS_NOT_UNIQUE/);
});

test("schema is closed at every object boundary", async () => {
  const schema = parseProjectHarnessText(await readFile(SCHEMA_PATH, "utf8"));
  assert.deepEqual(schemaClosureErrors(schema), []);
  assert.deepEqual(validateProjectHarnessSchema(schema), []);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.root.additionalProperties, false);
  assert.equal(schema.properties.frontend.additionalProperties, false);
  assert.equal(schema.properties.backend.additionalProperties, false);
  assert.equal(schema.properties.observedAuthority.additionalProperties, false);

  const forgedReady = clone(schema);
  forgedReady.properties.status.const = "READY";
  assert.match(validateProjectHarnessSchema(forgedReady).join("\n"), /SCHEMA_CONTRACT_INVALID/);

  const forgedProduct = clone(schema);
  forgedProduct.properties.observedAuthority.properties.canExecuteProductWork.const = true;
  assert.match(validateProjectHarnessSchema(forgedProduct).join("\n"), /SCHEMA_CONTRACT_INVALID/);
});

test("disk projection accepts exact facts and fails on drift", async (t) => {
  const root = await createDiskFixture(t);
  assert.deepEqual(validateProjectHarnessDisk(root, EXPECTED_MANIFEST), []);

  const escapingPath = clone(EXPECTED_MANIFEST);
  escapingPath.root.entrypoint = "../../etc/passwd";
  assert.deepEqual(validateProjectHarnessDisk(root, escapingPath), ["MANIFEST_INVALID_FOR_DISK_CHECK"]);

  await mkdir(path.join(root, "frontend", ".harness"));
  assert.match(validateProjectHarnessDisk(root, EXPECTED_MANIFEST).join("\n"), /FRONTEND_ABSENCE_DRIFT/);

  await rm(path.join(root, "backend", "harness"), { recursive: true });
  assert.match(validateProjectHarnessDisk(root, EXPECTED_MANIFEST).join("\n"), /BACKEND_PARTIAL_DRIFT/);
});

test("repository manifest, disk and observed authority remain non-authorizing", async () => {
  const manifest = parseProjectHarnessText(await readFile(MANIFEST_PATH, "utf8"));
  assert.deepEqual(manifest, EXPECTED_MANIFEST);
  assert.deepEqual(validateProjectHarnessManifest(manifest), []);
  assert.deepEqual(validateProjectHarnessDisk(REPOSITORY_ROOT, manifest), []);
  assert.deepEqual(await observeExtAuthority(REPOSITORY_ROOT), {
    schemaVersion: "execution-authority.ext.result.v1",
    authorityId: "execution-authority.ext.v1",
    taskId: "EXT-GOV-AUTH-V1-20260815",
    decision: "STOP",
    canAcceptGovernanceCandidate: false,
    canExecuteProductWork: false,
    reason: "EXTERNAL_AUTHORITY_NOT_EVALUATED",
  });
});

test("CLI exposes only check, status and permanently-not-ready commands", () => {
  const checked = runDoctor("--check");
  assert.equal(checked.status, 0, checked.stderr);
  assert.deepEqual(JSON.parse(checked.stdout), {
    schemaVersion: "ext-project-harness.result.v1",
    command: "check",
    decision: "PASS",
    status: "BOOTSTRAP_OBSERVE",
    ready: false,
    canExecuteProductWork: false,
    reason: "STRUCTURE_VALID_NON_AUTHORIZING",
  });

  const status = runDoctor("--status");
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).decision, "OBSERVE");

  const ready = runDoctor("--ready");
  assert.equal(ready.status, 2, ready.stderr);
  assert.deepEqual(JSON.parse(ready.stdout), {
    schemaVersion: "ext-project-harness.result.v1",
    command: "ready",
    decision: "NOT_READY",
    status: "BOOTSTRAP_OBSERVE",
    ready: false,
    canExecuteProductWork: false,
    reason: "FRONTEND_ABSENT_BACKEND_PARTIAL_PRODUCT_STOP",
  });

  const invalid = runDoctor("--authorize");
  assert.equal(invalid.status, 64, invalid.stderr);
  assert.equal(JSON.parse(invalid.stdout).decision, "INVALID");
});

test("doctor source has no network, write or authorization command surface", async () => {
  const source = await readFile(DOCTOR_PATH, "utf8");
  for (const forbidden of [
    /node:http/,
    /node:https/,
    /node:net/,
    /\bfetch\s*\(/,
    /\bwriteFile/,
    /\bappendFile/,
    /\bmkdir/,
    /\bunlink/,
    /\brename/,
    /--authorize/,
    /shell\s*:\s*true/,
  ]) assert.doesNotMatch(source, forbidden);
});

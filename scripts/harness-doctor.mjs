#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { digestCanonical, parseJsonNoDuplicateKeys } from "./execution_authority_ext.mjs";

const RESULT_SCHEMA = "ext-project-harness.result.v1";
const MANIFEST_RELATIVE_PATH = ".harness/manifest/project-harness.json";
const SCHEMA_RELATIVE_PATH = ".harness/contracts/project-harness.schema.json";
const AUTHORITY_RELATIVE_PATH = "scripts/execution_authority_ext.mjs";
const EXPECTED_SCHEMA_DIGEST = "sha256:ee6d32ba167c77af125b07027439389e46fbafa21148331a1ecc6360b183f81d";
const PRODUCT_AUTHORITY_RELATIVE_PATH = "scripts/product-authority.mjs";

export const EXPECTED_MANIFEST = Object.freeze({
  schemaVersion: "ext-project-harness.v1",
  status: "BOOTSTRAP_OBSERVE",
  root: Object.freeze({
    status: "READY_FOR_OBSERVE",
    entrypoint: "AGENTS.md",
    harnessRoot: ".harness",
    manifest: MANIFEST_RELATIVE_PATH,
    doctor: "scripts/harness-doctor.mjs",
  }),
  frontend: Object.freeze({
    status: "ABSENT",
    entrypoint: "frontend/AGENTS.md",
    harnessRoot: "frontend/.harness",
    manifest: null,
    doctor: null,
  }),
  backend: Object.freeze({
    status: "PARTIAL",
    entrypoint: "backend/AGENTS.md",
    harnessRoot: "backend/harness",
    manifest: null,
    doctor: null,
  }),
  observedAuthority: Object.freeze({
    namespace: "execution-authority.ext.v1",
    decision: "STOP",
    canExecuteProductWork: false,
  }),
  productAuthority: Object.freeze({
    namespace: "product-authority.m0.v1",
    status: "CONSUMER_AVAILABLE",
    consumer: PRODUCT_AUTHORITY_RELATIVE_PATH,
    approvalSchema: ".harness/contracts/product-approval.schema.json",
    decision: "STOP",
    canExecuteProductWork: false,
  }),
  governanceGrantState: "EXTERNAL_NOT_CONSUMED",
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function hasExactFields(value, fields) {
  if (!isPlainObject(value) || Object.keys(value).length !== fields.length) return false;
  return fields.every((field) => Object.hasOwn(value, field));
}

function sameScalarFields(actual, expected) {
  return Object.keys(expected).every((field) => actual?.[field] === expected[field]);
}

function isSafeRepositoryPath(value) {
  return typeof value === "string" && value.length > 0 && value === path.posix.normalize(value)
    && !path.posix.isAbsolute(value) && value !== ".." && !value.startsWith("../") && !value.includes("\\");
}

function add(errors, code) {
  if (!errors.includes(code)) errors.push(code);
}

export function parseProjectHarnessText(text) {
  return parseJsonNoDuplicateKeys(text);
}

export function validateProjectHarnessManifest(manifest) {
  const errors = [];
  const topFields = [
    "schemaVersion",
    "status",
    "root",
    "frontend",
    "backend",
    "observedAuthority",
    "productAuthority",
    "governanceGrantState",
  ];
  const layerFields = ["status", "entrypoint", "harnessRoot", "manifest", "doctor"];
  const authorityFields = ["namespace", "decision", "canExecuteProductWork"];
  const productAuthorityFields = [
    "namespace",
    "status",
    "consumer",
    "approvalSchema",
    "decision",
    "canExecuteProductWork",
  ];

  if (!hasExactFields(manifest, topFields)) add(errors, "MANIFEST_FIELDS_INVALID");
  if (manifest?.schemaVersion !== EXPECTED_MANIFEST.schemaVersion) add(errors, "MANIFEST_SCHEMA_VERSION_INVALID");
  if (manifest?.status !== EXPECTED_MANIFEST.status) add(errors, "MANIFEST_STATUS_INVALID");

  if (!hasExactFields(manifest?.root, layerFields) || !sameScalarFields(manifest?.root, EXPECTED_MANIFEST.root)) {
    add(errors, "ROOT_LAYER_INVALID");
  }
  if (!hasExactFields(manifest?.frontend, layerFields) || !sameScalarFields(manifest?.frontend, EXPECTED_MANIFEST.frontend)) {
    add(errors, "FRONTEND_LAYER_INVALID");
  }
  if (!hasExactFields(manifest?.backend, layerFields) || !sameScalarFields(manifest?.backend, EXPECTED_MANIFEST.backend)) {
    add(errors, "BACKEND_LAYER_INVALID");
  }
  if (!hasExactFields(manifest?.observedAuthority, authorityFields)
    || !sameScalarFields(manifest?.observedAuthority, EXPECTED_MANIFEST.observedAuthority)) {
    add(errors, "AUTHORITY_PROJECTION_INVALID");
  }
  if (!hasExactFields(manifest?.productAuthority, productAuthorityFields)
    || !sameScalarFields(manifest?.productAuthority, EXPECTED_MANIFEST.productAuthority)) {
    add(errors, "PRODUCT_AUTHORITY_PROJECTION_INVALID");
  }
  if (manifest?.governanceGrantState !== "EXTERNAL_NOT_CONSUMED") add(errors, "GOVERNANCE_GRANT_STATE_INVALID");

  const repositoryPaths = ["root", "frontend", "backend"].flatMap((layer) => {
    const value = manifest?.[layer];
    return [value?.entrypoint, value?.harnessRoot, value?.manifest, value?.doctor].filter((entry) => entry !== null && entry !== undefined);
  });
  repositoryPaths.push(manifest?.productAuthority?.consumer, manifest?.productAuthority?.approvalSchema);
  if (repositoryPaths.some((entry) => !isSafeRepositoryPath(entry))) add(errors, "MANIFEST_PATH_INVALID");
  const normalized = repositoryPaths.map((entry) => entry.toLowerCase());
  if (new Set(normalized).size !== normalized.length) add(errors, "MANIFEST_PATHS_NOT_UNIQUE");
  return errors;
}

function pathKind(rootDir, relativePath) {
  let currentPath = rootDir;
  const segments = relativePath.split("/");
  for (const [index, segment] of segments.entries()) {
    currentPath = path.join(currentPath, segment);
    const stat = lstatSync(currentPath, { throwIfNoEntry: false });
    if (!stat) return "missing";
    if (stat.isSymbolicLink()) return "symlink";
    if (index < segments.length - 1) {
      if (!stat.isDirectory()) return "other";
      continue;
    }
    if (stat.isFile()) return "file";
    if (stat.isDirectory()) return "directory";
    return "other";
  }
  return "missing";
}

export function readRepositoryFile(rootDir, relativePath) {
  if (!isSafeRepositoryPath(relativePath)) throw new Error("REPOSITORY_PATH_INVALID");
  if (pathKind(rootDir, relativePath) !== "file") throw new Error("REPOSITORY_FILE_INVALID");
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

export function validateProjectHarnessDisk(rootDir, manifest) {
  if (validateProjectHarnessManifest(manifest).length > 0) {
    return ["MANIFEST_INVALID_FOR_DISK_CHECK"];
  }
  const errors = [];
  const exactFiles = [
    manifest.root.entrypoint,
    SCHEMA_RELATIVE_PATH,
    manifest.root.manifest,
    manifest.root.doctor,
    manifest.frontend.entrypoint,
    manifest.backend.entrypoint,
    manifest.productAuthority.consumer,
    manifest.productAuthority.approvalSchema,
  ];
  if (exactFiles.some((entry) => pathKind(rootDir, entry) !== "file")) add(errors, "REQUIRED_FILE_DRIFT");
  if (pathKind(rootDir, manifest.root.harnessRoot) !== "directory") add(errors, "ROOT_HARNESS_DRIFT");
  if (pathKind(rootDir, manifest.frontend.harnessRoot) !== "missing") add(errors, "FRONTEND_ABSENCE_DRIFT");
  if (pathKind(rootDir, manifest.backend.harnessRoot) !== "directory") add(errors, "BACKEND_PARTIAL_DRIFT");
  return errors;
}

export function schemaClosureErrors(schema) {
  const errors = [];
  const visit = (node, location) => {
    if (!isPlainObject(node)) return;
    if (node.type === "object") {
      if (node.additionalProperties !== false) add(errors, `SCHEMA_OBJECT_OPEN:${location}`);
      if (!isPlainObject(node.properties)) add(errors, `SCHEMA_PROPERTIES_INVALID:${location}`);
      const propertyNames = isPlainObject(node.properties) ? Object.keys(node.properties) : [];
      if (!Array.isArray(node.required)
        || node.required.length !== propertyNames.length
        || [...node.required].sort().join("\n") !== [...propertyNames].sort().join("\n")) {
        add(errors, `SCHEMA_REQUIRED_INVALID:${location}`);
      }
      for (const [name, child] of Object.entries(node.properties ?? {})) visit(child, `${location}.${name}`);
    }
  };
  visit(schema, "$");
  return errors;
}

export function validateProjectHarnessSchema(schema) {
  const errors = [...schemaClosureErrors(schema)];
  let schemaDigest = null;
  try {
    schemaDigest = digestCanonical(schema);
  } catch {
    schemaDigest = null;
  }
  const expectedLeaves = [
    [["properties", "schemaVersion", "const"], "ext-project-harness.v1"],
    [["properties", "status", "const"], "BOOTSTRAP_OBSERVE"],
    [["properties", "root", "properties", "status", "const"], "READY_FOR_OBSERVE"],
    [["properties", "root", "properties", "entrypoint", "const"], "AGENTS.md"],
    [["properties", "root", "properties", "harnessRoot", "const"], ".harness"],
    [["properties", "root", "properties", "manifest", "const"], MANIFEST_RELATIVE_PATH],
    [["properties", "root", "properties", "doctor", "const"], "scripts/harness-doctor.mjs"],
    [["properties", "frontend", "properties", "status", "const"], "ABSENT"],
    [["properties", "frontend", "properties", "entrypoint", "const"], "frontend/AGENTS.md"],
    [["properties", "frontend", "properties", "harnessRoot", "const"], "frontend/.harness"],
    [["properties", "frontend", "properties", "manifest", "type"], "null"],
    [["properties", "frontend", "properties", "doctor", "type"], "null"],
    [["properties", "backend", "properties", "status", "const"], "PARTIAL"],
    [["properties", "backend", "properties", "entrypoint", "const"], "backend/AGENTS.md"],
    [["properties", "backend", "properties", "harnessRoot", "const"], "backend/harness"],
    [["properties", "backend", "properties", "manifest", "type"], "null"],
    [["properties", "backend", "properties", "doctor", "type"], "null"],
    [["properties", "observedAuthority", "properties", "namespace", "const"], "execution-authority.ext.v1"],
    [["properties", "observedAuthority", "properties", "decision", "const"], "STOP"],
    [["properties", "observedAuthority", "properties", "canExecuteProductWork", "const"], false],
    [["properties", "productAuthority", "properties", "namespace", "const"], "product-authority.m0.v1"],
    [["properties", "productAuthority", "properties", "status", "const"], "CONSUMER_AVAILABLE"],
    [["properties", "productAuthority", "properties", "consumer", "const"], PRODUCT_AUTHORITY_RELATIVE_PATH],
    [["properties", "productAuthority", "properties", "approvalSchema", "const"], ".harness/contracts/product-approval.schema.json"],
    [["properties", "productAuthority", "properties", "decision", "const"], "STOP"],
    [["properties", "productAuthority", "properties", "canExecuteProductWork", "const"], false],
    [["properties", "governanceGrantState", "const"], "EXTERNAL_NOT_CONSUMED"],
  ];
  const valueAt = (keys) => keys.reduce((value, key) => value?.[key], schema);
  if (schema?.$schema !== "https://json-schema.org/draft/2020-12/schema"
    || schema?.$id !== "https://chaotang-os.local/contracts/ext-project-harness.v1.schema.json"
    || schema?.type !== "object"
    || schemaDigest !== EXPECTED_SCHEMA_DIGEST
    || expectedLeaves.some(([keys, expected]) => valueAt(keys) !== expected)) {
    add(errors, "SCHEMA_CONTRACT_INVALID");
  }
  return errors;
}

export async function observeExtAuthority(rootDir) {
  if (pathKind(rootDir, AUTHORITY_RELATIVE_PATH) !== "file") throw new Error("AUTHORITY_FILE_INVALID");
  const authorityPath = path.join(rootDir, AUTHORITY_RELATIVE_PATH);
  const result = spawnSync(process.execPath, [authorityPath, "--status"], {
    cwd: rootDir,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "" },
    timeout: 5_000,
  });
  if (result.error || result.status !== 0 || result.signal || result.stderr) throw new Error("AUTHORITY_STATUS_FAILED");
  const authority = parseProjectHarnessText(result.stdout.trim());
  if (!hasExactFields(authority, [
    "schemaVersion",
    "authorityId",
    "taskId",
    "decision",
    "canAcceptGovernanceCandidate",
    "canExecuteProductWork",
    "reason",
  ]) || authority.schemaVersion !== "execution-authority.ext.result.v1"
    || authority.authorityId !== EXPECTED_MANIFEST.observedAuthority.namespace
    || authority.decision !== "STOP"
    || authority.canAcceptGovernanceCandidate !== false
    || authority.canExecuteProductWork !== false
    || typeof authority.reason !== "string") {
    throw new Error("AUTHORITY_OBSERVATION_INVALID");
  }
  return authority;
}

export async function observeProductAuthority(rootDir) {
  if (pathKind(rootDir, PRODUCT_AUTHORITY_RELATIVE_PATH) !== "file") {
    throw new Error("PRODUCT_AUTHORITY_FILE_INVALID");
  }
  const authorityPath = path.join(rootDir, PRODUCT_AUTHORITY_RELATIVE_PATH);
  const result = spawnSync(process.execPath, [authorityPath, "--status"], {
    cwd: rootDir,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "" },
    timeout: 5_000,
  });
  if (result.error || result.status !== 0 || result.signal || result.stderr) {
    throw new Error("PRODUCT_AUTHORITY_STATUS_FAILED");
  }
  const authority = parseProjectHarnessText(result.stdout.trim());
  if (!hasExactFields(authority, [
    "schemaVersion",
    "authorityId",
    "command",
    "taskId",
    "decision",
    "canExecuteProductWork",
    "canAcceptProductCandidate",
    "approvalDigest",
    "candidateCommit",
    "candidateTree",
    "evidenceDigest",
    "reason",
  ]) || authority.schemaVersion !== "product-authority.m0.result.v1"
    || authority.authorityId !== EXPECTED_MANIFEST.productAuthority.namespace
    || authority.command !== "status"
    || authority.taskId !== null
    || authority.decision !== "STOP"
    || authority.canExecuteProductWork !== false
    || authority.canAcceptProductCandidate !== false
    || authority.approvalDigest !== null
    || authority.candidateCommit !== null
    || authority.candidateTree !== null
    || authority.evidenceDigest !== null
    || authority.reason !== "APPROVAL_NOT_SELECTED") {
    throw new Error("PRODUCT_AUTHORITY_OBSERVATION_INVALID");
  }
  return authority;
}

async function inspectRepository(rootDir) {
  const schema = parseProjectHarnessText(readRepositoryFile(rootDir, SCHEMA_RELATIVE_PATH));
  const manifest = parseProjectHarnessText(readRepositoryFile(rootDir, MANIFEST_RELATIVE_PATH));
  const errors = [
    ...validateProjectHarnessSchema(schema),
    ...validateProjectHarnessManifest(manifest),
    ...validateProjectHarnessDisk(rootDir, manifest),
  ];
  if (errors.length) throw new Error(errors.join(","));
  await observeExtAuthority(rootDir);
  await observeProductAuthority(rootDir);
  return manifest;
}

function publicResult(command, decision, reason) {
  return {
    schemaVersion: RESULT_SCHEMA,
    command,
    decision,
    status: EXPECTED_MANIFEST.status,
    ready: false,
    canExecuteProductWork: false,
    reason,
  };
}

export async function runCli(argv = process.argv.slice(2), rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")) {
  const commandMap = new Map([["--check", "check"], ["--status", "status"], ["--ready", "ready"]]);
  const command = argv.length === 1 ? commandMap.get(argv[0]) : undefined;
  if (!command) {
    process.stdout.write(`${JSON.stringify(publicResult("invalid", "INVALID", "USAGE_INVALID"))}\n`);
    return 64;
  }
  try {
    await inspectRepository(rootDir);
  } catch {
    process.stdout.write(`${JSON.stringify(publicResult(command, "STOP", "HARNESS_INVALID"))}\n`);
    return 2;
  }
  if (command === "check") {
    process.stdout.write(`${JSON.stringify(publicResult(command, "PASS", "STRUCTURE_VALID_NON_AUTHORIZING"))}\n`);
    return 0;
  }
  if (command === "status") {
    process.stdout.write(`${JSON.stringify(publicResult(command, "OBSERVE", "BOOTSTRAP_OBSERVE_NON_AUTHORIZING"))}\n`);
    return 0;
  }
  process.stdout.write(`${JSON.stringify(publicResult(command, "NOT_READY", "FRONTEND_ABSENT_BACKEND_PARTIAL_PRODUCT_STOP"))}\n`);
  return 2;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = await runCli();
}

#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = dirname(dirname(scriptPath));

export const CONVERGENCE_MANIFEST_PATH = '.harness/manifest/ext-branch-convergence.v1.json';
export const CONVERGENCE_SCHEMA_PATH = '.harness/contracts/ext-branch-convergence.schema.json';

export const ALLOWED_DISPOSITIONS = Object.freeze([
  'ABSORB_ADAPT',
  'REBUILD',
  'SUPERSEDED_VERIFY',
  'ARCHIVE',
  'REJECT',
  'DUPLICATE',
  'BLOCKED_WIP',
]);

export const ALLOWED_STATUSES = Object.freeze([
  'PLANNED',
  'BASELINED',
  'RED',
  'IMPLEMENTED',
  'VERIFIED',
  'REVIEW_GO',
  'INTEGRATED_LOCAL',
  'BLOCKED',
  'CLOSED',
]);

const IMPLEMENTATION_DISPOSITIONS = new Set(['ABSORB_ADAPT', 'REBUILD']);
const FULL_COMMIT = /^[0-9a-f]{40}$/u;
const COMMIT = /^[0-9a-f]{7,40}$/u;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const TARGET_OWNERS = new Set(['root', 'backend', 'frontend']);
const SNAPSHOT_KEYS = [
  'capturedAt',
  'integrationTarget',
  'integrationHead',
  'integrationTree',
  'sourceRefCount',
  'inventoryRule',
  'authorityPackage',
  'plan',
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function hasExactKeys(value, expected) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

export async function loadConvergenceManifest(root = defaultRoot) {
  const text = await readFile(resolve(root, CONVERGENCE_MANIFEST_PATH), 'utf8');
  return JSON.parse(text);
}

export function validateConvergenceManifest(manifest) {
  const errors = [];
  if (!isObject(manifest)) return ['manifest must be an object'];
  if (manifest.schemaVersion !== 'ext-branch-convergence.v1') {
    errors.push('schemaVersion must be ext-branch-convergence.v1');
  }
  if (!isObject(manifest.snapshot)) errors.push('snapshot must be an object');
  if (!Array.isArray(manifest.assetFamilies)) errors.push('assetFamilies must be an array');
  if (!Array.isArray(manifest.branches)) errors.push('branches must be an array');
  if (errors.length > 0) return errors;

  if (!hasExactKeys(manifest.snapshot, SNAPSHOT_KEYS)) errors.push('snapshot has an invalid field set');
  if (!ISO_DATE_TIME.test(manifest.snapshot.capturedAt ?? '') || Number.isNaN(Date.parse(manifest.snapshot.capturedAt))) {
    errors.push('snapshot.capturedAt must be an ISO 8601 date-time');
  }
  if (manifest.snapshot.sourceRefCount !== manifest.branches.length) {
    errors.push(`snapshot.sourceRefCount ${manifest.snapshot.sourceRefCount} does not match branches.length ${manifest.branches.length}`);
  }
  if (manifest.snapshot.sourceRefCount !== 99) errors.push('snapshot.sourceRefCount must be 99');
  if (manifest.snapshot.integrationTarget !== 'feature-chaotang-ext') {
    errors.push('snapshot.integrationTarget must be feature-chaotang-ext');
  }
  if (!FULL_COMMIT.test(manifest.snapshot.integrationHead ?? '')) {
    errors.push('snapshot.integrationHead must be a 40-character lowercase commit hash');
  }
  if (!FULL_COMMIT.test(manifest.snapshot.integrationTree ?? '')) {
    errors.push('snapshot.integrationTree must be a 40-character lowercase tree hash');
  }
  if (manifest.snapshot.inventoryRule !== 'LOCAL_BRANCH_NOT_ANCESTOR_OF_INTEGRATION_TARGET_AT_CAPTURE') {
    errors.push('snapshot.inventoryRule must freeze non-ancestor local branches');
  }
  if (manifest.snapshot.authorityPackage !== 'R0-W08') {
    errors.push('snapshot.authorityPackage must be R0-W08');
  }
  if (manifest.snapshot.plan !== 'docs/superpowers/plans/2026-08-03-ext-99-branch-capability-convergence.md') {
    errors.push('snapshot.plan must reference the approved convergence plan');
  }

  const familyIds = new Set();
  const familiesById = new Map();
  manifest.assetFamilies.forEach((family, index) => {
    if (!hasExactKeys(family, ['id', 'title', 'canonicalDonor', 'decision', 'status'])) {
      errors.push(`assetFamilies[${index}] has an invalid field set`);
      return;
    }
    if (!nonEmptyString(family.id)) errors.push(`assetFamilies[${index}].id is required`);
    else if (familyIds.has(family.id)) errors.push(`duplicate asset family: ${family.id}`);
    else {
      familyIds.add(family.id);
      familiesById.set(family.id, family);
    }
    if (!ALLOWED_DISPOSITIONS.includes(family.decision)) {
      errors.push(`assetFamilies[${index}].decision is not allowed: ${family.decision}`);
    }
    if (!ALLOWED_STATUSES.includes(family.status)) {
      errors.push(`assetFamilies[${index}].status is not allowed: ${family.status}`);
    }
  });

  const requiredRecordKeys = [
    'branch',
    'tip',
    'assetFamily',
    'candidateCommits',
    'disposition',
    'canonicalDonor',
    'containedBy',
    'authorityPackage',
    'targetOwners',
    'targetFiles',
    'proofCommands',
    'status',
    'checkpoint',
    'reviewReceipt',
    'integrationCommit',
    'blockedReason',
  ];
  const branchNames = new Set();
  manifest.branches.forEach((branch, index) => {
    if (!hasExactKeys(branch, requiredRecordKeys)) {
      errors.push(`branches[${index}] has an invalid field set`);
      return;
    }
    if (!nonEmptyString(branch.branch)) errors.push(`branches[${index}].branch is required`);
    else if (branchNames.has(branch.branch)) errors.push(`duplicate branch: ${branch.branch}`);
    else branchNames.add(branch.branch);
    if (!FULL_COMMIT.test(branch.tip ?? '')) {
      errors.push(`branches[${index}].tip must be a 40-character lowercase commit hash`);
    }
    if (!familyIds.has(branch.assetFamily)) {
      errors.push(`branches[${index}].assetFamily is not registered: ${branch.assetFamily}`);
    }
    if (!ALLOWED_DISPOSITIONS.includes(branch.disposition)) {
      errors.push(`branches[${index}].disposition is not allowed: ${branch.disposition}`);
    }
    if (!ALLOWED_STATUSES.includes(branch.status)) {
      errors.push(`branches[${index}].status is not allowed: ${branch.status}`);
    }
    if (typeof branch.canonicalDonor !== 'boolean') {
      errors.push(`branches[${index}].canonicalDonor must be boolean`);
    }
    if (IMPLEMENTATION_DISPOSITIONS.has(branch.disposition) && !nonEmptyString(branch.authorityPackage)) {
      errors.push(`branches[${index}] ${branch.disposition} requires authorityPackage`);
    }
    if (branch.status === 'CLOSED' && !nonEmptyString(branch.checkpoint)) {
      errors.push(`branches[${index}] CLOSED requires checkpoint proof`);
    }
    if (branch.disposition === 'DUPLICATE' && !nonEmptyString(branch.containedBy)) {
      errors.push(`branches[${index}] DUPLICATE requires containedBy`);
    }
    if (branch.disposition === 'BLOCKED_WIP' && !nonEmptyString(branch.blockedReason)) {
      errors.push(`branches[${index}] BLOCKED_WIP requires blockedReason`);
    }
    for (const field of ['candidateCommits', 'targetOwners', 'targetFiles', 'proofCommands']) {
      if (!Array.isArray(branch[field])) errors.push(`branches[${index}].${field} must be an array`);
    }
    if (Array.isArray(branch.candidateCommits)) {
      branch.candidateCommits.forEach((commit, itemIndex) => {
        if (!COMMIT.test(commit ?? '')) {
          errors.push(`branches[${index}].candidateCommits[${itemIndex}] must be a 7-40 character lowercase commit hash`);
        }
      });
    }
    if (Array.isArray(branch.targetOwners)) {
      branch.targetOwners.forEach((owner, itemIndex) => {
        if (!TARGET_OWNERS.has(owner)) {
          errors.push(`branches[${index}].targetOwners[${itemIndex}] is not allowed: ${owner}`);
        }
      });
    }
    for (const field of ['targetFiles', 'proofCommands']) {
      if (!Array.isArray(branch[field])) continue;
      branch[field].forEach((value, itemIndex) => {
        if (!nonEmptyString(value)) {
          errors.push(`branches[${index}].${field}[${itemIndex}] must be a non-empty string`);
        }
      });
    }
  });

  for (const [familyId, family] of familiesById) {
    const members = manifest.branches.filter((branch) => branch.assetFamily === familyId);
    if (members.length === 0) errors.push(`asset family ${familyId} has no branches`);
    const canonical = members.filter((branch) => branch.canonicalDonor);
    const expectedCount = family.canonicalDonor === null ? 0 : 1;
    if (canonical.length !== expectedCount) {
      errors.push(`asset family ${familyId} must have exactly ${expectedCount === 0 ? 'zero' : 'one'} canonical donor; found ${canonical.length}`);
    } else if (expectedCount === 1 && canonical[0].branch !== family.canonicalDonor) {
      errors.push(`asset family ${familyId} canonical donor mismatch: expected ${family.canonicalDonor} got ${canonical[0].branch}`);
    }
  }

  for (const [index, branch] of manifest.branches.entries()) {
    if (branch.containedBy !== null && !branchNames.has(branch.containedBy)) {
      errors.push(`branches[${index}].containedBy is not a frozen source ref: ${branch.containedBy}`);
    }
  }
  return errors;
}

async function resolveGitRef(root, branch) {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--verify', `refs/heads/${branch}`], {
      cwd: root,
      encoding: 'utf8',
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function verifyConvergenceRefs(
  manifest,
  { root = defaultRoot, resolveRef = (branch) => resolveGitRef(root, branch) } = {},
) {
  const errors = [];
  for (const branch of manifest.branches) {
    const actual = await resolveRef(branch.branch);
    if (actual === null) errors.push(`source ref missing: ${branch.branch}`);
    else if (actual !== branch.tip) errors.push(`source ref moved: ${branch.branch} expected ${branch.tip} got ${actual}`);
  }
  return errors;
}

export function summarizeConvergence(manifest) {
  const dispositionCounts = Object.fromEntries(ALLOWED_DISPOSITIONS.map((key) => [key, 0]));
  const statusCounts = Object.fromEntries(ALLOWED_STATUSES.map((key) => [key, 0]));
  for (const branch of manifest.branches) {
    if (Object.hasOwn(dispositionCounts, branch.disposition)) dispositionCounts[branch.disposition] += 1;
    if (Object.hasOwn(statusCounts, branch.status)) statusCounts[branch.status] += 1;
  }
  const closedRefCount = statusCounts.CLOSED;
  return {
    sourceRefCount: manifest.branches.length,
    familyCount: manifest.assetFamilies.length,
    closedRefCount,
    openRefCount: manifest.branches.length - closedRefCount,
    dispositionCounts,
    statusCounts,
  };
}

export function selectConvergenceFamily(manifest, familyId) {
  const family = manifest.assetFamilies.find((entry) => entry.id === familyId);
  if (!family) return null;
  return {
    family,
    branches: manifest.branches.filter((entry) => entry.assetFamily === familyId),
  };
}

async function runCli(args = process.argv.slice(2), root = defaultRoot) {
  const [mode = '--status', value, ...extra] = args;
  const valid = mode === '--check' || mode === '--status' || mode === '--family';
  if (!valid || extra.length > 0 || (mode === '--family' && !nonEmptyString(value)) || (mode !== '--family' && value !== undefined)) {
    console.error('Usage: node scripts/ext-branch-convergence.mjs --check|--status|--family <family-id>');
    return 64;
  }

  const manifest = await loadConvergenceManifest(root);
  const validationErrors = validateConvergenceManifest(manifest);
  if (mode === '--family') {
    const selected = selectConvergenceFamily(manifest, value);
    if (!selected) {
      console.log(JSON.stringify({ schemaVersion: manifest.schemaVersion, decision: 'NOT_FOUND', familyId: value }, null, 2));
      return 2;
    }
    console.log(JSON.stringify({ schemaVersion: manifest.schemaVersion, decision: validationErrors.length === 0 ? 'PASS' : 'FAIL', ...selected, errors: validationErrors }, null, 2));
    return validationErrors.length === 0 ? 0 : 1;
  }
  if (mode === '--status') {
    console.log(JSON.stringify({ schemaVersion: manifest.schemaVersion, decision: validationErrors.length === 0 ? 'PASS' : 'FAIL', summary: summarizeConvergence(manifest), errors: validationErrors }, null, 2));
    return validationErrors.length === 0 ? 0 : 1;
  }
  const refErrors = validationErrors.length === 0 ? await verifyConvergenceRefs(manifest, { root }) : [];
  const errors = [...validationErrors, ...refErrors];
  console.log(JSON.stringify({ schemaVersion: manifest.schemaVersion, decision: errors.length === 0 ? 'PASS' : 'FAIL', summary: summarizeConvergence(manifest), errors }, null, 2));
  return errors.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    process.exitCode = await runCli();
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}

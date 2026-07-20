#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateR0AmendmentMarkdown } from './lib/r0-amendment-check.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const arguments_ = process.argv.slice(2);
const amendmentPath = resolve(
  root,
  '.harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md',
);
const amendmentRelativePath =
  '.harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md';
const projectManifestPath = resolve(root, '.harness/manifest/project-harness.json');
const requiredOwnerAssignmentKeys = Object.freeze([
  'product',
  'program',
  'backendApiContract',
  'canonicalRuntime',
  'securityData',
  'frontend',
  'qaLegalEvaluation',
  'release',
  'security',
]);

function hasValidEffectiveBase(effectiveBase) {
  return (
    typeof effectiveBase?.ref === 'string' &&
    effectiveBase.ref.length > 0 &&
    /^[0-9a-f]{40}$/.test(effectiveBase?.sha ?? '')
  );
}

function hasValidOwnerAssignments(ownerAssignments) {
  return (
    ownerAssignments !== null &&
    typeof ownerAssignments === 'object' &&
    requiredOwnerAssignmentKeys.every(
      (key) =>
        typeof ownerAssignments[key] === 'string' &&
        ownerAssignments[key].trim() !== '' &&
        ownerAssignments[key] !== 'UNASSIGNED',
    )
  );
}

function printFailure(errorCode) {
  console.log(
    JSON.stringify(
      {
        schemaVersion: 'r0-amendment-check.v1',
        amendmentPath,
        sourceDigest: null,
        expectedSourceDigest: null,
        effectiveBase: null,
        ownerAssignments: null,
        decision: 'STOP',
        requirements: 'UNKNOWN',
        exitGates: 'UNKNOWN',
        milestones: 'UNKNOWN',
        canAuthorizeRuntime: false,
        errors: [errorCode],
      },
      null,
      2,
    ),
  );
}

async function main() {
  if (arguments_.length !== 0) {
    console.error('Usage: node scripts/r0-amendment-check.mjs (canonical amendment path only)');
    return 64;
  }

  let sourceBytes;
  let projectManifestBytes;
  try {
    [sourceBytes, projectManifestBytes] = await Promise.all([
      readFile(amendmentPath),
      readFile(projectManifestPath),
    ]);
  } catch {
    printFailure('AMENDMENT_OR_MANIFEST_READ_FAILED');
    return 66;
  }

  let projectManifest;
  try {
    projectManifest = JSON.parse(projectManifestBytes.toString('utf8'));
  } catch {
    printFailure('PROJECT_HARNESS_MANIFEST_INVALID');
    return 65;
  }

  const source = sourceBytes.toString('utf8');
  const sourceDigest = createHash('sha256').update(sourceBytes).digest('hex');
  const amendmentGovernance = projectManifest.amendmentGovernance;
  const expectedSourceDigest = amendmentGovernance?.candidateSourceDigest;
  const effectiveBase = amendmentGovernance?.effectiveBase;
  const ownerAssignments = amendmentGovernance?.ownerAssignments;
  const errors = validateR0AmendmentMarkdown(source, {
    effectiveBase,
    ownerAssignments,
  });
  if (!hasValidEffectiveBase(effectiveBase)) {
    errors.push('manifest amendment effectiveBase is missing or invalid');
  }
  if (!hasValidOwnerAssignments(ownerAssignments)) {
    errors.push('manifest amendment ownerAssignments are missing or invalid');
  }
  if (amendmentGovernance?.document !== amendmentRelativePath) {
    errors.push('manifest amendment document differs from canonical amendment path');
  }
  if (sourceDigest !== expectedSourceDigest) {
    errors.push('amendment sourceDigest differs from manifest candidateSourceDigest');
  }
  const output = {
    schemaVersion: 'r0-amendment-check.v1',
    amendmentPath,
    sourceDigest,
    expectedSourceDigest: expectedSourceDigest ?? null,
    effectiveBase: effectiveBase ?? null,
    ownerAssignments: ownerAssignments ?? null,
    decision: errors.length === 0 ? 'VALID_REPINNED_AMENDMENT' : 'STOP',
    requirements: errors.length === 0 ? '22/22_UNIQUE' : 'INVALID',
    exitGates: errors.length === 0 ? '9/9_OWNED' : 'INVALID',
    milestones: errors.length === 0 ? '11/11_DISPOSED' : 'INVALID',
    canAuthorizeRuntime: false,
    errors,
  };
  console.log(JSON.stringify(output, null, 2));
  return errors.length === 0 ? 0 : 1;
}

process.exitCode = await main();

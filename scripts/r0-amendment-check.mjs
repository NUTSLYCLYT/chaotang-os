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

function printFailure(errorCode) {
  console.log(
    JSON.stringify(
      {
        schemaVersion: 'r0-amendment-check.v1',
        amendmentPath,
        sourceDigest: null,
        expectedSourceDigest: null,
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
  const expectedSourceDigest = projectManifest.amendmentGovernance?.candidateSourceDigest;
  const errors = validateR0AmendmentMarkdown(source);
  if (projectManifest.amendmentGovernance?.document !== amendmentRelativePath) {
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
    decision: errors.length === 0 ? 'VALID_PROPOSED_AMENDMENT' : 'STOP',
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

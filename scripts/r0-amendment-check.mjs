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

async function main() {
  if (arguments_.length !== 0) {
    console.error('Usage: node scripts/r0-amendment-check.mjs (canonical amendment path only)');
    return 64;
  }

  try {
    const sourceBytes = await readFile(amendmentPath);
    const source = sourceBytes.toString('utf8');
    const errors = validateR0AmendmentMarkdown(source);
    const output = {
      schemaVersion: 'r0-amendment-check.v1',
      amendmentPath,
      sourceDigest: createHash('sha256').update(sourceBytes).digest('hex'),
      decision: errors.length === 0 ? 'VALID_PROPOSED_AMENDMENT' : 'STOP',
      requirements: errors.length === 0 ? '22/22_UNIQUE' : 'INVALID',
      exitGates: errors.length === 0 ? '9/9_OWNED' : 'INVALID',
      milestones: errors.length === 0 ? '11/11_DISPOSED' : 'INVALID',
      canAuthorizeRuntime: false,
      errors,
    };
    console.log(JSON.stringify(output, null, 2));
    return errors.length === 0 ? 0 : 1;
  } catch {
    console.log(
      JSON.stringify(
        {
          schemaVersion: 'r0-amendment-check.v1',
          amendmentPath,
          sourceDigest: null,
          decision: 'STOP',
          requirements: 'UNKNOWN',
          exitGates: 'UNKNOWN',
          milestones: 'UNKNOWN',
          canAuthorizeRuntime: false,
          errors: ['AMENDMENT_READ_FAILED'],
        },
        null,
        2,
      ),
    );
    return 66;
  }
}

process.exitCode = await main();

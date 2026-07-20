#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateR0AmendmentMarkdown } from './lib/r0-amendment-check.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const arguments_ = process.argv.slice(2);

if (arguments_.length > 1) {
  console.error('Usage: node scripts/r0-amendment-check.mjs [amendment-path]');
  process.exit(64);
}

const amendmentPath = resolve(
  root,
  arguments_[0] ??
    '.harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md',
);

try {
  const source = await readFile(amendmentPath, 'utf8');
  const errors = validateR0AmendmentMarkdown(source);
  const output = {
    schemaVersion: 'r0-amendment-check.v1',
    amendmentPath,
    decision: errors.length === 0 ? 'VALID_PROPOSED_AMENDMENT' : 'STOP',
    requirements: errors.length === 0 ? '22/22_UNIQUE' : 'INVALID',
    exitGates: errors.length === 0 ? '9/9_OWNED' : 'INVALID',
    canAuthorizeRuntime: false,
    errors,
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(errors.length === 0 ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

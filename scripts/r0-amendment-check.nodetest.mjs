import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { validateR0AmendmentMarkdown } from './lib/r0-amendment-check.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const amendmentPath = join(
  root,
  '.harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md',
);

test('R0 amendment maps all requirements and exit gates to one owner', async () => {
  const source = await readFile(amendmentPath, 'utf8');
  assert.deepEqual(validateR0AmendmentMarkdown(source), []);
});

test('R0 amendment validator rejects missing or duplicate requirement ownership', async () => {
  const source = await readFile(amendmentPath, 'utf8');
  const missing = source.replace(/^\| 022 \|.*\n/m, '');
  assert.ok(validateR0AmendmentMarkdown(missing).some((error) => error.includes('REQ 022')));

  const duplicate = source.replace(
    /^\| 022 \|.*$/m,
    (row) => `${row}\n| 022 | W05 | Duplicate Owner | duplicate | duplicate |`,
  );
  assert.ok(validateR0AmendmentMarkdown(duplicate).some((error) => error.includes('duplicate REQ 022')));
});

test('R0 amendment validator rejects a missing release exit gate', async () => {
  const source = await readFile(amendmentPath, 'utf8');
  const missing = source.replace(/^\| G04 \|.*\n/m, '');
  assert.ok(validateR0AmendmentMarkdown(missing).some((error) => error.includes('exit gate G04')));
});

test('R0 amendment validator requires fail-closed approval controls', async () => {
  const source = await readFile(amendmentPath, 'utf8');
  for (const requiredControl of [
    'git diff --binary <B>..<H> | sha256sum',
    'decision != GO',
    'OQ-02',
    'OQ-03',
    'OQ-09',
    'OQ-10',
  ]) {
    const mutated = source.replaceAll(requiredControl, 'REMOVED_CONTROL');
    assert.ok(
      validateR0AmendmentMarkdown(mutated).some((error) => error.includes(requiredControl)),
      `expected missing control error for ${requiredControl}`,
    );
  }
});

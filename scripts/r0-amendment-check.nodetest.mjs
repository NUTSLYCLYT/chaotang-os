import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { validateR0AmendmentMarkdown } from './lib/r0-amendment-check.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const execFileAsync = promisify(execFile);
const cliPath = join(root, 'scripts/r0-amendment-check.mjs');
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
    'OQ-01',
    'OQ-03',
    'OQ-09',
    'OQ-10',
    '1 → 2 → 4 → 5 → 3',
    '明确未批准 W02–W09 runtime',
  ]) {
    const mutated = source.replaceAll(requiredControl, 'REMOVED_CONTROL');
    assert.ok(
      validateR0AmendmentMarkdown(mutated).some((error) => error.includes(requiredControl)),
      `expected missing control error for ${requiredControl}`,
    );
  }

  const invertedDecision = source.replace(
    '`decision != GO`、字段缺失或包不一致立即 STOP',
    '`decision != GO`、字段缺失或包不一致可继续',
  );
  assert.ok(
    validateR0AmendmentMarkdown(invertedDecision).some((error) =>
      error.includes('decision != GO'),
    ),
  );

  const weakenedOq = source.replace('W03 RED 前 | W03 保持', 'W03 GREEN 后 | W03 保持');
  assert.ok(validateR0AmendmentMarkdown(weakenedOq).some((error) => error.includes('OQ-02')));
});

test('R0 amendment validator cross-checks packet ownership and legacy milestone disposition', async () => {
  const source = await readFile(amendmentPath, 'utf8');
  const conflictingOwner = source.replace(
    '| 2 | R0-W02 | 合同、Mission、裁决、状态的共享 v1 契约 | 003–007、012、017 |',
    '| 2 | R0-W02 | 合同、Mission、裁决、状态的共享 v1 契约 | 003–007、012、017、019 |',
  );
  assert.ok(
    validateR0AmendmentMarkdown(conflictingOwner).some((error) =>
      error.includes('packet ownership'),
    ),
  );

  const missingM10 = source.replace(/^\| M10 \|.*\n/m, '');
  assert.ok(
    validateR0AmendmentMarkdown(missingM10).some((error) => error.includes('milestone M10')),
  );

  const accidentalW08Owner = source.replace('| 消费 001–022 |', '| 001–022 消费 |');
  assert.ok(
    validateR0AmendmentMarkdown(accidentalW08Owner).some((error) =>
      error.includes('non-owner packet W08'),
    ),
  );
});

test('R0 amendment CLI binds output to canonical bytes and never authorizes runtime', async () => {
  const { stdout } = await execFileAsync(process.execPath, [cliPath], { cwd: root });
  const output = JSON.parse(stdout);
  const sourceBytes = await readFile(amendmentPath);
  assert.equal(output.sourceDigest, createHash('sha256').update(sourceBytes).digest('hex'));
  assert.equal(output.expectedSourceDigest, output.sourceDigest);
  assert.equal(output.canAuthorizeRuntime, false);
  assert.equal(output.decision, 'VALID_PROPOSED_AMENDMENT');

  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, amendmentPath], { cwd: root }),
    (error) => error.code === 64 && error.stderr.includes('canonical amendment path'),
  );
});

test('R0 amendment CLI returns distinct fail-closed results for invalid and unreadable input', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'r0-amendment-check-'));
  try {
    const fixtureScripts = join(fixtureRoot, 'scripts');
    const fixtureChange = join(
      fixtureRoot,
      '.harness/changes/docs-r0-trusted-kernel-amendment-20260720',
    );
    await mkdir(join(fixtureScripts, 'lib'), { recursive: true });
    await mkdir(fixtureChange, { recursive: true });
    await mkdir(join(fixtureRoot, '.harness/manifest'), { recursive: true });
    await copyFile(cliPath, join(fixtureScripts, 'r0-amendment-check.mjs'));
    await copyFile(
      join(root, 'scripts/lib/r0-amendment-check.mjs'),
      join(fixtureScripts, 'lib/r0-amendment-check.mjs'),
    );
    await copyFile(
      join(root, '.harness/manifest/project-harness.json'),
      join(fixtureRoot, '.harness/manifest/project-harness.json'),
    );

    const fixtureAmendment = join(fixtureChange, 'amendment.md');
    await copyFile(amendmentPath, fixtureAmendment);
    const fixtureManifestPath = join(fixtureRoot, '.harness/manifest/project-harness.json');
    const fixtureManifest = JSON.parse(await readFile(fixtureManifestPath, 'utf8'));
    fixtureManifest.amendmentGovernance.candidateSourceDigest = '0'.repeat(64);
    await writeFile(fixtureManifestPath, `${JSON.stringify(fixtureManifest, null, 2)}\n`);
    await assert.rejects(
      execFileAsync(process.execPath, [join(fixtureScripts, 'r0-amendment-check.mjs')], {
        cwd: fixtureRoot,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        return (
          error.code === 1 &&
          output.errors.includes(
            'amendment sourceDigest differs from manifest candidateSourceDigest',
          )
        );
      },
    );

    await writeFile(fixtureAmendment, 'invalid amendment\n');
    await assert.rejects(
      execFileAsync(process.execPath, [join(fixtureScripts, 'r0-amendment-check.mjs')], {
        cwd: fixtureRoot,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        return error.code === 1 && output.decision === 'STOP' && output.canAuthorizeRuntime === false;
      },
    );

    await rm(fixtureAmendment);
    await assert.rejects(
      execFileAsync(process.execPath, [join(fixtureScripts, 'r0-amendment-check.mjs')], {
        cwd: fixtureRoot,
      }),
      (error) => {
        const output = JSON.parse(error.stdout);
        return error.code === 66 && output.decision === 'STOP' && output.canAuthorizeRuntime === false;
      },
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

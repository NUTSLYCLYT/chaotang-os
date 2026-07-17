import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const retirementRoot = resolve(root, 'dev/_attic/governance-orphans-2026-07-17');

const originalPaths = [
  'src/lib/orchestration/court-pipeline.ts',
  'src/features/governance/lib/three-chamber-engine.ts',
  'src/features/governance/components/deliberation-console.tsx',
  'src/lib/orchestration/court-pipeline.nodetest.ts',
  'src/features/governance/lib/retrieve-relevance.nodetest.ts',
];

test('P6 governance orphan cluster exists only in dated attic with restoration evidence', () => {
  for (const path of originalPaths) {
    assert.equal(existsSync(resolve(root, path)), false, `retired original path still exists: ${path}`);
    assert.equal(existsSync(resolve(retirementRoot, path)), true, `attic copy missing: ${path}`);
  }
  for (const evidence of ['README.md', 'EXPIRES-2026-08-17.md', 'restore-manifest.json']) {
    assert.equal(existsSync(resolve(retirementRoot, evidence)), true, `retirement evidence missing: ${evidence}`);
  }
});

test('P6 retired governance modules are permanently covered by the production import guard', () => {
  const guard = readFileSync(resolve(root, 'scripts/architecture-import-guard.mjs'), 'utf8');
  for (const name of ['court-pipeline', 'three-chamber-engine', 'deliberation-console']) {
    assert.match(guard, new RegExp(name), `retired module missing from import guard: ${name}`);
  }
});

test('P6 restore manifest is bound to the repaired base and exact attic bytes', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(retirementRoot, 'restore-manifest.json'), 'utf8'),
  ) as {
    baseline_commit: string;
    files: Array<{ original_path: string; attic_path: string; sha256: string }>;
  };
  assert.equal(manifest.baseline_commit, 'd7f7436fb6a7f257df7b13a4bc703c866602b243');
  assert.deepEqual(
    manifest.files.map((file) => file.original_path.replace(/^frontend\//, '')).sort(),
    [...originalPaths].sort(),
  );

  for (const file of manifest.files) {
    const atticPath = resolve(root, file.attic_path.replace(/^frontend\//, ''));
    const digest = createHash('sha256').update(readFileSync(atticPath)).digest('hex');
    assert.equal(digest, file.sha256, file.attic_path);
  }
});

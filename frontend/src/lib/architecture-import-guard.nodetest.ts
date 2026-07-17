import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  findRestrictedProductionImports,
  validateProductionImportText,
} from '../../scripts/architecture-import-guard.mjs';

test('current production imports match the frozen P2 allowlist', () => {
  assert.deepEqual(findRestrictedProductionImports(), []);
});

test('a new attic import is rejected', () => {
  const violations = validateProductionImportText(
    'src/features/example/new-writer.ts',
    "import { legacy } from '@/dev/_attic/legacy';\n",
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0], /dev\/_attic/);
});

test('a side-effect attic import is rejected', () => {
  const violations = validateProductionImportText(
    'src/features/example/side-effect.ts',
    "import '@/dev/_attic/register-legacy';\n",
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0], /dev\/_attic/);
});

test('a new local decision-engine import is rejected', () => {
  const violations = validateProductionImportText(
    'src/features/example/new-brain.ts',
    "import { runMinistryReview } from '@/core/courtos/ministries/ministry-review-loop.ts';\n",
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0], /ministry-review-loop/);
});

test('a retired P6 governance module cannot return to production imports', () => {
  for (const engine of ['court-pipeline', 'three-chamber-engine', 'deliberation-console']) {
    const violations = validateProductionImportText(
      'src/features/example/governance-revival.ts',
      `import { legacy } from '@/features/governance/${engine}.ts';\n`,
    );
    assert.equal(violations.length, 1, engine);
    assert.match(violations[0], new RegExp(engine));
  }
});

test('an allowlisted file cannot add a different decision engine', () => {
  const violations = validateProductionImportText(
    'src/core/courtos/runtime/live-memorial-build.ts',
    "import { runCourtUnifiedDecisionLoop } from '../unified/unified-decision-loop.ts';\n",
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0], /unified-decision-loop/);
});

test('junjichu has no local decision markers after the P4a projection cutover', () => {
  const source = readFileSync(new URL('../app/(dashboard)/junjichu/page.tsx', import.meta.url), 'utf8');
  for (const marker of [
    "status: 'local_decision'",
    "source: 'MIXED'",
    'runMinistryReview(',
    'runYushitaiAudit(',
    'synthesizeImperialReport(',
    'runCourtUnifiedDecisionLoop(',
  ]) {
    assert.equal(source.includes(marker), false, `junjichu still contains local decision marker: ${marker}`);
  }
});

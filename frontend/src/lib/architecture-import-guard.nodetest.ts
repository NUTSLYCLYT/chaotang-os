import assert from 'node:assert/strict';
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

test('an allowlisted file cannot add a different decision engine', () => {
  const violations = validateProductionImportText(
    'src/core/courtos/runtime/live-memorial-build.ts',
    "import { runCourtUnifiedDecisionLoop } from '../unified/unified-decision-loop.ts';\n",
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0], /unified-decision-loop/);
});

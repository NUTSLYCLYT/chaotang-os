import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldBlockCourtOnboarding } from './court-onboarding-paths';

test('basePath dashboard routes do not show the onboarding modal over work flows', () => {
  assert.equal(shouldBlockCourtOnboarding('/chaotang/shangshufang'), true);
  assert.equal(shouldBlockCourtOnboarding('/chaotang/shiguan'), true);
  assert.equal(shouldBlockCourtOnboarding('/chaotang/dadian'), true);
});

test('non-basePath dashboard routes also keep onboarding out of the work surface', () => {
  assert.equal(shouldBlockCourtOnboarding('/shangshufang'), true);
  assert.equal(shouldBlockCourtOnboarding('/shiguan'), true);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { isCanonicalProjectionEnabled } from './canonical-projection-rollout';

test('canonical projection rollout defaults on and accepts the explicit off switch', () => {
  assert.equal(isCanonicalProjectionEnabled(undefined), true);
  assert.equal(isCanonicalProjectionEnabled('true'), true);
  assert.equal(isCanonicalProjectionEnabled('false'), false);
});

test('unknown rollout values fail closed to the safe waiting mode', () => {
  assert.equal(isCanonicalProjectionEnabled('legacy'), false);
});

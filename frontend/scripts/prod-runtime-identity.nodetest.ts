import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyProductionListenerOwnership } from './prod-runtime-identity.mjs';

test('rejects a 3050 listener owned by another checkout', () => {
  assert.deepEqual(
    classifyProductionListenerOwnership({ port: '3050', sameRepo: false }),
    ['foreign_prod_3050'],
  );
});

test('accepts a 3050 listener owned by the current checkout', () => {
  assert.deepEqual(
    classifyProductionListenerOwnership({ port: '3050', sameRepo: true }),
    [],
  );
});

test('leaves missing-listener classification to the existing port gate', () => {
  assert.deepEqual(classifyProductionListenerOwnership(undefined), []);
});

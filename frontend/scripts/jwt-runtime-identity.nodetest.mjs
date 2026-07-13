import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertLoopbackBackendUrl,
  classifyJwtRuntimeIdentity,
  normalizeJwtKeyId,
} from './jwt-runtime-identity.mjs';

test('accepts only bounded non-secret JWT key identifiers', () => {
  assert.equal(normalizeJwtKeyId('jwt-prod-2026-07'), 'jwt-prod-2026-07');
  assert.equal(normalizeJwtKeyId('invalid key id'), null);
  assert.equal(normalizeJwtKeyId('x'.repeat(65)), null);
});

test('refuses to send a probe token outside loopback', () => {
  assert.equal(assertLoopbackBackendUrl('http://127.0.0.1:8081').hostname, '127.0.0.1');
  assert.equal(assertLoopbackBackendUrl('http://localhost:8081').hostname, 'localhost');
  assert.throws(() => assertLoopbackBackendUrl('https://example.com/api'), /loopback/);
});

test('fails closed before probing when runtime identity mismatches', () => {
  const result = classifyJwtRuntimeIdentity({
    authEnabled: true,
    runtimeKeyId: 'jwt-runtime-a',
    expectedKeyId: 'jwt-candidate-b',
    probeTokenPresent: true,
    probeStatus: null,
  });

  assert.equal(result.ok, false);
  assert.equal(result.shouldProbe, false);
  assert.deepEqual(result.failures, ['jwt_key_id_mismatch']);
});

test('keeps missing runtime auth metadata distinct from disabled auth', () => {
  const result = classifyJwtRuntimeIdentity({
    authEnabled: undefined,
    runtimeKeyId: undefined,
    expectedKeyId: 'jwt-prod-2026-07',
    probeTokenPresent: true,
    probeStatus: null,
  });

  assert.equal(result.authEnabled, null);
  assert.equal(result.failures.includes('runtime_auth_state_missing'), true);
  assert.equal(result.failures.includes('production_auth_disabled'), false);
});

test('requires enabled auth, matching key id, and a successful protected probe', () => {
  const ready = classifyJwtRuntimeIdentity({
    authEnabled: true,
    runtimeKeyId: 'jwt-prod-2026-07',
    expectedKeyId: 'jwt-prod-2026-07',
    probeTokenPresent: true,
    probeStatus: 200,
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.state, 'ready');

  const missingToken = classifyJwtRuntimeIdentity({
    authEnabled: true,
    runtimeKeyId: 'jwt-prod-2026-07',
    expectedKeyId: 'jwt-prod-2026-07',
    probeTokenPresent: false,
    probeStatus: null,
  });
  assert.equal(missingToken.ok, false);
  assert.deepEqual(missingToken.failures, ['probe_token_missing']);
});

test('classification never returns the probe token', () => {
  const secretToken = 'must-never-appear-in-report';
  const result = classifyJwtRuntimeIdentity({
    authEnabled: true,
    runtimeKeyId: 'jwt-prod-2026-07',
    expectedKeyId: 'jwt-prod-2026-07',
    probeTokenPresent: Boolean(secretToken),
    probeStatus: 401,
  });

  assert.equal(JSON.stringify(result).includes(secretToken), false);
  assert.deepEqual(result.failures, ['protected_probe_rejected:401']);
});

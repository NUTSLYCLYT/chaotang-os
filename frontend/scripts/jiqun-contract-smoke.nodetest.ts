import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./jiqun-contract-smoke.mjs', import.meta.url), 'utf8');

test('production release harness token is forwarded to protected jiqun contracts', () => {
  const buildAuthToken = source.slice(
    source.indexOf('function buildAuthToken()'),
    source.indexOf('// ── 带超时的 fetch'),
  );

  assert.match(buildAuthToken, /process\.env\.HARNESS_AUTH_TOKEN/);
});

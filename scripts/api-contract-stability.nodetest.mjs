import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('API stability report timestamps are deterministic', () => {
  const source = readFileSync(new URL('./api-contract-stability.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /generatedAt:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(source, /generatedAt:\s*DATE/);
});

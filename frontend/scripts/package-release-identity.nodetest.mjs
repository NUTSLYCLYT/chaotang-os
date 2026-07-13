import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./package-release.mjs', import.meta.url), 'utf8');

test('package release emits the canonical chaotang-os frontend artifact identity', () => {
  assert.match(source, /const appName = 'chaotang-os-frontend';/);
  assert.match(source, /# Chaotang OS Frontend Release Package/);
  assert.doesNotMatch(source, /chaotang-web-lyt/i);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sources = [
  'scripts/next-with-base-path.mjs',
  'scripts/prod-release-gate.mjs',
  'src/lib/llm/shared-env.ts',
];

const bannedAutomaticSources = [
  'jiqun_ai',
  'jiqun_ai_fresh',
  "'fengQun'",
  '/home/ubuntu/fe/',
];

for (const source of sources) {
  test(`${source} only auto-discovers the canonical monorepo backend env`, async () => {
    const content = await readFile(new URL(`../${source}`, import.meta.url), 'utf8');

    for (const legacySource of bannedAutomaticSources) {
      assert.equal(
        content.includes(legacySource),
        false,
        `${source} still auto-discovers legacy runtime env source: ${legacySource}`,
      );
    }

    assert.match(content, /CHAOTANG_BACKEND_ENV_FILE/);
    assert.match(content, /['"]backend['"],\s*['"]\.env['"]/);
  });
}

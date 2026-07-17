import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const realFetch = globalThis.fetch;
const realWindow = (globalThis as { window?: unknown }).window;
const realLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;

function restoreEnv() {
  globalThis.fetch = realFetch;
  (globalThis as { window?: unknown }).window = realWindow;
  (globalThis as { localStorage?: unknown }).localStorage = realLocalStorage;
}

test('fetchHanlinJson uses the authenticated backend transport', async (t) => {
  t.after(restoreEnv);
  (globalThis as { window?: unknown }).window = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) =>
      key === 'courtos.auth'
        ? JSON.stringify({
            accessToken: 'hanlin-admin-token',
            refreshToken: '',
            tenantId: 1,
            username: 'ops',
            accountType: 2,
            expiresAt: Date.now() + 60_000,
          })
        : null,
    setItem: () => {},
    removeItem: () => {},
  };

  let sentUrl = '';
  let sentAuth: string | null = null;
  globalThis.fetch = (async (url: unknown, init: RequestInit = {}) => {
    sentUrl = String(url);
    sentAuth = new Headers(init.headers).get('authorization');
    return new Response(JSON.stringify({ overview: { sourceLabel: 'FALLBACK' } }), { status: 200 });
  }) as typeof fetch;

  const { fetchHanlinJson } = await import('./api.ts');
  const payload = await fetchHanlinJson<{ overview: { sourceLabel: string } }>('/api/hanlin/overview');

  assert.equal(payload.overview.sourceLabel, 'FALLBACK');
  assert.equal(sentAuth, 'Bearer hanlin-admin-token');
  assert.match(sentUrl, /\/api\/hanlin\/overview$/);
});

test('fetchHanlinJson surfaces backend authorization failures', async (t) => {
  t.after(restoreEnv);
  (globalThis as { window?: unknown }).window = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  globalThis.fetch = (async () => new Response('Forbidden', { status: 403, statusText: 'Forbidden' })) as typeof fetch;

  const { fetchHanlinJson } = await import('./api.ts');
  await assert.rejects(
    fetchHanlinJson('/api/hanlin/overview'),
    /403 Forbidden/,
  );
});

test('Hanlin pages do not bypass the authenticated transport', () => {
  const pagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'pages');
  const bypasses = readdirSync(pagesDir)
    .filter((name) => name.endsWith('.tsx'))
    .filter((name) => /\bhanlinApi\b|fetch\s*\(\s*['"`]\/api\/hanlin\//.test(readFileSync(join(pagesDir, name), 'utf8')));

  assert.deepEqual(bypasses, []);
});

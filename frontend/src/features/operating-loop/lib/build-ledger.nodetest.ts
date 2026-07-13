import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * P0-A(2026-07-12,独立只读审查发现): build-ledger.ts 原来全部用裸 fetch()
 * 打 withBasePath() 拼出的相对路径，从不带 Authorization: Bearer 头。后端
 * FENGQUN_AUTH 默认开启，只认 Bearer 头或 cookie `token`，浏览器登录态只有
 * courtos.access_token 这个 cookie(后端不消费它)——生产环境下每一次调用都
 * 会 401，前端还把 401 当成"空台账"静默吞掉，运营闭环页面的构建台账功能
 * 实际上永远拿不到数据。改用 backendFetch() 后这里验证:①请求真的带上了
 * Authorization: Bearer<token> ②路径走的是后端契约路径而不是裸相对路径
 * ③写路径(prune)失败时会 throw 而不是静默返回看起来"成功"的空值。
 */

const realFetch = globalThis.fetch;
const realWindow = (globalThis as { window?: unknown }).window;
const realLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = (async (url: unknown, init: unknown) =>
    handler(String(url), (init ?? {}) as RequestInit)) as typeof fetch;
}

function mockBrowserSession(token: string) {
  (globalThis as { window?: unknown }).window = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) =>
      key === 'courtos.auth'
        ? JSON.stringify({
            accessToken: token,
            refreshToken: 'refresh-token',
            tenantId: 1,
            username: 'ops',
            accountType: 1,
            expiresAt: Date.now() + 60_000,
          })
        : null,
    setItem: () => {},
    removeItem: () => {},
  };
}

function restoreEnv() {
  globalThis.fetch = realFetch;
  (globalThis as { window?: unknown }).window = realWindow;
  (globalThis as { localStorage?: unknown }).localStorage = realLocalStorage;
}

test('fetchBuildLedger attaches Bearer auth via backendFetch', async (t) => {
  t.after(restoreEnv);
  mockBrowserSession('session-token-abc');
  let sentAuth: string | null = null;
  let sentUrl = '';
  mockFetch((url, init) => {
    sentUrl = url;
    sentAuth = new Headers(init.headers as HeadersInit).get('authorization');
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  });

  const { fetchBuildLedger } = await import('./build-ledger.ts');
  const result = await fetchBuildLedger();

  assert.deepEqual(result, []);
  assert.equal(
    sentAuth,
    'Bearer session-token-abc',
    '必须带上 Authorization: Bearer——这正是原来裸 fetch() 从来不做的事，导致生产环境永远 401',
  );
  assert.match(sentUrl, /\/api\/build-ledger$/);
});

test('dispatchBuildLedgerEntry posts through authenticated transport with the right path', async (t) => {
  t.after(restoreEnv);
  mockBrowserSession('session-token-xyz');
  let sentAuth: string | null = null;
  let sentUrl = '';
  let sentBody: unknown = null;
  mockFetch((url, init) => {
    sentUrl = url;
    sentAuth = new Headers(init.headers as HeadersInit).get('authorization');
    sentBody = init.body ? JSON.parse(String(init.body)) : null;
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          entry: {
            id: 'ledger-1', taskId: 'task-1', title: 't', command: 'c',
            evidence: [], ministers: [], createdAt: '2026-07-12T00:00:00Z', status: 'dispatched',
          },
        },
      }),
      { status: 200 },
    );
  });

  const { dispatchBuildLedgerEntry } = await import('./build-ledger.ts');
  const entry = {
    id: 'ledger-1', taskId: 'task-1', title: 't', command: 'c',
    evidence: [], ministers: [], createdAt: '2026-07-12T00:00:00Z',
    status: 'dispatched' as const,
  };
  const result = await dispatchBuildLedgerEntry(entry);

  assert.equal(result.id, 'ledger-1');
  assert.equal(sentAuth, 'Bearer session-token-xyz');
  assert.match(sentUrl, /\/api\/build-ledger$/);
  assert.deepEqual((sentBody as { action?: string }).action, 'dispatch');
});

test('pruneBuildLedger throws on failure instead of silently returning null', async (t) => {
  t.after(restoreEnv);
  mockBrowserSession('session-token-prune');
  mockFetch(() => new Response(JSON.stringify({ success: false, error: 'forbidden' }), { status: 403 }));

  const { pruneBuildLedger } = await import('./build-ledger.ts');
  await assert.rejects(
    () => pruneBuildLedger(90),
    /forbidden/,
    'prune 失败必须 throw，不能像改动前那样静默返回 null(调用方会误以为清理成功了)',
  );
});

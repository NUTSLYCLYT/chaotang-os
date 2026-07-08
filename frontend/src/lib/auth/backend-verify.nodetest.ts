import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * 铁律4 回归(上线第一波·特权写入守门 backendVerifyOrReject):
 * 这道 SSOT 门被 jiqun 代理(#1)/orchestrate(#5a)/sign-off 共用,堵伪造 alg:none token 打穿后端。
 * 钉死:strict 模式下 ①后端验签 401→拒 ②后端不可达→503 fail-closed ③无凭证→401
 *       ④CRITICAL-1 修复:只带 courtos.access_token cookie 的合法用户不被误拒——
 *         探针必须以 Authorization: Bearer<提取的token> 转发(后端 cookie 名是 token 非 courtos.access_token)。
 * 会咬证明:删掉 route 里的 backendVerifyOrReject 调用→消费方测试红;改回直转原始 cookie→④红。
 */

// STRICT_AUTH 在模块 import 时读取,必须先设 env 再 import;tsx 编 CJS 不支持顶层 await,
// 故 env 同步设于顶部、用懒加载 dynamic import(首次调用即生效,模块被缓存)。本测试自带 FENGQUN_AUTH=true,
// 不依赖外部 env(否则 test:node 全量 glob 下会因 dev 旁路假绿)。
process.env.FENGQUN_AUTH = 'true';
process.env.JIQUN_API_URL = 'http://127.0.0.1:18081'; // 测试用,不真连
let _door: ((req: Request) => Promise<Response | null>) | null = null;
async function getDoor(): Promise<(req: Request) => Promise<Response | null>> {
  if (!_door) _door = (await import('./backend-verify.ts')).backendVerifyOrReject;
  return _door;
}

const realFetch = globalThis.fetch;
function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = (async (url: unknown, init: unknown) =>
    handler(String(url), (init ?? {}) as RequestInit)) as typeof fetch;
}

test('strict: 后端验签 401 → 拒(返 401)', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  mockFetch(() => new Response(null, { status: 401 }));
  const req = new Request('http://app/x', { headers: { cookie: 'courtos.access_token=forged' } });
  const r = await (await getDoor())(req);
  assert.ok(r, '应返回拒绝 Response');
  assert.equal(r!.status, 401, '伪造/无效签名必 401');
});

test('strict: 后端不可达 → 503 fail-closed(绝不放行可疑请求烧后端)', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  mockFetch(() => { throw new Error('ECONNREFUSED'); });
  const req = new Request('http://app/x', { headers: { cookie: 'courtos.access_token=abc' } });
  const r = await (await getDoor())(req);
  assert.ok(r, '不可达必拒');
  assert.equal(r!.status, 503, 'fail-closed 503');
});

test('strict: 无任何凭证 → 401', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  mockFetch(() => new Response('{}', { status: 200 }));
  const r = await (await getDoor())(new Request('http://app/x'));
  assert.ok(r);
  assert.equal(r!.status, 401);
});

test('CRITICAL-1: 仅带 courtos.access_token cookie 的合法用户不被误拒,且探针用 Bearer 转发', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  let sentAuth: string | null = null;
  let sentCookie: string | null = null;
  mockFetch((_url, init) => {
    const h = new Headers(init.headers as HeadersInit);
    sentAuth = h.get('authorization');
    sentCookie = h.get('cookie');
    return new Response('{}', { status: 200 }); // 后端验签通过
  });
  const req = new Request('http://app/x', { headers: { cookie: 'a=1; courtos.access_token=realjwt; b=2' } });
  const r = await (await getDoor())(req);
  assert.equal(r, null, '后端 200 → 放行(合法用户不被误拒)');
  assert.equal(sentAuth, 'Bearer realjwt', '探针必须以 Bearer<提取token> 转发(后端认 token 非 courtos.access_token)');
  assert.equal(sentCookie, 'token=realjwt', '同时以后端期望的 token= cookie 转发(belt-and-suspenders)');
});

test('CRITICAL-1: 已带 Authorization Bearer 时优先用之', async (t) => {
  t.after(() => { globalThis.fetch = realFetch; });
  let sentAuth: string | null = null;
  mockFetch((_url, init) => {
    sentAuth = new Headers(init.headers as HeadersInit).get('authorization');
    return new Response('{}', { status: 200 });
  });
  const req = new Request('http://app/x', { headers: { authorization: 'Bearer header-token' } });
  assert.equal(await (await getDoor())(req), null);
  assert.equal(sentAuth, 'Bearer header-token', 'Authorization 头优先');
});

// ── fail-safe(解决"FENGQUN_AUTH 没设就静默裸奔"警示):生产 fail-closed,非静默旁路。──
function withEnv(over: Record<string, string | undefined>, fn: () => Promise<void>) {
  const keys = ['FENGQUN_AUTH', 'NODE_ENV', 'CHAOTANG_ALLOW_INSECURE_AUTH'];
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) prev[k] = process.env[k];
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return fn().finally(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });
}

test('fail-safe: 生产环境未设 FENGQUN_AUTH → 503 fail-closed(绝不静默旁路成不安全)', async () => {
  const door = await getDoor();
  await withEnv({ FENGQUN_AUTH: undefined, NODE_ENV: 'production', CHAOTANG_ALLOW_INSECURE_AUTH: undefined }, async () => {
    const r = await door(new Request('http://app/x', { headers: { cookie: 'courtos.access_token=x' } }));
    assert.ok(r, 'prod 未设 FENGQUN_AUTH 必拒(不旁路)');
    assert.equal(r!.status, 503, 'fail-closed 503');
  });
});

test('fail-safe: 生产 + CHAOTANG_ALLOW_INSECURE_AUTH=1 → 显式逃生阀放行', async () => {
  const door = await getDoor();
  await withEnv({ FENGQUN_AUTH: undefined, NODE_ENV: 'production', CHAOTANG_ALLOW_INSECURE_AUTH: '1' }, async () => {
    assert.equal(await door(new Request('http://app/x')), null, '显式承担风险才放行');
  });
});

test('fail-safe: 非生产(dev) 未设 FENGQUN_AUTH → 放行(后端本就放行)', async () => {
  const door = await getDoor();
  await withEnv({ FENGQUN_AUTH: undefined, NODE_ENV: 'test', CHAOTANG_ALLOW_INSECURE_AUTH: undefined }, async () => {
    assert.equal(await door(new Request('http://app/x')), null, 'dev 旁路属预期');
  });
});

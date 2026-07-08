/**
 * 验真器红队测试(6大神会审 wy1tg27my · 天才建议)
 * 测的不是"真 trace 能通过"(那只证 happy path),是"假 trace 能不能骗过你"——
 * 验真器的价值不在放行真的,在拦住假的。跑:pnpm test:core
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertLiveSwarmTrace,
  isGenuineSwarmTraceId,
} from '../source-label.ts';
import { reverifyLiveSwarmTrace } from './reverify-swarm-trace.ts';

const REAL = '20260622_085226_a15fb9'; // 实跑 finance 蜂群探得的真 session_id 形状
const FORGED = '20260622_085226_deadbeef'; // 格式合法、后端不存在的伪造

// 构造一个最小 Response-like
function mockFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return (async () =>
    ({
      ok,
      status,
      json: async () => body,
    }) as unknown as Response) as unknown as typeof fetch;
}

test('同步预闸:构造垃圾 trace 必须被 assertLiveSwarmTrace 拒绝', () => {
  assert.throws(() => assertLiveSwarmTrace('LIVE_SWARM', 'x'), /构造|trace_id/);
  assert.throws(() => assertLiveSwarmTrace('LIVE_SWARM', ''), /trace_id/);
  assert.throws(() => assertLiveSwarmTrace('LIVE_SWARM', 'fake-trace'), /构造/);
  assert.throws(() => assertLiveSwarmTrace('LIVE_SWARM', undefined), /trace_id/);
});

test('同步预闸:真 jiqun session 形状放行;非 LIVE_SWARM 不设限', () => {
  assert.doesNotThrow(() => assertLiveSwarmTrace('LIVE_SWARM', REAL));
  assert.doesNotThrow(() => assertLiveSwarmTrace('FALLBACK', 'x')); // 只闸 LIVE_SWARM
  assert.equal(isGenuineSwarmTraceId(REAL), true);
  assert.equal(isGenuineSwarmTraceId('x'), false);
  assert.equal(isGenuineSwarmTraceId('fake-trace'), false);
});

test('承重墙:格式合法但后端无此 session 的伪造 trace 必须 404 反查失败(关键红队)', async () => {
  const r = await reverifyLiveSwarmTrace(FORGED, {
    fetchImpl: mockFetch({}, false, 404),
  });
  assert.equal(r.verified, false, '后端不存在(404)的 session 绝不能算已兑现');
});

test('承重墙:真 session 在 jiqun 存在(200+id匹配) → 反查通过', async () => {
  const r = await reverifyLiveSwarmTrace(REAL, {
    fetchImpl: mockFetch({ session_id: REAL, status: 'completed' }, true, 200),
  });
  assert.equal(r.verified, true);
});

test('承重墙:synthetic/测试 session 不算真 LIVE', async () => {
  const r = await reverifyLiveSwarmTrace(REAL, {
    fetchImpl: mockFetch({ session_id: REAL, synthetic: true }, true, 200),
  });
  assert.equal(r.verified, false, '合成 session 不能盖 LIVE_SWARM');
});

test('承重墙:返回 session_id 不匹配 → 不可信', async () => {
  const r = await reverifyLiveSwarmTrace(REAL, {
    fetchImpl: mockFetch({ session_id: 'someone_else' }, true, 200),
  });
  assert.equal(r.verified, false);
});

test('承重墙 fail-closed:jiqun 不可达/异常 → 不轻信', async () => {
  const unreachable = (async () => {
    throw new Error('ECONNREFUSED');
  }) as unknown as typeof fetch;
  const r1 = await reverifyLiveSwarmTrace(REAL, { fetchImpl: unreachable });
  assert.equal(r1.verified, false, '够不到 jiqun 必须 fail-closed');

  const r2 = await reverifyLiveSwarmTrace(REAL, { fetchImpl: mockFetch({}, false, 502) });
  assert.equal(r2.verified, false, '502 必须 fail-closed');
});

test('401 门:带 adminToken 时 Authorization 头必须发到 sessions 反查(否则真链恒降 MIXED)', async () => {
  let sentAuth: string | undefined;
  const spy = (async (_url: unknown, init?: { headers?: Record<string, string> }) => {
    sentAuth = init?.headers?.Authorization;
    // 后端只在带鉴权时才认这条 session
    const authed = Boolean(sentAuth);
    return {
      ok: authed,
      status: authed ? 200 : 401,
      json: async () => (authed ? { session_id: REAL, status: 'completed' } : { error: '未登录' }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  const r = await reverifyLiveSwarmTrace(REAL, { adminToken: 'tok-abc', fetchImpl: spy });
  assert.equal(sentAuth, 'Bearer tok-abc', 'adminToken 必须作为 Bearer 头发出去');
  assert.equal(r.verified, true, '带 token → 后端 200 认账 → 可盖 LIVE_SWARM');
});

test('401 门 fail-closed:sessions 反查 401(无鉴权) → verified=false 诚实降 MIXED', async () => {
  const r = await reverifyLiveSwarmTrace(REAL, {
    adminToken: undefined,
    fetchImpl: mockFetch({ error: '未登录' }, false, 401),
  });
  assert.equal(r.verified, false, '401 绝不能算已兑现,必须降级不能盖帝金章');
});

test('承重墙:垃圾 trace 直接判假,不浪费往返', async () => {
  let fetched = false;
  const spy = (async () => {
    fetched = true;
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
  const r = await reverifyLiveSwarmTrace('garbage', { fetchImpl: spy });
  assert.equal(r.verified, false);
  assert.equal(fetched, false, '格式就垃圾的 trace 应在反查前短路');
});

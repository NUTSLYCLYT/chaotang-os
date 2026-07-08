import { expect, test, type APIRequestContext } from '@playwright/test';
import { resolveBasePath } from './helpers/base-path';
import { Buffer } from 'node:buffer';

// 回归断言(#3 跨进程脆弱 · 2026-06-24):courtos(COURTOS_API_URL :4000)死链时,
// 非 ssf_ 任务读不得每次吃满 5s AbortSignal 超时。熔断器(courtos-breaker)在连续失败后打开,
// 之后 courtos 调用瞬间失败 → 走本地 primary 兜底。守护:旧版固定 5000ms 超时 → 每读 5s+。

function cookieHeader(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    user_id: 'e2e-fastfail',
    username: 'e2e',
    tenant_slug: 'local',
    role: 'user',
    exp: '2100-01-01T00:00:00.000Z',
  })}.sig`;
  return `courtos.access_token=${token}`;
}

async function readMissing(request: APIRequestContext, id: string) {
  return request.get(`${await resolveBasePath(request)}/api/court/backend/tasks/${encodeURIComponent(id)}`, {
    headers: { cookie: cookieHeader() },
  });
}

test('非 ssf_ 任务读:courtos 死链下熔断快失败走本地(不吃 5s)', async ({ request }) => {
  // 用非 ssf_ 前缀的不存在 id —— 必走 jiqun → courtos → 本地兜底(ssf_ 已被前置快路径绕开)。
  const missingId = 'task-fastfail-nonexistent-001';

  // 预热:连续失败让熔断打开(阈值 2)。
  await readMissing(request, missingId);
  await readMissing(request, missingId);

  // 测量:此时 courtos 熔断已开,调用瞬间失败 → 本地兜底,整读应远快于旧版 5s。
  const startedAt = Date.now();
  const res = await readMissing(request, missingId);
  const elapsedMs = Date.now() - startedAt;

  // 本地兜底:不存在 → not_found(404),或 primary 异常(503);都不是 courtos 的 502。
  expect([404, 503]).toContain(res.status());
  // 阈值 4s:破损态恒 ≥5s(courtos 固定超时);熔断后只剩 jiqun+primary,即便门禁并发负载下
  // 也远低于 5s。取 4s 既稳过修复态、又稳卡在破损下限之下,不被并发抖动误伤。
  expect(elapsedMs, `courtos 死链下非 ssf_ 读应快失败,实测 ${elapsedMs}ms`).toBeLessThan(4000);
});

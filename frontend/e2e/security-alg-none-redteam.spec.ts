import { test, expect, type APIRequestContext } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { resolveBasePath } from './helpers/base-path';

/**
 * 红队回归 · 伪造 alg:none cookie 不得冒充身份(渗透审计 C1·2026-06-25)。
 *
 * C1:Next/边缘层 decode-only,本地库端点唯一身份源是"解码不验签"的 cookie,`alg:none` 是被接受的格式。
 *   → 攻击者伪造 `alg:none + user_id=任意` 即冒充任何人,击穿所有 owner 校验。
 * 本断言:对一个**写本地库的 court 端点**,伪造 alg:none token 必须被拒(401),而非被当合法会话处理。
 *
 * ⚠️ 现状:C1 修复(BFF 真验签/拒 alg:none)由并发同事在做。修复落地前本断言会红(=漏洞仍在)。
 * **故本 spec 暂不进 gate:daily 阻断门**;C1 落地、本断言转绿后再 wire 进门(那时绿=验证修复)。
 * 手动跑:PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test e2e/security-alg-none-redteam.spec.ts
 */

function forgeAlgNoneCookie(userId: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  // alg:none + 未来 exp + 任意 user_id;第三段(签名)随便填——若系统真验签,这必被拒。
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    user_id: userId,
    username: userId,
    tenant_slug: 'victim-tenant',
    role: 'user',
    exp: '2099-01-01T00:00:00.000Z',
  })}.not-a-real-signature`;
  return `courtos.access_token=${token}`;
}

test('伪造 alg:none cookie 打 court 写本地端点 → 必须 401(拒冒充·C1)', async ({ request }: { request: APIRequestContext }) => {
  const bp = await resolveBasePath(request);
  const res = await request.post(`${bp}/api/court/junjichu/review`, {
    headers: { 'content-type': 'application/json', cookie: forgeAlgNoneCookie('victim-user') },
    data: { task_id: 'redteam', question: '红队伪造身份测试' },
  });
  // 真验签后:alg:none + 假签名 → 401。未修(decode-only)→ 会被当合法会话(非 401)。
  expect(res.status(), '伪造 alg:none token 必须被拒(401),否则可冒充任何用户击穿越权防御').toBe(401);
});

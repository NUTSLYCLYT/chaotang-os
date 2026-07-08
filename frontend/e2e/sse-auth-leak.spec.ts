import { test, expect, type Page } from '@playwright/test';
import { seedSession, addCookieAcrossOrigins } from './fixtures';

/**
 * E2E：DATA-SSE-01 回归 —— SSE 代理不把凭据写回响应头（凭据不泄漏）
 *
 * 背景（见 docs/CHAOTANG_FLOW_AUDIT.md DATA-SSE-01）：
 *   BFF SSE 代理 GET /api/court/events/stream 把上游 SSE 透传给浏览器。
 *   修复要求：响应头【不含】authorization 字段——客户端传入的 Authorization
 *   只能用于「向上游 NestJS 发起请求」，绝不能回写到给浏览器的响应头里
 *   （否则等于把后端凭据/转发头泄漏给前端）。
 *
 * 修复落地位置：src/app/api/court/events/stream/route.ts
 *   - 上游请求头（fetch 第二参 headers）含 authorization —— 合法，发给后端。
 *   - 返回给浏览器的 new Response 仅设 Content-Type / Cache-Control /
 *     X-Accel-Buffering 三个头，绝不回写 authorization。
 *
 * 测试策略（照 e2e/swarm-members.spec.ts + e2e/authz-downgrade.spec.ts 范式，无需真实后端）：
 *   - seedSession() 种双门（cookie + localStorage），与既有受保护页测试一致；
 *     注：/api/court/* 在 src/proxy.ts 中是公开前缀（后端自鉴权），种会话不影响可达性，
 *     仅为遵循统一范式。
 *   - 用 page.request 直接打 API；断言 response.headers() 中【无】authorization。
 *   - 关键回归点：即便请求显式带上 Authorization 头，响应头也绝不把它（或任何
 *     authorization 字段）回写——证明凭据不被反射泄漏。
 *   - 无真实后端时上游 fetch 失败 → route 返回 502；但无论 200/502，
 *     响应头都不应含 authorization，正是本回归要锁死的不变量。
 *
 * 注：buildSessionToken/seedTypedSession 提供「不同 accountType 会话」的能力
 *   （照 authz-downgrade 范式）。本回归点（凭据不回写）与 accountType 无关——
 *   无论何种会话，响应头都不得含 authorization——故用其断言该不变量在带类型会话下亦成立。
 */

const STREAM_URL = '/api/court/events/stream';

/** 造一个可被服务端 base64url 解码、指定 accountType 的 JWT 形 access_token（不验签）。 */
function buildSessionToken(accountType: number): string {
  const b64url = (obj: unknown): string =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({ sub: 'e2e-user', accountType, exp: 4102444800 }); // 2100-01-01
  return `${header}.${payload}.sig`;
}

/** 种一个 accountType=N 的服务端会话 cookie（用于「不同账户类型会话」场景）。
 *  会审后修复(2026-07-04)：改用 fixtures.ts 的 addCookieAcrossOrigins(同款domain不匹配bug)。 */
async function seedTypedSession(page: Page, accountType: number): Promise<void> {
  await addCookieAcrossOrigins(page, 'courtos.access_token', buildSessionToken(accountType));
}

/** 断言响应头中不存在任何 authorization 字段（大小写不敏感）。 */
function expectNoAuthorizationHeader(headers: Record<string, string>): void {
  const keys = Object.keys(headers).map((k) => k.toLowerCase());
  expect(keys).not.toContain('authorization');
  expect(keys).not.toContain('proxy-authorization');
}

test.describe('DATA-SSE-01：SSE 代理响应头不泄漏凭据', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('GET stream（无 taskId）：响应头不含 authorization', async ({ page }) => {
    const res = await page.request.get(STREAM_URL);

    // 无真实后端 → 上游不可达 → 502；有后端 → 200。两种情况响应头都不得含凭据。
    expectNoAuthorizationHeader(res.headers());
  });

  test('GET stream?taskId=…：响应头不含 authorization', async ({ page }) => {
    const res = await page.request.get(`${STREAM_URL}?taskId=task-e2e`);

    expectNoAuthorizationHeader(res.headers());
  });

  test('即便请求显式带 Authorization 头，响应头也不回写该凭据（不反射泄漏）', async ({
    page,
  }) => {
    const SECRET = 'Bearer e2e-secret-credential-should-not-leak';
    const res = await page.request.get(STREAM_URL, {
      headers: { authorization: SECRET },
    });

    const headers = res.headers();
    // 1) 响应头里根本不该出现 authorization 字段
    expectNoAuthorizationHeader(headers);
    // 2) 更强：任何响应头值里都不应出现这段被传入的密文（杜绝换名回写）
    for (const value of Object.values(headers)) {
      expect(value).not.toContain('e2e-secret-credential-should-not-leak');
    }
  });

  test('不同 accountType 会话下，凭据不回写不变量仍成立', async ({ page }) => {
    // 切换为 accountType=2 的会话（照 authz-downgrade 范式），证明该不变量与权限等级无关。
    await seedTypedSession(page, 2);

    const res = await page.request.get(STREAM_URL, {
      headers: { authorization: 'Bearer typed-session-credential' },
    });

    const headers = res.headers();
    expectNoAuthorizationHeader(headers);
    for (const value of Object.values(headers)) {
      expect(value).not.toContain('typed-session-credential');
    }
  });
});

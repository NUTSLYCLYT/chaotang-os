import { test, expect } from '@playwright/test';
import { addCookieAcrossOrigins } from './fixtures';

/**
 * E2E：授权降级 / 提权拦截（路由层断言，无需真实后端）
 *
 * 验证两处已落地的提权修复（见 AGENTS.md §11、代码现实注释）：
 *
 *  (A) AUTHZ-002 + SEC-HANLIN-ROLE-CLIENT-SPOOFABLE
 *      路由 POST /api/hanlin/reset-demo 需要 'demo_reset' 能力（仅 emperor/taizi 有）。
 *      readHanlinRoleFromRequest() 已改为：最终角色 = min(claimedRole, sessionMaxRole)，
 *      sessionMaxRole 由服务端会话 cookie 'courtos.access_token' 的 accountType 派生
 *      （accountType<1 → viewer）。因此：
 *        - 仅带客户端伪造头 x-hanlin-role:emperor、但会话 accountType=0
 *          → 角色被压成 viewer → 无 demo_reset → 403 forbidden（头不再能提权）。
 *        - 不带任何头、accountType=0 → 默认 viewer → 同样 403（缺省回退 viewer，非 taizi）。
 *
 *  (B) AUTHZ-001
 *      路由 POST /api/governance/bills/[id]/transition 的 approve（终审）只有 ruler 能做。
 *      resolveActor()/authorizeActor() 已改为：声称 'ruler' 必须服务端会话 accountType
 *      达标（默认 >=2），否则降级 'liubu'。因此：
 *        - 仅带客户端 cookie courtos.actor=ruler、但会话 accountType=0
 *          → resolved=liubu ≠ claimed=ruler → authorizeActor 拒绝 → 403（不能以 ruler 终审）。
 *
 * 实现要点（照 e2e/swarm-members.spec.ts 范式，无需真实后端）：
 *  - 用 buildSessionToken(accountType) 造一个可被服务端 base64url 解码、accountType=0 的
 *    JWT 形 access_token，显式落实"会话存在但权限不达标"这一前提（不依赖解码失败的偶然性）。
 *  - 用 page.context().addCookies 种 cookie；page.request 直接打 API 断言状态码。
 *  - reset-demo 走 demo 内存 store，transition 在 actor 鉴权处即 403 返回，均不触达真实后端。
 *
 * 分层说明：src/proxy.ts 中间件对所有 /api/* 先要求 access_token cookie 存在（缺则 401）。
 *  - "会话存在但权限不达标"（种了弱 token）→ 过中间件 → 命中 route 层的 403 降级逻辑（本测重点）。
 *  - "完全无会话"（不种 token）→ 在中间件层即 401 fail-closed，更早一层拦下（也一并断言）。
 */

/**
 * 造一个"会话存在但 accountType 不达标"的 JWT 形 token。
 * 服务端（actor-context / server-access）只 base64url 解码 payload（不验签），
 * 取 accountType；这里给 0（NORMAL）→ 既非 ruler 资格(>=2)，也只配 hanlin viewer。
 */
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

/** 种一个 accountType=N 的服务端会话 cookie（默认 0 = NORMAL，权限不达标）。
 *  会审后修复(2026-07-04)：改用 fixtures.ts 的 addCookieAcrossOrigins，理由同
 *  e2e/agents-run-auth.spec.ts——单一 domain:'localhost' 与默认 baseURL(127.0.0.1)
 *  不匹配会让 cookie 从未被发送。 */
async function seedWeakSession(
  page: import('@playwright/test').Page,
  accountType = 0,
): Promise<void> {
  await addCookieAcrossOrigins(page, 'courtos.access_token', buildSessionToken(accountType));
}

const RESET_DEMO_URL = '/api/hanlin/reset-demo';
const TRANSITION_URL = '/api/governance/bills/bill-e2e/transition';

test.describe('AUTHZ 降级 / 提权拦截（路由层）', () => {
  // ── (A) 翰林 reset-demo：客户端头不可提权 + 缺省 viewer ─────────────────
  test('reset-demo：伪造头 x-hanlin-role:emperor 但会话 accountType=0 → 403（头不能提权）', async ({
    page,
  }) => {
    await seedWeakSession(page, 0); // 会话存在但权限不达标 → sessionMaxRole=viewer

    const res = await page.request.post(RESET_DEMO_URL, {
      headers: { 'x-hanlin-role': 'emperor' }, // 客户端伪造的提权意图
    });

    expect(res.status()).toBe(403);
    const body = (await res.json()) as { ok?: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('forbidden');
  });

  test('reset-demo：不带任何角色头、accountType=0 → 403（缺省回退 viewer，非 taizi）', async ({
    page,
  }) => {
    await seedWeakSession(page, 0);

    const res = await page.request.post(RESET_DEMO_URL);

    expect(res.status()).toBe(403);
    const body = (await res.json()) as { ok?: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('forbidden');
  });

  test('reset-demo：完全无会话 cookie + 伪造头 → 被服务端中间件 401 拦下（fail-closed，比 route 更早）', async ({
    page,
  }) => {
    // 不种任何 cookie。src/proxy.ts 中间件对所有 /api/* 要求 access_token 存在，
    // 缺则直接 401（NextResponse 'Unauthorized'），根本不进 route 的 403 分支。
    // 这同样满足"伪造头不能提权"——访客连门都进不来。
    const res = await page.request.post(RESET_DEMO_URL, {
      headers: { 'x-hanlin-role': 'taizi' },
    });

    expect(res.status()).toBe(401);
  });

  // ── (B) 治理 transition approve：访客不能冒充 ruler 终审 ──────────────────
  test('transition approve：cookie courtos.actor=ruler 但会话 accountType=0 → 403（降级 liubu，不能以 ruler 终审）', async ({
    page,
  }) => {
    await seedWeakSession(page, 0); // 会话存在但 accountType<2 → ruler 资格不达标
    // 客户端自设的身份意图：声称自己是 ruler
    await addCookieAcrossOrigins(page, 'courtos.actor', 'ruler');

    const res = await page.request.post(TRANSITION_URL, {
      data: {
        type: 'approve', // 终审操作，只有真 ruler 能做
        actor: 'ruler', // body 声称 ruler
        reason: '准奏（伪造的御前终审）',
      },
    });

    // authorizeActor：resolved=liubu ≠ claimed=ruler → ok:false → 403
    expect(res.status()).toBe(403);
    const body = (await res.json()) as { error?: string; resolved?: string; claimed?: string };
    expect(body.resolved).toBe('liubu'); // 被降级为最小权
    expect(body.claimed).toBe('ruler'); // 客户端声称的身份
    expect(body.error).toBeTruthy(); // 携带拒绝原因（不能声称为 ruler）
  });

  test('transition approve：完全无会话 + 仅伪造 actor=ruler → 被服务端中间件 401 拦下（未登录连门都进不来）', async ({
    page,
  }) => {
    // 只有客户端自设的 courtos.actor，没有 access_token 会话 cookie。
    // src/proxy.ts 中间件对 /api/* 要求 access_token 存在 → 401，不进 route。
    // 即"无会话不能冒充 ruler"在中间件层即被 fail-closed 拦下。
    await addCookieAcrossOrigins(page, 'courtos.actor', 'ruler');

    const res = await page.request.post(TRANSITION_URL, {
      data: { type: 'approve', actor: 'ruler', reason: '准奏（无会话伪造）' },
    });

    expect(res.status()).toBe(401);
  });

  // ── 反例：达标会话可正常担任 ruler（证明拦截是按权限、非一刀切拒绝）──────────
  test('transition approve：会话 accountType=2(SUPER_ADMIN) + actor=ruler → 通过 actor 鉴权（不再 403 身份不符）', async ({
    page,
  }) => {
    await seedWeakSession(page, 2); // 达标 → ruler 资格成立
    await addCookieAcrossOrigins(page, 'courtos.actor', 'ruler');

    const res = await page.request.post(TRANSITION_URL, {
      data: { type: 'approve', actor: 'ruler', reason: '准奏（合法御前终审）' },
    });

    // 身份鉴权应放行；后续 FSM 因 bill 不存在 / 状态不符可能 422/404/500，
    // 但绝不应是 403 身份不符 —— 断言"不是被身份门拒绝"。
    expect(res.status()).not.toBe(403);
    if (res.status() === 403) {
      // 万一仍 403，打印 body 便于定位（理论上不会进这里）
      const body = await res.json();
      throw new Error(`unexpected 403: ${JSON.stringify(body)}`);
    }
  });
});

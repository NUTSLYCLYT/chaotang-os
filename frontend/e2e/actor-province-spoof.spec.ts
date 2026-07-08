import { test, expect } from '@playwright/test';
import { addCookieAcrossOrigins } from './fixtures';

/**
 * E2E：门下省（menxia）身份伪造拦截（路由层断言，无需真实后端）
 *
 * 回归：AUTHZ-LANE-03 / GOV-FSM-01（见 docs/CHAOTANG_FLOW_AUDIT.md §二、§三）
 *
 * 已落地的修复（actor-context.ts resolveActor）：
 *   特权省份（中书 zhongshu / 门下 menxia / 尚书 shangshu）不再凭「任何会话即采信
 *   客户端自设的 courtos.actor」。声称 menxia 必须服务端会话 accountType 达标
 *   （PROVINCE_MIN_ACCOUNT_TYPE，默认 1）；否则降级为最小权 liubu。
 *
 * 被测路由：POST /api/governance/bills/[id]/transition
 *   FSM 中 under_review --approve--> approved 仅允许 actor=menxia（门下省终审过堂/准奏）。
 *   故"仅靠客户端 cookie courtos.actor=menxia 但会话无对应省份资格"时：
 *     resolveActor → liubu（≠ menxia）→ authorizeActor 拒绝 → 403，
 *     body.resolved=liubu、body.claimed=menxia（resolved ≠ menxia）。
 *
 * 实现要点（照 e2e/swarm-members.spec.ts、e2e/authz-downgrade.spec.ts 范式，无需真实后端）：
 *   - buildSessionToken(accountType) 造一个服务端可 base64url 解码（不验签）的 JWT 形
 *     access_token，显式落实"会话存在但省份资格不达标"这一前提（accountType=0）。
 *   - page.context().addCookies 种双门 cookie；page.request 直打 API 断状态码/响应体。
 *   - 在 actor 鉴权处即 403 返回，不触达真实后端 FSM / 持久化。
 *
 * 分层说明：src/proxy.ts 中间件对所有 /api/* 先要求 access_token cookie 存在（缺则 401）。
 *   - "会话存在但省份资格不达标"（种弱 token）→ 过中间件 → 命中 route 层 403 降级（本测重点）。
 *   - "完全无会话"（不种 token）→ 在中间件层即 401 fail-closed，更早一层拦下（也一并断言）。
 */

/**
 * 造一个"会话存在但 accountType 不达标"的 JWT 形 token。
 * 服务端（actor-context）只 base64url 解码 payload（不验签），取 accountType。
 * 默认 0（NORMAL）→ 既非 ruler 资格（>=2），也不配特权省份（>=1）→ 派生最小权 liubu。
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

/** 种一个 accountType=N 的服务端会话 cookie（默认 0 = NORMAL，省份资格不达标）。
 *  会审后修复(2026-07-04)：改用 fixtures.ts 的 addCookieAcrossOrigins——此前只种
 *  domain:'localhost'，与 playwright.config.ts 默认 baseURL(127.0.0.1) 域名不匹配，
 *  cookie 从未被发送，用例静默走向"看似符合预期"的 401。 */
async function seedWeakSession(
  page: import('@playwright/test').Page,
  accountType = 0,
): Promise<void> {
  await addCookieAcrossOrigins(page, 'courtos.access_token', buildSessionToken(accountType));
}

/** 客户端自设的省份意图：声称自己属于某省（仅 UI 意图，最终权限封顶于会话）。 */
async function seedActorClaim(
  page: import('@playwright/test').Page,
  actor: string,
): Promise<void> {
  await addCookieAcrossOrigins(page, 'courtos.actor', actor);
}

const TRANSITION_URL = '/api/governance/bills/bill-menxia-e2e/transition';

test.describe('AUTHZ-LANE-03 / GOV-FSM-01：门下省身份伪造拦截（路由层）', () => {
  test('approve：cookie courtos.actor=menxia 但会话 accountType=0 → 403（降级 liubu，不能以门下省准奏）', async ({
    page,
  }) => {
    await seedWeakSession(page, 0); // 会话存在但 accountType<1 → menxia 资格不达标
    await seedActorClaim(page, 'menxia'); // 客户端伪造的省份意图：声称门下省

    const res = await page.request.post(TRANSITION_URL, {
      data: {
        type: 'approve', // under_review→approved 仅门下省可触发
        actor: 'menxia', // body 声称门下省
        reason: '准奏（伪造的门下省过堂）',
        expectedEventCount: 0, // 乐观锁必传，否则更早一层 400（须先过该门才命中身份门）
      },
    });

    // authorizeActor：resolved=liubu ≠ claimed=menxia → ok:false → 403
    expect(res.status()).toBe(403);
    const body = (await res.json()) as {
      error?: string;
      resolved?: string;
      claimed?: string;
    };
    expect(body.resolved).toBe('liubu'); // 被降级为最小权（resolved ≠ menxia）
    expect(body.resolved).not.toBe('menxia');
    expect(body.claimed).toBe('menxia'); // 客户端声称的省份
    expect(body.error).toBeTruthy(); // 携带拒绝原因（身份不符，不可声称为 menxia）
  });

  test('approve：不带 actor cookie、仅 body.actor=menxia、accountType=0 → 403（缺省份意图也不放行）', async ({
    page,
  }) => {
    await seedWeakSession(page, 0); // 无 courtos.actor → resolveActor 无 claimed → liubu

    const res = await page.request.post(TRANSITION_URL, {
      data: {
        type: 'approve',
        actor: 'menxia', // 仅 body 声称，无 cookie/header 支撑
        reason: '准奏（无省份意图的伪造）',
        expectedEventCount: 0,
      },
    });

    // resolveActor 无任何 claimed → liubu；authorizeActor(liubu vs menxia) → 403
    expect(res.status()).toBe(403);
    const body = (await res.json()) as { resolved?: string; claimed?: string };
    expect(body.resolved).toBe('liubu');
    expect(body.claimed).toBe('menxia');
  });

  test('approve：完全无会话 cookie + 仅伪造 actor=menxia → 被服务端中间件 401 拦下（fail-closed，比 route 更早）', async ({
    page,
  }) => {
    // 只有客户端自设的 courtos.actor，没有 access_token 会话 cookie。
    // src/proxy.ts 中间件对 /api/* 要求 access_token 存在 → 401，不进 route 的 403 分支。
    // 即"无会话不能冒充门下省"在中间件层即被 fail-closed 拦下。
    await seedActorClaim(page, 'menxia');

    const res = await page.request.post(TRANSITION_URL, {
      data: {
        type: 'approve',
        actor: 'menxia',
        reason: '准奏（无会话伪造门下省）',
        expectedEventCount: 0,
      },
    });

    expect(res.status()).toBe(401);
  });

  // ── 反例：达标会话可正常担任 menxia（证明拦截是按权限、非一刀切拒绝）──────────
  test('approve：会话 accountType=1(MAIN) + actor=menxia → 通过 actor 身份鉴权（不再 403 身份不符）', async ({
    page,
  }) => {
    await seedWeakSession(page, 1); // 达标（>= PROVINCE_MIN_ACCOUNT_TYPE 默认 1）→ menxia 资格成立
    await seedActorClaim(page, 'menxia');

    const res = await page.request.post(TRANSITION_URL, {
      data: {
        type: 'approve',
        actor: 'menxia',
        reason: '准奏（合法门下省过堂）',
        expectedEventCount: 0,
      },
    });

    // 身份鉴权应放行；后续 FSM 因 bill 不存在 / 状态不符可能 422/404/500，
    // 但绝不应是 403 身份不符 —— 断言"不是被身份门拒绝"。
    expect(res.status()).not.toBe(403);
    if (res.status() === 403) {
      const body = await res.json();
      throw new Error(`unexpected 403 (menxia 应已达标): ${JSON.stringify(body)}`);
    }
  });
});

import { test, expect } from '@playwright/test';
import { addCookieAcrossOrigins } from './fixtures';

/**
 * E2E：邀请码严格校验回归（AUTHZ-LANE-05）
 *
 * 修复落地（见 docs/CHAOTANG_FLOW_AUDIT.md AUTHZ-LANE-05 + src/app/api/auth/verify-invite/route.ts）：
 *   宽松正则（把任意 6-32 位串判 valid）已移除。现在仅两条放行路径：
 *     1. 显式精确 allowlist（VALID_CODES：COURT2026 / CHAOTANG2026 / INVITE2026 ...）
 *     2. 显式前缀 allowlist（VALID_PREFIXES：COURT- / CHAOTANG- / INVITE-）
 *   其余一律 valid:false + 403。
 *
 * 回归重点：随机 6-32 位串（如 ABC123）不再判 valid。
 *
 * 实现要点（照 e2e/swarm-members.spec.ts 与 e2e/authz-downgrade.spec.ts 范式，无需真实后端）：
 *  - POST /api/auth/verify-invite 是公开路由（src/proxy.ts：pathname.startsWith('/api/auth/') 放行），
 *    无需双门鉴权 / 无需 access_token cookie，page.request 可直打。
 *  - 端点纯本地内存校验（allowlist + 前缀），不触达任何上游后端。
 *  - 用 page.request.post 直打 API，断状态码 + 响应 JSON 的 valid 字段。
 *  - buildSessionToken 造不同 accountType 会话以证明：邀请码校验与会话权限无关
 *    （公开端点不因带/不带会话而改变判定）。
 */

/**
 * 造一个可被服务端 base64url 解码的 JWT 形 access_token（不验签，仅显示用）。
 * 与 e2e/authz-downgrade.spec.ts 同款，用于"带会话也不改变邀请码判定"的对照。
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

const VERIFY_URL = '/api/auth/verify-invite';

interface VerifyResponse {
  valid?: boolean;
  message?: string;
}

test.describe('邀请码严格校验回归（AUTHZ-LANE-05）', () => {
  // ── 核心回归：随机 6-32 位串不再判 valid（宽松正则已移除）─────────────────
  test('随机 6 位串 ABC123 → 403 + valid:false（宽松正则已移除，不再放行）', async ({
    page,
  }) => {
    const res = await page.request.post(VERIFY_URL, {
      data: { code: 'ABC123' },
    });

    expect(res.status()).toBe(403);
    const body = (await res.json()) as VerifyResponse;
    expect(body.valid).toBe(false);
    expect(body.message).toBeTruthy(); // 携带"无效或已过期"原因
  });

  test('随机 32 位长串 → 403 + valid:false（长度落在旧宽松区间也不放行）', async ({
    page,
  }) => {
    const longCode = 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6'; // 32 位，旧正则会判 valid
    const res = await page.request.post(VERIFY_URL, {
      data: { code: longCode },
    });

    expect(res.status()).toBe(403);
    const body = (await res.json()) as VerifyResponse;
    expect(body.valid).toBe(false);
  });

  test('随机串大小写无关：abc123（小写）同样 403（服务端 toUpperCase 归一后仍非白名单）', async ({
    page,
  }) => {
    const res = await page.request.post(VERIFY_URL, {
      data: { code: 'abc123' },
    });

    expect(res.status()).toBe(403);
    const body = (await res.json()) as VerifyResponse;
    expect(body.valid).toBe(false);
  });

  test('形似前缀但不匹配（COURTX-1234 非 COURT- 前缀）→ 403（前缀放行是精确的，不模糊）', async ({
    page,
  }) => {
    const res = await page.request.post(VERIFY_URL, {
      data: { code: 'COURTX-1234' },
    });

    expect(res.status()).toBe(403);
    const body = (await res.json()) as VerifyResponse;
    expect(body.valid).toBe(false);
  });

  // ── 反例：白名单 / 前缀仍正常放行（证明拦截是按 allowlist、非一刀切拒绝）──────
  test('显式白名单码 COURT2026 → 200 + valid:true（allowlist 仍放行）', async ({
    page,
  }) => {
    const res = await page.request.post(VERIFY_URL, {
      data: { code: 'COURT2026' },
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as VerifyResponse;
    expect(body.valid).toBe(true);
  });

  test('白名单码大小写无关：court2026（小写）→ 200 + valid:true（toUpperCase 归一命中）', async ({
    page,
  }) => {
    const res = await page.request.post(VERIFY_URL, {
      data: { code: 'court2026' },
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as VerifyResponse;
    expect(body.valid).toBe(true);
  });

  test('显式前缀码 COURT-WELCOME → 200 + valid:true（VALID_PREFIXES 仍放行）', async ({
    page,
  }) => {
    const res = await page.request.post(VERIFY_URL, {
      data: { code: 'COURT-WELCOME' },
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as VerifyResponse;
    expect(body.valid).toBe(true);
  });

  // ── 边界：空码 400（与"无效"403 区分，输入校验在前）────────────────────────
  test('空邀请码 → 400 + valid:false（输入校验，区别于 403 无效）', async ({
    page,
  }) => {
    const res = await page.request.post(VERIFY_URL, {
      data: { code: '' },
    });

    expect(res.status()).toBe(400);
    const body = (await res.json()) as VerifyResponse;
    expect(body.valid).toBe(false);
  });

  test('缺 code 字段 → 400 + valid:false（缺省归一为空，走输入校验）', async ({
    page,
  }) => {
    const res = await page.request.post(VERIFY_URL, {
      data: {},
    });

    expect(res.status()).toBe(400);
    const body = (await res.json()) as VerifyResponse;
    expect(body.valid).toBe(false);
  });

  // ── 公开端点与会话无关：带不同 accountType 会话，随机串判定不变 ──────────────
  test('带 accountType=2 强会话 cookie，随机串 ABC123 仍 403（邀请码判定与会话权限解耦）', async ({
    page,
  }) => {
    // 即便携带"高权限"会话 cookie，公开端点也不因此放行非白名单邀请码。
    // 会审后修复(2026-07-04)：改用 fixtures.ts 的 addCookieAcrossOrigins(同款domain不匹配bug)。
    await addCookieAcrossOrigins(page, 'courtos.access_token', buildSessionToken(2));

    const res = await page.request.post(VERIFY_URL, {
      data: { code: 'ABC123' },
    });

    expect(res.status()).toBe(403);
    const body = (await res.json()) as VerifyResponse;
    expect(body.valid).toBe(false);
  });
});

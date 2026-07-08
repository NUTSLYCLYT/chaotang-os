import { test, expect, type Page } from '@playwright/test';
import { cookieOrigins } from './fixtures';

/**
 * E2E：BL-07 · governance 本地 store 租户隔离（路由层，无需真实后端）
 *
 * 使用【真实后端形状】token（jiqun_ai/src/tenant.py）：
 *   { user_id, username, tenant_slug, role: 'user'|'admin', exp: <ISO 字符串> }
 * 以证明生产路径下隔离生效（tenant = tenant_slug 字符串，非 dev 的数字 tenantId）。
 *
 * 覆盖（见 docs/CHAOTANG_BACKLOG.md BL-07）：
 *  - 租户 A 创建的议案，租户 B GET 详情/audit → 404、列表不可见；租户 A 自己可见。
 *  - 租户 B 即便通过 actor 鉴权(role=admin)，也不能 transition 租户 A 的案（→ 404）。
 *  - legacy 案（会话无 tenant_slug → 案无租户标记）对任意会话可见（向后兼容）。
 *
 * 信任模型：claims 取自会话 payload（仅解码，验签由后端守）。
 * bill-store 是 JSONL 文件存储（不依赖 TURSO），故本测可在 dev server 真实创建/读取议案。
 * 断言基于唯一 billId，对并发/历史残留议案稳健。
 */

const BILLS = '/api/governance/bills';

/** 造真实后端形状的 access_token（user_id / tenant_slug / role / ISO exp）。 */
function buildToken(opts: {
  userId: string;
  tenantSlug?: string;
  role?: string;
  expISO?: string;
}): string {
  const b64url = (o: unknown): string =>
    Buffer.from(JSON.stringify(o))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({
    user_id: opts.userId,
    username: opts.userId,
    ...(opts.tenantSlug != null ? { tenant_slug: opts.tenantSlug } : {}),
    role: opts.role ?? 'user',
    exp: opts.expISO ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  });
  return `${header}.${payload}.sig`;
}

/** 会审后修复(2026-07-04)：此前只种 domain:'localhost'，与 playwright.config.ts 默认
 *  baseURL(127.0.0.1) 域名不匹配，cookie 从未被发送。改用 fixtures.ts 的 cookieOrigins()
 *  在全部候选 origin 下都种一份。 */
async function seedTenant(
  page: Page,
  opts: { userId: string; tenantSlug?: string; role?: string; actor?: string },
): Promise<void> {
  await page.context().clearCookies();
  const token = buildToken(opts);
  const cookies = cookieOrigins().flatMap((url) => {
    const forOrigin = [{ name: 'courtos.access_token', value: token, url }];
    if (opts.actor) forOrigin.push({ name: 'courtos.actor', value: opts.actor, url });
    return forOrigin;
  });
  await page.context().addCookies(cookies);
}

test.describe('BL-07 · governance 租户隔离（真实后端 token 形状）', () => {
  test('租户A 创建案 → 租户B GET/audit 404 + 列表不可见；租户A 自己可见', async ({ page }) => {
    // ── 租户 A（slug=acme）创建案 ──
    await seedTenant(page, { userId: 'a-user', tenantSlug: 'acme' });
    const createRes = await page.request.post(BILLS, {
      data: { command: '户部，核算 Q1 财务三大指标：收入、成本、利润' },
    });
    expect(createRes.status()).toBe(201);
    const bill = (await createRes.json()) as { id: string };
    expect(bill.id).toBeTruthy();

    // 租户 A 能 GET 详情 + 列表可见
    expect((await page.request.get(`${BILLS}/${bill.id}`)).status()).toBe(200);
    const aBills = ((await (await page.request.get(BILLS)).json()) as { bills: { id: string }[] }).bills;
    expect(aBills.some((b) => b.id === bill.id)).toBe(true);

    // ── 切到租户 B（slug=globex）──
    await seedTenant(page, { userId: 'b-user', tenantSlug: 'globex' });

    // 跨租户 GET 详情 → 404
    expect((await page.request.get(`${BILLS}/${bill.id}`)).status()).toBe(404);
    // 跨租户 audit → 404（不能借 audit 探测他租户案）
    expect((await page.request.get(`${BILLS}/${bill.id}/audit`)).status()).toBe(404);
    // 跨租户列表 → 不含该案
    const bBills = ((await (await page.request.get(BILLS)).json()) as { bills: { id: string }[] }).bills;
    expect(bBills.some((b) => b.id === bill.id)).toBe(false);
  });

  test('租户B 通过 actor 鉴权后仍不能 transition 租户A 的案（→ 404）', async ({ page }) => {
    await seedTenant(page, { userId: 'a-user', tenantSlug: 'acme' });
    const createRes = await page.request.post(BILLS, {
      data: { command: '兵部，评估竞争态势与市场风险' },
    });
    const bill = (await createRes.json()) as { id: string };

    // 租户 B：role=admin（过 actor 省份鉴权 sessionIsAdmin）+ 自称 zhongshu + 带 expectedEventCount。
    // 鉴权(403)与参数(400)都已满足 → 应卡在租户归属校验 404。
    await seedTenant(page, { userId: 'b-user', tenantSlug: 'globex', role: 'admin', actor: 'zhongshu' });
    const res = await page.request.post(`${BILLS}/${bill.id}/transition`, {
      data: { type: 'submit_to_review', actor: 'zhongshu', reason: '越租户尝试', expectedEventCount: 1 },
    });
    expect(res.status()).toBe(404);
    expect(res.status()).not.toBe(403); // 已过鉴权
    expect(res.status()).not.toBe(400); // 已带乐观锁版本号
  });

  test('legacy 案（会话无 tenant_slug）对任意租户会话可见（向后兼容）', async ({ page }) => {
    await seedTenant(page, { userId: 'legacy-user' }); // 无 tenant_slug → 案无租户标记
    const createRes = await page.request.post(BILLS, {
      data: { command: '工部，梳理技术债与重构优先级清单' },
    });
    expect(createRes.status()).toBe(201);
    const bill = (await createRes.json()) as { id: string };

    await seedTenant(page, { userId: 'tenant-user', tenantSlug: 'acme' });
    expect((await page.request.get(`${BILLS}/${bill.id}`)).status()).toBe(200);
    const bills = ((await (await page.request.get(BILLS)).json()) as { bills: { id: string }[] }).bills;
    expect(bills.some((b) => b.id === bill.id)).toBe(true);
  });
});

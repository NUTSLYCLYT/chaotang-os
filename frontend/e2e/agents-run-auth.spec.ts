import { test, expect, type Page } from '@playwright/test';
import { clearSession } from './fixtures';

/**
 * E2E：POST /api/agents/run 鉴权回归（路由 + 中间件层断言，无需真实后端）
 *
 * 覆盖已落地的修复（见 docs/CHAOTANG_FLOW_AUDIT.md）：
 *
 *  (1) SWARM-RUN-02 — /api/agents/run 不再可匿名触发 LLM + 写库。
 *      · 匿名（无 courtos.access_token 会话 cookie）→ 被 src/proxy.ts 中间件在
 *        所有 /api/* 上 fail-closed 401（JSON {error:'unauthorized'}），根本不进
 *        route 的 triggerLlm / DB 写入分支。route 内 getUserIdFromSession() 亦会
 *        在 sub 缺失时 401 兜底，但中间件更早一层拦下。
 *      · 带「会话存在且含 sub claim」的 cookie → 过中间件 → route 的身份门放行
 *        （getUserIdFromSession 取 payload.sub 非空）→ 不再 401。
 *
 *  (2) SWARM-RUN-03 — run 插入前应用层校验 task 存在，杜绝孤儿行。
 *      · 带合法会话 + 合法 agentCode + 不存在的 taskId → route 在写库前
 *        `SELECT id FROM tasks WHERE id=?` 未命中 → 404 {error:'task_not_found'}。
 *        身份门已通过，故响应必为 4xx（且断言「不是 401」以证明卡在 task 校验而非鉴权）。
 *
 * 实现要点（严格照 e2e/swarm-members.spec.ts 与 e2e/authz-downgrade.spec.ts 范式）：
 *  - 用 buildSessionToken() 造一个可被服务端 base64url 解码、payload 含 sub 的
 *    JWT 形 access_token；getUserIdFromSession() 取 payload.sub 作 userId。
 *  - 双门只需种服务端 cookie 这一道：本测全部直打 API（page.request），不渲染受
 *    AuthGate 保护的页面，故无需 localStorage 种子（localStorage 那道门只拦页面跳转）。
 *  - page.request 直接 POST API 断言状态码 / envelope，不触达真实 LLM 后端。
 */

const RUN_URL = '/api/agents/run';

/** 11 codes 之一（见 lib/contracts/schemas.ts ZAgentCode），合法 agentCode。 */
const VALID_AGENT_CODE = 'prime_minister';

/**
 * 造一个「会话存在且含 sub claim」的 JWT 形 token。
 * 服务端 readAccessPayload() 只 base64url 解码 payload（不验签），取 sub 作 userId、
 * 校验 exp 未过期。这里给 sub + 远未来 exp → getUserIdFromSession() 返回非空 → 过身份门。
 */
function buildSessionToken(opts: { userId?: string; expISO?: string } = {}): string {
  const b64url = (obj: unknown): string =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  // 真实后端形状（jiqun_ai/src/tenant.py）：user_id（非 sub）+ ISO exp。
  // getUserIdFromSession 现读 user_id；exp 容忍 ISO 字符串（旧代码 exp*1000=NaN 漏过）。
  const payload = b64url({
    user_id: opts.userId ?? 'e2e-run-user',
    username: 'e2e',
    role: 'user',
    exp: opts.expISO ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  });
  return `${header}.${payload}.sig`;
}

/** 种一个含 user_id 的服务端会话 cookie（过中间件 + route 身份门）。
 *  会审后修复(2026-07-04)：此前只种 domain:'localhost'，playwright.config.ts 默认
 *  baseURL 是 127.0.0.1——域名不匹配导致 cookie 从不被发送，全部依赖会话的用例静默判成
 *  401(看似"符合预期"，实则从未真正验证过 body/后续逻辑)。改用 e2e/fixtures.ts 已有的
 *  双域名(localhost + 127.0.0.1)模式，与其它 spec 保持一致。 */
async function seedRunSession(
  page: Page,
  opts: { userId?: string; expISO?: string } = {},
): Promise<void> {
  const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
  const origins = new Set(['http://localhost:3002', 'http://127.0.0.1:3002']);
  if (configuredBaseUrl) origins.add(new URL(configuredBaseUrl).origin);
  const token = buildSessionToken(opts);
  await page.context().addCookies(Array.from(origins).map((url) => ({
    name: 'courtos.access_token',
    value: token,
    url,
  })));
}

test.describe('POST /api/agents/run 鉴权回归', () => {
  // ── (1) SWARM-RUN-02：匿名不可触发 ─────────────────────────────────────────
  test('匿名（clearSession，无会话 cookie）→ 401（不可匿名烧 LLM / 写库）', async ({
    page,
  }) => {
    // 清掉任何潜在种子：无 courtos.access_token → 中间件 fail-closed 401。
    await clearSession(page);

    const res = await page.request.post(RUN_URL, {
      data: { taskId: 'whatever', agentCode: VALID_AGENT_CODE },
    });

    expect(res.status()).toBe(401);
    const body = (await res.json()) as { error?: string; success?: boolean };
    // 中间件返回 {error:'unauthorized'}；route 兜底返回 {success:false,error:'unauthorized'}。
    // 两者皆带 error:'unauthorized'，断言其存在即可（不绑定具体层）。
    expect(body.error).toBe('unauthorized');
  });

  // ── (1) SWARM-RUN-02：合法会话过身份门 ─────────────────────────────────────
  test('带会话 cookie（含 sub）+ 合法 agentCode → 非 401（身份门放行）', async ({
    page,
  }) => {
    await seedRunSession(page);

    const res = await page.request.post(RUN_URL, {
      data: { taskId: 'task-e2e-maybe-absent', agentCode: VALID_AGENT_CODE },
    });

    // 身份门已通过 → 绝不应再是 401。后续可能因 taskId 不存在(404)、并发/限频(429)
    // 或 DB 不可用(503) 而失败，但都不是「未鉴权」。本用例只钉「不再匿名被拒」。
    expect(res.status()).not.toBe(401);
  });

  // ── 正向路径补测(2026-07-04 · 会审指出此前只测反面情形，未断言"真实存在的任务应该成功") ──
  // 用 GET /api/qintian/learning-path 造一个真实存在、未传tenantId(tenant_id恒为NULL，见
  // tenant-null-fallback.nodetest.ts)的task，钉死"合法拥有的真实任务不应被(tenant_id = ?
  // OR tenant_id IS NULL)误判404"这条CRITICAL回归——此前只用ghost/maybe-absent taskId
  // 测试，无论tenant过滤对不对都会得到同样的404/非404结果，测不出这次回归。
  test('合法会话 + 真实存在的task(tenant_id=NULL) + 合法agentCode → 非404 task_not_found', async ({
    page,
  }) => {
    await seedRunSession(page);

    const learningPathRes = await page.request.get('/api/qintian/learning-path');
    const learningPathBody = (await learningPathRes.json().catch(() => ({}))) as {
      success?: boolean;
      data?: { retrospective?: { archiveTaskId?: string } };
    };
    const realTaskId = learningPathBody.data?.retrospective?.archiveTaskId;
    // 若环境无法造出真实task(如DB不可达)，跳过而非误判失败——这条测的是"存在时不应404"，
    // 不是"造数据这一步一定成功"。
    test.skip(!learningPathBody.success || !realTaskId, 'DB 不可达或 learning-path 未能造出真实 task，跳过');

    const res = await page.request.post(RUN_URL, {
      data: { taskId: realTaskId, agentCode: VALID_AGENT_CODE },
    });

    const status = res.status();
    expect(status).not.toBe(401); // 身份门已通过
    const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
    // 核心断言：真实存在的task绝不应被误判成 task_not_found(严格tenant_id=?的回归特征)。
    expect(body.error).not.toBe('task_not_found');
  });

  // ── (2) SWARM-RUN-03：不存在的 taskId 在写库前被 4xx 拒 ─────────────────────
  test('合法会话 + 合法 agentCode + 不存在的 taskId → 4xx（task 校验，非鉴权）', async ({
    page,
  }) => {
    await seedRunSession(page);

    // 用极不可能命中的随机 taskId，确保 SELECT tasks WHERE id=? 未命中。
    const ghostTaskId = `ghost-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const res = await page.request.post(RUN_URL, {
      data: { taskId: ghostTaskId, agentCode: VALID_AGENT_CODE },
    });

    const status = res.status();
    // 身份门已通过（非 401）且绝不返回 2xx 成功（ghost task 永不能创建 run）。
    expect(status).not.toBe(401);
    expect(status).toBeGreaterThanOrEqual(400);

    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);

    // SWARM-RUN-03 契约：DB 可达时，不存在的 taskId 在写库前被 404 task_not_found 拒。
    // 但本 E2E dev server 未必配置 TURSO_DB_URL —— DB 不可达时 getDb()/查询前置失败返回
    // 503 db_insert_failed（仍是 4xx 之外的服务端错，且非 2xx、非鉴权）。两种都满足
    // 「身份已过、ghost task 未写库成功」的安全契约；仅在 DB 可达(404)时强校验 task_not_found。
    if (status === 404) {
      expect(body.error).toBe('task_not_found');
    } else {
      expect(status).toBe(503); // DB 不可达兜底，文档化的环境降级
      expect(body.error).toBe('db_insert_failed');
    }
  });

  // ── 反例：缺失 agentCode 不应被误判为鉴权失败（证明 4xx 来自校验非鉴权）──────
  test('合法会话 + 缺 agentCode → 400（入参校验，非 401 鉴权）', async ({ page }) => {
    await seedRunSession(page);

    const res = await page.request.post(RUN_URL, {
      data: { taskId: 'task-e2e' }, // 缺 agentCode
    });

    expect(res.status()).toBe(400);
    expect(res.status()).not.toBe(401);
    const body = (await res.json()) as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();
  });

  // ── (3) ISO exp 过期判断生效（真实后端 exp 是 ISO 字符串，非 unix 秒）──────────
  test('过期 ISO exp 的会话 → 401（exp 容忍 ISO 字符串，过期判断生效）', async ({ page }) => {
    // 1 分钟前过期的 ISO exp。旧代码 `exp*1000`（exp 是字符串）= NaN → 永不过期 → 会放行；
    // 修复后 isExpired 解析 ISO → 判定过期 → getUserIdFromSession 返回 null → 401。
    await seedRunSession(page, { expISO: new Date(Date.now() - 60_000).toISOString() });
    const res = await page.request.post(RUN_URL, {
      data: { taskId: 'whatever', agentCode: VALID_AGENT_CODE },
    });
    expect(res.status()).toBe(401);
  });
});

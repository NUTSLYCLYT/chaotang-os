import { expect, test } from '@playwright/test';

/**
 * 邀请准入闭环冒烟（remaining-pages 方案 P0，2026-07-09）：
 *   /enter?token=  →  /invite、/invite/[code]  →  /register
 *
 * 修复背景：三个入口此前分别有假校验/死接口问题——
 *   - /enter：纯前端 setTimeout，任意非空 token 必过（安全缺陷，已删）。
 *   - /invite：调用的 POST /api/auth/verify-invite 后端不存在（404/走不到）。
 *   - /register：inviteCode 字段后端 schema 没有，静默丢弃不校验。
 * 现在三者统一走真实后端 /api/auth/verify-invite + /api/auth/register 的
 * invite_code 字段，backend/src/tenant.py 的 invites 表持久化用量。
 *
 * 与 liubu-bureau-pages-smoke.spec.ts 同款方法论：真实后端、真断言负向情况，
 * 不用 alg:none 假 token，不能只查"页面没崩"。
 */

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_JIQUN_API_URL ??
  process.env.NEXT_PUBLIC_CHAOTANG_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  'http://localhost:8081';

// backend/scripts/bootstrap_chaotang.sh 默认导出 FENGQUN_BOOTSTRAP_INVITE_CODE=CHAOTANG-DEV-E2E，
// 后端启动时会幂等创建这个邀请码（max_uses=100000）。未走该脚本启动的后端需要自行用
// backend/scripts/manage_invites.py create CHAOTANG-DEV-E2E --max-uses 100000 补一个。
const VALID_INVITE_CODE = process.env.FENGQUN_BOOTSTRAP_INVITE_CODE ?? 'CHAOTANG-DEV-E2E';
const INVALID_INVITE_CODE = 'NOT-A-REAL-CODE-9999';

test.describe('邀请准入闭环（/enter、/invite、/register）', () => {
  test('/enter 携带无效 token → 拒绝态，不放行到 /dadian', async ({ page }) => {
    await page.goto(`/enter?token=${encodeURIComponent(INVALID_INVITE_CODE)}`);
    await expect(page.getByText('此令牌无法入朝')).toBeVisible({ timeout: 10_000 });
    // 给一点缓冲时间确认真的没有触发跳转（此前的 bug 是无条件 setTimeout 后跳转）。
    await page.waitForTimeout(2500);
    await expect(page).not.toHaveURL(/\/dadian/);
  });

  test('/enter 携带真实有效邀请码 → 核验通过，跳转 /dadian', async ({ page }) => {
    await page.goto(`/enter?token=${encodeURIComponent(VALID_INVITE_CODE)}`);
    await expect(page.getByText('圣旨到，开殿迎驾')).toBeVisible({ timeout: 10_000 });
    await page.waitForURL(/\/dadian/, { timeout: 10_000 });
  });

  test('/invite 页面输入无效邀请码 → 拒绝态，不放行到登录/注册', async ({ page }) => {
    await page.goto('/invite');
    await page.getByPlaceholder('输入邀请码，如 COURT2026').fill(INVALID_INVITE_CODE);
    await page.getByRole('button', { name: '验证邀请码' }).click();
    await expect(page.getByText(/邀请码不存在|邀请码无效或已过期/)).toBeVisible({ timeout: 10_000 });
  });

  test('/invite/[code] 落地页对真实有效邀请码显示可用', async ({ page }) => {
    await page.goto(`/invite/${encodeURIComponent(VALID_INVITE_CODE)}`);
    await expect(page.getByText('圣旨到，开殿迎驾')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(VALID_INVITE_CODE)).toBeVisible();
  });

  test('POST /api/auth/register 缺 invite_code → 422，不建号', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `e2e_no_invite_${Date.now()}`,
        email: `e2e_no_invite_${Date.now()}@e2e.local`,
        password: 'e2e-pw-2026',
      }),
    });
    expect(res.status).toBe(422);
  });

  test('POST /api/auth/register 携带无效 invite_code → 403，不建号', async () => {
    const res = await fetch(`${BACKEND_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `e2e_bad_invite_${Date.now()}`,
        email: `e2e_bad_invite_${Date.now()}@e2e.local`,
        password: 'e2e-pw-2026',
        invite_code: INVALID_INVITE_CODE,
      }),
    });
    expect(res.status).toBe(403);
  });

  test('POST /api/auth/register 携带真实有效 invite_code → 201，真建号', async () => {
    const stamp = Date.now();
    const res = await fetch(`${BACKEND_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `e2e_good_invite_${stamp}`,
        email: `e2e_good_invite_${stamp}@e2e.local`,
        password: 'e2e-pw-2026',
        invite_code: VALID_INVITE_CODE,
      }),
    });
    expect(res.status, `register(${await res.text()})`).toBe(201);
  });

  test('/register 页面直接访问(无邀请码参数) → 提交被前端拦截，不发请求', async ({ page }) => {
    // 之前这条用例名字叫"不发请求"，但断言只查了错误文案是否可见，从没验证过真的
    // 没发请求——如果前端拦截逻辑出 bug（比如判断条件写反、只是没 await 就继续往下
    // 跑），文案照样能显示，但请求可能已经发出去了，这条用例照样会“通过”。这里加一个
    // 真实的网络层断言：监听是否有任何打到 /api/auth/register 的请求，断言数量为 0。
    let registerRequestCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/register')) registerRequestCount += 1;
    });

    await page.goto('/register');
    await page.getByPlaceholder('2-32 个中英文字符').fill(`e2e_ui_probe_${Date.now()}`);
    await page.getByPlaceholder('you@courtos.ai').fill('e2e_ui_probe@e2e.local');
    await page.getByPlaceholder('至少 6 位').fill('e2e-pw-2026');
    await page.getByPlaceholder('再次输入密码').fill('e2e-pw-2026');
    await page.getByRole('button', { name: /注册账号/ }).click();
    await expect(page.getByText('注册需要有效邀请码，请通过邀请链接进入本页面。')).toBeVisible();
    // 给一点缓冲时间，确认拦截之后确实没有异步补发请求。
    await page.waitForTimeout(1000);
    expect(registerRequestCount, '拦截文案显示的同时，不应该有任何 /api/auth/register 请求发出').toBe(0);
  });

  test('/register 页面携带真实有效邀请码 → 真实注册成功，跳转登录页', async ({ page }) => {
    // 覆盖此前缺失的"关键修复"正向路径：register/page.tsx 新加的 `!inviteCode` 前端
    // 拦截门，只在没有邀请码时挡住提交——但没有任何用例真的通过浏览器 UI（而不是绕开
    // UI 直接打 fetch）驱动一次"带有效邀请码"的注册，去证明这道新加的门没有把正常
    // 路径也一起挡住。这里补上：真实走一遍表单填写→提交→断言注册成功卷轴→断言最终
    // 跳到登录页，全程通过浏览器 DOM 交互，不直接调后端 API。
    const stamp = Date.now();
    const username = `e2e_ui_success_${stamp}`;
    await page.goto(`/register?invite=${encodeURIComponent(VALID_INVITE_CODE)}`);
    await expect(page.getByText(VALID_INVITE_CODE)).toBeVisible();
    await page.getByPlaceholder('2-32 个中英文字符').fill(username);
    await page.getByPlaceholder('you@courtos.ai').fill(`${username}@e2e.local`);
    await page.getByPlaceholder('至少 6 位').fill('e2e-pw-2026');
    await page.getByPlaceholder('再次输入密码').fill('e2e-pw-2026');
    await page.getByRole('button', { name: /使用引荐码注册|注册账号/ }).click();
    await expect(page.getByText('注册成功')).toBeVisible({ timeout: 10_000 });
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });
});

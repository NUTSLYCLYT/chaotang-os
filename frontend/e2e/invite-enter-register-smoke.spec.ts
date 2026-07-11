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

  test('/register 页面携带真实有效邀请码 → 真实注册成功→登录→落地已登录页', async ({ page }) => {
    // 覆盖此前缺失的"关键修复"正向路径：register/page.tsx 新加的 `!inviteCode` 前端
    // 拦截门，只在没有邀请码时挡住提交——但没有任何用例真的通过浏览器 UI（而不是绕开
    // UI 直接打 fetch）驱动一次"带有效邀请码"的注册，去证明这道新加的门没有把正常
    // 路径也一起挡住。
    //
    // 2026-07-11 Codex 停止前审查纠正：上一版这条用例只走到"跳转登录页"就断言结束了，
    // 用例名字却叫"注册→登录"，实际从没有真的用刚注册出来的账号密码登录、也没断言
    // 落地到已登录页——跟任务 1 原定目标"注册→登录→落地到已登录页"名不副实。这里补
    // 完整这条闭环：跳到登录页后，真的用同一组刚创建的用户名密码提交登录，断言最终落
    // 地 /dadian（登录页默认 next），而不是只停在"到了登录页"这一半。
    const stamp = Date.now();
    const username = `e2e_ui_success_${stamp}`;
    const password = 'e2e-pw-2026';
    await page.goto(`/register?invite=${encodeURIComponent(VALID_INVITE_CODE)}`);
    await expect(page.getByText(VALID_INVITE_CODE)).toBeVisible();
    await page.getByPlaceholder('2-32 个中英文字符').fill(username);
    await page.getByPlaceholder('you@courtos.ai').fill(`${username}@e2e.local`);
    await page.getByPlaceholder('至少 6 位').fill(password);
    await page.getByPlaceholder('再次输入密码').fill(password);
    await page.getByRole('button', { name: /使用引荐码注册|注册账号/ }).click();
    await expect(page.getByText('注册成功')).toBeVisible({ timeout: 10_000 });
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    // register/page.tsx 用 window.location.assign() 触发整页硬跳转（不是 SPA 路由），
    // 跳过去之后有一小段 HTML 已渲染、但 React 尚未 hydrate 完成（受控 input 的
    // onChange 还没接上）的窗口——第一次实测在这里直接 fill() 就撞上了，两个输入框
    // 填了但值没进 React state，提交时读到空字符串，登录页自己报"请填写账号和密码"，
    // 而不是我们要测的登录成功/失败。等标题渲染完成只能证明 DOM 有了，不能证明已经
    // hydrate；用 networkidle 等 hydration 相关的脚本执行/请求真正完事。
    await page.waitForLoadState('networkidle');

    // 用刚注册的账号真实登录，走到底：断言落地已登录页 /dadian，不是只到登录页为止。
    //
    // 2026-07-11 Codex 停止前审查纠正：register/page.tsx 带邀请码时跳的是
    // `/login?next=/dadian&invite=...`——这个 URL 字符串本身就含有 "/dadian" 子串
    // (来自 query 里的 next 参数)，如果最终断言用 /\/dadian/ 去匹配"完整 URL 字符串"，
    // 哪怕登录压根没提交成功、页面一直停在 /login，这条正则也会命中查询字符串里的
    // "/dadian" 而误判通过——等于这条断言从写下的那一刻起就没有真正验证过登录是否成功。
    // 改用 URL 对象的 pathname 精确比较，只认路径部分，查询字符串里出现同名子串不会
    // 再造成误判。
    await page.getByLabel('用户名').fill(username);
    await page.getByLabel('密码').fill(password);
    // fill() 之后立刻断言输入框真的拿到了值——比"直接点提交"更早发现"填了但没进
    // React state"这类 hydration 竞态，失败信息也更直接指向问题所在，而不是十秒后
    // 才在登录页报"请填写账号和密码"、让人误以为是登录接口本身的问题。
    await expect(page.getByLabel('用户名')).toHaveValue(username);
    await expect(page.getByLabel('密码')).toHaveValue(password);
    await page.getByRole('button', { name: '入朝议政' }).click();
    await page.waitForURL((url) => url.pathname === '/dadian', { timeout: 10_000 });
    expect(new URL(page.url()).pathname, `登录后仍停留在 ${page.url()}，未真正落地 /dadian`).toBe('/dadian');
  });
});

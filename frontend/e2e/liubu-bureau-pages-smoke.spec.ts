import { expect, test, type Page } from '@playwright/test';

/**
 * 六部司页面冒烟：useBureauPageView 2026-07-09 从死路由改接真实 dept overview 后，
 * 验证 8 个司页面不再硬 404，且能看到真实数据或诚实的骨架态（不是伪造数据）。
 *
 * 鉴权注意（2026-07-09 复审修正，见 e2e/fixtures.ts 的双门鉴权说明）：
 * - 服务端中间件只查 cookie 是否存在，不校验值；
 * - 但 useBureauPageView → backendFetch 会把 localStorage['courtos.auth'].accessToken
 *   当 Bearer token 直接打到真实后端（backend/web/deps.py:get_current_user 会验签），
 *   假 token（alg:none 或任意字符串）在这里必 401。之前用假 token 时，8/9 用例全部
 *   落在 useBureauPageView 的诚实降级态（"当前无法生成司级页面视图"），只是断言字符串
 *   写的是"部门页面视图"（措辞不符），从未真正触发过，才被误判为"通过"。
 * 这里改为对真实后端注册+登录一个 e2e 专用账号，拿到真签名 token，才能真正验证
 * dept.py 数据链路，而不是验证"降级 UI 不会白屏"这种弱得多的东西。
 */

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_JIQUN_API_URL ??
  process.env.NEXT_PUBLIC_CHAOTANG_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  'http://localhost:8081';

const E2E_USERNAME = 'e2e_liubu_smoke';
const E2E_PASSWORD = 'e2e-liubu-smoke-pw-2026';
const E2E_EMAIL = 'e2e-liubu-smoke@example.local';
// 2026-07-09 起 /register 要求 invite_code；backend/scripts/bootstrap_chaotang.sh
// 默认导出 FENGQUN_BOOTSTRAP_INVITE_CODE=CHAOTANG-DEV-E2E（未设置该变量的后端不会有此邀请码，
// 需自行用 backend/scripts/manage_invites.py 建一个同名的）。
const E2E_INVITE_CODE = process.env.FENGQUN_BOOTSTRAP_INVITE_CODE ?? 'CHAOTANG-DEV-E2E';

/** 对真实后端注册（已存在则忽略 409）+ 登录，拿到一个真正签过名、能通过 verify_token 的 token。 */
async function getRealBackendToken(): Promise<string> {
  await fetch(`${BACKEND_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: E2E_USERNAME,
      email: E2E_EMAIL,
      password: E2E_PASSWORD,
      invite_code: E2E_INVITE_CODE,
    }),
  }).catch(() => null); // 409(已存在)是预期的稳态，忽略即可

  const loginRes = await fetch(`${BACKEND_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: E2E_USERNAME, password: E2E_PASSWORD }),
  });
  if (!loginRes.ok) {
    throw new Error(`e2e 登录失败，无法拿到真实 token：HTTP ${loginRes.status}`);
  }
  const body = (await loginRes.json()) as { token: string };
  return body.token;
}

let cachedToken: string | null = null;

async function seedSession(page: Page): Promise<void> {
  // 缓存 token：9 个 worker 同时 register+login 同一账号会撞后端限流(429)。
  // 配合下面 describe.configure({ mode: 'serial' })，本文件全程单 worker 跑，
  // 这里只会真正请求一次。
  cachedToken ??= await getRealBackendToken();
  const token = cachedToken;
  await page.context().addCookies([
    { name: 'courtos.access_token', value: token, url: 'http://localhost:3002' },
    { name: 'courtos.access_token', value: token, url: 'http://127.0.0.1:3002' },
  ]);
  await page.addInitScript((accessToken) => {
    window.localStorage.setItem('courtos.auth', JSON.stringify({
      accessToken,
      refreshToken: 'e2e-refresh',
      tenantId: 1,
      username: 'liubu-smoke',
      accountType: 0,
      expiresAt: 4102444800000,
    }));
    window.localStorage.setItem('courtos.onboarded', '1');
  }, token);
}

// 路径不带 /chaotang 前缀：playwright.config.ts 的 webServer 直接调 `next dev`，
// 不经过 scripts/next-with-base-path.mjs（那里才会 `BASE_PATH ||= '/chaotang'`），
// 所以本 e2e harness 里 basePath 从不生效——这是全仓统一约定（其余 e2e spec 也都是
// 裸路径），不是本文件的新决定。带 /chaotang 前缀会打到真实的 Next 404
// （已用截图核实：加前缀时 8/9 用例的"通过"实际是 404 页面本身，弱断言没测出来）。
const BASE_PATH = '';

const BUREAUS: Array<{ code: string; office: string }> = [
  { code: 'hubu', office: 'yusuan' },
  { code: 'hubu', office: 'chuna' },
  { code: 'libu', office: 'renmian' },
  { code: 'libu', office: 'zhaopin' },
  { code: 'bingbu', office: 'baojia' },
  { code: 'bingbu', office: 'xiansuo' },
  { code: 'xingbu', office: 'hetong' },
  { code: 'gongbu', office: 'chan-yan' },
];

test.describe('六部司页面不再 404', () => {
  // 单 worker 串行：见 cachedToken 注释——避免并发 register/login 撞后端限流，
  // 也顺带避开本机资源紧张时 9 路并发 networkidle 超时的问题。
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  for (const { code, office } of BUREAUS) {
    test(`/liubu/${code}/${office} 渲染真实视图，不落到 BureauPageViewError`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(`${BASE_PATH}/liubu/${code}/${office}`, { waitUntil: 'networkidle' });

      const notFoundHeading = page.getByRole('heading', { name: '404', exact: true });
      await expect(notFoundHeading).toHaveCount(0);

      // 实际降级文案是"司级页面视图"（buildBureauPageView 的错误态），不是"部门页面视图"——
      // 两个字符串都查，防止措辞再变一次又把断言写空。
      const errorPanel = page.getByText(/当前无法生成(部门|司级)页面视图/);
      await expect(errorPanel).toHaveCount(0);
      const overviewFailed = page.getByText('bureau_page_view_overview_failed', { exact: false });
      await expect(overviewFailed).toHaveCount(0);

      await expect(page.locator('body')).not.toHaveText('');
      await page.screenshot({
        path: `test-results/liubu-smoke/${code}-${office}.png`,
        fullPage: true,
      });
    });
  }

  test('/liubu/xingbu/hetong 挂载了合同审查台（原孤儿组件，本轮重接）', async ({ page }) => {
    await page.goto(`${BASE_PATH}/liubu/xingbu/hetong`, { waitUntil: 'networkidle' });
    const heading = page.getByText('合同审查司', { exact: false });
    await expect(heading).toBeVisible();
    await heading.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/liubu-smoke/xingbu-hetong-workbench.png' });
  });

  test('/liubu/bingbu/baojia 挂载了报价红线深度复核面板', async ({ page }) => {
    await page.goto(`${BASE_PATH}/liubu/bingbu/baojia`, { waitUntil: 'networkidle' });
    const heading = page.getByText('报价红线深度复核', { exact: false });
    await expect(heading).toBeVisible();
    await heading.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/liubu-smoke/bingbu-baojia-quotation-panel.png' });
  });
});

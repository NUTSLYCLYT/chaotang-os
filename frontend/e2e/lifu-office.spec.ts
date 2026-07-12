import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { clearSession } from './fixtures';

/**
 * E2E：礼部对外增长办公厅 /liubu/libu_rites（旧稿测的是从未存在过的 /departments/market，
 * 用的也是另一版 UI/引擎选型——2026-07-13 对齐真实实现后整份重写，不是增量修补）。
 *
 * 鉴权注意（同 e2e/liubu-bureau-pages-smoke.spec.ts 的复审结论，2026-07-13 本文件复现同一个坑）：
 * useDepartmentPageView（DepartmentPageRouteClient 实际用的 hook）对 overview 拉取失败没有降级态，
 * 直接抛 department_page_view_failed，把整页替成错误壳——4 个已接线司的工作台完全渲染不出来。
 * e2e/fixtures.ts 的 seedSession() 用的假 token 会被真后端 401，所以这里不能用它，必须像
 * liubu-bureau-pages-smoke.spec.ts 一样对真后端注册+登录拿一个真签名 token。
 * 4 个司引擎本身仍是纯客户端同步函数，无需 mock 具体业务数据——只是页面壳需要一个能通过
 * verify_token 的 token 才能先跑到 DepartmentPageViewShell。
 */

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_JIQUN_API_URL ??
  process.env.NEXT_PUBLIC_CHAOTANG_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  'http://localhost:8081';

const RUN_ID = randomUUID().replaceAll('-', '').slice(0, 12);
const E2E_USERNAME = `e2e_lifu_${RUN_ID}`;
const E2E_PASSWORD = `E2E-${randomUUID()}-aA1!`;
const E2E_EMAIL = `${E2E_USERNAME}@example.local`;
const E2E_INVITE_CODE = process.env.FENGQUN_BOOTSTRAP_INVITE_CODE ?? 'CHAOTANG-DEV-E2E';

async function getRealBackendToken(): Promise<string> {
  const injectedToken = (process.env.HARNESS_AUTH_TOKEN ?? '').trim();
  if (injectedToken) return injectedToken;

  const registerRes = await fetch(`${BACKEND_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: E2E_USERNAME,
      email: E2E_EMAIL,
      password: E2E_PASSWORD,
      invite_code: E2E_INVITE_CODE,
    }),
  });
  if (!registerRes.ok) {
    throw new Error(`e2e 注册失败，无法创建一次性测试会话：HTTP ${registerRes.status}`);
  }

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

async function seedRealSession(page: Page): Promise<void> {
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
      username: 'lifu-office-e2e',
      accountType: 0,
      expiresAt: 4102444800000,
    }));
    window.localStorage.setItem('courtos.onboarded', '1');
  }, token);
}

const MARKET_URL = '/liubu/libu_rites';

test.describe('礼部对外增长办公厅', () => {
  // 单 worker 串行：同账号并发 register/login 会撞后端限流(429)，同 liubu-bureau-pages-smoke.spec.ts。
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await seedRealSession(page);
  });

  test('顶条显示 4 真司可算,3 骨架司诚实标待通电', async ({ page }) => {
    await page.goto(MARKET_URL, { waitUntil: 'networkidle' });

    await expect(page.getByText('4 真司可算')).toBeVisible({ timeout: 10000 });
    // 8 司编制 - 1 尚书(chief,不进"能算"清单) - 4 已接真引擎 = 3 骨架待通电(新媒体运营/场合作战/品牌文化)
    await expect(page.getByText(/3 待通电/)).toBeVisible();
    // 4 个已接线司的 tab 按钮都在
    await expect(page.getByRole('button', { name: '关系台账司' })).toBeVisible();
    await expect(page.getByRole('button', { name: '流量增长司' })).toBeVisible();
    await expect(page.getByRole('button', { name: '对外承诺可逆司' })).toBeVisible();
    await expect(page.getByRole('button', { name: '商务公关司' })).toBeVisible();
  });

  test('关系台账司：填一个对外关系后算出关系健康', async ({ page }) => {
    await page.goto(MARKET_URL, { waitUntil: 'networkidle' });

    // 默认激活关系台账司
    await expect(page.getByText('对外关系台账')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('姓名/机构').first().fill('张总监');
    await page.getByRole('button', { name: '算关系健康' }).click();

    await expect(page.getByText('共 1 个对外关系')).toBeVisible({ timeout: 5000 });

    // 裁决卡不能显示过期结果：编辑输入后（未重新点算）旧卡必须消失
    await page.getByPlaceholder('姓名/机构').first().fill('张总监（改名）');
    await expect(page.getByText('共 1 个对外关系')).toHaveCount(0);
  });

  test('流量增长司：填一个渠道后算出 ROI 裁决', async ({ page }) => {
    await page.goto(MARKET_URL, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: '流量增长司' }).click();
    await expect(page.getByText('渠道投入产出')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('公众号/抖音/SEM…').first().fill('公众号');
    const inputs = page.getByRole('spinbutton');
    await inputs.nth(0).fill('10000'); // 投入
    await inputs.nth(1).fill('20'); // 转化数
    await inputs.nth(2).fill('30000'); // 营收 → ROAS=3 → 加投

    await page.getByRole('button', { name: '算渠道 ROI' }).click();

    await expect(page.getByText('公众号').last()).toBeVisible({ timeout: 5000 });
    // exact: true —— "加投" 也会作为子串出现在推荐语("加投【公众号】。")和 nextStep("ROAS 3 高,加投")里，
    // 只有裁决徽章是精确等于"加投"。
    await expect(page.getByText('加投', { exact: true })).toBeVisible();
  });

  test('对外承诺可逆司：报价评估出 decision,防失真门查出违规', async ({ page }) => {
    await page.goto(MARKET_URL, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: '对外承诺可逆司' }).click();
    await expect(page.getByText('报价/让步评估')).toBeVisible({ timeout: 10000 });

    const inputs = page.getByRole('spinbutton');
    await inputs.nth(0).fill('100000'); // 己方保留价
    await inputs.nth(2).fill('120000'); // 当前报价(第 3 个 spinbutton，第 2 个是对方保留价)
    await page.getByRole('button', { name: '算报价决策' }).click();
    // needsSignoff 恒真但渲染在 VerdictCard 折叠区，断言 nextStep(未折叠即可见)而非折叠内的 blockers 文案
    await expect(page.getByText('报价达到/优于己方保留价,可接受(仍须人工确认)')).toBeVisible({ timeout: 5000 });

    // 防失真门：源标 FALLBACK 但表达用了确定性措辞 → 应查出违规
    await page.getByLabel('源结论标签').selectOption('FALLBACK');
    await page.getByLabel('对外表达文案').fill('本方案已验证,保证效果');
    await page.getByRole('button', { name: '查失真' }).click();
    await expect(page.getByText(/处失真/)).toBeVisible({ timeout: 5000 });
  });

  test('商务公关司：默认参数即可算出响应姿态和协办徽', async ({ page }) => {
    await page.goto(MARKET_URL, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: '商务公关司' }).click();
    await expect(page.getByText('危机响应姿态')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: '算响应姿态' }).click();

    await expect(page.getByText(/Tier \d/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('锦衣卫')).toBeVisible();
  });

  test('未登录访问不跳 /login,但会诚实降级(overview 接口拒匿名读)', async ({ page }) => {
    // src/components/AuthGate.tsx 的 PUBLIC_ROUTES 显式包含 '/liubu'（routePath.startsWith('/liubu/')
    // 即命中），六部页面本身不做客户端登录跳转。但 /api/chaotang/dept/market/overview 本身要真
    // token（curl 空 Authorization 头验证过：{"detail":"未登录，请先认证"}），useDepartmentPageView
    // 对取数失败没有降级态，会把整页替成"部门案卷暂不可用"错误壳——不是白屏，也不是登录跳转。
    await clearSession(page);
    await page.goto(MARKET_URL, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(`${MARKET_URL}$`));
    await expect(page.getByText('部门案卷暂不可用')).toBeVisible({ timeout: 10000 });
  });
});

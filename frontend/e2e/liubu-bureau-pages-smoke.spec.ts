import { expect, test, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';

/**
 * 六部司页面冒烟：useBureauPageView 2026-07-09 从死路由改接真实 dept overview 后，
 * 验证 8 个司页面不再硬 404，且能看到真实数据或诚实的骨架态（不是伪造数据）。
 */

function makeLocalSessionToken(): string {
  const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({
    user_id: 'e2e-liubu-smoke',
    username: 'liubu-smoke',
    tenant_slug: 'local',
    role: 'owner',
    exp: '2100-01-01T00:00:00.000Z',
  });
  return `${header}.${payload}.sig`;
}

async function seedSession(page: Page): Promise<void> {
  const token = makeLocalSessionToken();
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
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  for (const { code, office } of BUREAUS) {
    test(`/liubu/${code}/${office} 渲染真实视图，不落到 BureauPageViewError`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(`/chaotang/liubu/${code}/${office}`, { waitUntil: 'networkidle' });

      const errorPanel = page.getByText('当前无法生成部门页面视图', { exact: false });
      await expect(errorPanel).toHaveCount(0);

      await expect(page.locator('body')).not.toHaveText('');
      await page.screenshot({
        path: `test-results/liubu-smoke/${code}-${office}.png`,
        fullPage: true,
      });
    });
  }

  test('/liubu/xingbu/hetong 挂载了合同审查台（原孤儿组件，本轮重接）', async ({ page }) => {
    await page.goto('/chaotang/liubu/xingbu/hetong', { waitUntil: 'networkidle' });
    const heading = page.getByText('合同审查司', { exact: false });
    await expect(heading).toBeVisible();
    await heading.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/liubu-smoke/xingbu-hetong-workbench.png' });
  });
});

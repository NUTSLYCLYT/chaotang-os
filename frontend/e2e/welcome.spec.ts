import { expect, test, type Page } from '@playwright/test';

const configuredBasePath =
  process.env.PLAYWRIGHT_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH ?? '';
const basePath = configuredBasePath.replace(/\/$/, '');

async function clearAuth(page: Page) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    window.localStorage.removeItem('courtos.auth');
    window.localStorage.removeItem('courtos.onboarded');
  });
}

async function gotoPublic(page: Page, path: string) {
  await page.goto(`${basePath}${path}`);
}

test.describe('欢迎引导页', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('根路径先展示欢迎页而不是登录页', async ({ page }) => {
    await gotoPublic(page, '/');

    await expect(page.getByRole('heading', { name: '朝堂 OS' })).toBeVisible();
    await expect(page.getByText('把你的公司，交给一座会思考的朝堂')).toBeVisible();
    await expect(page.getByRole('link', { name: /创建朝堂/ }).first()).toHaveAttribute('href', /\/register$/);
    await expect(page.getByRole('link', { name: /入朝登录|已有账号/ }).first()).toHaveAttribute('href', /\/login$/);
    await expect(page.getByRole('heading', { name: '登入朝堂' })).toHaveCount(0);
  });

  test('/welcome 可直接访问并保留注册登录入口', async ({ page }) => {
    await gotoPublic(page, '/welcome');

    await expect(page.getByRole('heading', { name: '朝堂 OS' })).toBeVisible();
    await expect(page.getByRole('link', { name: /创建朝堂/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /入朝登录|已有账号/ }).first()).toBeVisible();
  });

  test('宣传导航都指向有效区块', async ({ page }) => {
    await gotoPublic(page, '/welcome');

    const sections = [
      ['企业痛点', 'pain-points'],
      ['解决方案', 'solution'],
      ['适用场景', 'use-cases'],
      ['预约体验', 'conversion'],
    ] as const;

    for (const [label, targetId] of sections) {
      await page.getByRole('link', { name: label }).click();
      await expect(page.locator(`#${targetId}`)).toBeVisible();
    }

    await page.getByRole('link', { name: '再看奏折' }).click();
    await expect(page.locator('#demo')).toBeVisible();
  });

  test('企业痛点与获客转化信息一目了然', async ({ page }) => {
    await gotoPublic(page, '/welcome');

    await expect(page.getByText('企业不是缺 AI，是缺一套可追责的决策系统')).toBeVisible();
    await expect(page.getByText('老板每天被小事打断')).toBeVisible();
    await expect(page.getByText('部门信息割裂').first()).toBeVisible();
    await expect(page.getByText('AI 产出不可追责')).toBeVisible();
    await expect(page.getByText('增长动作容易失控')).toBeVisible();
    await expect(page.getByText('先服务最常见的老板决策')).toBeVisible();
    await expect(page.getByText('预约体验，保存你的第一座朝堂')).toBeVisible();
  });

  test('试问朝堂生成静态奏折预览', async ({ page }) => {
    await gotoPublic(page, '/welcome');

    await page.getByRole('textbox', { name: '试问朝堂' }).fill('这个客户该不该降价签？');
    await page.getByRole('button', { name: /生成奏折/ }).click();

    await expect(page.getByText('客户降价签约 · 待裁奏折')).toBeVisible();
    await expect(page.getByText('伏候圣裁').first()).toBeVisible();
    await expect(page.getByText('户部：降价后毛利低于 18%')).toBeVisible();
    await expect(page.getByText('给条件式报价：换年度预付、案例授权、回款节点。', { exact: true }).last()).toBeVisible();
  });
});

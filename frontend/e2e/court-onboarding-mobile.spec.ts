import { expect, test } from '@playwright/test';

const SESSION = {
  accessToken: 'e2e-access',
  refreshToken: 'e2e-refresh',
  tenantId: 1,
  username: 'e2e-mobile',
  accountType: 0,
  expiresAt: 4102444800000,
};

async function seedLoggedInButNotOnboarded(page: import('@playwright/test').Page) {
  await page.context().addCookies(
    ['http://localhost:3002', 'http://127.0.0.1:3002'].map((url) => ({
      name: 'courtos.access_token',
      value: 'e2e-token',
      url,
    })),
  );
  await page.addInitScript((session) => {
    window.localStorage.setItem('courtos.auth', JSON.stringify(session));
    window.localStorage.removeItem('courtos.onboarded');
    window.localStorage.removeItem('courtos.ruler.style');
  }, SESSION);
}

test.describe('开朝仪轨移动端', () => {
  test('首次登录弹窗在移动端可滚动并完成操作', async ({ page }) => {
    const basePath = process.env.PLAYWRIGHT_BASE_PATH ?? '';

    await page.setViewportSize({ width: 390, height: 844 });
    await seedLoggedInButNotOnboarded(page);
    await page.goto(`${basePath}/donggong`, { waitUntil: 'domcontentloaded' });

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 8_000 });
    await expect(dialog.getByText('陛下御极 · 开朝仪轨')).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.height).toBeLessThanOrEqual(844);

    await dialog.getByRole('button', { name: /严政陛下/ }).click();
    await dialog.getByRole('button', { name: /下一步/ }).click();
    await expect(dialog.getByText('请陛下亲下开朝第一道旨')).toBeVisible();

    await dialog.getByRole('button', { name: /先不下旨/ }).click();
    await expect(dialog.getByText('朝堂在此 · 永远为您')).toBeVisible();

    await dialog.getByRole('button', { name: /进入朝堂/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem('courtos.onboarded')))
      .toBe('1');
  });
});

import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';

const basePath = process.env.PLAYWRIGHT_BASE_PATH ?? '';

test.describe('钦天监私塾', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('观天台展示 teach 学习工作区入口', async ({ page }) => {
    await page.goto(`${basePath}/forecast`);
    await page.getByRole('button', { name: /全球大势/ }).click();

    await expect(page.getByText(/teach workspace · 钦天监私塾/i)).toBeVisible();
    await expect(page.getByText('先知负责预警，导师负责铺路，钦天监自己负责进化。')).toBeVisible();
    await expect(page.getByText('MISSION.md · 定义用户当前最该学会的判断力')).toBeVisible();
    await expect(page.getByText(/不强迫用户答题/)).toBeVisible();
    await expect(page.getByText('当前学习令')).toBeVisible();
    await expect(page.getByText('触发器卡', { exact: true })).toBeVisible();
    await expect(page.getByText('史馆复盘', { exact: true })).toBeVisible();
    await expect(page.getByText(/Source · (PRIMARY|FALLBACK|RULE_SEED)/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /查看史馆记录 · qintian_learning_/ })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: '运行自我校准' }).click();
    await expect(page.getByText(/校准完成：扫描 \d+ 条，更新 \d+ 条，结论/)).toBeVisible({ timeout: 10_000 });
  });
});

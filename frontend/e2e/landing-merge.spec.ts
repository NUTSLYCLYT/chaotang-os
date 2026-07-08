import { expect, test } from '@playwright/test';

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');
const appPath = (path: string) => `${BASE_PATH}${path}`;

test.describe('chaotang-landing 合入页', () => {
  test('六部艺术卷轴入口与单部页可访问', async ({ page }) => {
    await page.goto(appPath('/depts'));

    await expect(page.getByRole('heading', { name: '六 部 分 曹' })).toBeVisible();
    await expect(page.getByText('吏部')).toBeVisible();
    await expect(page.getByText('户部')).toBeVisible();
    await expect(page.getByText('工部')).toBeVisible();

    await page.getByRole('link', { name: /户部/ }).click();
    await expect(page).toHaveURL(/\/depts\/hubu$/);
    await expect(page.getByRole('heading', { name: '户部' })).toBeVisible();
    await expect(page.getByText('库银安全线')).toBeVisible();
    await expect(page.getByRole('link', { name: '入本部控制台' })).toBeVisible();
  });

  test('九部统一控制台与底部老板下旨可交互', async ({ page }) => {
    await page.goto(appPath('/court'));

    await expect(page.getByRole('heading', { name: '军机处' })).toBeVisible();
    await expect(page.getByLabel('老板下旨')).toBeVisible();
    await expect(page.getByText('本日军国要务 · 三事待裁')).toBeVisible();

    await page.getByRole('link', { name: '锦衣卫' }).click();
    await expect(page).toHaveURL(/\/court\/jinyiwei$/);
    await expect(page.getByRole('heading', { name: '锦衣卫' })).toBeVisible();
    await page.getByLabel('老板下旨').fill('核查本周异常报价线索');
    await page.getByRole('button', { name: /下旨/ }).click();
    await expect(page.getByText(/已下旨：核查本周异常报价线索/)).toBeVisible();
  });
});

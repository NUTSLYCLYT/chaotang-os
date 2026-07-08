import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';

const BASE_PATH = process.env.PLAYWRIGHT_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '';

test.describe('Boss Decision Loop Prototype', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('正式报价问题可以从拟旨推进到史馆归档', async ({ page }) => {
    await page.goto(`${BASE_PATH}/prototype/boss-decision-loop`);

    await expect(page.getByRole('heading', { name: '老板经营决策主闭环' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '客户要求正式报价，要不要发？' })).toBeVisible();

    await page.getByRole('button', { name: /生成丞相拟旨/ }).click();
    await expect(page.getByText('客户承诺核验', { exact: true })).toBeVisible();
    await expect(page.getByText('成本与毛利', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /生成军机处奏折/ }).click();
    await expect(page.getByText('圣裁建议')).toBeVisible();
    await expect(page.getByText('补证').first()).toBeVisible();
    await expect(page.getByText('禁止直接外发')).toBeVisible();

    await page.getByRole('button', { name: /选择补证并归档/ }).click();
    await expect(page.getByText('已入史馆预归档')).toBeVisible();
    await expect(page.getByText(/原问、拟旨、会审、奏折、来源、缺口已保存/)).toBeVisible();
  });
});

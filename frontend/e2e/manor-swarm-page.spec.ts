import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';

test.describe('庄园蜂群二级页', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('展示蜂群描述、六类能力、工位和边界说明', async ({ page }) => {
    await page.goto('/manors/sales/swarm');

    await expect(page.getByRole('heading', { name: '销售庄园 · 蜂群执行班组' })).toBeVisible();
    await expect(page.getByText('庄园看业务战场，蜂群把战场里的事情真正办起来。')).toBeVisible();
    await expect(page.getByRole('heading', { name: '六类能力' })).toBeVisible();
    await expect(page.getByText('看经营全局')).toBeVisible();
    await expect(page.getByRole('heading', { name: '当前蜂群工位' })).toBeVisible();
    await expect(page.getByText('高意图快车')).toBeVisible();
    await expect(page.getByText('真实报价、合同、交付、付款、客户承诺等事项不在前端蜂群静默执行')).toBeVisible();
  });
});
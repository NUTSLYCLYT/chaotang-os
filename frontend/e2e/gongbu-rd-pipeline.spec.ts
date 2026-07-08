import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';
import { resolveBasePath } from './helpers/base-path';

test.describe('宸ラ儴浜у搧瀹氫箟涓庝氦浠樺畾褰㈠彴', () => {
  test.setTimeout(60_000);

  test('工部页围绕销售校验与增长贡献运行', async ({ page }) => {
    await seedSession(page);
    const basePath = await resolveBasePath(page.request);
    await page.goto(`${basePath}/departments/gongbu`, { waitUntil: 'domcontentloaded' });

    const leftRail = page.getByRole('region', { name: '工部六司与兵部增长校验面板' });
    const scroll = page.getByLabel('部门中央卷轴');
    const rightRail = page.getByRole('region', { name: '业务列表与方案工作台' });

    await expect(page.getByRole('heading', { name: '工部 · 产品定义与交付定形台' })).toBeVisible();
    await expect(leftRail).toBeVisible();
    await expect(leftRail.getByRole('button', { name: /产品司/ })).toBeVisible();
    await expect(leftRail.getByRole('button', { name: /技术司/ })).toBeVisible();
    await expect(leftRail.getByRole('button', { name: /质量司/ })).toBeVisible();
    await expect(leftRail.getByText('产品部指挥兵部会审', { exact: true })).toBeVisible();
    await expect(leftRail).toContainText('增长贡献');
    await expect(leftRail.getByText('长说明收口到二级展开', { exact: true })).toBeVisible();

    await expect(scroll).toBeVisible();
    await expect(scroll).toContainText('工部产品丹书铁券');
    await expect(scroll).toContainText('工部产品圣裁');
    await expect(scroll).toContainText('这页的主角仍然是工部');
    await expect(scroll).toContainText('增长贡献');

    await expect(rightRail).toBeVisible();
    await expect(rightRail).toContainText('项目进展');
    await expect(rightRail).toContainText('工部教学资料');
    await expect(rightRail).toContainText('对象一 · 储能报价定义台');
    await expect(rightRail).toContainText('硬约束');
    await expect(rightRail).toContainText('推荐方案');
    await expect(rightRail).toContainText('商业模式升级');

    await leftRail.getByRole('button', { name: /质量司/ }).click();
    await expect(page.getByText('风险与禁令 · 页面精美不代表增长成立')).toBeVisible();

    await leftRail.getByRole('button', { name: '查看兵部会审入卷' }).click();
    await expect(page.getByText('兵部增长校验 · 只保留能改变成交效率的意见')).toBeVisible();
  });
});

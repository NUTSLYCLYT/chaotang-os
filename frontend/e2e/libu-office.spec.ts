import { test, expect } from '@playwright/test';
import { seedSession, clearSession } from './fixtures';
import { resolveBasePath } from './helpers/base-path';

/**
 * E2E：吏部人事决策办公厅 /departments/personnel
 *
 * 设计要点（无需后端·纯客户端计算）：
 *  - 双门鉴权：seedSession() 同时种 cookie + localStorage（见 e2e/fixtures.ts）
 *  - 招人审查：reviewHiring 是纯客户端同步函数，无需 mock API
 *  - 辞退审查：reviewTermination 是纯客户端同步函数，无需 mock API
 *  - 薪酬带：buildCompBand + suggestOffer 是纯客户端同步函数，无需 mock API
 *  - 转正评估：parsePromotionRows 是纯客户端同步函数，无需 mock API
 *  - 断言：6 司编制可见（真/骨架）+ 各工作台能出结果
 *
 * 注：basePath 自适应（resolveBasePath）——本机 pnpm dev 带 /chaotang，
 * playwright webServer 启动无 basePath；两种场景均可跑通。
 */

test.describe('吏部人事决策办公厅', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('6 司编制文案可见（真/骨架区分）', async ({ page }) => {
    const bp = await resolveBasePath(page.request);
    await page.goto(`${bp}/departments/personnel`);

    // 等待左栏渲染
    const rail = page.locator('aside').first();

    // 真引擎司
    await expect(rail.getByText('选才司').first()).toBeVisible({ timeout: 10000 });
    await expect(rail.getByText('劳关司').first()).toBeVisible();
    await expect(rail.getByText('薪酬司').first()).toBeVisible();
    await expect(rail.getByText('铨叙司').first()).toBeVisible();

    // 骨架司
    await expect(rail.getByText('制度司').first()).toBeVisible();
    await expect(rail.getByText('吏部尚书').first()).toBeVisible();

    // 引擎状态文案（4 真 / 6 司）
    await expect(rail.getByText(/4 真引擎/).first()).toBeVisible();
  });

  test('招人填入岗位信息后出录用建议', async ({ page }) => {
    const bp = await resolveBasePath(page.request);
    await page.goto(`${bp}/departments/personnel`);

    // 等待招人 tab 默认激活
    await expect(page.getByText('选才司 · 招人三件套审查')).toBeVisible({ timeout: 10000 });

    // 填入岗位名称
    await page.getByPlaceholder('岗位名称（如：Java 后端工程师）').fill('后端工程师');

    // 填入月薪
    const spinners = page.getByRole('spinbutton');
    await spinners.nth(0).fill('15000');

    // 勾选三件套（质门人工判断）
    await page.getByRole('button', { name: '有预算' }).click();
    await page.getByRole('button', { name: '有90天成功标准' }).click();
    await page.getByRole('button', { name: '有岗位画像/JD' }).click();

    // 点击审查
    await page.getByRole('button', { name: '审查招聘' }).click();

    // 断言结果：年成本或录用建议出现
    await expect(page.getByText(/年成本/).first()).toBeVisible({ timeout: 5000 });

    // verdict 可见（可招/先定清楚/养不起/缺证 之一）
    const verdictVisible =
      (await page.getByText('可招').count()) > 0 ||
      (await page.getByText('先定清楚再招').count()) > 0 ||
      (await page.getByText('养不起·别招').count()) > 0 ||
      (await page.getByText('缺证·先补').count()) > 0;
    expect(verdictVisible).toBe(true);
  });

  test('辞退高风险路径显示 needsSignoff 横幅', async ({ page }) => {
    const bp = await resolveBasePath(page.request);
    await page.goto(`${bp}/departments/personnel`);

    // 切换到辞退 tab
    await page.getByRole('tab', { name: '辞退' }).click();

    // 等待辞退工作台渲染
    await expect(page.getByText('劳关司 · 辞退合规审查')).toBeVisible({ timeout: 10000 });

    // 填入员工信息
    await page.getByPlaceholder('员工姓名').fill('李明');

    // 填入工龄（月）和月薪
    const spinners = page.getByRole('spinbutton');
    await spinners.nth(0).fill('24');
    await spinners.nth(1).fill('12000');

    // 选择绩效辞退（且不勾选 PIP = 违法解除高风险）
    await page.selectOption('select', 'performance');

    // 不勾选有证据/有PIP — 触发违法解除判断

    // 点击审查辞退
    await page.getByRole('button', { name: '审查辞退' }).click();

    // 断言高危 needsSignoff 横幅出现
    await expect(page.getByText(/needsSignoff/).first()).toBeVisible({ timeout: 5000 });

    // 法律风险判词可见
    await expect(page.getByText(/违法解除/).first()).toBeVisible();
  });

  test('薪酬填入岗位和市场中位后出薪酬带', async ({ page }) => {
    const bp = await resolveBasePath(page.request);
    await page.goto(`${bp}/departments/personnel`);

    // 切换到薪酬 tab
    await page.getByRole('tab', { name: '薪酬' }).click();

    // 等待薪酬工作台渲染
    await expect(page.getByText('薪酬司 · 宽带薪酬 + 定薪建议')).toBeVisible({ timeout: 10000 });

    // 填入岗位
    await page.getByPlaceholder('岗位/级别（如：后端工程师 L3）').fill('后端工程师 L3');

    // 填入市场中位
    const spinners = page.getByRole('spinbutton');
    await spinners.nth(0).fill('20000');

    // 点击算薪酬带
    await page.getByRole('button', { name: '算薪酬带' }).click();

    // 断言薪酬带结果出现
    await expect(page.getByText('薪酬带宽 · 后端工程师 L3')).toBeVisible({ timeout: 5000 });

    // 中位可见
    await expect(page.getByText('中位').first()).toBeVisible();

    // 定薪建议可见
    await expect(page.getByText('定薪建议').first()).toBeVisible();
  });

  test('转正评估填入候选人和评分维度后出转正结论', async ({ page }) => {
    const bp = await resolveBasePath(page.request);
    await page.goto(`${bp}/departments/personnel`);

    // 切换到转正 tab
    await page.getByRole('tab', { name: '转正' }).click();

    // 等待转正工作台渲染
    await expect(page.getByText('铨叙司 · 转正评估')).toBeVisible({ timeout: 10000 });

    // 填入候选人姓名
    await page.getByPlaceholder('候选人姓名').fill('王小明');

    // 第一个评分维度填写（默认有3行）
    const dimInputs = page.getByPlaceholder(/维度\d+/);
    await dimInputs.nth(0).fill('工作成效');

    // 找满分和评分 spinbutton（每行2个number input + 候选人姓名前一行没有spinner）
    const allSpinners = page.getByRole('spinbutton');
    // 第1维度：满分(0)=20，评分(1)填18
    await allSpinners.nth(1).fill('18');

    // 点击评估转正
    await page.getByRole('button', { name: '评估转正' }).click();

    // 断言结果出现（候选人姓名 + 结论）
    await expect(page.getByText('王小明').first()).toBeVisible({ timeout: 5000 });

    // verdict（准予转正/延长试用/不予转正/评分不全 之一）可见
    const verdictVisible =
      (await page.getByText('准予转正').count()) > 0 ||
      (await page.getByText('延长试用').count()) > 0 ||
      (await page.getByText('不予转正').count()) > 0 ||
      (await page.getByText('评分不全·待补').count()) > 0;
    expect(verdictVisible).toBe(true);
  });

  test('未登录访问被拦截到 /login', async ({ page }) => {
    const bp = await resolveBasePath(page.request);
    await clearSession(page);
    await page.goto(`${bp}/departments/personnel`);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});

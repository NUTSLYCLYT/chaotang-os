import { test, expect } from '@playwright/test';
import { seedSession, clearSession } from './fixtures';

/**
 * E2E：礼部对外增长办公厅 /departments/market
 *
 * 设计要点（无需后端·纯客户端计算）：
 *  - 双门鉴权：seedSession() 同时种 cookie + localStorage（见 e2e/fixtures.ts）
 *  - 关系台账：prioritizeStakeholders 是纯客户端同步函数，无需 mock API
 *  - 流量增长：rankChannels 是纯客户端同步函数，无需 mock API
 *  - 断言：8 司编制可见（真/骨架）+ 关系台账出优先序 + 流量增长出 ROI 排序
 *
 * 注：URL 不含 /chaotang 前缀——playwright 的 webServer 配置
 * (pnpm exec next dev -p 3002 --webpack) 不传 BASE_PATH，Next.js 无 basePath。
 */

const MARKET_URL = '/departments/market';

test.describe('礼部对外增长办公厅', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('8 司编制文案可见（真/骨架区分）', async ({ page }) => {
    await page.goto(MARKET_URL);

    const rail = page.locator('aside').first();
    // 两个真引擎司
    await expect(rail.getByText('关系台账司').first()).toBeVisible({ timeout: 10000 });
    await expect(rail.getByText('流量增长司').first()).toBeVisible();
    // 骨架司
    await expect(rail.getByText('新媒体运营司').first()).toBeVisible();
    await expect(rail.getByText('对外承诺可逆司').first()).toBeVisible();
    await expect(rail.getByText('商务公关司').first()).toBeVisible();
    await expect(rail.getByText('场合作战司').first()).toBeVisible();
    await expect(rail.getByText('品牌文化司').first()).toBeVisible();
    await expect(rail.getByText('礼部尚书').first()).toBeVisible();
  });

  test('关系台账填入一个干系人后分析出优先序清单', async ({ page }) => {
    await page.goto(MARKET_URL);

    // 确认关系台账 tab 默认激活
    await expect(page.getByText('关系台账司 · 干系人优先序')).toBeVisible({ timeout: 10000 });

    // 填入干系人姓名
    await page.getByPlaceholder('干系人姓名/机构').first().fill('张总监');

    // 点击分析
    await page.getByRole('button', { name: '分析优先序' }).click();

    // 断言结果出现
    await expect(page.getByText('优先序清单 · 1 人')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('张总监')).toBeVisible();
  });

  test('流量增长填入渠道后分析出 ROI 排序', async ({ page }) => {
    await page.goto(MARKET_URL);

    // 切换到流量增长 tab（exact: true 避免匹配左栏"流量增长司"按钮）
    await page.getByRole('button', { name: '流量增长', exact: true }).click();

    // 确认工作台已切换
    await expect(page.getByText('流量增长司 · 渠道 ROI 决策')).toBeVisible({ timeout: 10000 });

    // 填入渠道
    await page.getByPlaceholder('渠道名（公众号/视频号/SEM/展会…）').first().fill('公众号');

    // 填投入
    const inputs = page.getByRole('spinbutton');
    await inputs.nth(0).fill('10000');
    // 填转化
    await inputs.nth(1).fill('20');
    // 填营收
    await inputs.nth(2).fill('30000');

    // 点击分析
    await page.getByRole('button', { name: '分析 ROI' }).click();

    // 断言 ROI 排序结果出现
    await expect(page.getByText('渠道 ROI 排序 · 1 个')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('公众号')).toBeVisible();
    // ROAS=3 → 加投
    await expect(page.getByText('加投')).toBeVisible();
  });

  test('危机公关 tab：生成响应方案含姿态和严重度 tier', async ({ page }) => {
    await page.goto(MARKET_URL);

    // 切换到危机公关 tab
    await page.getByRole('tab', { name: '危机公关' }).click();

    // 确认工作台已切换
    await expect(page.getByText('商务公关司 · 危机响应')).toBeVisible({ timeout: 10000 });

    // 默认选中"受害者型"，直接点生成
    await page.getByRole('button', { name: '生成响应方案' }).click();

    // 断言结果：危机响应方案出现
    await expect(page.getByText('危机响应方案')).toBeVisible({ timeout: 5000 });

    // 姿态（否认/淡化/重建 之一）可见
    const postureVisible =
      (await page.getByText('否认').count()) > 0 ||
      (await page.getByText('淡化').count()) > 0 ||
      (await page.getByText('重建').count()) > 0;
    expect(postureVisible).toBe(true);

    // 严重度 Tier 行可见
    await expect(page.getByText('严重度 Tier')).toBeVisible();
  });

  test('对外谈判 tab：评估报价出现 decision 结果', async ({ page }) => {
    await page.goto(MARKET_URL);

    // 切换到对外谈判 tab
    await page.getByRole('tab', { name: '对外谈判' }).click();

    // 确认工作台已切换
    await expect(page.getByText('对外承诺司 · 谈判评估')).toBeVisible({ timeout: 10000 });

    // 填入己方保留价和对方报价
    const inputs = page.getByRole('spinbutton');
    await inputs.nth(0).fill('100000');
    await inputs.nth(1).fill('120000');

    // 点击评估
    await page.getByRole('button', { name: '评估报价' }).click();

    // 断言结果：谈判评估结果出现
    await expect(page.getByText('谈判评估结果')).toBeVisible({ timeout: 5000 });

    // decision（接受/还价/走人 之一）可见
    const decisionVisible =
      (await page.getByText('接受').count()) > 0 ||
      (await page.getByText('还价').count()) > 0 ||
      (await page.getByText('走人').count()) > 0;
    expect(decisionVisible).toBe(true);

    // needsSignoff 提示恒存在
    await expect(page.getByText(/needsSignoff/)).toBeVisible();
  });

  test('未登录访问被拦截到 /login', async ({ page }) => {
    await clearSession(page);
    await page.goto(MARKET_URL);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});

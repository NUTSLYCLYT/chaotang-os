import { test, expect, type Page } from '@playwright/test';
import { seedSession } from './fixtures';

const configuredBasePath =
  process.env.PLAYWRIGHT_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH ?? '';
const basePath = configuredBasePath.replace(/\/$/, '');

async function gotoDonggong(page: Page) {
  await page.goto(`${basePath}/donggong`);
}

async function openDetails(page: Page) {
  await page.getByRole('button', { name: '查看运营详情', exact: true }).click();
}

/**
 * E2E：东宫 · 太子自主运营面 /donggong(精简版:一屏一件事)
 *
 * 静态 source 驱动(无需后端):只需绕过双门鉴权(seedSession 种 cookie+localStorage)。
 * 覆盖:核心(待裁御批)默认可见 + 御批交互 + 次要信息折叠在"更多"。
 */
test.describe('东宫 · 太子自主运营', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('默认只呈现核心:标题 + 待裁御批', async ({ page }) => {
    await gotoDonggong(page);
    await expect(page.getByText('东宫 · 太子监国')).toBeVisible();
    await expect(page.getByText('一人公司的自动化运营雏形').first()).toBeVisible();
    await expect(page.getByText('监国听政')).toBeVisible();
    await expect(page.getByText('东宫令曰')).toBeVisible();
    await expect(page.getByText('授权毕业').first()).toBeVisible();
    await expect(page.getByText('伏候圣裁').first()).toBeVisible();
    await expect(page.getByText('伏候圣裁 · 太子不擅专,候陛下一裁')).toBeVisible();
    // 次要信息默认折叠(不占屏)
    await expect(page.getByText('今日奏报')).toHaveCount(0);
    await expect(page.getByText('权责演练')).toHaveCount(0);
    await page.screenshot({ path: '/tmp/donggong.png', fullPage: true });
  });

  test('御批:点"准"后该条变为已御批态', async ({ page }) => {
    await gotoDonggong(page);
    const firstApprove = page.getByRole('button', { name: '准' }).first();
    await firstApprove.click();
    await expect(page.getByText('准·可执行').first()).toBeVisible();
  });

  test('折叠:点"更多"才展开运营详情', async ({ page }) => {
    await gotoDonggong(page);
    await openDetails(page);
    await expect(page.getByText('今日奏报')).toBeVisible();
    await expect(page.getByText('两轨授权 · 毕业或候裁')).toBeVisible();
  });

  test('一人公司:展开后呈现自动运营闭环和边界', async ({ page }) => {
    await gotoDonggong(page);
    await openDetails(page);

    const loop = page.getByLabel('一人公司自动运营闭环');
    await expect(loop.getByText('老板只处理高风险准驳')).toBeVisible();
    await expect(loop.getByText('盯盘', { exact: true })).toBeVisible();
    await expect(loop.getByText('代拟', { exact: true })).toBeVisible();
    await expect(loop.getByText('按律拦截', { exact: true })).toBeVisible();
    await expect(loop.getByText('请您拍板', { exact: true })).toBeVisible();
    await expect(loop.getByText('归档学习', { exact: true })).toBeVisible();
    await expect(loop.getByText('不替老板做高危决定')).toBeVisible();
    await expect(loop.getByText('不把模拟当执行')).toBeVisible();
    await expect(loop.getByText('不让自动化脱离证据链')).toBeVisible();
  });

  test('数字分身:只代拟和跟进,高危动作必须本人确认', async ({ page }) => {
    await gotoDonggong(page);
    await openDetails(page);

    const twin = page.getByLabel('数字分身权责边界');
    await expect(twin.getByText('数字分身 · 御前副本')).toBeVisible();
    await expect(twin.getByText('人在回路')).toBeVisible();
    await expect(twin.getByText('接管通道')).toBeVisible();
    await expect(twin.getByText('经营日报')).toBeVisible();
    await expect(twin.getByText('客户跟进')).toBeVisible();
    await expect(twin.getByText('授权毕业后代办')).toBeVisible();
    await expect(twin.getByText('代拟回复')).toBeVisible();
    await expect(twin.getByText('整理证据')).toBeVisible();
    await expect(twin.getByText('必须本人确认')).toBeVisible();
    await expect(twin.getByText('付款')).toBeVisible();
    await expect(twin.getByText('签约', { exact: true })).toBeVisible();
    await expect(twin.getByText('未经本人确认不得代表最终决定')).toBeVisible();
  });

  test('权责区别:皇帝本人、太子监国、数字分身三层不混淆', async ({ page }) => {
    await gotoDonggong(page);
    await openDetails(page);

    const boundary = page.getByLabel('皇帝太子数字分身区别');
    await expect(boundary).toBeVisible();
    await expect(boundary.getByText('皇帝不是数字分身')).toBeVisible();
    await expect(boundary.getByText('关键权力永远不被系统拿走')).toBeVisible();
    await expect(boundary.getByText('皇帝本人')).toBeVisible();
    await expect(boundary.getByText('最终准驳')).toBeVisible();
    await expect(boundary.getByText('太子监国')).toBeVisible();
    await expect(boundary.getByText('授权毕业', { exact: true })).toBeVisible();
    await expect(boundary.getByText('数字分身', { exact: true })).toBeVisible();
    await expect(boundary.getByText('代拟与跟进')).toBeVisible();
    await expect(boundary.getByText('不代表最终决定')).toBeVisible();
  });

  test('权责演练:借鉴发布脚本但保持只演练不执行', async ({ page }) => {
    await gotoDonggong(page);
    await openDetails(page);

    await expect(page.getByText('权责演练 · 同一 objectId 继承训练')).toBeVisible();
    await expect(page.getByText('objectId: build-chaotang-dev-workbench-mvp-shadow')).toBeVisible();
    await expect(page.getByText('工部发布前固定演示脚本')).toBeVisible();
    await expect(page.getByText('只演练不执行')).toBeVisible();
    await expect(page.getByText('御史二审前不授功业、不升级授权、不生成称号')).toBeVisible();
  });

  test('减法A:顶导只剩核心,六部收进"六部"下拉', async ({ page }) => {
    await gotoDonggong(page);
    const nav = page.getByRole('navigation', { name: '部门导航' });
    await expect(nav.getByRole('link', { name: /六部/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: '户部' })).toHaveCount(0);
    await page.screenshot({ path: '/tmp/donggong-nav.png' });
  });
});

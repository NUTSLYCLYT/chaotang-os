import { test, expect } from '@playwright/test';
import { seedSession, clearSession } from './fixtures';

/**
 * E2E：刑部决策办公厅 /departments/legal
 *
 * 设计要点（无需后端·纯客户端扫描）：
 *  - 双门鉴权：seedSession() 同时种 cookie + localStorage（见 e2e/fixtures.ts）
 *  - 合同审查台：scanWithHistory 是纯客户端同步函数，无需 mock API
 *  - 断言：8 司编制可见 + 高危条款触发"一票否决"红横幅
 *
 * 注：URL 不含 /chaotang 前缀——playwright 的 webServer 配置
 * (pnpm exec next dev -p 3002 --webpack) 不传 BASE_PATH，Next.js 无 basePath。
 * 如使用已有带 /chaotang 前缀的 dev server，改用 PLAYWRIGHT_SKIP_WEBSERVER=1。
 */

const LEGAL_URL = '/departments/legal';

/** 含多项高危条款的测试合同片段（命中 unlimited_liability + unilateral + final_interpretation）。 */
const HIGH_RISK_CONTRACT = `
甲乙双方就以下事项达成协议：
一、乙方应承担一切损失并负连带责任，赔偿上限不做限制。
二、甲方有权随时解除本协议，无需提前通知乙方。
三、本协议最终解释权归甲方所有。
`;

test.describe('刑部决策办公厅', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('8 司编制文案可见', async ({ page }) => {
    await page.goto(LEGAL_URL);

    // 等待左栏渲染（aside 是 XingbuStaffRail 的根元素，缩小匹配范围避免右栏重复文案触发严格模式）
    const rail = page.locator('aside').first();
    await expect(rail.getByText('合同审查司').first()).toBeVisible({ timeout: 10000 });
    await expect(rail.getByText('合规稽查司').first()).toBeVisible();
    await expect(rail.getByText('风控司').first()).toBeVisible();
    await expect(rail.getByText('缺证核查司').first()).toBeVisible();
    await expect(rail.getByText('制度司').first()).toBeVisible();
    await expect(rail.getByText('争议处置司').first()).toBeVisible();
    await expect(rail.getByText('知识产权司').first()).toBeVisible();
    await expect(rail.getByText('刑部尚书').first()).toBeVisible();
  });

  test('高危合同触发一票否决红横幅', async ({ page }) => {
    await page.goto(LEGAL_URL);

    // 等待审查台渲染
    await expect(page.getByPlaceholder('粘贴合同条款文本')).toBeVisible({ timeout: 10000 });

    // 输入高危合同文本
    await page.getByPlaceholder('粘贴合同条款文本').fill(HIGH_RISK_CONTRACT);

    // 点击审查按钮（exact: true 避免匹配名称中含"审查"字样的司按钮）
    await page.getByRole('button', { name: '审查', exact: true }).click();

    // 断言出现"一票否决"红横幅（exact: true 排除刑部尚书职责文本中也含有此词的元素）
    await expect(page.getByText('一票否决', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('未登录访问被拦截到 /login', async ({ page }) => {
    // clearSession 撤销 beforeEach 的双门种子，验证服务端中间件 307 → /login?next=
    await clearSession(page);
    await page.goto(LEGAL_URL);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});

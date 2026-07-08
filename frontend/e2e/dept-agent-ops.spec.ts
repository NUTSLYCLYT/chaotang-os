import { test, expect } from '@playwright/test';
import { seedSession, clearSession } from './fixtures';

const BASE_PATH = process.env.PLAYWRIGHT_BASE_PATH ?? '';

/**
 * E2E：兵部(ops)单 agent · API 守卫
 *
 * /departments/ops 已由新版兵部专用页接管，不再渲染旧通用问责坞。
 * 这里保留 /api/court/dept/ops/ask 的确定性守卫契约，避免匿名或脏请求烧 LLM。
 */
test.describe('兵部单 agent · API 守卫', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('匿名 POST /api/court/dept/ops/ask → 401', async ({ page }) => {
    await clearSession(page);
    const res = await page.request.post(`${BASE_PATH}/api/court/dept/ops/ask`, { data: { command: '当前最大的运营风险是什么？' } });
    expect(res.status()).toBe(401);
  });

  test('未配置部门 market → 404（先于鉴权的注册表守卫）', async ({ page }) => {
    const res = await page.request.post(`${BASE_PATH}/api/court/dept/market/ask`, { data: { command: '礼部风险评估一下' } });
    expect(res.status()).toBe(404);
  });

  test('command 过短 → 400', async ({ page }) => {
    const res = await page.request.post(`${BASE_PATH}/api/court/dept/ops/ask`, { data: { command: '嗯' } });
    expect(res.status()).toBe(400);
  });
});

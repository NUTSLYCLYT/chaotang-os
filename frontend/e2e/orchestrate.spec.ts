import { test, expect } from '@playwright/test';
import { seedSession, clearSession } from './fixtures';

/**
 * E2E：丞相编排 /api/court/orchestrate 的确定性闸（鉴权/入参）。
 * 注：merge/router 的真实合并行为靠 live 烟测（内部 fan-out 是 server 端，无法浏览器 mock）；
 * 这里只焊死"不可匿名烧 LLM"与"入参校验"这两个 brain 之前就返回的确定性闸。
 */

test.describe('丞相编排 · 确定性闸', () => {
  test('匿名 POST /api/court/orchestrate → 401（不可匿名召部门烧 LLM）', async ({ page }) => {
    await clearSession(page);
    const res = await page.request.post('/api/court/orchestrate', { data: { command: '兵部要追加粮草，户部该不该批' } });
    expect(res.status()).toBe(401);
  });

  test('command 过短 → 400', async ({ page }) => {
    await seedSession(page);
    const res = await page.request.post('/api/court/orchestrate', { data: { command: '嗯' } });
    expect(res.status()).toBe(400);
  });
});

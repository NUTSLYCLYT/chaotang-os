import { test, expect, type Page } from '@playwright/test';
import { seedSession, clearSession } from './fixtures';

/**
 * E2E：蜂群单元成员列表页 /swarm/[unit]/members
 *
 * 设计要点（无需后端、无需真实登录）：
 *  - 绕过双门鉴权：seedSession() 同时种 cookie + localStorage（见 e2e/fixtures.ts）
 *  - mock 数据：拦截 /api/v1/swarms/* 驱动 loaded / empty / error 三态
 *    （dev 下 basePath 为空、NEXT_PUBLIC_BASE_PATH 未设 → API base = /api/v1）
 */

const UNIT = 'alpha';
const MEMBERS_URL = `/swarm/${UNIT}/members`;

// 蜂群名（面包屑用）
async function mockSwarmName(page: Page) {
  await page.route(`**/api/v1/swarms/${UNIT}`, (route) =>
    route.fulfill({ json: { id: UNIT, name: '霜羽蜂群', status: 'running' } }),
  );
}

const MEMBERS_FIXTURE = [
  {
    id: 'm1', name: '赵子龙', role: '前锋', status: 'running', swarmId: UNIT,
    isBlocked: false, hasReturnedResult: true, recentSummary: '已完成侦察',
    createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-02T00:00:00Z',
  },
  {
    id: 'm2', name: '马孟起', role: '后卫', status: 'blocked', swarmId: UNIT,
    isBlocked: true, hasReturnedResult: false, recentSummary: null,
    createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-02T00:00:00Z',
  },
];

test.describe('蜂群成员列表页', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await mockSwarmName(page);
  });

  test('有成员时渲染列表 + 面包屑 + 已交付 + danger 卡片', async ({ page }) => {
    await page.route(`**/api/v1/swarms/${UNIT}/members`, (route) =>
      route.fulfill({ json: MEMBERS_FIXTURE }),
    );
    await page.goto(MEMBERS_URL);

    await expect(page.getByText('赵子龙')).toBeVisible();
    await expect(page.getByText('马孟起')).toBeVisible();
    await expect(page.getByText('已交付')).toBeVisible();          // hasReturnedResult=true
    await expect(page.getByText('已完成侦察')).toBeVisible();        // recentSummary
    await expect(page.getByRole('heading', { name: '霜羽蜂群 · 成员' })).toBeVisible(); // 标题用蜂群名
  });

  test('空蜂群显示「该蜂群暂无成员」', async ({ page }) => {
    await page.route(`**/api/v1/swarms/${UNIT}/members`, (route) =>
      route.fulfill({ json: [] }),
    );
    await page.goto(MEMBERS_URL);

    await expect(page.getByText('该蜂群暂无成员')).toBeVisible();
  });

  test('接口报错显示重试，点重试后恢复（onRetry → mutate）', async ({ page }) => {
    let hit = 0;
    await page.route(`**/api/v1/swarms/${UNIT}/members`, (route) => {
      hit += 1;
      if (hit === 1) {
        route.fulfill({ status: 500, json: { message: 'boom' } }); // 首次失败
      } else {
        route.fulfill({ json: MEMBERS_FIXTURE });                  // 重试成功
      }
    });
    await page.goto(MEMBERS_URL);

    const retry = page.getByRole('button', { name: '重试' });
    await expect(retry).toBeVisible();
    await retry.click();

    await expect(page.getByText('赵子龙')).toBeVisible();          // 恢复成功
    await expect(retry).toBeHidden();
  });

  test('未登录访问被服务端中间件拦截到 /login（带 next 回跳）', async ({ page }) => {
    // 清掉 beforeEach 的双门种子，验证鉴权门（服务端 307 → /login?next=）
    await clearSession(page);
    await page.goto(MEMBERS_URL);

    await expect(page).toHaveURL(/\/login\?next=/);
  });
});

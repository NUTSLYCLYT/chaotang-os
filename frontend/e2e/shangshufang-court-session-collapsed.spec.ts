import { expect, test, type Page } from '@playwright/test';
import { seedSession } from './fixtures';

/**
 * 回归断言：上书房入口 /court-briefing 不再渲染顶部「今日朝报」面板。
 *
 * 背景：用户要求去除上部 LIVE 状态条与「今日朝报 · 皇帝单屏作战室」。
 * 本测试钉死：CourtSessionPanel 不应再占用上书房首屏高度。
 */

const COURT_SESSION = {
  available: true,
  stamp: '2026-06-22',
  content: [
    '# 今日朝报',
    '',
    '## 户部上奏',
    '- 现金流低于安全线，需压缩开支。',
    '## 兵部上奏',
    '- 竞品压价抢渠道，建议跟进。',
    '> 御史核真：两条均 ✅ 有据。',
  ].join('\n'),
  summary: { deptCount: 8, groundedCount: 6, ungroundedCount: 2, conflictCount: 1 },
};

const BRIEFING = {
  dailyStats: { taskTotal: 1, pendingCount: 1, runningCount: 0, completedToday: 0 },
  chancellorItems: [
    {
      id: 'court-session-chancellor-001',
      title: '客户要求正式报价，要不要发？',
      tag: '待裁 · 军机处回奏',
      priority: 'urgent',
      source: 'primary',
      suggestedCommand: '请军机处会审正式报价边界。',
      citations: [{ source: '销售记录', snippet: '客户要求今天给正式报价。' }],
      recommendedMinisters: ['户部', '刑部', '军机处'],
    },
  ],
  memorials: [
    {
      id: 'court-session-memorial-001',
      title: '客户要求正式报价，要不要发？',
      summary: '正式报价可能构成对外承诺，需先核成本、毛利和付款条件。',
      priority: 'urgent',
      status: 'pending',
      petitioner: '上书房',
      reporter: '军机处',
      sealDate: '2026-06-22T00:00:00.000Z',
      decisionOptions: ['采纳', '补证', '复核', '驳回', '追问'],
      enhancedSuggestion: '建议先补齐报价依据、授权记录和报价有效期。',
      citations: [{ source: '销售记录', snippet: '客户要求今天给正式报价。' }],
    },
  ],
  fetchedAt: '2026-06-22T00:00:00.000Z',
  sourceMode: 'real',
};

async function gotoBriefing(page: Page) {
  const basePath = process.env.PLAYWRIGHT_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '/chaotang';
  await page.route('**/api/court/court-session/latest', (route) =>
    route.fulfill({ json: { success: true, data: COURT_SESSION } }),
  );
  await page.route('**/api/court/shangshufang/briefing', (route) =>
    route.fulfill({ json: { success: true, data: BRIEFING } }),
  );
  await page.route('**/api/court/shangshufang/home', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          recommended_issue: null,
          pending_decisions: [],
          pending_evidence_tasks: [],
          archive_hints: [],
          source_label: 'LIVE',
        },
      },
    }),
  );
  await page.route('**/api/court/build-ledger', (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
  await page.route('**/api/court/shangshufang/im**', (route) =>
    route.fulfill({ json: { success: true, data: { messages: [] } } }),
  );
  await page.route('**/jiqun/api/swarm/sessions', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto(`${basePath}/court-briefing`, { waitUntil: 'domcontentloaded' });
}

test.describe('上书房 · 顶部朝报面板已移除', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('不再渲染 LIVE 条和今日朝报面板', async ({ page }) => {
    await gotoBriefing(page);

    await expect(page.getByText('奏折闭环 · 今日预案、补证、裁决与史馆归档按真实边界展示')).toHaveCount(0);
    await expect(page.getByText('今日朝报 · 皇帝单屏作战室')).toHaveCount(0);
    await expect(page.getByTestId('court-session-summary')).toHaveCount(0);
    await expect(page.getByTestId('court-session-content')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '展开今日朝报全文' })).toHaveCount(0);
  });

  test('辅政双栏默认收起（聚焦中央卷轴），点「展开辅政」后才出现', async ({ page }) => {
    await gotoBriefing(page);

    // 折叠态：左丞相栏 / 右钦天监栏不在 DOM，按钮显「展开辅政」。
    await expect(page.locator('[data-three-axis-panel="left"]')).toHaveCount(0);
    await expect(page.locator('[data-three-axis-panel="right"]')).toHaveCount(0);
    const railsToggle = page.getByRole('button', { name: '展开辅政' });
    await expect(railsToggle).toBeVisible();

    // 展开后：双栏出现，按钮变「收起辅政」。
    await railsToggle.click();
    await expect(page.locator('[data-three-axis-panel="left"]')).toBeVisible();
    await expect(page.locator('[data-three-axis-panel="right"]')).toBeVisible();
    await expect(page.getByRole('button', { name: '收起辅政' })).toBeVisible();
  });
});

import { expect, test, type Page } from '@playwright/test';
import { seedSession } from './fixtures';

const BASE_PATH = process.env.PLAYWRIGHT_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '/chaotang';

async function gotoFocusStudy(page: Page) {
  await page.goto(`${BASE_PATH}/court-briefing?skipOnboarding=1`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('客户要求正式报价，要不要发？').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Compiling')).toHaveCount(0, { timeout: 30_000 });
}

async function openDecreeWorkbench(page: Page) {
  await page.getByTestId('edict-quick-dock').getByRole('button', { name: '按此下旨' }).click();
  await expect(page.getByLabel('御前对话栏')).toBeVisible();
}

const BRIEFING = {
  dailyStats: { taskTotal: 3, pendingCount: 1, runningCount: 1, completedToday: 1 },
  chancellorItems: Array.from({ length: 7 }, (_, index) => ({
    id: `focus-chancellor-${String(index + 1).padStart(3, '0')}`,
    title: index === 0 ? '客户要求正式报价，要不要发？' : `丞相后台事项 ${index + 1}`,
    tag: index === 0 ? '待裁 · 军机处回奏' : '丞相汇报',
    priority: index === 0 ? 'urgent' : 'medium',
    source: 'primary',
    suggestedCommand: index === 0 ? '请军机处会审正式报价边界。' : `请丞相处理后台事项 ${index + 1}`,
    citations: [{ source: '销售记录', snippet: '客户要求今天给正式报价。' }],
    recommendedMinisters: ['户部', '刑部', '军机处'],
  })),
  memorials: [
    {
      id: 'focus-memorial-001',
      title: '客户要求正式报价，要不要发？',
      summary: '正式报价可能构成对外承诺，需先核成本、毛利和付款条件。',
      priority: 'urgent',
      status: 'pending',
      petitioner: '上书房',
      reporter: '军机处',
      sealDate: '2026-06-19T00:00:00.000Z',
      decisionOptions: ['采纳', '补证', '复核', '驳回', '追问'],
      enhancedSuggestion: '建议先补齐报价依据、授权记录和报价有效期。',
      citations: [{ source: '销售记录', snippet: '客户要求今天给正式报价。' }],
    },
  ],
  fetchedAt: '2026-06-19T00:00:00.000Z',
  sourceMode: 'real',
};

test.describe('上书房首屏收口', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('courtos.onboarded', '1');
      window.localStorage.setItem('courtos.first-decree-seeded', '1');
      window.localStorage.removeItem('chaotang:build-ledger:v1');
    });

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
  });

  test('默认只保留中央奏折和轻量操作 dock', async ({ page }) => {
    await gotoFocusStudy(page);

    await expect(page.getByText('客户要求正式报价，要不要发？').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /展开辅政/ })).toBeVisible();
    await expect(page.getByTestId('chancellor-visible-item')).toHaveCount(0);
    await expect(page.getByTestId('qintian-visible-item')).toHaveCount(0);

    await expect(page.getByLabel('御前对话栏')).toHaveCount(0);
    await expect(page.locator('textarea')).toHaveCount(0);

    const dock = page.getByTestId('edict-quick-dock');
    await expect(dock).toBeVisible();
    await expect(dock).toContainText('按此下旨');
    await expect(dock).toContainText('问丞相');
    await expect(dock).toContainText('资料');
  });

  test('点击轻量 dock 后在同一底部位置切换御前输入栏', async ({ page }) => {
    await gotoFocusStudy(page);

    await openDecreeWorkbench(page);

    await expect(page.getByTestId('decree-workbench-close')).toBeVisible();
    await expect(page.getByTestId('edict-quick-dock')).toHaveCount(0);
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('textarea')).toHaveValue('');
    await expect(page.locator('textarea')).toHaveAttribute('placeholder', '直接说您的裁决：准、驳回、补证或让谁先办。');

    await page.getByTestId('decree-workbench-close').click();
    await expect(page.getByLabel('御前对话栏')).toHaveCount(0);
    await expect(page.getByTestId('edict-quick-dock')).toBeVisible();
  });

  test('bottom workbench stays fully reachable in compact viewports', async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 560 },
      { width: 1280, height: 560 },
      { width: 2048, height: 964 },
    ]) {
      await page.setViewportSize(viewport);
      await gotoFocusStudy(page);
      await openDecreeWorkbench(page);

      const dock = page.locator('[data-three-axis-decree-input]');
      await expect(dock).toBeVisible();
      await expect(page.getByTestId('edict-quick-dock')).toHaveCount(0);
      await expect(page.getByTestId('decree-workbench-close')).toBeVisible();
      await expect(page.getByTestId('ssf-ask-input')).toBeVisible();
      await expect(page.getByTestId('decree-submit')).toBeVisible();

      const dockBox = await dock.boundingBox();
      const bottomChromeHeight = 16;
      expect(dockBox).not.toBeNull();
      expect(dockBox!.y).toBeGreaterThanOrEqual(0);
      expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(viewport.height - bottomChromeHeight + 1);
      expect(dockBox!.height).toBeLessThanOrEqual(Math.min(viewport.height * 0.88, 520) + 1);
    }
  });

  test('expanded side rails stay above bottom dock and workbench', async ({ page }) => {
    const viewport = { width: 1280, height: 560 };
    await page.setViewportSize(viewport);
    await gotoFocusStudy(page);

    await page.getByTestId('rails-toggle').click();
    const quickDockBox = await page.getByTestId('edict-quick-dock').boundingBox();
    expect(quickDockBox).not.toBeNull();

    for (const side of ['left', 'right'] as const) {
      const rail = page.locator(`[data-three-axis-panel="${side}"]`);
      await expect(rail).toBeVisible();
      const box = await rail.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(quickDockBox!.y - 8);
    }

    await openDecreeWorkbench(page);
    const workbenchBox = await page.locator('[data-three-axis-decree-input]').boundingBox();
    expect(workbenchBox).not.toBeNull();

    for (const side of ['left', 'right'] as const) {
      const box = await page.locator(`[data-three-axis-panel="${side}"]`).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(workbenchBox!.y - 8);
    }
  });

  test('点击丞相要务后只保留建议面板', async ({ page }) => {
    await gotoFocusStudy(page);

    await page.getByRole('button', { name: /展开辅政/ }).click();
    await page.getByTestId('chancellor-visible-item').first().click();

    const report = page.getByLabel('圣旨展示面板');
    await expect(report.getByText('丞相裁决台')).toBeVisible();
    await expect(report.getByRole('heading', { name: '建议' })).toBeVisible();
    await expect(page.getByTestId('chancellor-resolution-board')).toHaveCount(0);
    await expect(report.getByText('CHIEF OF STAFF')).toHaveCount(0);
    await expect(report.getByText('丞相先替老板判断：该不该亲自处理')).toHaveCount(0);
  });
});

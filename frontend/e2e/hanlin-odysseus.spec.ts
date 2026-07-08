import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';

const ODYSSEUS_URL = process.env.PLAYWRIGHT_BASE_URL?.includes('/chaotang')
  ? '/chaotang/hanlin/odysseus'
  : '/hanlin/odysseus';

test.describe('翰林 Odysseus 大神工作台入口', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.route('**/api/court/odysseus/health', (route) =>
      route.fulfill({
        json: {
          data: {
            status: 'ready',
            sourceLabel: 'LIVE',
            checkedAt: '2026-06-19T00:00:00.000Z',
            openUrl: 'http://127.0.0.1:7000',
            services: {
              ui: { status: 'auth_required', url: 'http://127.0.0.1:7000', httpStatus: 302 },
              modelGateway: { status: 'auth_required', url: 'http://host.docker.internal:4444/v1/models', httpStatus: 401 },
            },
            usageBoundary: 'sidecar_cockpit',
          },
        },
      }),
    );
  });

  test('展示受控入口、健康状态和大神使用说明', async ({ page }) => {
    await page.goto(ODYSSEUS_URL);

    await expect(page.getByRole('heading', { name: '大神工作台' })).toBeVisible();
    await expect(page.getByRole('link', { name: /打开 Odysseus/ })).toHaveAttribute('href', 'http://127.0.0.1:7000');
    await expect(page.getByText('LiteLLM bridge')).toBeVisible();
    await expect(page.getByText('karpathy + andrew-ng')).toBeVisible();
    await expect(page.getByText('bruce-schneier + stuart-russell')).toBeVisible();
    await expect(page.getByText('不绕过 CourtOS 闭环')).toBeVisible();
  });
});

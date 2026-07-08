import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';

test.describe('真能力与能力债务榜', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.route('**/api/court/true-chain-health', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            summary: {
              ready: 12,
              degraded: 2,
              down: 1,
              mock: 1,
              missing: 0,
              requiredDown: 0,
            },
            recommendation: '非关键依赖仍有缺口；继续标注 degraded/mock 边界。',
            checks: [
              {
                key: 'next_bff',
                label: 'Next BFF',
                kind: 'runtime',
                state: 'ready',
                live: true,
                detail: '当前请求已命中 Next BFF。',
                requiredForLive: true,
              },
              {
                key: 'legal_agent',
                label: 'Legal Agent',
                kind: 'backend',
                state: 'down',
                live: false,
                detail: 'http://127.0.0.1:18003/health -> probe timeout',
                requiredForLive: false,
              },
              {
                key: 'durable_queue',
                label: 'Durable Queue',
                kind: 'queue',
                state: 'degraded',
                live: false,
                detail: 'REDIS_URL/QSTASH_TOKEN 未配置；当前依赖进程内 task registry。',
                requiredForLive: false,
              },
              {
                key: 'swarm_overview',
                label: 'Swarm overview',
                kind: 'mock',
                state: 'mock',
                live: false,
                detail: '/api/v1/swarms/overview 当前为本地 mock 数据。',
                requiredForLive: false,
              },
            ],
          },
        },
      });
    });
  });

  test('顶导真演浮层显示能力债务、责任域和下一步', async ({ page }) => {
    let ledgerPayload: unknown = null;
    await page.route('**/api/court/chaotang/decree/draft', async (route) => {
      const rawCommand = (route.request().postDataJSON() as { rawCommand: string }).rawCommand;
      await route.fulfill({
        json: {
          success: true,
          data: {
            draft: rawCommand,
            intent: '修复能力债务：Legal Agent',
            source: 'rule',
            recommendedCategories: [{
              id: 'capability-debt-fix',
              label: '能力债务修复',
              description: '由工部形成修复方案，军机处复核。',
              taskType: 'engineering',
              ministers: ['gongbu', 'prime_minister'],
              groups: ['engineering'],
              confidence: 0.92,
              citations: [],
            }],
          },
        },
      });
    });
    await page.route('**/api/court/chaotang/decree/dispatch', async (route) => {
      const body = route.request().postDataJSON() as { intent: string };
      await route.fulfill({
        json: {
          success: true,
          data: {
            taskId: 'capability-debt-legal-agent-e2e',
            status: 'running',
            acceptedAt: '2026-06-07T00:00:00.000Z',
            streamUrl: '/api/court/events/stream?taskId=capability-debt-legal-agent-e2e',
            intent: body.intent,
            taskType: 'engineering',
            ministers: ['gongbu', 'prime_minister'],
            groups: ['engineering'],
          },
        },
      });
    });
    await page.route('**/api/court/build-ledger**', async (route) => {
      if (route.request().method() === 'POST') {
        ledgerPayload = route.request().postDataJSON();
        await route.fulfill({
          json: {
            success: true,
            data: {
              entry: (ledgerPayload as { entry: unknown }).entry,
              entries: [(ledgerPayload as { entry: unknown }).entry],
            },
          },
        });
        return;
      }
      await route.fulfill({ json: { success: true, data: [] } });
    });

    await page.goto('/court-briefing', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('load', { timeout: 60_000 });
    const capabilityButton = page.getByLabel('查看真能力与演示边界');
    await expect(capabilityButton).toBeVisible();
    await expect(capabilityButton).toContainText('LIVE / MIXED / DEMO');
    await capabilityButton.click();
    await expect(capabilityButton).toHaveAttribute('aria-expanded', 'true');

    const dialog = page.getByLabel('真能力与演示边界');
    await expect(dialog.getByText('能力债务榜')).toBeVisible();
    await expect(dialog.getByText('Legal Agent')).toBeVisible();
    await expect(dialog.getByText('DOWN', { exact: true })).toBeVisible();
    await expect(dialog.getByText('责任 军机处')).toBeVisible();
    await expect(dialog.getByText('Durable Queue')).toBeVisible();
    await expect(dialog.getByText('责任 工部')).toBeVisible();
    await expect(dialog.getByText('Swarm overview')).toBeVisible();
    await expect(dialog.getByText('责任 礼部')).toBeVisible();
    await expect(dialog.getByText('下一步：拉起服务并加健康探针。')).toBeVisible();
    await expect(dialog.getByText('非关键依赖仍有缺口；继续标注 degraded/mock 边界。')).toBeVisible();

    const fixLink = dialog.getByRole('link', { name: '生成修复任务' }).first();
    await expect(fixLink).toHaveAttribute('href', /\/command-center\?.*origin=capability-debt/);
    await fixLink.click();

    await expect(page).toHaveURL(/\/command-center\?.*origin=capability-debt/);
    const buildDraft = page.getByLabel('工部建设案草稿');
    await expect(buildDraft).toBeVisible();
    await expect(buildDraft.getByText('修复能力债务：Legal Agent')).toBeVisible();
    await expect(buildDraft.getByText('来源入口：能力债务榜')).toBeVisible();
    await expect(buildDraft.getByText('能力债务榜 · legal_agent')).toBeVisible();
    await expect(buildDraft.getByText('推荐会审：军机处、工部')).toBeVisible();

    await buildDraft.getByRole('button', { name: '正式下旨立项' }).click();
    await expect(page).toHaveURL(/taskId=capability-debt-legal-agent-e2e/);
    expect(ledgerPayload).toMatchObject({
      entry: {
        taskId: 'capability-debt-legal-agent-e2e',
        title: '工部建设案',
        source: '能力债务榜 · legal_agent',
        suggestion: '把 Legal Agent 从 DOWN 推进到 READY',
        evidence: [
          '状态：DOWN',
          '责任域：军机处',
          '详情：http://127.0.0.1:18003/health -> probe timeout',
          'LIVE 必需：否',
        ],
        ministers: ['军机处', '工部'],
        status: 'dispatched',
      },
    });
  });

  test('未登录体检只返回公开层，不泄露完整依赖细节', async ({ request }) => {
    const response = await request.get('/api/court/true-chain-health');
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload).toMatchObject({
      success: true,
      data: {
        status: 'needs_auth',
        healthLayer: 'public',
        releaseTier: 'public-preview',
      },
    });
  });
});

import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';

test.describe('视觉导演逐页修正：命令中心', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.route('**/jiqun/api/swarm/sessions', route =>
      route.fulfill({
        json: [
          {
            session_id: 'qa-fail-session',
            task_input: '铭硕样本上线前法律风险闸门',
            status: 'completed',
            release_gate: 'blocked',
            swarm_count: 1,
            completed_count: 1,
            start_time: '2026-06-07T10:00:00Z',
            duration: '41s',
          },
          {
            session_id: 'running-session',
            task_input: '锦衣卫公开来源采集验证',
            status: 'running',
            release_gate: 'clear',
            swarm_count: 2,
            completed_count: 1,
            start_time: '2026-06-07T10:10:00Z',
          },
          {
            session_id: 'done-session',
            task_input: '内部经营复盘摘要',
            status: 'completed',
            release_gate: 'clear',
            swarm_count: 2,
            completed_count: 2,
            start_time: new Date().toISOString(),
            duration: '18s',
          },
        ],
      }),
    );
  });

  test('统一按钮语法、阻断提示和截图验收', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/jiqun/command-center');

    await expect(page.getByRole('button', { name: '刷新会话' })).toBeVisible();
    await expect(page.getByRole('link', { name: /蜂群总台/ })).toBeVisible();
    await expect(page.getByText('快速调度 · 丞相拟旨')).toBeVisible();
    await expect(page.getByRole('button', { name: '正式下旨' })).toBeVisible();
    await expect(page.getByRole('button', { name: '按丞相拟旨' })).toBeVisible();
    await expect(page.getByRole('link', { name: /铭硕样本上线前法律风险闸门/ })).toContainText('发布阻断');
    await expect(page.getByText('下一步：先处理 QA issue，再复核、审签、归档；不要从命令中心直接视为完成。')).toBeVisible();

    await page.screenshot({
      path: 'artifacts/visual-director/jiqun-command-center-desktop.png',
      fullPage: true,
    });
  });
});

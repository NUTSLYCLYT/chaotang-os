import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';

test.describe('视觉导演逐页修正：蜂群编排总台', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.route('**/jiqun/api/swarm/config', route =>
      route.fulfill({
        json: {
          swarms: [
            { id: 'legal_review', name: '法律蜂群', qa_version: 'v3', config: 'flow_legal.yaml' },
            { id: 'jinyiwei_signal', name: '锦衣卫情报蜂群', qa_version: 'v3', config: 'flow_intel.yaml' },
          ],
          bindings: [
            { enabled: true, topic: 'legal_review_completed', target_swarm: 'jinyiwei_signal', min_quality_score: 4, transform: 'auto' },
          ],
        },
      }),
    );
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
        ],
      }),
    );
  });

  test('按钮、发布阻断和下一步提示可见，并生成桌面截图', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/jiqun/swarm');

    await expect(page.getByRole('button', { name: '刷新会话' })).toBeVisible();
    await expect(page.getByRole('link', { name: /命令中心/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /启动编排/ })).toBeVisible();
    await expect(page.getByText('发布阻断')).toBeVisible();
    await expect(page.getByText('下一步：进入详情页查看 QA issue，完成复核、审签、归档后再发布。')).toBeVisible();

    await page.screenshot({
      path: 'artifacts/visual-director/jiqun-swarm-desktop.png',
      fullPage: true,
    });
  });
});

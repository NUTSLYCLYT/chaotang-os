import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';

const SESSION_ID = 'qa-fail-session';

test.describe('视觉导演逐页修正：蜂群会话详情', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.route(`**/jiqun/api/swarm/sessions/${SESSION_ID}`, route =>
      route.fulfill({
        json: {
          session_id: SESSION_ID,
          task_input: '铭硕样本上线前法律风险闸门',
          status: 'completed',
          release_gate: 'blocked',
          swarm_count: 2,
          completed_count: 2,
          start_time: '2026-06-07T10:00:00Z',
          duration: '41s',
          swarm_runs: [
            {
              swarm_id: 'legal_review',
              run_id: 'legal-run-qa-fail',
              status: 'completed',
              quality_score: 4.2,
              triggered_by: 'manual',
              task_input: '核查预测口径冲突、第三方品牌授权和融资材料发布边界',
              qa_result: {
                qa_result: 'fail',
                issues: [
                  {
                    severity: 'critical',
                    dimension: '发布门禁',
                    problem: '缺少不得对外发布、复核、审签、归档硬闸',
                  },
                ],
              },
            },
            {
              swarm_id: 'archive_review',
              run_id: 'archive-run-pass',
              status: 'completed',
              quality_score: 8.6,
              triggered_by: 'legal_review',
              task_input: '归档复盘摘要',
              qa_result: { qa_result: 'pass', issues: [] },
            },
          ],
          graph: {
            nodes: [],
            edges: [{ source: 'legal_review', target: 'archive_review', topic: 'qa.blocked' }],
          },
          events: [{ event_id: 'event-1', topic: 'qa.blocked' }],
        },
      }),
    );
    await page.route('**/jiqun/api/swarm/run', route =>
      route.fulfill({ json: { session_id: 'rerun-session', success: true } }),
    );
  });

  test('详情页用状态、证据和下一步承接 QA 发布门禁', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto(`/jiqun/swarm/${SESSION_ID}`);

    await expect(page.getByRole('button', { name: '刷新会话' })).toBeVisible();
    await expect(page.getByRole('link', { name: /命令中心/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /重新编排/ })).toBeVisible();
    await expect(page.getByText('禁止发布')).toBeVisible();
    await expect(page.getByText('完成数代表执行结束，不等于可发布。')).toBeVisible();
    await expect(page.getByTestId('qa-fail-release-gate')).toContainText('下一步：修复下列 QA issue，重新编排或补充复核证据，再交由负责人审签。');
    await expect(page.getByText('输出结论：存在发布阻断')).toBeVisible();
    await expect(page.getByText('下一步：补齐证据或修正输出后复核，不要直接进入客户展示。')).toBeVisible();
    await expect(page.getByText('输出结论：执行结束后进入复核队列，等待审签与归档。')).toBeVisible();

    await page.screenshot({
      path: 'artifacts/visual-director/jiqun-swarm-detail-desktop.png',
      fullPage: true,
    });
  });
});

import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';

const SESSION_ID = 'qa-fail-session';

test.describe('蜂群编排 QA 发布门禁', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('法律蜂群执行完成但 QA fail 时，不展示为可发布状态', async ({ page }) => {
    await page.route(`**/jiqun/api/swarm/sessions/${SESSION_ID}`, route =>
      route.fulfill({
        json: {
          session_id: SESSION_ID,
          task_input: '铭硕样本上线前法律风险闸门',
          status: 'completed',
          swarm_count: 1,
          completed_count: 1,
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
          ],
          graph: { nodes: [], edges: [] },
          events: [],
        },
      }),
    );

    await page.goto(`/jiqun/swarm/${SESSION_ID}`);

    await expect(page.getByText('1 蜂群 · 1 完成')).toBeVisible();
    await expect(page.getByTestId('qa-fail-release-gate')).toBeVisible();
    await expect(page.getByText('QA 未通过，禁止把本次蜂群输出标记为可发布')).toBeVisible();
    await expect(page.getByText('已完成数量只代表执行结束；仍需复核、审签、归档后才能进入对外发布或客户展示。')).toBeVisible();
    await expect(page.getByText('QA fail')).toBeVisible();
    await expect(page.getByTestId('qa-fail-release-gate')).toContainText('缺少不得对外发布、复核、审签、归档硬闸');
  });

  test('会话列表使用后端 release_gate 标记发布阻断', async ({ page }) => {
    await page.route('**/jiqun/api/swarm/config', route =>
      route.fulfill({
        json: {
          swarms: [{ id: 'legal_review', name: '法律蜂群', qa_version: 'v3', config: 'flow_legal.yaml' }],
          bindings: [],
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
            session_id: 'qa-pass-session',
            task_input: '普通内部研判',
            status: 'completed',
            release_gate: 'clear',
            swarm_count: 1,
            completed_count: 1,
            start_time: '2026-06-07T11:00:00Z',
            duration: '12s',
          },
        ],
      }),
    );

    await page.goto('/jiqun/swarm');

    const blockedCard = page.getByRole('link', { name: /铭硕样本上线前法律风险闸门/ });
    await expect(blockedCard).toContainText('发布阻断');
    await expect(page.getByText('阻塞/失败')).toBeVisible();
  });
});

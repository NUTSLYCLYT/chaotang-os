import { expect, test } from '@playwright/test';

import { seedSession } from './fixtures';

const TASK_ID = 'task_p16_menxia_veto';
const VETO_MESSAGE = '门下省封驳：不属于任何部门真实职责范围，未获准奏前不得进入军机处派单。';

const memorial = {
  title: '门下省封驳纪要',
  verdict: '已封驳',
  summary: VETO_MESSAGE,
  ministry_outputs: [],
  conflict_summary: [{
    type: 'human_signoff',
    summary: VETO_MESSAGE,
    departments: [],
    source_label: 'FALLBACK',
  }],
  evidence_gaps: [],
  risk_flags: ['门下省封驳'],
  risk_register: [],
  decision_options: [],
  next_best_action: 'await_human_signoff',
  source_label: 'FALLBACK',
  quality_gate: {
    passed: false,
    status: 'blocked',
    reasons: ['门下省封驳'],
    blocking_issues: ['门下省封驳'],
    warnings: [],
    human_signoff_required: true,
  },
};

test('门下省封驳在军机处诚实显示为阻断，不伪报完成或系统异常', async ({ page }) => {
  await seedSession(page);

  await page.route(`**/api/chaotang/tasks/${TASK_ID}`, (route) => route.fulfill({
    json: {
      success: true,
      data: {
        task: {
          id: TASK_ID,
          rawCommand: '我要去美国看世界杯决赛',
          status: 'menxia_veto_pending',
          source: 'FALLBACK',
        },
      },
    },
  }));
  await page.route(`**/api/shangshufang/tasks/${TASK_ID}/status`, (route) => route.fulfill({
    json: {
      success: true,
      data: {
        task: {
          task_id: TASK_ID,
          status: 'menxia_veto_pending',
          raw_question: '我要去美国看世界杯决赛',
          draft_edict: null,
          source_label: 'FALLBACK',
          risk_flags: ['门下省封驳'],
          known_facts: [],
          unknown_gaps: [],
          recommended_departments: [],
          created_at: '2026-07-19T00:00:00Z',
          updated_at: '2026-07-19T00:01:00Z',
        },
        review: {
          review_id: 'review-p16-veto',
          review_status: 'menxia_veto_pending',
          routing_plan: {
            ministry_candidates: [],
            selected_departments: [],
            swarm_plan: [],
            route_reason: VETO_MESSAGE,
            source_label: 'FALLBACK',
          },
          ministry_outputs: [],
          conflict_summary: memorial.conflict_summary,
          memorial,
          created_at: '2026-07-19T00:00:00Z',
          updated_at: '2026-07-19T00:01:00Z',
        },
        formal_memorial: null,
        execution_status: null,
      },
    },
  }));
  await page.route(`**/api/chaotang/stream/${TASK_ID}`, (route) => route.fulfill({
    contentType: 'text/event-stream',
    body: `data: ${JSON.stringify({
      type: 'canonical.snapshot',
      taskId: TASK_ID,
      terminal: true,
      status: 'menxia_veto_pending',
      error: VETO_MESSAGE,
    })}\n\n`,
  }));

  await page.goto(`/command-center?taskId=${TASK_ID}`);

  await expect(page.getByText('需人工确认', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(`需人工确认：${VETO_MESSAGE}`, { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '门下省封驳状态' })).toContainText(
    '门下省封驳，需人工确认后才能进入会审。未生成奏折，也未派发部门或蜂群执行。',
  );
  await expect(page.getByText('作战流进行中 · 奏折待生成。完成会审与蜂群执行后，奏折将自动起草。', { exact: true })).toHaveCount(0);
  await expect(page.getByText('已完成', { exact: true })).toHaveCount(0);
  await expect(page.getByText('异常终止', { exact: true })).toHaveCount(0);
});

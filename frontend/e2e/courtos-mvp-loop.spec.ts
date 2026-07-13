import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';

const BASE_PATH = process.env.PLAYWRIGHT_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const draftEdict = {
  original_question: '客户要求正式报价，要不要发？',
  refined_edict:
    '请军机处组织相关视角会审，判断当前是否可以向客户发出正式报价。重点核查客户需求是否确认、报价依据是否充分、成本与毛利边界是否清楚、付款条件和报价有效期是否明确，以及正式报价是否构成对外承诺风险。',
  decision_type: '正式报价决策',
  known_facts: ['客户提出正式报价请求'],
  unknown_gaps: ['客户需求确认', '成本依据', '目标毛利', '付款条件', '报价有效期', '报价审批人'],
  recommended_departments: ['锦衣卫', '户部', '兵部', '刑部', '礼部', '吏部'],
  risk_flags: ['对外承诺风险', '报价依据不足', '毛利风险', '需人工确认'],
  expected_memorial_format: ['圣裁', '分奏', '证据链', '缺口', '风险', '后令', '来源'],
  emperor_confirmation_question: '是否确认发起军机处会审？',
  source_label: 'MIXED',
};

test.describe('CourtOS MVP 上书房闭环', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('courtos.onboarded', '1');
      window.localStorage.setItem('courtos.first-decree-seeded', '1');
    });

    await page.route('**/api/court/shangshufang/briefing', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            dailyStats: { taskTotal: 0, pendingCount: 0, runningCount: 0, completedToday: 0 },
            chancellorItems: [],
            memorials: [],
            fetchedAt: '2026-06-18T00:00:00.000Z',
            sourceMode: 'real',
          },
        },
      }),
    );
    await page.route('**/api/court/shangshufang/home', (route) =>
      route.fulfill({
        json: {
          success: true,
          source_label: 'MIXED',
          user_visible_message: '上书房已有待处理经营问题。',
          next_action: '查看待裁决或待补证任务',
          data: {
            recommended_issue: '客户要求正式报价，要不要发？',
            source_label: 'MIXED',
            pending_decisions: [
              {
                task_id: 'task_formal_quote_e2e',
                loop_trace_id: 'loop_quote_e2e',
                status: 'awaiting_confirm',
                raw_question: '客户要求正式报价，要不要发？',
                draft_edict: draftEdict,
                source_label: 'MIXED',
                risk_flags: ['formal_quote_risk', 'financial_risk', 'external_message_risk'],
                known_facts: draftEdict.known_facts,
                unknown_gaps: draftEdict.unknown_gaps,
                recommended_departments: draftEdict.recommended_departments,
                created_at: '2026-06-18T00:00:00.000Z',
                updated_at: '2026-06-18T00:01:00.000Z',
              },
            ],
            pending_evidence_tasks: [],
            archive_hints: [],
          },
        },
      }),
    );
    await page.route('**/api/build-ledger', (route) =>
      route.fulfill({ json: { success: true, data: [] } }),
    );
    await page.route('**/api/shangshufang/im**', (route) =>
      route.fulfill({ json: { success: true, data: { messages: [] } } }),
    );
    await page.route('**/jiqun/api/swarm/sessions', (route) =>
      route.fulfill({ json: [] }),
    );
  });

  test('首屏显示可找回的正式报价任务、来源和补证缺口', async ({ page }) => {
    await page.goto(`${BASE_PATH}/court-briefing`);

    await expect(page.getByTestId('daily-command-card')).toBeVisible();
    await expect(page.getByRole('heading', { name: /正式报价/ }).first()).toBeVisible();
    await expect(page.getByText(/待确认 · 丞相拟旨/).first()).toBeVisible();
    await expect(page.getByTestId('loop-trace-badge')).toContainText('TRACE');
    await expect(page.getByText('loop_quote_e2e').first()).toBeVisible();
    await expect(page.getByText(/证据待补/).first()).toBeVisible();
    await expect(page.getByText(/客户需求确认|成本依据|目标毛利|付款条件|报价有效期|报价审批人/).first()).toBeVisible();
  });
});

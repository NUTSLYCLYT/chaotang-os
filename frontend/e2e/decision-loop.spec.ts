import { test, expect, type Page } from '@playwright/test';
import { seedSession } from './fixtures';

/**
 * E2E：御前决策最小闭环 /throne/decision（CourtOS §13 主闭环的发布门禁）
 *
 * 设计要点（无需后端 / 无需真实 LLM）：
 *  - 绕过双门鉴权：seedSession() 种 cookie + localStorage
 *  - mock POST /api/court/decision 返回确定奏折 → 验证 UI 把
 *    圣裁 / 拟旨 / 后令 / 风险 / 缺证 / 来源印信 / 质门(人工确认) 渲染对。
 *  - 这是「绿/红/补证」三态的回归门：源标签必须如实显示，FALLBACK 不得伪装成 LIVE。
 */

const DECISION_URL = '/throne/decision';

function decisionResponse(over: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      taskId: 'decision-e2e',
      state: 'waiting_for_decision',
      refinedIntent: '冷库储能项目可行性判断案。要判断投入边界与现金流可覆盖性。',
      report: {
        verdict: '驳回',
        summary: '投入边界模糊、现金流可覆盖性无法论证，建议补证后重新上奏。',
        perspectives: [{ department: '财务部', view: '缺融资结构与现金流预测。' }],
        evidence: ['项目规模100MWh已确定'],
        missingEvidence: ['一期总投入预算', '5年滚动现金流模型'],
        risks: [{ category: '财务风险', description: '融资成本未知，现金流覆盖能力无法判断' }],
        nextAction: '着令财务部、工程部补证，30日内重新上奏。',
        sourceLabel: 'LIVE',
        needsHumanConfirmation: false,
        qualityGate: { trustLevel: 'conditional', warnings: [] },
        ...(over.report as Record<string, unknown> | undefined),
      },
      sourceLabel: 'LIVE',
      needsHumanConfirmation: false,
      ...over,
    },
  };
}

async function runDecision(page: Page, body: Record<string, unknown>) {
  await page.route('**/api/court/decision', (route) => route.fulfill({ json: body }));
  await page.goto(DECISION_URL);
  await page.locator('#q').fill('判断 100MWh 冷库储能项目是否推进，重点看投入边界与现金流风险');
  await page.getByRole('button', { name: '发起会审' }).click();
}

test.describe('御前决策最小闭环', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('LIVE 奏折：圣裁 / 后令 / 缺证 / 风险 / 来源印信全渲染', async ({ page }) => {
    await runDecision(page, decisionResponse());

    await expect(page.getByRole('heading', { name: '圣裁：驳回' })).toBeVisible();
    await expect(page.getByText('LIVE', { exact: true })).toBeVisible();   // 来源印信
    await expect(page.getByText('一期总投入预算')).toBeVisible();           // 缺证
    await expect(page.getByText(/融资成本未知/)).toBeVisible();             // 风险（对象渲染为 JSON）
    await expect(page.getByText(/着令财务部/)).toBeVisible();               // 后令
    await expect(page.getByText('状态：waiting_for_decision')).toBeVisible(); // 状态机
  });

  test('高风险 / 缺证 → 质门：需人工确认横幅可见', async ({ page }) => {
    await runDecision(
      page,
      decisionResponse({
        needsHumanConfirmation: true,
        sourceLabel: 'MIXED',
        report: { needsHumanConfirmation: true, sourceLabel: 'MIXED' },
      }),
    );

    await expect(page.getByText(/采纳需人工确认/)).toBeVisible();
    await expect(page.getByText('MIXED', { exact: true })).toBeVisible();
  });

  test('FALLBACK 必须如实显示（不得伪装成 LIVE）', async ({ page }) => {
    await runDecision(
      page,
      decisionResponse({ sourceLabel: 'FALLBACK', report: { sourceLabel: 'FALLBACK' } }),
    );

    await expect(page.getByText('FALLBACK', { exact: true })).toBeVisible();
    await expect(page.getByText('LIVE', { exact: true })).toHaveCount(0);
  });
});

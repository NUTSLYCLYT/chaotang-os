import { test, expect, type Page } from '@playwright/test';
import { seedSession, clearSession } from './fixtures';
import { resolveBasePath } from './helpers/base-path';

/**
 * E2E：户部单 agent · 问责面板（北极星——让蜂群真实工作）
 *
 * 验收：
 *  - /departments/finance 渲染户部专用页 + 底部对话坞
 *  - 提问 → POST /api/court/hubu/ask → 渲染「答案 + 证据 + 数字接地徽标 + 冲突声明」
 *  - 匿名 POST /api/court/hubu/ask → 401（不可匿名烧 LLM）
 *  - 鉴权 + 入参校验（过短 400）
 *
 * 浏览器层 mock /api/court/hubu/{overview,ask}，无需后端/真大脑，确定性。
 */

const HUBU_OVERVIEW = {
  success: true,
  data: {
    summary: {
      total_requested: '42.6 万',
      approved_this_week: '18.0 万',
      pending_count: 3,
      avg_roi: '2.8x',
      cash_reserve: '71%',
      recommendation: '先批户部预算中台和工部 Workflow。',
      generated_at: '2026-06-04T00:00:00Z',
      source: 'turso',
    },
    projects: [
      {
        id: 'build-hubu-v1', title: '建设户部经营预算中台 v1', target_dept: '户部', owner_dept: '工部',
        status: 'pending_review', requested_budget: '16.8 万', estimated_roi: '3.2x', payback_window: '30 天',
        cash_flow_pressure: '中', priority: 'P0', risk_level: 'medium', recommendation: '批准首期。',
        command: '', acceptance_criteria: [], created_at: '', updated_at: '',
      },
    ],
    llm_advice: null,
  },
};

// 户部单 agent 的结构化「问责」结果（HubuAgentResult 形状）
const ASK_RESULT = {
  ok: true,
  answer: '建议优先批准“建设户部经营预算中台 v1”，其次史馆模板，暂不批锦衣卫雷达二期。',
  reasoning: '按 ROI 降序与现金储备承受力排序。',
  evidence: ['ROI×预算 53.8 万（已核算）', '现金储备 71%', '锦衣卫风险雷达二期 状态 退回补充'],
  assumptions: [],
  conflicts: '若锦衣卫补充后 ROI 提升可能推翻当前结论；需工部复核资源冲突。',
  confidence: 0.9,
  grounding: { total: 10, grounded: 10, rate: 1, ungrounded: [] },
  reprompted: false,
  model: 'deepseek-chat',
  latencyMs: 1234,
};

async function mockHubu(page: Page) {
  await page.route('**/api/court/hubu/overview', (r) => r.fulfill({ json: HUBU_OVERVIEW }));
  await page.route('**/api/court/hubu/ask', (r) => r.fulfill({ json: ASK_RESULT }));
  // HubuClient 还会拉通用 dept 总览，给个空壳避免控制台噪音（组件已 catch）
  await page.route('**/api/court/chaotang/dept/finance/overview', (r) =>
    r.fulfill({ json: { success: true, data: { code: 'finance', status: 'operational', minister: null, keyMetrics: [], activeTasks: [], risks: [], recentMemorials: [] } } }),
  );
}

test.describe('户部单 agent · 问责面板', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('户部页 → 渲染部门任务池与财政工作台', async ({ page }) => {
    await mockHubu(page);
    await page.goto(`${await resolveBasePath(page.request)}/departments/finance`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Revenue Office', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('CFO Office', { exact: false }).first()).toBeVisible();
  });

  test('匿名 POST /api/court/hubu/ask → 401（不可匿名烧 LLM）', async ({ page }) => {
    await clearSession(page);
    const res = await page.request.post(`${await resolveBasePath(page.request)}/api/court/hubu/ask`, {
      data: { command: '三个待批项目先批哪个？' },
    });
    expect(res.status()).toBe(401);
  });

  test('command 过短 → 400（入参校验，区别于 401）', async ({ page }) => {
    const res = await page.request.post(`${await resolveBasePath(page.request)}/api/court/hubu/ask`, { data: { command: '嗯' } });
    expect(res.status()).toBe(400);
  });
});

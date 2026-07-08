import { test, expect, type Page } from '@playwright/test';
import { seedSession } from './fixtures';

/**
 * E2E：刑部(legal)单 agent · 问责面板（量产第三个部门——边际成本≈两条配置）
 * 浏览器层 mock 数据源 + ask，确定性。
 */

const DEPT_OVERVIEW = {
  success: true,
  data: {
    code: 'legal',
    status: 'processing',
    minister: { name: '包拯', role: 'Minister' },
    keyMetrics: [
      { label: '在办案件', value: '128', unit: '件' },
      { label: '结案率', value: '82', unit: '%' },
    ],
    activeTasks: [{ taskId: 'lg1', title: '盐铁专营合规审查', progressPct: 60 }],
    risks: [{ label: '三起契约纠纷临近诉讼时效', level: 'high' }],
    recentMemorials: [
      { id: 'm1', title: '刑部月报', summary: '五月案务结算', priority: 'normal', status: 'pending' },
    ],
  },
};

const ASK_RESULT = {
  ok: true,
  answer: '优先处置「三起契约纠纷临近诉讼时效」，其次推进盐铁专营合规审查。',
  reasoning: '按合规暴露与时效紧迫度排序。',
  evidence: ['风险分级计数：高危 1 条', '在办案件：128件', '[高危] 三起契约纠纷临近诉讼时效'],
  assumptions: [],
  conflicts: '若户部对盐铁收入口径有异议，审查结论可能调整；需户部复核。',
  confidence: 0.86,
  grounding: { total: 6, grounded: 6, rate: 1, ungrounded: [] },
  reprompted: false,
  model: 'deepseek-chat',
  latencyMs: 1900,
};

async function mockLegal(page: Page) {
  await page.route('**/api/court/chaotang/dept/legal/overview', (r) => r.fulfill({ json: DEPT_OVERVIEW }));
  await page.route('**/api/court/dept/legal/ask', (r) => r.fulfill({ json: ASK_RESULT }));
}

test.describe('刑部单 agent · 问责面板（量产第三个部门）', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('提问 → 渲染答案 + 证据 + 数字接地 100% 徽标 + 冲突声明', async ({ page }) => {
    await mockLegal(page);
    await page.goto('/departments/legal');

    await page.getByRole('button', { name: '展开对话', exact: true }).click();
    await page.getByRole('button', { name: '当前最该优先处置的合规风险是哪一个？为什么？' }).first().click();

    await expect(page.getByText('三起契约纠纷临近诉讼时效', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('在办案件：128件')).toBeVisible();
    await expect(page.getByText(/数字接地\s*6\/6\s*=\s*100%/)).toBeVisible();
    await expect(page.getByText(/需户部复核/)).toBeVisible();
  });

  test('command 过短 → 400', async ({ page }) => {
    const res = await page.request.post('/api/court/dept/legal/ask', { data: { command: '嗯' } });
    expect(res.status()).toBe(400);
  });
});

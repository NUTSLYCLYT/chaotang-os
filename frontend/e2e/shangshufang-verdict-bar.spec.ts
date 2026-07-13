import { expect, test, type Page } from '@playwright/test';
import { seedSession } from './fixtures';

/**
 * 回归护栏 · 上书房决策卡朱批五键 + 注意力状态机（铁律4）
 * 钉死三件「不该回退的事」：
 *  1. 中栏决策卡的朱批动作恰好是 采纳/补证/复核/驳回/追问 五键（SSOT，铁律3）
 *  2. 旧的两套并存按钮组已收敛——不得再出现 准奏 / 裁决 / 查看详情
 *  3. 注意力状态机：卷轴收起=提问态(底部下旨栏在)；展开=决策态(底部降格提示、下旨栏隐)
 */
const BASE_PATH = process.env.PLAYWRIGHT_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '/chaotang';

const BRIEFING = {
  dailyStats: { taskTotal: 4, pendingCount: 2, runningCount: 1, completedToday: 1 },
  chancellorItems: Array.from({ length: 3 }, (_, i) => ({
    id: `verdict-c-${i + 1}`,
    title: i === 0 ? '客户要求正式报价，要不要发？' : `丞相事项 ${i + 1}`,
    tag: i === 0 ? '待裁 · 军机处回奏' : '丞相汇报',
    priority: i === 0 ? 'urgent' : 'medium',
    source: 'primary',
    suggestedCommand: '请军机处会审正式报价边界。',
    citations: [{ source: '销售记录', snippet: '客户要求今天给正式报价。' }],
    recommendedMinisters: ['户部', '刑部', '军机处'],
  })),
  memorials: [
    {
      id: 'verdict-m-1',
      title: '客户要求正式报价，要不要发？',
      summary: '正式报价可能构成对外承诺，需先核成本、毛利和付款条件。',
      priority: 'urgent',
      status: 'pending',
      verdict: '建议暂缓外发，先补授权与有效期',
      petitioner: '上书房',
      reporter: '军机处',
      sealDate: '2026-07-01T00:00:00.000Z',
      decisionOptions: ['采纳', '补证', '复核', '驳回', '追问'],
      enhancedSuggestion: '建议先补齐报价依据、授权记录和报价有效期。',
      citations: [{ source: '销售记录', snippet: '客户要求今天给正式报价。' }],
    },
  ],
  fetchedAt: '2026-07-01T00:00:00.000Z',
  sourceMode: 'real',
};

// 高风险奏折：task_ 前缀 + verdict 命中高危词(正式报价/合同/付款)——点「采纳」必须过人工确认门(铁律4/13.5)
const HIGH_RISK_BRIEFING = {
  ...BRIEFING,
  memorials: [
    {
      ...BRIEFING.memorials[0],
      id: 'task_highrisk_001',
      verdict: '涉及正式报价与合同付款，属对外承诺，需人工确认后方可采纳。',
    },
  ],
};

// 低风险奏折：标题/摘要/裁决均无高危词，sourceMode=real → 不触发强制翻面，默认落结论页。
const LOW_RISK_BRIEFING = {
  ...BRIEFING,
  chancellorItems: [
    { ...BRIEFING.chancellorItems[0], title: '内部周会议程确认', tag: '丞相汇报', priority: 'medium', citations: [], suggestedCommand: '确认本周例会议程。' },
  ],
  memorials: [
    {
      ...BRIEFING.memorials[0],
      id: 'verdict-lowrisk-1',
      title: '内部周会议程确认',
      summary: '本周部门例会时间与议程确认，按惯例推进即可。',
      verdict: '照常安排。',
      enhancedSuggestion: '按惯例推进即可。',
      citations: [],
    },
  ],
};

// 排序验证：urgent 项在数组里排第二，收件箱须把它顶到 medium 之前(PRD §4 高危置顶)。
const SORT_BRIEFING = {
  ...BRIEFING,
  memorials: [],
  chancellorItems: [
    { ...BRIEFING.chancellorItems[0], id: 'c-mid', title: '内部例会安排', priority: 'medium', tag: '丞相汇报', citations: [] },
    { ...BRIEFING.chancellorItems[0], id: 'c-urg', title: '紧急客户投诉', priority: 'urgent', tag: '待裁 · 紧急', citations: [] },
  ],
};

async function gotoBriefing(page: Page, briefing: unknown = BRIEFING) {
  await seedSession(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('courtos.onboarded', '1');
    window.localStorage.setItem('courtos.first-decree-seeded', '1');
    window.localStorage.removeItem('chaotang:build-ledger:v1');
  });
  await page.route('**/api/court/shangshufang/briefing', (route) =>
    route.fulfill({ json: { success: true, data: briefing } }),
  );
  await page.route('**/api/court/shangshufang/home', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { recommended_issue: null, pending_decisions: [], pending_evidence_tasks: [], archive_hints: [], source_label: 'LIVE' },
      },
    }),
  );
  await page.route('**/api/build-ledger', (route) => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('**/api/shangshufang/im**', (route) => route.fulfill({ json: { success: true, data: { messages: [] } } }));

  await page.goto(`${BASE_PATH}/court-briefing?skipOnboarding=1`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('aside[aria-label="奏折收件箱"]')).toBeVisible({ timeout: 20_000 });
}

/** 展卷进入决策态：点顶部「展卷」切换。 */
async function enterDecisionState(page: Page) {
  await page.getByRole('button', { name: '展卷' }).first().click();
  await expect(page.getByText('决策进行中', { exact: false })).toBeVisible({ timeout: 10_000 });
}

test.describe('上书房 · 朱批五键 + 注意力状态机', () => {
  test('决策卡朱批动作恰为 采纳/补证/复核/驳回/追问 五键', async ({ page }) => {
    await gotoBriefing(page);
    await enterDecisionState(page);
    for (const key of ['采纳', '补证', '复核', '驳回', '追问']) {
      await expect(page.getByRole('button', { name: key })).toBeVisible();
    }
  });

  test('旧并存按钮组已收敛：不得再出现 准奏 / 裁决 / 查看详情', async ({ page }) => {
    await gotoBriefing(page);
    await enterDecisionState(page);
    await expect(page.getByRole('button', { name: '准奏' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '裁决' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '查看详情' })).toHaveCount(0);
  });

  test('注意力状态机：提问态有下旨栏 / 决策态降格且下旨栏隐', async ({ page }) => {
    await gotoBriefing(page);
    // 提问态(默认收卷)：底部无降格提示
    await expect(page.getByText('决策进行中', { exact: false })).toHaveCount(0);
    // 进决策态：降格提示出现
    await enterDecisionState(page);
    await expect(page.getByText('决策进行中', { exact: false })).toBeVisible();
    // 点降格提示可收卷回提问态
    await page.getByRole('button', { name: '收卷回到提问' }).click();
    await expect(page.getByText('决策进行中', { exact: false })).toHaveCount(0);
  });

  // 会审 CRITICAL 1 回归：高风险奏折(task_ + 高危词)点「采纳」必须弹人工确认门(window.confirm)，
  // 不得像旧 approveMemorialBySwarm 那样一键静默重灌拟旨、绕过铁律4/13.5。
  test('高风险奏折点采纳必须弹人工确认门(拦门)', async ({ page }) => {
    await gotoBriefing(page, HIGH_RISK_BRIEFING);
    await enterDecisionState(page); // 展卷 → 首条 memorial(task_highrisk_001)决策卡
    let confirmFired = false;
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm' && dialog.message().includes('高风险采纳需要人工确认')) {
        confirmFired = true;
      }
      await dialog.dismiss(); // 取消 → 不写入，验证拦门确实挡在写库前
    });
    await page.getByRole('button', { name: '采纳' }).click();
    await page.waitForTimeout(600);
    expect(confirmFired).toBe(true);
  });

  // PRD §4 排序：奏折收件箱高危/紧急置顶（urgent 项虽在数据里排第二，仍须顶到 medium 之前）。
  test('奏折收件箱按优先级排序：紧急置顶', async ({ page }) => {
    await gotoBriefing(page, SORT_BRIEFING);
    const railText = await page.locator('aside[aria-label="奏折收件箱"]').innerText();
    const urgentAt = railText.indexOf('紧急客户投诉');
    const midAt = railText.indexOf('内部例会安排');
    expect(urgentAt).toBeGreaterThan(-1);
    expect(midAt).toBeGreaterThan(-1);
    expect(urgentAt).toBeLessThan(midAt);
  });

  // PRD §3 强制翻面：高风险奏折决策卡默认落在「原始明细」证据页(aria-label=附件明细)，逼老板先看缺证再采纳。
  test('高风险奏折强制翻面：决策卡默认落在证据明细页', async ({ page }) => {
    await gotoBriefing(page, HIGH_RISK_BRIEFING);
    await enterDecisionState(page);
    await expect(page.getByLabel('附件明细')).toBeVisible();
  });

  test('常规奏折默认落在结论页、不强制翻面', async ({ page }) => {
    await gotoBriefing(page, LOW_RISK_BRIEFING); // 无高危词 → 不翻面
    await enterDecisionState(page);
    await expect(page.getByLabel('附件明细')).toHaveCount(0);
  });

  // 会审 HIGH 回归：终态裁决(驳回)后五键必须锁定，防止对同一奏折重复/矛盾裁决。
  // (CRITICAL 1 把驳回改走 handleVerdictChoice 后，锁定必须在该通路里发生，不能依赖已死的 rejectMemorialDirectly。)
  test('驳回后五键锁定、不可再点采纳', async ({ page }) => {
    await gotoBriefing(page, HIGH_RISK_BRIEFING); // memorial id=task_highrisk_001
    // 裁决落库端点 mock 成功，锁定才会触发
    await page.route('**/api/court/shangshufang/tasks/*/decision', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: { task_id: 'task_highrisk_001', decision_id: 'd1', status: '已驳回', loop_trace_id: 't1', archive_record: { archive_id: 'a1' } },
        },
      }),
    );
    // 驳回会 window.prompt 要原因
    page.on('dialog', (dialog) => dialog.accept('测试驳回原因'));
    await enterDecisionState(page);
    await page.getByRole('button', { name: '驳回' }).click();
    // 锁定后采纳键置灰不可点
    await expect(page.getByRole('button', { name: '采纳' })).toBeDisabled({ timeout: 8000 });
  });

  // 会审 CRITICAL 2 回归：点右栏钦天监教学卡(edictOverride=qintian-plain-text)不得被误判为决策态、
  // 不得把底部提问栏降格困住老板。inDecisionState 必须排除 edictOverride。
  test('点右栏教学卡不进决策态、提问栏不被降格困住', async ({ page }) => {
    await gotoBriefing(page);
    const rightRail = page.locator('aside[aria-label="情报与战略"]');
    await rightRail.getByText('新岁引导', { exact: false }).first().click();
    await page.waitForTimeout(600);
    // 教学卡只有单键、无五键 → 不该出现决策态降格提示
    await expect(page.getByText('决策进行中', { exact: false })).toHaveCount(0);
  });
});

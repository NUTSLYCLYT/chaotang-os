import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';
import { ZStudyEdict } from '../src/lib/contracts/study-edict';

/**
 * ⚠️ 这是 FIXTURE 驱动的 UI 渲染契约测试 —— **不是真链路存活证明**。
 *
 * 本 spec 注入一份捏造的 LIVE_SWARM edict(run_id=study-live-true-loop)并把
 * /api/court/true-chain-health mock 成全 'real',仅为驱动页面渲染。它能证明的只有两件事:
 *   1. fixture 形状仍匹配 ZStudyEdict 契约 SoT(防 mock 与后端形状静默漂移);
 *   2. 给定一份 LIVE_SWARM edict,UI 能正确渲染。
 * 它**不**证明后端真跑了蜂群 / 真碰了 provider / 真归档——那些全被 mock 掉了。
 *
 * 端到端"真跑通"的唯一裁判是 e2e/golden-loop-liveness.spec.ts(零 mock、经真接缝触发真蜂群)。
 * 已从旧名 'true loop contract' 改名,消除"此测试通过=真链路通"的误导(就绪度审计 B5)。
 */

const TRUE_LOOP_BRIEFING = {
  dailyStats: {
    taskTotal: 1,
    pendingCount: 1,
    runningCount: 0,
    completedToday: 0,
  },
  chancellorItems: [
    {
      id: 'true-loop-chancellor',
      title: '真实闭环第一案',
      tag: '经营信号 · 待决策 · 高',
      priority: 'urgent',
      source: 'true_loop_contract',
      suggestedCommand: '请军机处召集户部和工部判断 100MWh 冷库储能项目是否推进。',
      citations: [
        { source: '客户线索', snippet: '客户要求 48 小时内给出初步方案' },
        { source: '史馆旧案', snippet: '同类项目曾因报价缺证被退回' },
      ],
      recommendedMinisters: ['军机处', '户部', '工部', '史馆'],
    },
  ],
  memorials: [
    {
      id: 'true-loop-memorial',
      title: '100MWh 冷库储能项目是否推进',
      summary: '客户有明确意向，但报价、交期和风险边界需要后端蜂群给出证据。',
      priority: 'urgent',
      status: 'pending',
      petitioner: '上书房',
      reporter: '军机处',
      sealDate: '丙辰初刻',
      decisionOptions: ['准奏 · 进入军机处', '补证 · 召户部工部', '暂缓 · 史馆查旧案'],
      enhancedSuggestion: '先召集户部和工部形成证据，再由史馆保留 replay artifact。',
      citations: [
        { source: '客户线索', snippet: '48 小时内需要初步方案' },
        { source: '史馆旧案', snippet: '报价缺证曾导致项目退回' },
      ],
    },
  ],
  fetchedAt: '2026-06-08T00:00:00.000Z',
};

const TRUE_LOOP_EDICT = {
  run_id: 'study-live-true-loop',
  source_mode: 'LIVE_SWARM',
  title: '100MWh 冷库储能项目是否推进',
  verdict: '需人工复核',
  summary: '后端蜂群已经形成第一轮证据，但报价和客户承诺需要人工确认。',
  departments: [
    {
      dept: 'ops',
      name: '军机处',
      opinion: '已创建执行任务卡，等待户部和工部补证。',
      confidence: 0.86,
      status: 'completed',
      run_id: 'run-command-center',
    },
    {
      dept: 'finance',
      name: '户部',
      opinion: '需要补齐成本和毛利底线。',
      confidence: 0.82,
      status: 'completed',
      run_id: 'run-hubu',
    },
    {
      dept: 'engineering',
      name: '工部',
      opinion: '需要确认交期、BOM 和供应约束。',
      confidence: 0.79,
      status: 'completed',
      run_id: 'run-gongbu',
    },
  ],
  evidence: [
    { label: '用户旨意', value: '判断 100MWh 冷库储能项目是否推进', source: 'study_input' },
    { label: '真实蜂群会话', value: 'study-live-true-loop', source: 'swarm_orchestrator' },
    { label: '史馆复盘入口', value: '/api/swarm/sessions/study-live-true-loop', source: 'swarm_replay_artifact' },
    { label: '报价缺证旧案', value: '同类项目曾因报价缺证被退回', source: 'archive' },
  ],
  risks: ['报价、交期、客户承诺属于不可逆边界，必须人工签字。'],
  next_actions: [
    {
      type: 'dispatch',
      label: '交军机处立项',
      target: '/command-center?taskId=study-live-true-loop',
      owner: '军机处',
    },
    {
      type: 'archive',
      label: '史馆保留 replay artifact',
      target: '/shiguan?taskId=study-live-true-loop',
      owner: '史馆',
    },
  ],
  quality_gate: {
    status: 'needs_review',
    score: 0.81,
    reasons: ['live_swarm_session_completed', 'human_signoff_required_for_customer_commitment'],
    human_signoff_required: true,
  },
  run_adapter: {
    name: 'swarm_orchestrator',
    session_id: 'study-live-true-loop',
    entry_swarm: 'ai_ops',
    status: 'completed',
    run_count: 3,
    completed_count: 3,
    replay_artifact: {
      kind: 'swarm_session',
      session_id: 'study-live-true-loop',
      path: 'swarm_sessions/study-live-true-loop.json',
      api_path: '/api/swarm/sessions/study-live-true-loop',
      owner: 'shiguan',
    },
  },
  created_at: '2026-06-08T00:10:00.000Z',
};

test.describe('上书房 LIVE_SWARM edict 渲染契约 (fixture-driven · 非真链路验证)', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('courtos.onboarded', '1');
      window.localStorage.setItem('courtos.first-decree-seeded', '1');
    });
    await page.route('**/api/court/shangshufang/briefing', (route) =>
      route.fulfill({ json: { success: true, data: TRUE_LOOP_BRIEFING } }),
    );
    await page.route('**/api/court/chaotang/study/run', (route) =>
      route.fulfill({ json: { success: true, data: { edict: TRUE_LOOP_EDICT } } }),
    );
    await page.route('**/api/build-ledger', (route) =>
      route.fulfill({ json: { success: true, data: [] } }),
    );
    // ⚠️ 把 true-chain-health mock 成全 'real' 仅为让页面渲染 —— 不代表真链路健康。
    //    真健康/真存活由 e2e/golden-loop-liveness.spec.ts 经真接缝裁定,不在此处。
    await page.route('**/api/court/true-chain-health', (route) =>
      route.fulfill({
        json: {
          ok: true,
          status: 'needs_review',
          checks: [
            { id: 'study-run', ok: true, status: 'real' },
            { id: 'swarm-replay', ok: true, status: 'real' },
            { id: 'shiguan-archive', ok: true, status: 'fallback-labeled' },
          ],
        },
      }),
    );
  });

  test('fixture conforms to ZStudyEdict', () => {
    // 守门：mock fixture 必须匹配真实后端契约（study-edict 的 Zod SoT）。
    // 一旦后端形状变更、SoT 收紧而此 fixture 未同步，parse 抛错 → 测试红，
    // 杜绝 mock 与真实 backend 形状静默漂移。
    expect(() => ZStudyEdict.parse(TRUE_LOOP_EDICT)).not.toThrow();
  });

  test('给定注入的 LIVE_SWARM edict,UI 正确渲染会话/复盘/归档指令 (fixture · 不证明后端真跑)', async ({ page }) => {
    await page.goto('/study');

    const desk = page.getByRole('region', { name: '今日御案' });
    await expect(desk.getByRole('heading', { name: '100MWh 冷库储能项目是否推进' })).toBeVisible();

    await desk.getByRole('button', { name: '按此下旨' }).click();
    await expect(page.getByText('正式下旨进执行')).toBeVisible();
    await page.getByTestId('decree-submit').click();

    const edict = page.getByLabel('圣旨展示');
    await expect(edict).toBeVisible();
    await expect(edict.getByText('LIVE_SWARM')).toBeVisible();
    await expect(edict.getByText('后令 · 军机处')).toBeVisible();

    await edict.getByRole('button', { name: 'AI 极客' }).click();
    await expect(edict.getByText('真实蜂群会话：study-live-true-loop')).toBeVisible();
    await expect(edict.getByText('史馆复盘入口：/api/swarm/sessions/study-live-true-loop')).toBeVisible();
    await expect(edict.getByText('needs_review · 81分 · 需人工圣裁', { exact: true })).toBeVisible();
    await expect(
      edict.getByText('史馆保留 replay artifact · 史馆 → /shiguan?taskId=study-live-true-loop', { exact: true }),
    ).toBeVisible();
  });
});

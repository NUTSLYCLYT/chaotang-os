import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { seedSession } from './fixtures';

type ImFixtureMessage = {
  id: string;
  role: 'user' | 'assistant';
  label: string;
  text: string;
  time: string;
  mode?: 'ask' | 'order' | 'secret' | null;
  sessionId?: string;
};

const IM_SESSION_CHANCELLOR = 'ask:chancellor';
const IM_SESSION_MENTOR = 'ask:mentor';

let imMessagesBySession: Record<string, ImFixtureMessage[]> = {};
let imWrites: ImFixtureMessage[] = [];

async function gotoStudy(page: Page) {
  const basePath = process.env.PLAYWRIGHT_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  await page.goto(`${basePath}/study`, { waitUntil: 'domcontentloaded' });
}

async function expectStudyReady(page: Page) {
  await expect(page.getByText(/朝堂 OS · 上书房 ·/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('正在整理上书房奏折……')).toHaveCount(0, { timeout: 15_000 });
}

async function openWorkbench(page: Page) {
  await expectStudyReady(page);
  const bar = page.getByLabel('御前对话栏');
  if (!(await bar.isVisible().catch(() => false))) {
    await page.getByTestId('edict-quick-dock').getByRole('button', { name: '按此下旨' }).click();
  }
  await expect(bar).toBeVisible();
}

async function openWorkbenchAskChancellor(page: Page) {
  await expectStudyReady(page);
  await page.getByTestId('edict-quick-dock').getByRole('button', { name: '问丞相' }).click();
  await expect(page.getByLabel('御前对话栏')).toBeVisible();
  await expect(page.getByTestId('decree-im-dialog')).toBeVisible();
}

async function openWorkbenchAskQintian(page: Page) {
  await expectStudyReady(page);
  await page.getByTestId('edict-quick-dock').getByRole('button', { name: '问钦天监' }).click();
  await expect(page.getByLabel('御前对话栏')).toBeVisible();
  await expect(page.getByTestId('decree-im-dialog')).toBeVisible();
}

async function expectDraftOriginalAbovePolished(stage: Locator) {
  const originalBox = await stage.getByTestId('decree-draft-original').boundingBox();
  const polishedBox = await stage.getByTestId('decree-draft-polished').boundingBox();
  expect(originalBox).not.toBeNull();
  expect(polishedBox).not.toBeNull();
  expect(polishedBox!.y).toBeGreaterThan(originalBox!.y + originalBox!.height);
}

const BRIEFING = {
  dailyStats: {
    taskTotal: 7,
    pendingCount: 2,
    runningCount: 3,
    completedToday: 1,
  },
  chancellorItems: [
    {
      id: 'chancellor-task_001',
      title: '压价清库存是否伤害利润',
      tag: '经营信号 · 待决策 · 高',
      priority: 'urgent',
      source: 'turso',
      suggestedCommand: '请户部与兵部会审压价清库存的利润风险与市场收益。',
      citations: [
        { source: '户部预算', snippet: '毛利率低于安全线' },
        { source: '兵部市场', snippet: '竞品正在压价抢渠道' },
      ],
      recommendedMinisters: ['户部', '兵部', '军机处'],
    },
  ],
  memorials: [
    {
      id: 'study-ux-memorial',
      title: '是否大幅压价清库存抢市场份额',
      summary: '库存压力上升，但压价可能压穿毛利底线。',
      priority: 'urgent',
      status: 'pending',
      petitioner: '上书房',
      reporter: '户部',
      sealDate: '甲申三刻',
      decisionOptions: ['准奏 · 转为圣旨', '询问 · 请丞相补充', '暂缓 · 留中再议'],
      enhancedSuggestion: '建议先让户部测算毛利底线，再让兵部给出竞品压价窗口。',
      citations: [
        { source: '户部预算', snippet: '毛利率低于安全线' },
        { source: '兵部市场', snippet: '竞品正在压价抢渠道' },
      ],
    },
  ],
  fetchedAt: '2026-06-07T00:00:00.000Z',
  sourceMode: 'real',
};

/** 真实任务库不可达时 BFF 返回的兜底骨架：sourceMode=unavailable（missing），FE 必须显式告警。 */
const BRIEFING_UNAVAILABLE = {
  dailyStats: { taskTotal: 1, pendingCount: 1, runningCount: 0, completedToday: 0 },
  chancellorItems: [],
  memorials: [
    {
      id: 'local-memorial-operating-loop',
      title: '打通每日经营闭环',
      summary: '本地兜底奏折。',
      priority: 'urgent',
      status: '待裁决',
      petitioner: '上书房',
      reporter: '丞相',
      sealDate: '甲申三刻',
      decisionOptions: ['准奏', '询问', '暂缓'],
    },
  ],
  fetchedAt: '2026-06-07T00:00:00.000Z',
  sourceMode: 'unavailable',
};

const SHANGSHUFANG_HOME_EMPTY = {
  status: 'ok',
  data: {
    recommended_issue: null,
    pending_decisions: [],
    pending_evidence_tasks: [],
    archive_hints: [],
    source_label: 'FALLBACK',
  },
};

const RECALL_LEDGER_ENTRY = {
  id: 'ledger-study-memory-recall',
  taskId: 'build-chaotang-dev-workbench-mvp-e2e',
  title: '建设朝堂开发工作台 MVP',
  command: '把 /departments/gongbu 打造成工部首页工作台首屏。',
  source: 'gongbu-homepage',
  suggestion: '朝堂开发工作台 MVP 首张真实开工任务卡',
  evidence: ['/departments/gongbu 首屏任务卡', 'E2E: e2e/gongbu-rd-pipeline.spec.ts'],
  ministers: ['工部', '军机处', '史馆'],
  createdAt: '2026-06-07T00:00:00.000Z',
  updatedAt: '2026-06-07T00:05:00.000Z',
  status: 'archived',
  auditTrail: [],
};

const REVIEWING_BUILD_CASE_ENTRY = {
  ...RECALL_LEDGER_ENTRY,
  id: 'ledger-study-build-reviewing',
  taskId: 'build-gongbu-rd-pipeline-e2e',
  title: '建设工部研发生产台',
  command: '把工部建设任务接入军机处复核和史馆归档。',
  source: 'gongbu-rd-pipeline',
  suggestion: '先由军机处复核建设案，再决定是否送史馆归档。',
  evidence: ['/departments/gongbu 研发流水线', 'E2E: e2e/gongbu-rd-pipeline.spec.ts'],
  ministers: ['工部', '军机处', '史馆'],
  status: 'reviewing',
};

const STUDY_RUN_EDICT = {
  run_id: 'edict-genius-design-001',
  source_mode: 'LIVE',
  title: '压价清库存圣旨',
  verdict: '需补证',
  summary: '先测毛利底线，再判断是否压价。',
  departments: [
    {
      dept: 'hubu',
      name: '户部',
      opinion: '测算最低可承受成交价。',
      confidence: 0.91,
      status: 'ready',
      run_id: 'hubu-001',
    },
    {
      dept: 'bingbu',
      name: '兵部',
      opinion: '判断竞品压价窗口。',
      confidence: 0.84,
      status: 'ready',
      run_id: 'bingbu-001',
    },
    {
      dept: 'command-center',
      name: '军机处',
      opinion: '生成 48 小时执行任务卡。',
      confidence: 0.8,
      status: 'queued',
      run_id: 'command-001',
    },
  ],
  evidence: [
    { label: '户部预算', value: '毛利率低于安全线', source: 'budget' },
    { label: '兵部市场', value: '竞品正在压价抢渠道', source: 'market' },
    { label: '史馆召回', value: '历史压价案导致渠道利润下滑', source: 'archive' },
  ],
  risks: ['压价可能换来短期销量，但损害渠道利润和品牌价格锚点。'],
  next_actions: [
    {
      type: 'request_evidence',
      label: '请户部补证',
      target: '/command-center?owner=hubu',
      owner: '户部',
    },
    {
      type: 'dispatch',
      label: '交军机处立项',
      target: '/command-center',
      owner: '军机处',
    },
  ],
  quality_gate: {
    status: 'needs_review',
    score: 0.78,
    reasons: ['毛利底线未核定', '需要人工确认压价边界'],
    human_signoff_required: true,
  },
  created_at: '2026-06-07T00:10:00.000Z',
};

async function mockOrderDecreeFlow(page: Page, taskId = 'ssf_im_confirm_e2e') {
  const state: { draftQuestion?: string; swarmDeepenCalled: boolean } = {
    draftQuestion: undefined,
    swarmDeepenCalled: false,
  };

  await page.route('**/api/court/shangshufang/draft-edict', (route) => {
    const body = route.request().postDataJSON() as { raw_question?: string };
    state.draftQuestion = body.raw_question ?? '';
    const draftEdict = {
      schema_version: 'DraftEdictV1',
      task_id: taskId,
      original_question: state.draftQuestion,
      refined_edict: `请军机处会审：${state.draftQuestion}`,
      decision_type: '经营决策判断',
      known_facts: [`用户原问：${state.draftQuestion}`],
      unknown_gaps: [],
      suggested_perspectives: ['hubu_cfo', 'bingbu_sales'],
      recommended_departments: ['hubu_cfo', 'bingbu_sales'],
      risk_flags: [],
      expected_output: ['圣裁', '分奏', '证据', '风险', '后令', '质门', '来源'],
      expected_memorial_format: ['圣裁', '分奏', '证据', '风险', '后令', '质门', '来源'],
      emperor_confirmation_question: '是否确认发起军机处会审？',
      source_label: 'LIVE',
    };
    return route.fulfill({
      json: {
        success: true,
        data: {
          task_id: taskId,
          loop_trace_id: `loop_${taskId}`,
          status: 'awaiting_emperor_confirm',
          trace_id: `trace_${taskId}`,
          draft_edict: draftEdict,
          archive_hints: [],
          eval_result: { suite: 'e2e', passed: true, score: 1, failed: [] },
        },
      },
    });
  });

  await page.route('**/api/court/shangshufang/confirm-edict', (route) => {
    const originalQuestion = state.draftQuestion ?? '';
    const draftEdict = {
      schema_version: 'DraftEdictV1',
      task_id: taskId,
      original_question: originalQuestion,
      refined_edict: `请军机处会审：${originalQuestion}`,
      decision_type: '经营决策判断',
      known_facts: [`用户原问：${originalQuestion}`],
      unknown_gaps: [],
      suggested_perspectives: ['hubu_cfo', 'bingbu_sales'],
      recommended_departments: ['hubu_cfo', 'bingbu_sales'],
      risk_flags: [],
      expected_output: ['圣裁', '分奏', '证据', '风险', '后令', '质门', '来源'],
      expected_memorial_format: ['圣裁', '分奏', '证据', '风险', '后令', '质门', '来源'],
      emperor_confirmation_question: '是否确认发起军机处会审？',
      source_label: 'LIVE',
    };
    const routingPlan = {
      schema_version: 'ReviewPlanV1',
      task_id: taskId,
      ministry_candidates: ['hubu_cfo', 'bingbu_sales'],
      swarm_plan: [
        { department: '户部', focus: '利润风险', status: 'queued' },
        { department: '兵部', focus: '市场收益', status: 'queued' },
      ],
      route_reason: '需要财务与市场共同会审。',
      source_label: 'LIVE_SWARM',
    };
    const memorial = {
      schema_version: 'MemorialV1',
      task_id: taskId,
      sacred_judgement: '补证',
      executive_summary: '确认后已生成最小奏折，并启动后端蜂群深挖。',
      title: 'IM 下旨圣旨',
      verdict: '补证',
      summary: '先补关键证据，再判断是否执行。',
      draft_edict: draftEdict,
      department_memorials: [],
      evidence_chain: [],
      missing_evidence: [],
      risk_register: [],
      next_order: '请户部与兵部补证。',
      human_confirmation_required: false,
      ministry_outputs: [],
      conflict_summary: [],
      evidence_gaps: [],
      risk_flags: [],
      decision_options: [],
      next_best_action: 'request_evidence',
      source_label: 'LIVE_SWARM',
      quality_gate: {
        schema_version: 'QualityGateResultV1',
        task_id: taskId,
        status: 'pass',
        reasons: ['通过'],
        human_signoff_required: false,
        source_label: 'LIVE_SWARM',
      },
    };
    return route.fulfill({
      json: {
        success: true,
        data: {
          task_id: taskId,
          loop_trace_id: `loop_${taskId}`,
          status: 'reviewing',
          message: '已确认拟旨，最小奏折已生成，等待皇上裁决。',
          review_id: `review_${taskId}`,
          routing_plan: routingPlan,
          memorial,
          review_status_url: `/api/court/shangshufang/tasks/${taskId}/status`,
        },
      },
    });
  });

  await page.route(`**/api/court/shangshufang/tasks/${taskId}/swarm-deepen`, (route) => {
    state.swarmDeepenCalled = true;
    return route.fulfill({
      json: {
        success: true,
        data: {
          task_id: taskId,
          loop_trace_id: `loop_${taskId}`,
          status: 'completed',
          source_label: 'LIVE_SWARM',
          adapter_result: {
            adapter_id: 'jiqun',
            ok: true,
            external_task_id: null,
            external_session_id: null,
            status: 'completed',
            findings: ['后端蜂群已接令'],
            missing_capabilities: [],
            user_visible_summary: '后端蜂群已围绕本案号深挖。',
            source_label: 'LIVE_SWARM',
          },
          swarm_trace_summary: {
            schema_version: 'SwarmTraceV1',
            task_id: taskId,
            trace_id: `trace_swarm_${taskId}`,
            mode: 'live_adapter',
            status: 'completed',
            requested_bundles: [],
            departments: ['hubu_cfo', 'bingbu_sales'],
            findings: ['后端蜂群已接令'],
            missing_capabilities: [],
            user_visible_summary: '后端蜂群已围绕本案号深挖。',
            source_label: 'LIVE_SWARM',
          },
          memorial: null,
          routing_plan: null,
        },
      },
    });
  });

  return state;
}

test.describe('上书房 UX', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('courtos.onboarded', '1');
      window.localStorage.setItem('courtos.first-decree-seeded', '1');
      window.localStorage.removeItem('chaotang:build-ledger:v1');
    });
    imMessagesBySession = {};
    imWrites = [];
    await page.route('**/api/court/shangshufang/briefing**', (route) =>
      route.fulfill({ json: { success: true, data: BRIEFING } }),
    );
    await page.route('**/api/court/shangshufang/home**', (route) =>
      route.fulfill({ json: { success: true, data: SHANGSHUFANG_HOME_EMPTY.data } }),
    );
    await page.route('**/api/build-ledger**', (route) =>
      route.fulfill({ json: { success: true, data: [] } }),
    );
    await page.route('**/api/shangshufang/im**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const sessionId = url.searchParams.get('sessionId') ?? 'default';
      if (request.method() === 'GET') {
        return route.fulfill({ json: { success: true, data: { messages: imMessagesBySession[sessionId] ?? [] } } });
      }
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as { message?: Partial<ImFixtureMessage> };
        const source = body.message ?? {};
        const writeSessionId = typeof source.sessionId === 'string' ? source.sessionId : 'default';
        const sessionMessages = imMessagesBySession[writeSessionId] ?? [];
        const message: ImFixtureMessage = {
          id: `db-im-${sessionMessages.length + 1}`,
          role: source.role === 'assistant' ? 'assistant' : 'user',
          label: typeof source.label === 'string' ? source.label : '陛下',
          text: typeof source.text === 'string' ? source.text : '',
          time: typeof source.time === 'string' ? source.time : '11:17',
          mode: source.mode === 'ask' || source.mode === 'order' || source.mode === 'secret' ? source.mode : null,
          sessionId: writeSessionId,
        };
        imMessagesBySession[writeSessionId] = [...sessionMessages, message];
        imWrites.push(message);
        return route.fulfill({ status: 201, json: { success: true, data: { message } } });
      }
      return route.fulfill({ status: 405, json: { success: false } });
    });
    await page.route('**/api/court/shangshufang/polish-edict', (route) => {
      const body = route.request().postDataJSON() as { raw_question?: string; mode?: 'order' | 'secret' };
      const mode = body.mode === 'secret' ? 'secret' : 'order';
      const raw = body.raw_question ?? '';
      return route.fulfill({
        json: {
          success: true,
          data: {
            mode,
            original_question: raw,
            polished_edict: `${mode === 'secret' ? '密旨' : '圣旨'}润色：${raw}`,
            source_label: 'LIVE',
            audit_id: `polish-${mode}-e2e`,
            fallback_used: false,
          },
        },
      });
    });
    await page.route('**/jiqun/api/swarm/sessions', (route) =>
      route.fulfill({ json: [] }),
    );
    await page.route('**/api/court/orchestrate/all', (route) => {
      const body = route.request().postDataJSON() as { command?: string };
      return route.fulfill({
        json: {
          ok: true,
          secret: true,
          command: body.command,
          decisionId: null,
          jiqunSwarm: {
            ok: true,
            status: 202,
            taskId: 'task-default-swarm-001',
            sessionId: null,
            entrySwarm: 'pack_rd',
            streamUrl: '/chaotang/jiqun/api/runs/stream/task-default-swarm-001',
            message: 'started',
          },
          coverage: {
            responded: ['works'],
            absent: [],
            realExpected: 1,
            realResponded: 1,
          },
          called: ['works'],
          merge: {
            verdict: '后端蜂群已接令。',
            escalateToBoss: false,
            grounded: true,
            leadDept: 'works',
            contributors: [],
            conflicts: [],
          },
        },
      });
    });
  });

  test('右侧问钦天监入口不被全站浮标遮挡', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoStudy(page);

    const qintianAction = page.getByTestId('edict-quick-dock').getByRole('button', { name: '问钦天监' });
    await expect(qintianAction).toBeVisible();

    const floatingClearsQintianAction = async () => {
      const cardBox = await qintianAction.boundingBox();
      const floatingBox = await page.locator('div.fixed.bottom-6.right-6.z-\\[90\\] > div').first().boundingBox();
      if (!cardBox || !floatingBox) return false;
      return (
        floatingBox.x >= cardBox.x + cardBox.width + 8 ||
        floatingBox.x + floatingBox.width <= cardBox.x - 8 ||
        floatingBox.y >= cardBox.y + cardBox.height + 8 ||
        floatingBox.y + floatingBox.height <= cardBox.y - 8
      );
    };

    await expect.poll(floatingClearsQintianAction).toBe(true);
  });

  test('右侧问钦天监图标区域可打开御前 IM', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoStudy(page);
    await expectStudyReady(page);

    const qintianAction = page.getByTestId('edict-quick-dock').getByRole('button', { name: '问钦天监' });
    await expect(qintianAction).toBeVisible();
    const box = await qintianAction.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.click(box!.x + box!.width - 8, box!.y + box!.height / 2);

    await expect(page.locator('[data-three-axis-decree-input]')).toBeVisible();
    await expect(page.getByTestId('decree-im-dialog')).toBeVisible();
    await expect(page.getByTestId('decree-im-dialog')).toContainText('钦天监 IM 对话历史');
    await expect(page.getByTestId('decree-submit')).toContainText('问钦天监');
  });

  test('uploads evidence text into IMA knowledge and exposes it in Shiguan maintenance', async ({ page }) => {
    const docs: Array<{
      id: string;
      title: string;
      filename: string;
      mimeType: string;
      size: number;
      contentChars: number;
      contentExcerpt: string;
      contentHash: string;
      source: string;
      status: 'active' | 'archived';
      lastModified: number;
      createdAt: string;
      updatedAt: string;
      archiveHref: string;
    }> = [
      {
        id: 'ima_evidence_upload_e2e',
        title: 'margin-evidence',
        filename: 'margin-evidence.txt',
        mimeType: 'text/plain',
        size: 96,
        contentChars: 44,
        contentExcerpt: '渠道利润底线：压价不能低于 12%，否则会触发经销商流失。',
        contentHash: 'sha256-e2e',
        source: 'shangshufang_upload',
        status: 'active',
        lastModified: 1780000000000,
        createdAt: '2026-06-24T10:00:00.000Z',
        updatedAt: '2026-06-24T10:00:00.000Z',
        archiveHref: '/shiguan?knowledgeId=ima_evidence_upload_e2e',
      },
    ];
    let uploadedContent = '';
    let polishRaw = '';

    await page.route('**/api/court/ima-knowledge**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as { content?: string; filename?: string };
        uploadedContent = body.content ?? '';
        return route.fulfill({
          status: 201,
          json: { success: true, data: { document: { ...docs[0], filename: body.filename ?? docs[0].filename } } },
        });
      }
      if (request.method() === 'PATCH') {
        const body = request.postDataJSON() as { id?: string; status?: 'active' | 'archived' };
        docs[0] = { ...docs[0], status: body.status ?? docs[0].status, updatedAt: '2026-06-24T10:05:00.000Z' };
        return route.fulfill({ json: { success: true, data: { document: docs[0] } } });
      }
      return route.fulfill({ json: { success: true, data: { documents: docs, count: docs.length } } });
    });
    await page.unroute('**/api/court/shangshufang/polish-edict');
    await page.route('**/api/court/shangshufang/polish-edict', (route) => {
      const body = route.request().postDataJSON() as { raw_question?: string; mode?: 'order' | 'secret' };
      polishRaw = body.raw_question ?? '';
      return route.fulfill({
        json: {
          success: true,
          data: {
            mode: body.mode === 'secret' ? 'secret' : 'order',
            original_question: polishRaw,
            polished_edict: `圣旨润色：${polishRaw}`,
            source_label: 'LIVE',
            audit_id: 'polish-ima-evidence-e2e',
            fallback_used: false,
          },
        },
      });
    });

    await gotoStudy(page);
    await expectStudyReady(page);
    if (!(await page.locator('[data-three-axis-decree-input]').isVisible().catch(() => false))) {
      await page.getByTestId('edict-quick-dock').getByRole('button').first().click();
    }
    await page.getByTestId('decree-mode-order').click();
    await page.getByRole('textbox').fill('请户部会审压价清库存的利润风险。');
    await page.getByTestId('decree-evidence-upload-input').setInputFiles({
      name: 'margin-evidence.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('渠道利润底线：压价不能低于 12%，否则会触发经销商流失。', 'utf8'),
    });

    await expect.poll(() => uploadedContent).toContain('渠道利润底线');
    const chip = page.getByTestId('decree-attachment-chip').filter({ hasText: 'margin-evidence.txt' });
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('IMA');

    await page.getByTestId('decree-submit').click();
    await expect(page.getByTestId('decree-draft-original')).toContainText('【IMA补证附件】');
    await expect(page.getByTestId('decree-draft-original')).toContainText('渠道利润底线');
    await page.getByTestId('decree-polish').click();
    await expect.poll(() => polishRaw).toContain('【IMA补证附件】');
    await expect.poll(() => polishRaw).toContain('渠道利润底线');

    await page.route('**/api/court/chaotang/archive/knowledge/count', (route) =>
      route.fulfill({ json: { success: true, data: { count: 0 } } }),
    );
    await page.route('**/api/court/chaotang/archive', (route) =>
      route.fulfill({ json: { success: true, data: { memorials: [], decisions: [] } } }),
    );
    await page.route('**/api/court/shiguan/stats', (route) =>
      route.fulfill({ json: { totalTasks: 0, totalCases: 0, successRate: 0 } }),
    );
    await page.route('**/api/court/shiguan/archive**', (route) =>
      route.fulfill({ json: { data: [], total: 0 } }),
    );
    await page.route('**/api/court/shiguan/release-gates**', (route) =>
      route.fulfill({ json: { success: true, data: { status: 'ready', latest: null, audit: [] } } }),
    );
    await page.route('**/api/scribe/lessons', (route) =>
      route.fulfill({ json: { lessons: [], count: 0 } }),
    );

    const basePath = process.env.PLAYWRIGHT_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    await page.goto(`${basePath}/shiguan?knowledgeId=ima_evidence_upload_e2e`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('ima-knowledge-panel')).toBeVisible();
    const record = page.getByTestId('ima-knowledge-record').filter({ hasText: 'margin-evidence.txt' });
    await expect(record).toBeVisible();
    await expect(record).toContainText('渠道利润底线');
    await record.getByRole('button').click();
    await expect.poll(() => docs[0].status).toBe('archived');
    await expect(record).toContainText('归档');
  });

  test('首屏给出今日御案、证据和下一站', async ({ page }) => {
    await gotoStudy(page);

    await expect(page.getByTestId('daily-command-card')).toHaveCount(0);
    await expect(page.getByTestId('today-docket-strip')).toHaveCount(0);
    await expect(page.getByTestId('capability-matrix')).toHaveCount(0);
    const stage = page.getByLabel('圣旨展示面板');
    await expect(stage).toBeVisible();
    await expect(stage.getByRole('heading', { name: '奏折' })).toBeVisible();
    await expect(stage).toContainText('是否大幅压价清库存抢市场份额');
    await expect(page.getByTestId('edict-brush-page')).toBeVisible();
    await expect(page.getByTestId('edict-brush-page')).toContainText('奏折正文');
    await page.getByTestId('edict-next-page').evaluate((el) => (el as HTMLButtonElement).click());
    await expect(page.getByTestId('edict-advisory-page')).toBeVisible();
    await expect(page.getByTestId('edict-advisory-page')).toContainText('丞相分析');
    await expect(page.getByTestId('edict-advisory-page')).toContainText('下一步决策建议');
    await expect(page.getByTestId('edict-advisory-page')).toContainText('钦天监分析');
    await expect(page.getByText('先问丞相补判断')).toBeVisible();
    const decreeBar = page.getByLabel('御前对话栏');
    await expect(decreeBar.getByRole('button', { name: '下旨', exact: true })).toBeVisible();
    await expect(decreeBar.getByRole('button', { name: '密旨', exact: true })).toBeVisible();
    await page.getByText('丞相汇总后台').click();
    const chancellorSummary = page.getByTestId('chancellor-summary-system').first();
    await expect(chancellorSummary).toBeVisible();
    await expect(chancellorSummary).toContainText('丞相汇总系统');
    await expect(chancellorSummary).toContainText('丞相代办');
    await expect(chancellorSummary).toContainText('必须圣裁');

    const hubuQueue = page.getByTestId('hubu-memorial-queue').first();
    await expect(hubuQueue).toBeVisible();
    await expect(hubuQueue).toContainText('户部奏折分流');
    await expect(hubuQueue).toContainText('最多 3 件上呈');
    await expect(hubuQueue).toContainText('汇报 2');
    await expect(hubuQueue).toContainText('已办 2');
    await expect(hubuQueue).toContainText('现金流奏折');
    await expect(hubuQueue).toContainText('报价毛利奏折');
    await expect(hubuQueue).toContainText('融资奏折');
    await expect(page.getByTestId('hubu-memorial-cashflow').first()).toContainText('户部');
    await expect(page.getByTestId('hubu-memorial-cashflow').first()).toContainText('丞相审批');
    await expect(hubuQueue).toContainText('汇报 2 · 已办 2 · 明细入后台');
    await expect(page.getByText('丞相今日要务 · 汇报 / 已办 / 待补证').first()).toBeVisible();
    const deepWork = page.getByTestId('qintian-deep-work').first();
    await expect(deepWork).toBeVisible();
    await expect(deepWork).toContainText('专业教学');
    await expect(deepWork).toContainText('大势分析');
    await expect(deepWork).toContainText('预测推演');

    await page.getByTestId('clean-room-toggle').click();
    await expect(page.getByTestId('clean-room-toggle')).toContainText('退出净室');
    await expect(page.getByLabel('圣旨展示面板')).toBeVisible();
    await expect(page.getByLabel('御前对话栏')).toHaveCount(0);
    await expect(page.getByText('丞相今日要务 · 汇报 / 已办 / 待补证')).toHaveCount(0);
    await expect(page.getByTestId('qintian-deep-work')).toHaveCount(0);
    await expect(page.getByText('净室御览 · Esc 退出')).toBeVisible();
    await expect(page.getByTestId('clean-room-action-bar')).toBeVisible();
    await expect(page.getByTestId('clean-room-action-bar')).toContainText('退出净室');
    await expect(page.getByTestId('clean-room-action-bar')).toContainText('准奏 / 裁决');
    await page.getByTestId('clean-room-action-bar').getByRole('button', { name: '准奏 / 裁决' }).click();
    const verdictDialog = page.getByRole('dialog', { name: /裁决：/ });
    await expect(verdictDialog).toBeVisible();
    await expect(verdictDialog).toContainText('朱批裁决');
    await expect(verdictDialog).toContainText('准奏');
    await expect(verdictDialog).toContainText('补证');
    await expect(verdictDialog).toContainText('后果预览');
    await expect(verdictDialog).toContainText('生成圣旨，写入任务裁决');
    await verdictDialog.getByRole('button', { name: '暂缓 · 容朕再想' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('clean-room-toggle')).toContainText('净室');
    await expect(page.getByTestId('clean-room-action-bar')).toHaveCount(0);
    await expect(page.getByLabel('御前对话栏')).toBeVisible();
  });

  test('点击丞相今日要务后中间正文展示蜂群执行报告奏折', async ({ page }) => {
    await gotoStudy(page);
    await expectStudyReady(page);

    const expandScroll = page.getByRole('button', { name: '展卷' }).first();
    if (await expandScroll.isVisible().catch(() => false)) {
      await expandScroll.click();
    }

    const report = page.getByLabel('圣旨展示面板');
    await expect(report).toBeVisible();
    await expect(report.getByRole('heading', { name: '奏折' })).toBeVisible();
    await expect(report.getByRole('region', { name: '90 秒圣裁卡' })).toContainText('丞相裁决');
    const adviceRegion = report.getByRole('region', { name: '建议' });
    await expect(adviceRegion).toBeVisible();
    await expect(adviceRegion.getByText(/建议先让户部测算毛利底线/)).toBeVisible();
    await expect(report.getByRole('button', { name: '附件' })).toBeVisible();
    await expect(report.getByRole('link', { name: '报告' })).toBeVisible();
    await expect(report.getByText('证据包')).toHaveCount(0);
    await expect(report.getByText('返回奏折')).toHaveCount(0);
    await expect(report.getByText('查看庄园蜂群主页')).toHaveCount(0);
    await expect(report.getByRole('button', { name: '准奏' })).toBeVisible();
    await expect(report.getByRole('button', { name: '会审' })).toBeVisible();
    await expect(report.getByRole('button', { name: '批示' })).toBeVisible();
    await expect(report.getByRole('button', { name: '驳回' })).toBeVisible();
    const decisionBox = await report.getByTestId('edict-decision-snap').boundingBox();
    const adviceBox = await report.getByTestId('edict-brush-page').boundingBox();
    expect(decisionBox).not.toBeNull();
    expect(adviceBox).not.toBeNull();
    expect(adviceBox!.height).toBeGreaterThan(decisionBox!.height * 0.95);

    await report.getByRole('link', { name: '报告' }).click();
    await expect(page).toHaveURL(/\/reports\/ssf-report-study-ux-memorial$/);
    await expect(page.getByText('是否大幅压价清库存抢市场份额')).toBeVisible();
  });

  test('左侧已生成奏折进入批示预览后正文只读且不可润色', async ({ page }) => {
    await gotoStudy(page);
    await expectStudyReady(page);

    const expandScroll = page.getByRole('button', { name: '展卷' }).first();
    if (await expandScroll.isVisible().catch(() => false)) {
      await expandScroll.click();
    }

    const report = page.getByRole('region', { name: '奏折' });
    await expect(report.getByRole('heading', { name: '丞相裁决台' })).toBeVisible();
    await report.getByRole('button', { name: '批示' }).click();

    const edict = page.getByLabel('圣旨展示面板');
    await expect(edict.getByRole('heading', { name: '圣旨' })).toBeVisible();
    await expect(edict.getByTestId('decree-draft-original')).toContainText('请户部与兵部会审压价清库存的利润风险与市场收益。');
    await expect(edict.getByText('来自左侧已生成奏折')).toBeVisible();
    await expect(edict.getByTestId('decree-polish')).toBeDisabled();
    await expect(edict.getByTestId('decree-confirm')).toBeDisabled();
    await expect(page.getByLabel('御前对话栏')).toHaveCount(0);
  });

  test('裁决成功后展示落子回执和下一承办', async ({ page }) => {
    const taskBriefing = JSON.parse(JSON.stringify(BRIEFING)) as typeof BRIEFING;
    taskBriefing.memorials[0].id = 'task_receipt_001';
    await page.unroute('**/api/court/shangshufang/briefing**');
    await page.route('**/api/court/shangshufang/briefing**', (route) =>
      route.fulfill({ json: { success: true, data: taskBriefing } }),
    );
    await page.route('**/api/court/shangshufang/tasks/task_receipt_001/decision', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            task_id: 'task_receipt_001',
            decision_id: 'decision_receipt_001',
            status: 'reviewed',
            loop_trace_id: 'loop_trace_receipt_001',
            archive_record: {
              archive_id: 'archive_task_receipt_001',
              task_id: 'task_receipt_001',
              created_at: '2026-06-24T10:00:00.000Z',
              source_label: 'LIVE',
            },
          },
        },
      }),
    );

    await gotoStudy(page);
    await page.getByTestId('clean-room-toggle').click();
    await page.getByTestId('clean-room-action-bar').getByRole('button', { name: '准奏 / 裁决' }).click();
    const verdictDialog = page.getByRole('dialog', { name: /裁决：/ });
    await verdictDialog.getByRole('button', { name: /准奏/ }).click();

    const receipt = page.getByTestId('verdict-receipt');
    await expect(receipt).toBeVisible();
    await expect(receipt).toContainText('落子回执');
    await expect(receipt).toContainText('已落子，组织开始运转');
    await expect(receipt).toContainText('丞相督办');
    await expect(receipt).toContainText('去史馆查看');
    const bossCard = page.getByTestId('boss-action-card');
    await expect(bossCard).toBeVisible();
    await expect(bossCard).toContainText('老板行动卡');
    await expect(bossCard).toContainText('负责人');
    await expect(bossCard).toContainText('下一次回看');
    await expect(bossCard).toContainText('最大风险/缺口');
    const technicalReceipt = page.getByTestId('verdict-technical-receipt');
    await expect(technicalReceipt).toBeVisible();
    await expect(technicalReceipt).toContainText('技术回执');
    await technicalReceipt.click();
    await expect(technicalReceipt).toContainText('任务号：task_receipt_001');
    await expect(technicalReceipt).toContainText('决策号：decision_receipt_001');
    await expect(technicalReceipt).toContainText('Trace：loop_trace_receipt_001');
    await expect(technicalReceipt).toContainText('史馆归档');
    await expect(technicalReceipt).toContainText('军机处');
    await expect(technicalReceipt).toContainText('户部详情');
    await expect(technicalReceipt).toContainText('蜂群现场');

    await receipt.getByTestId('verdict-detail-link').click();
    await expect(page).toHaveURL(/\/shiguan\?from=verdict&taskId=task_receipt_001&archiveId=archive_task_receipt_001/);
  });

  test('驳回奏折只留痕，不归档进入史馆', async ({ page }) => {
    const taskBriefing = JSON.parse(JSON.stringify(BRIEFING)) as typeof BRIEFING;
    taskBriefing.memorials[0].id = 'task_reject_001';
    taskBriefing.memorials[0].decisionOptions = ['批示', '驳回', '询问'];
    let submittedAction: string | undefined;
    await page.unroute('**/api/court/shangshufang/briefing**');
    await page.route('**/api/court/shangshufang/briefing**', (route) =>
      route.fulfill({ json: { success: true, data: taskBriefing } }),
    );
    await page.route('**/api/court/shangshufang/tasks/task_reject_001/decision', (route) => {
      const body = route.request().postDataJSON() as { action?: string };
      submittedAction = body.action;
      return route.fulfill({
        json: {
          success: true,
          data: {
            task_id: 'task_reject_001',
            decision_id: 'decision_reject_001',
            status: 'rejected',
            loop_trace_id: 'loop_trace_reject_001',
            archive_record: null,
          },
        },
      });
    });

    await gotoStudy(page);
    await page.getByTestId('clean-room-toggle').click();
    await page.getByTestId('clean-room-action-bar').getByRole('button', { name: '准奏 / 裁决' }).click();
    const verdictDialog = page.getByRole('dialog', { name: /裁决：/ });
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('驳回原因');
      await dialog.accept('当前证据不足，退回保持原奏折。');
    });
    await verdictDialog.getByRole('button', { name: /驳回/ }).click();

    expect(submittedAction).toBe('reject');
    const receipt = page.getByTestId('verdict-receipt');
    await expect(receipt).toBeVisible();
    await expect(receipt).toContainText('未归档入史馆');
    await expect(receipt).toContainText('奏折保持原位');
    await expect(receipt).toContainText('回军机处查看');
    await expect(receipt).not.toContainText('去史馆复盘');
  });

  test('旨密切换使用丞相今日要务正文区域', async ({ page }) => {
    await gotoStudy(page);
    const decreeBar = page.getByLabel('御前对话栏');
    const input = page.getByRole('textbox');

    await expect(decreeBar.getByRole('button', { name: '问', exact: true })).toHaveCount(0);
    let stage = page.getByLabel('圣旨展示面板');
    await expect(stage.getByRole('heading', { name: '奏折' })).toBeVisible();
    await expect(page.getByText('御前模式')).toHaveCount(0);

    const orderModeButton = decreeBar.getByRole('button', { name: '下旨', exact: true });
    await orderModeButton.click();
    await expect(input).toBeFocused();
    await input.evaluate((el) => (el as HTMLTextAreaElement).blur());
    await expect(input).not.toBeFocused();
    await orderModeButton.click();
    await expect(input).not.toBeFocused();
    stage = page.getByLabel('圣旨展示面板');
    await expect(stage.getByRole('heading', { name: '圣旨' })).toBeVisible();
    await expect(stage.getByTestId('decree-draft-body')).toBeVisible();
    await expect(stage.getByTestId('decree-draft-original')).toContainText('请先在底部输入旨意原文。');
    await expect(page.getByText('御前模式')).toHaveCount(0);

    const secretModeButton = decreeBar.getByRole('button', { name: '密旨', exact: true });
    await secretModeButton.click();
    await expect(input).toBeFocused();
    await input.evaluate((el) => (el as HTMLTextAreaElement).blur());
    await expect(input).not.toBeFocused();
    await secretModeButton.click();
    await expect(input).not.toBeFocused();
    stage = page.getByLabel('圣旨展示面板');
    await expect(stage.getByRole('heading', { name: '密旨' })).toBeVisible();
    await expect(stage.getByTestId('decree-draft-body')).toBeVisible();
    await expect(stage.getByTestId('decree-draft-original')).toContainText('请先在底部输入旨意原文。');
    await expect(page.getByText('御前模式')).toHaveCount(0);
  });

  test('问丞相按钮打开御前 IM，最后问题可转成正式旨意', async ({ page }) => {
    let orchestrateCommand: string | undefined;
    await page.route('**/api/court/orchestrate', (route) => {
      const body = route.request().postDataJSON() as { command?: string };
      orchestrateCommand = body.command;
      return route.fulfill({
        json: {
          ok: true,
          decisionId: null,
          route: { departments: ['finance'], source: 'rule', matched: { finance: ['客户样本'] } },
          called: ['finance'],
          merge: {
            verdict: '建议先灰度上线，并补最大风险清单。',
            escalateToBoss: false,
            grounded: true,
            leadDept: 'finance',
            contributors: [],
            conflicts: [],
          },
        },
      });
    });

    await gotoStudy(page);
    await openWorkbenchAskChancellor(page);
    const decreeBar = page.getByLabel('御前对话栏');

    await expect(decreeBar.getByRole('button', { name: '问', exact: true })).toHaveCount(0);
    await expect(decreeBar).not.toContainText('中书舍人 · 辅政决策');
    await expect(page.getByTestId('workbench-ask-chancellor')).toHaveCount(0);
    await expect(page.getByTestId('workbench-ask-qintian')).toHaveCount(0);

    const im = page.getByTestId('decree-im-dialog');
    await expect(im).toBeVisible();
    await expect(im).toContainText('丞相 IM 对话历史');
    await expect(page.getByTestId('decree-submit')).toContainText('问丞相');

    await page.getByTestId('ssf-ask-input').fill('请判断这个客户样本是否可以上线，并指出最大风险');
    await page.getByTestId('decree-submit').click();

    await expect.poll(() => orchestrateCommand).toBe('请判断这个客户样本是否可以上线，并指出最大风险');
    await expect(im).toContainText('下旨「请判断这个客户样本是否可以上线，并指出最大风险」');
    await expect.poll(() => imWrites.some((message) =>
      message.text.includes('丞相已合议群臣') && message.sessionId === IM_SESSION_CHANCELLOR,
    )).toBe(true);

    await im.getByRole('button', { name: '下旨' }).click();

    await expect.poll(() => imWrites.some((message) =>
      message.text === '下旨「请判断这个客户样本是否可以上线，并指出最大风险」' &&
      message.sessionId === IM_SESSION_CHANCELLOR,
    )).toBe(true);
    await expect(page.getByTestId('ssf-ask-input')).toHaveValue('请判断这个客户样本是否可以上线，并指出最大风险');
    await expect(page.getByTestId('decree-submit')).toContainText('预览圣旨');
  });

  test('问钦天监按钮打开御前 IM，下旨后带最后问题转正式旨意', async ({ page }) => {
    let qintianQuestion: string | undefined;
    await page.route('**/api/qintian/chat', (route) => {
      const body = route.request().postDataJSON() as { message?: string };
      qintianQuestion = body.message;
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: 'data: {"token":"钦天监建议先看三情景。"}\n\ndata: {"done":true}\n\n',
      });
    });

    await gotoStudy(page);
    await openWorkbenchAskQintian(page);
    const decreeBar = page.getByLabel('御前对话栏');

    await expect(decreeBar.getByRole('button', { name: '问', exact: true })).toHaveCount(0);
    await expect(decreeBar).not.toContainText('问钦天监 · 随问随答');
    await expect(decreeBar).not.toContainText('中书舍人 · 辅政决策');
    await expect(page.getByTestId('workbench-ask-qintian')).toHaveCount(0);
    await expect(page.getByTestId('workbench-ask-chancellor')).toHaveCount(0);

    const mentorIm = page.getByTestId('decree-im-dialog');
    await expect(mentorIm).toBeVisible();
    await expect(mentorIm).toContainText('钦天监 IM 对话历史');
    await expect(page.getByTestId('decree-submit')).toContainText('问钦天监');

    await page.getByTestId('ssf-ask-input').fill('未来 90 天压价清库存的风险窗口在哪里？');
    await page.getByTestId('decree-submit').click();
    await expect.poll(() => qintianQuestion).toBe('未来 90 天压价清库存的风险窗口在哪里？');
    await expect(mentorIm).toContainText('钦天监建议先看三情景。');
    await expect(mentorIm).toContainText('下旨「未来 90 天压价清库存的风险窗口在哪里？」');

    await mentorIm.getByRole('button', { name: '下旨' }).click();
    await expect.poll(() => imWrites.some((message) =>
      message.text === '下旨「未来 90 天压价清库存的风险窗口在哪里？」' &&
      message.sessionId === IM_SESSION_MENTOR,
    )).toBe(true);
    await expect(page.getByTestId('ssf-ask-input')).toHaveValue('未来 90 天压价清库存的风险窗口在哪里？');
    await expect(page.getByTestId('decree-submit')).toContainText('预览圣旨');
  });

  test('问丞相和问钦天监分别维护各自 IM 历史', async ({ page }) => {
    imMessagesBySession[IM_SESSION_CHANCELLOR] = [
      {
        id: 'db-im-history-chancellor',
        role: 'assistant',
        label: '丞相',
        text: '丞相历史：先补报价依据。',
        time: '09:10',
        mode: 'ask',
        sessionId: IM_SESSION_CHANCELLOR,
      },
    ];
    imMessagesBySession[IM_SESSION_MENTOR] = [
      {
        id: 'db-im-history-mentor',
        role: 'assistant',
        label: '钦天监',
        text: '钦天监历史：先看三种窗口。',
        time: '09:20',
        mode: 'ask',
        sessionId: IM_SESSION_MENTOR,
      },
    ];

    await gotoStudy(page);
    await openWorkbenchAskChancellor(page);
    const im = page.getByTestId('decree-im-dialog');
    await expect(im).toContainText('丞相 IM 对话历史');
    await expect(im).toContainText('丞相历史：先补报价依据。');
    await expect(im).not.toContainText('钦天监历史：先看三种窗口。');

    await page.getByLabel('关闭御前 IM').click();
    await page.getByTestId('decree-workbench-close').click();
    await expect(page.getByTestId('edict-quick-dock')).toBeVisible();
    await page.getByTestId('edict-quick-dock').getByRole('button', { name: '问钦天监' }).click();
    await expect(im).toContainText('钦天监 IM 对话历史');
    await expect(im).toContainText('钦天监历史：先看三种窗口。');
    await expect(im).not.toContainText('丞相历史：先补报价依据。');
  });

  test('丞相要务为空时点击密按钮仍使用问旨一致的中间正文', async ({ page }) => {
    await page.unroute('**/api/court/shangshufang/briefing**');
    await page.route('**/api/court/shangshufang/briefing**', (route) =>
      route.fulfill({ json: { success: true, data: BRIEFING_UNAVAILABLE } }),
    );
    await gotoStudy(page);
    const decreeBar = page.getByLabel('御前对话栏');

    await expect(decreeBar.getByRole('button', { name: '问', exact: true })).toHaveCount(0);
    let stage = page.getByLabel('圣旨展示面板');
    await expect(stage.getByText('打通每日经营闭环').first()).toBeVisible();
    await expect(stage.getByRole('heading', { name: '奏折' })).toBeVisible();
    await expect(page.getByText('密旨记录')).toHaveCount(0);

    await decreeBar.getByRole('button', { name: '下旨', exact: true }).click();
    stage = page.getByLabel('圣旨展示面板');
    await expect(stage.getByRole('heading', { name: '圣旨' })).toBeVisible();
    await expect(stage.getByTestId('decree-draft-body')).toBeVisible();
    await expect(stage.getByTestId('decree-draft-original')).toContainText('请先在底部输入旨意原文。');
    await expectDraftOriginalAbovePolished(stage);
    await expect(stage.getByRole('heading', { name: '奏折' })).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveAttribute('placeholder', '直接说您的裁决：准、驳回、补证或让谁先办。');
    await expect(page.getByText('密旨记录')).toHaveCount(0);

    await decreeBar.getByRole('button', { name: '密旨', exact: true }).click();
    stage = page.getByLabel('圣旨展示面板');
    await expect(stage.getByRole('heading', { name: '密旨' })).toBeVisible();
    await expect(stage.getByTestId('decree-draft-body')).toBeVisible();
    await expect(stage.getByTestId('decree-draft-original')).toContainText('请先在底部输入旨意原文。');
    await expectDraftOriginalAbovePolished(stage);
    await expect(stage.getByRole('heading', { name: '奏折' })).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveAttribute('placeholder', '密旨直发全蜂群：让各司直陈利弊、冲突与风险。');
    await expect(page.getByText('密旨记录')).toHaveCount(0);
  });

  test('问丞相 IM 展示历史并可继续追问', async ({ page }) => {
    await page.route('**/api/court/orchestrate', (route) =>
      route.fulfill({
        json: {
          ok: true,
          route: { departments: ['finance'], groups: ['finance'] },
          coverage: { responded: ['finance'], absent: [], realExpected: 1, realResponded: 1 },
          called: ['finance'],
          merge: {
            verdict: '建议先请户部补毛利底线，再决定是否压价。',
            escalateToBoss: false,
            grounded: true,
            leadDept: 'finance',
            contributors: [],
            conflicts: [],
          },
        },
      }),
    );
    imMessagesBySession[IM_SESSION_CHANCELLOR] = [
      {
        id: 'db-im-history-1',
        role: 'assistant',
        label: '丞相',
        text: '数据库历史：昨日已提醒先补证。',
        time: '09:30',
        mode: 'ask',
        sessionId: IM_SESSION_CHANCELLOR,
      },
    ];
    await gotoStudy(page);
    await openWorkbenchAskChancellor(page);

    const im = page.getByTestId('decree-im-dialog');
    const decreeBar = page.getByLabel('御前对话栏');
    await expect(decreeBar.getByText('大神逐条过')).toHaveCount(0);
    await expect(decreeBar.getByText('当前事项')).toHaveCount(0);

    await expect(decreeBar.getByRole('button', { name: '问', exact: true })).toHaveCount(0);
    await expect(decreeBar).not.toContainText('中书舍人 · 辅政决策');
    await expect(page.getByTestId('workbench-ask-chancellor')).toHaveCount(0);
    await expect(page.getByTestId('workbench-ask-qintian')).toHaveCount(0);
    await expect(im).toBeVisible();
    await expect(im).toContainText('数据库历史：昨日已提醒先补证。');
    await expect(im).not.toContainText('尚无对话记录');

    // 御前对话记录窗口已移除，对话历史只在统一 IM 弹窗查验
    await expect(page.getByLabel('御前对话记录')).toHaveCount(0);
    await expect(im).toContainText('数据库历史：昨日已提醒先补证。');
    await page.getByTestId('ssf-ask-input').fill('库存压价是否该先问户部？');
    await page.getByTestId('decree-submit').click();

    await expect(im).toContainText('库存压价是否该先问户部？');
    await expect(im).toContainText('丞相已合议群臣');
    await expect.poll(() => imWrites.some((message) =>
      message.text === '库存压价是否该先问户部？' &&
      message.mode === 'ask' &&
      message.sessionId === IM_SESSION_CHANCELLOR,
    )).toBe(true);
    await expect.poll(() => imWrites.some((message) =>
      message.text.includes('丞相已合议群臣') &&
      message.mode === 'ask' &&
      message.sessionId === IM_SESSION_CHANCELLOR,
    )).toBe(true);
  });

  test('按此下旨默认展示圣旨 placeholder，不自动带入今日御案', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await gotoStudy(page);

    await openWorkbench(page);

    await expect(page.getByLabel('御前对话栏').getByText('御前下旨')).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveValue('');
    await expect(page.getByRole('textbox')).toHaveAttribute('placeholder', '直接说您的裁决：准、驳回、补证或让谁先办。');

    await page.screenshot({
      path: 'artifacts/visual-director/shangshufang-launch-desktop.png',
      fullPage: true,
    });
  });

  test('真实任务库不可读时显式告警，不静默冒充真实裁决', async ({ page }) => {
    await page.unroute('**/api/court/shangshufang/briefing**');
    await page.unroute('**/api/court/shangshufang/home**');
    await page.route('**/api/court/shangshufang/briefing**', (route) =>
      route.fulfill({ json: { success: true, data: BRIEFING_UNAVAILABLE } }),
    );
    await page.route('**/api/court/shangshufang/home**', (route) =>
      route.fulfill({ json: { success: true, data: SHANGSHUFANG_HOME_EMPTY.data } }),
    );
    await gotoStudy(page);

    // 顶层 outage 横幅必须出现并劝阻最终裁决。
    const banner = page.getByRole('status').filter({ hasText: '真实任务库暂不可读' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('请勿当作最终裁决');

    // 御案卡的来源标注也应落到降级态，而非冒充真实任务。
    await expect(
      page.getByRole('region', { name: '今日御案' }).getByText('证据 0 条 · 降级建议'),
    ).toBeVisible();
    await expect(page.getByTestId('capability-briefing')).toContainText('FALLBACK');
    await expect(page.getByTestId('capability-briefing')).toContainText('主库不可达');
  });

  test('史馆召回能反哺上书房起草', async ({ page }) => {
    await page.unroute('**/api/build-ledger**');
    await page.route('**/api/build-ledger**', (route) =>
      route.fulfill({ json: { success: true, data: [RECALL_LEDGER_ENTRY] } }),
    );
    await gotoStudy(page);

    const panel = page.getByRole('region', { name: '建设案待办' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('建设朝堂开发工作台 MVP')).toBeVisible();
    await expect(panel.getByText('已入史馆')).toBeVisible();
    await expect(panel.getByRole('link', { name: '去史馆' })).toHaveAttribute(
      'href',
      /\/shiguan\?from=study&taskId=build-chaotang-dev-workbench-mvp-e2e/,
    );

    await panel.getByRole('button', { name: '带入下旨' }).click();
    await expect(page.getByRole('textbox')).toHaveValue(/参考史馆旧案《建设朝堂开发工作台 MVP》/);
  });

  test('工部建设案会回流上书房待办入口', async ({ page }) => {
    await page.unroute('**/api/build-ledger**');
    await page.route('**/api/build-ledger**', (route) =>
      route.fulfill({ json: { success: true, data: [REVIEWING_BUILD_CASE_ENTRY] } }),
    );
    await gotoStudy(page);

    const panel = page.getByRole('region', { name: '建设案待办' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('建设工部研发生产台');
    await expect(panel).toContainText('军机复核中');
    await expect(panel).toContainText('证据 2 条');

    await expect(panel.getByRole('link', { name: '去军机处' })).toHaveAttribute(
      'href',
      /\/command-center\?from=study&taskId=build-gongbu-rd-pipeline-e2e/,
    );
    await expect(panel.getByRole('link', { name: '看工部' })).toHaveAttribute(
      'href',
      /\/departments\/gongbu\?from=study&taskId=build-gongbu-rd-pipeline-e2e/,
    );
  });

  test('正式圣旨先展示问题与润色，确认前不进入拟旨或蜂群', async ({ page }) => {
    let draftCalled = false;
    let orchestrateAllCalled = false;
    await page.route('**/api/court/shangshufang/draft-edict', (route) => {
      draftCalled = true;
      return route.fulfill({ status: 500, json: { success: false, error: 'should wait for confirm' } });
    });
    await page.unroute('**/api/court/orchestrate/all');
    await page.route('**/api/court/orchestrate/all', (route) => {
      orchestrateAllCalled = true;
      return route.fulfill({ status: 500, json: { error: 'should wait for confirm' } });
    });

    await gotoStudy(page);
    const decreeBar = page.getByLabel('御前对话栏');
    await decreeBar.getByRole('button', { name: '下旨', exact: true }).click();
    await page.getByRole('textbox').fill('客户要求正式报价，要不要发？');

    const stage = page.getByLabel('圣旨展示面板');
    await expect(stage.getByRole('heading', { name: '圣旨' })).toBeVisible();
    await expect(stage.getByTestId('decree-draft-polished')).toContainText('客户要求正式报价，要不要发？');
    await expect(stage.getByRole('button', { name: '批示' })).toBeVisible();
    await expect(stage.getByRole('button', { name: '批示' })).toBeDisabled();
    await decreeBar.getByRole('button', { name: '润色' }).click();
    await expect(stage.getByTestId('decree-draft-polished')).toContainText('圣旨润色：客户要求正式报价，要不要发？');
    await expect(stage.getByRole('button', { name: '批示' })).toBeEnabled();
    expect(draftCalled).toBe(false);
    expect(orchestrateAllCalled).toBe(false);
  });

  test('有输入时点击密按钮先展示密旨润色预览', async ({ page }) => {
    let orchestrateAllCalled = false;
    await page.unroute('**/api/court/orchestrate/all');
    await page.route('**/api/court/orchestrate/all', (route) => {
      orchestrateAllCalled = true;
      return route.fulfill({ status: 500, json: { error: 'should wait for confirm' } });
    });

    await gotoStudy(page);
    const decreeBar = page.getByLabel('御前对话栏');
    await page.getByRole('textbox').fill('是否给新官网加一个企业案例入口？');
    await decreeBar.getByRole('button', { name: '密旨', exact: true }).click();

    const stage = page.getByLabel('圣旨展示面板');
    await expect(stage.getByRole('heading', { name: '密奏' })).toBeVisible();
    await expect(stage.getByTestId('decree-draft-polished')).toContainText('是否给新官网加一个企业案例入口？');
    await expect(stage.getByRole('button', { name: '批示' })).toBeVisible();
    await expect(stage.getByRole('button', { name: '批示' })).toBeDisabled();
    await decreeBar.getByRole('button', { name: '润色' }).click();
    await expect(stage.getByTestId('decree-draft-polished')).toContainText('密旨润色：是否给新官网加一个企业案例入口？');
    await expect(stage.getByRole('button', { name: '批示' })).toBeEnabled();
    expect(orchestrateAllCalled).toBe(false);
  });

  test('批示后才进入圣旨拟旨与后端蜂群深挖', async ({ page }) => {
    let draftCalled = false;
    let swarmDeepenCalled = false;
    const draftEdict = {
      schema_version: 'DraftEdictV1',
      task_id: 'ssf_confirm_e2e',
      original_question: '圣旨润色：请户部会审压价清库存的利润风险。',
      refined_edict: '请军机处会审压价清库存的利润风险。',
      decision_type: '经营决策判断',
      known_facts: ['用户原问：请户部会审压价清库存的利润风险。'],
      unknown_gaps: [],
      suggested_perspectives: ['hubu_cfo', 'bingbu_sales'],
      recommended_departments: ['hubu_cfo', 'bingbu_sales'],
      risk_flags: [],
      expected_output: ['圣裁', '分奏', '证据', '风险', '后令', '质门', '来源'],
      expected_memorial_format: ['圣裁', '分奏', '证据', '风险', '后令', '质门', '来源'],
      emperor_confirmation_question: '是否确认发起军机处会审？',
      source_label: 'LIVE',
    };
    const routingPlan = {
      schema_version: 'ReviewPlanV1',
      task_id: 'ssf_confirm_e2e',
      ministry_candidates: ['hubu_cfo', 'bingbu_sales'],
      swarm_plan: [
        { department: '户部', focus: '利润风险', status: 'queued' },
        { department: '兵部', focus: '市场收益', status: 'queued' },
      ],
      route_reason: '压价决策需财务与市场共同会审。',
      source_label: 'LIVE_SWARM',
    };
    const memorial = {
      schema_version: 'MemorialV1',
      task_id: 'ssf_confirm_e2e',
      sacred_judgement: '补证',
      executive_summary: '确认后已生成最小奏折，并启动后端蜂群深挖。',
      title: '压价清库存圣旨',
      verdict: '补证',
      summary: '先测毛利底线，再判断是否压价。',
      draft_edict: draftEdict,
      department_memorials: [],
      evidence_chain: [],
      missing_evidence: [],
      risk_register: [],
      next_order: '请户部补毛利底线，兵部补竞品窗口。',
      human_confirmation_required: false,
      ministry_outputs: [],
      conflict_summary: [],
      evidence_gaps: [],
      risk_flags: [],
      decision_options: [],
      next_best_action: 'request_evidence',
      source_label: 'LIVE_SWARM',
      quality_gate: {
        schema_version: 'QualityGateResultV1',
        task_id: 'ssf_confirm_e2e',
        status: 'pass',
        reasons: ['通过'],
        human_signoff_required: false,
        source_label: 'LIVE_SWARM',
      },
    };

    await page.route('**/api/court/shangshufang/draft-edict', (route) => {
      draftCalled = true;
      return route.fulfill({
        json: {
          success: true,
          data: {
            task_id: 'ssf_confirm_e2e',
            loop_trace_id: 'loop_confirm_e2e',
            status: 'awaiting_emperor_confirm',
            trace_id: 'trace_confirm_e2e',
            draft_edict: draftEdict,
            archive_hints: [],
            eval_result: {
              suite: 'courtos_goal2_shangshufang_draft',
              passed: true,
              score: 1,
              failed: [],
            },
          },
        },
      });
    });
    await page.route('**/api/court/shangshufang/confirm-edict', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            task_id: 'ssf_confirm_e2e',
            loop_trace_id: 'loop_confirm_e2e',
            status: 'reviewing',
            message: '已确认拟旨，最小奏折已生成，等待皇上裁决。',
            review_id: 'review_confirm_e2e',
            routing_plan: routingPlan,
            memorial,
            review_status_url: '/api/court/shangshufang/tasks/ssf_confirm_e2e/status',
          },
        },
      }),
    );
    await page.route('**/api/court/shangshufang/tasks/ssf_confirm_e2e/swarm-deepen', (route) => {
      swarmDeepenCalled = true;
      return route.fulfill({
        json: {
          success: true,
          data: {
            task_id: 'ssf_confirm_e2e',
            loop_trace_id: 'loop_confirm_e2e',
            status: 'completed',
            source_label: 'LIVE_SWARM',
            adapter_result: {
              adapter_id: 'jiqun',
              ok: true,
              external_task_id: null,
              external_session_id: null,
              status: 'completed',
              findings: ['后端蜂群已接令'],
              missing_capabilities: [],
              user_visible_summary: '后端蜂群已围绕本案号深挖。',
              source_label: 'LIVE_SWARM',
            },
            swarm_trace_summary: {
              schema_version: 'SwarmTraceV1',
              task_id: 'ssf_confirm_e2e',
              trace_id: 'trace_swarm_confirm_e2e',
              mode: 'live_adapter',
              status: 'completed',
              requested_bundles: [],
              departments: ['hubu_cfo', 'bingbu_sales'],
              findings: ['后端蜂群已接令'],
              missing_capabilities: [],
              user_visible_summary: '后端蜂群已围绕本案号深挖。',
              source_label: 'LIVE_SWARM',
            },
            memorial,
            routing_plan: routingPlan,
          },
        },
      });
    });

    await page.setViewportSize({ width: 1440, height: 1100 });
    await gotoStudy(page);
    await openWorkbench(page);
    await page.getByLabel('御前对话栏').getByRole('button', { name: '下旨', exact: true }).click();
    await page.getByRole('textbox').fill('请户部会审压价清库存的利润风险。');

    const edict = page.getByLabel('圣旨展示面板');
    await expect(edict.getByRole('heading', { name: '圣旨' })).toBeVisible();
    await expect(edict.getByTestId('decree-draft-polished')).toContainText('请户部会审压价清库存的利润风险。');
    await expect(edict.getByTestId('decree-confirm')).toBeDisabled();
    await page.getByLabel('御前对话栏').getByRole('button', { name: '润色' }).click();
    await expect(edict.getByTestId('decree-draft-polished')).toContainText('圣旨润色：请户部会审压价清库存的利润风险。');
    await expect(edict.getByTestId('decree-confirm')).toBeVisible();
    expect(draftCalled).toBe(false);
    expect(swarmDeepenCalled).toBe(false);

    await edict.getByTestId('decree-confirm').click();
    await expect.poll(() => draftCalled).toBe(true);
    await expect.poll(() => swarmDeepenCalled).toBe(true);
    await expect(edict.getByRole('heading', { name: '奏折' })).toBeVisible();
    await expect(edict).toContainText('补齐关键证据');
    await expect(edict).toContainText('查看状态');
    await expect(page.getByText(/后端蜂群已围绕本案号深挖/).first()).toBeVisible();
  });

  test('密和旨确认后分别展示密旨正文与圣旨会审正文', async ({ page }) => {
    await mockOrderDecreeFlow(page, 'ssf_msxn_risk_e2e');
    await page.unroute('**/api/court/orchestrate/all');
    await page.route('**/api/court/orchestrate/all', (route) => {
      const body = route.request().postDataJSON() as { command?: string };
      return route.fulfill({
        json: {
          ok: true,
          secret: true,
          command: body.command,
          decisionId: 101,
          jiqunSwarm: {
            ok: true,
            status: 202,
            taskId: 'task-msxn-risk-001',
            sessionId: 'session-msxn-risk-001',
            entrySwarm: 'finance_risk',
            streamUrl: '/chaotang/jiqun/api/runs/stream/task-msxn-risk-001',
            message: 'started',
          },
          coverage: {
            responded: ['finance', 'sales'],
            absent: [],
            realExpected: 2,
            realResponded: 2,
          },
          called: ['finance', 'sales'],
          merge: {
            verdict: '铭硕新能 2026 年 6 月财务风险密报：现金流、应收账款和费用确认需重点复核。',
            escalateToBoss: true,
            grounded: true,
            leadDept: 'finance',
            contributors: [
              { name: '户部', answer: '现金流和应收账款风险需复核。' },
              { name: '兵部', answer: '销售回款节奏可能影响 6 月财务表现。' },
            ],
            conflicts: [
              {
                depts: ['户部', '兵部'],
                detail: '户部偏谨慎，兵部偏增长窗口。',
                prior: { lead: '户部', leadCount: 3, total: 5 },
              },
            ],
          },
        },
      });
    });

    await gotoStudy(page);
    await openWorkbench(page);
    const bar = page.getByLabel('御前对话栏');
    const input = page.getByRole('textbox');
    await bar.getByRole('button', { name: '密旨', exact: true }).click();
    await input.fill('请分析铭硕新能2026年6月份的财务风险。');
    const stage = page.getByLabel('圣旨展示面板');
    await stage.getByRole('button', { name: '润色' }).click();
    await expect(stage.getByTestId('decree-draft-polished')).toContainText('密旨润色：请分析铭硕新能2026年6月份的财务风险。');
    await stage.getByTestId('decree-confirm').click();
    await expect(stage.getByRole('heading', { name: '密旨' })).toBeVisible();
    await expect(stage).toContainText('密旨正文');
    await expect(stage).toContainText('蜂群任务执行状态');
    await expect(stage).toContainText('session-msxn-risk-001');
    await expect(stage).not.toContainText('群臣相争 · 伏候圣裁');
    await expect(stage).not.toContainText('準〔户部〕');
    await expect(stage).not.toContainText('御批即焊入判断飞轮');

    await bar.getByRole('button', { name: '下旨', exact: true }).click();
    await input.fill('请分析铭硕新能2026年6月份的财务风险。');
    await stage.getByRole('button', { name: '润色' }).click();
    await expect(stage.getByTestId('decree-draft-polished')).toContainText('圣旨润色：请分析铭硕新能2026年6月份的财务风险。');
    await stage.getByTestId('decree-confirm').click();
    await expect(stage.getByRole('heading', { name: '圣旨' })).toBeVisible();
    await expect(stage).toContainText('蜂群任务执行状态');
    await expect(stage).toContainText('群臣相争 · 伏候圣裁');
    await expect(stage).toContainText('準〔户部〕，準〔兵部〕');
  });

  test('蜂群回奏长正文直接展示并由外层滚动承载', async ({ page }) => {
    const longReturn = Array.from(
      { length: 90 },
      (_, index) =>
        `PACK_SCROLL_LINE_${String(index + 1).padStart(2, '0')}: requirements, pre-sales cost, supplier feasibility, BMS protocol, enclosure, thermal design, validation, and risk controls.`,
    ).join('\n');
    await page.unroute('**/api/court/shangshufang/briefing**');
    await page.route('**/api/court/shangshufang/briefing**', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            ...BRIEFING,
            chancellorItems: [],
            memorials: [],
            dailyStats: { taskTotal: 0, pendingCount: 0, runningCount: 0, completedToday: 0 },
            latestEdictReturn: {
              source: 'jiqun_ai',
              taskId: 'task-scroll-regression',
              jiqunTaskId: 'task-scroll-regression',
              sessionId: 'session-scroll-regression',
              mode: 'secret',
              command: 'scroll regression command',
              savedAt: '2026-06-12T09:58:11.000Z',
              finalOutputs: [],
              edictView: {
                id: 'edict-scroll-regression',
                title: '蜂群密报',
                subtitle: '机密 · 0/4 实司直奏 · 待补全 · 蜂群已回奏',
                meta: { reporter: '蜂群', priority: 'high' },
                rows: [
                  { label: '所议', body: 'scroll regression command' },
                  { label: '蜂群回奏', body: longReturn },
                  { label: '合议', body: 'SCROLL_SENTINEL_BOTTOM_VISIBLE' },
                ],
                seal: 'secret',
              },
            },
          },
        },
      }),
    );

    await page.setViewportSize({ width: 1502, height: 997 });
    await gotoStudy(page);
    await expectStudyReady(page);
    const expandEdict = page.getByRole('button', { name: /展开圣旨/ });
    if (await expandEdict.isVisible()) {
      await expandEdict.click();
    }

    const scroller = page.getByTestId('edict-body-scroll');
    await expect(scroller).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /正文与辅议/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /附件明细/ })).toHaveCount(0);
    await expect(page.getByTestId('edict-decision-snap')).toHaveCount(0);
    await expect(scroller.getByTestId('swarm-return-body')).toContainText('PACK_SCROLL_LINE_01');
    await expect(scroller.getByRole('button', { name: /蜂群回奏/ })).toHaveCount(0);
    await expect(page.getByText('SCROLL_SENTINEL_BOTTOM_VISIBLE')).toHaveCount(0);
    await expect
      .poll(() => scroller.evaluate((node) => node.scrollHeight > node.clientHeight))
      .toBe(true);

    await scroller.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect
      .poll(() => scroller.evaluate((node) => Math.ceil(node.scrollTop + node.clientHeight) >= node.scrollHeight - 1))
      .toBe(true);
    await expect(scroller).toContainText('PACK_SCROLL_LINE_90');
  });

  test('密旨下发后调用蜂群接口，完成会话回流到丞相今日要务', async ({ page }) => {
    let completed = false;
    let swarmCommand: string | undefined;

    await page.unroute('**/jiqun/api/swarm/sessions');
    await page.route('**/jiqun/api/swarm/sessions**', (route) => {
      const url = route.request().url();
      const session = {
        session_id: 'session-pack-rd-001',
        task_input: '建设朝堂开发工作台 MVP',
        status: 'completed',
        release_gate: 'clear',
        swarm_count: 3,
        completed_count: 3,
        start_time: '2026-06-07T00:00:00.000Z',
        end_time: '2026-06-07T00:00:52.000Z',
        duration: '52s',
      };
      if (url.includes('/session-pack-rd-001')) {
        return route.fulfill({
          json: {
            ...session,
            swarm_runs: [],
            graph: { nodes: [], edges: [] },
            events: [],
          },
        });
      }
      return route.fulfill({ json: completed ? [session] : [] });
    });
    await page.unroute('**/api/court/orchestrate/all');
    const fulfillOrchestrateAll = (route: Route) => {
      const body = route.request().postDataJSON() as { command?: string };
      swarmCommand = body.command;
      completed = true;
      return route.fulfill({
        json: {
          ok: true,
          secret: true,
          command: body.command,
          decisionId: null,
          jiqunSwarm: {
            ok: true,
            status: 202,
            taskId: 'task-pack-rd-001',
            sessionId: 'session-pack-rd-001',
            entrySwarm: 'pack_rd',
            streamUrl: '/chaotang/jiqun/api/runs/stream/task-pack-rd-001',
            message: 'started',
          },
          coverage: {
            responded: ['works', 'finance', 'archive'],
            absent: [],
            realExpected: 3,
            realResponded: 3,
          },
          called: ['works', 'finance', 'archive'],
          merge: {
            verdict: '后端蜂群已接令，等待完成后回流丞相今日要务。',
            escalateToBoss: false,
            grounded: true,
            leadDept: 'works',
            contributors: [],
            conflicts: [],
          },
        },
      });
    };
    await page.route('**/api/court/orchestrate/all', fulfillOrchestrateAll);
    await page.route('**/api/court/chaotang/study/run', (route) =>
      route.fulfill({ json: { success: true, data: { edict: STUDY_RUN_EDICT } } }),
    );

    await gotoStudy(page);
    await page.getByLabel('御前对话栏').getByRole('button', { name: '密旨', exact: true }).click();
    await page.getByRole('textbox').fill('建设朝堂开发工作台 MVP');

    const preview = page.getByLabel('圣旨展示面板');
    await expect(preview.getByRole('heading', { name: '密旨' })).toBeVisible();
    await expect(preview.getByTestId('decree-draft-original')).toContainText('建设朝堂开发工作台 MVP');
    await expect(preview.getByRole('button', { name: '批示' })).toBeDisabled();
    await preview.getByRole('button', { name: '润色' }).click();
    await expect(preview.getByTestId('decree-draft-polished')).toContainText('密旨润色：建设朝堂开发工作台 MVP');
    await expect(preview.getByRole('button', { name: '批示' })).toBeVisible();
    expect(swarmCommand).toBeUndefined();

    await preview.getByRole('button', { name: '批示' }).click();
    await expect.poll(() => swarmCommand).toBe('密旨润色：建设朝堂开发工作台 MVP');
    await expect(page.getByText(/后端会话 session-pack-rd-001/).first()).toBeVisible();
    await expect(page.getByText('建设朝堂开发工作台 MVP').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /建设朝堂开发工作台 MVP.*jiqun_ai 蜂群接口/ }).first()).toBeVisible();
  });

  test('蜂群命令即使从发送模式提交也会启动 jiqun_ai 后端蜂群异步任务', async ({ page }) => {
    let requestBody: { command?: string } | null = null;
    let normalOrchestrateCalled = false;
    await page.route('**/api/court/orchestrate', (route) => {
      normalOrchestrateCalled = true;
      return route.fulfill({ status: 502, json: { error: 'should not call normal orchestrate' } });
    });
    await page.route('**/api/court/orchestrate/all', (route) => {
      requestBody = route.request().postDataJSON() as { command?: string };
      return route.fulfill({
        json: {
          ok: true,
          secret: true,
          command: requestBody.command,
          decisionId: 42,
          jiqunSwarm: {
            ok: true,
            status: 202,
            taskId: null,
            sessionId: 'session-pack-rd-001',
            entrySwarm: 'pack_rd',
            streamUrl: null,
            message: 'started',
          },
          promptGuidance: {
            shouldGuide: false,
            trigger: 'none',
            contextBasis: [],
            gaps: [],
            suggestedPrompt: null,
          },
          coverage: {
            responded: ['finance', 'ops', 'legal', 'works'],
            absent: [],
            realExpected: 4,
            realResponded: 4,
          },
          called: ['finance', 'ops', 'legal', 'works'],
          merge: {
            verdict: 'PACK 研发蜂群应先锁定流程瓶颈，再分派工部、户部和兵部补证。',
            escalateToBoss: false,
            grounded: true,
            leadDept: 'works',
            contributors: [
              {
                dept: 'works',
                name: '工部',
                answer: '先复盘 PACK 研发流程的需求、验证、采购和试制四段。',
                confidence: 0.9,
                grounded: true,
                groundingRate: 1,
                conflicts: '',
              },
            ],
            conflicts: [],
          },
        },
      });
    });

    await gotoStudy(page);
    await expect(page.getByTestId('decree-submit')).toContainText('问丞相');
    await page.getByRole('textbox').fill('PACK研发蜂群流程');
    await expect(page.getByTestId('decree-submit')).toContainText('问丞相');
    await page.getByTestId('decree-submit').click();

    const edict = page.getByLabel('圣旨展示面板');
    await expect(edict.getByRole('heading', { name: '密旨' })).toBeVisible();
    await expect(edict.getByTestId('decree-draft-original')).toContainText('PACK研发蜂群流程');
    await expect(edict.getByTestId('decree-draft-polished')).toContainText('密旨润色：PACK研发蜂群流程');
    await expect(edict.getByRole('button', { name: '批示' })).toBeEnabled();
    expect(requestBody).toBeNull();

    await edict.getByRole('button', { name: '批示' }).click();
    await expect.poll(() => requestBody?.command).toBe('密旨润色：PACK研发蜂群流程');
    expect(normalOrchestrateCalled).toBe(false);
    await expect(page.getByText(/后端会话 session-pack-rd-001/).first()).toBeVisible();

    await expect(edict.getByRole('heading', { name: '蜂群密报' })).toBeVisible();
    await expect(edict).toContainText('PACK 研发蜂群应先锁定流程瓶颈');
  });
});

import { expect, test, type Page } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { resolveBasePath } from './helpers/base-path';

const ENABLED = process.env.PACK_SWARM_SHANGSHUFANG_E2E === '1';
const FAKE_JIQUN_PORT = Number(process.env.PACK_SWARM_FAKE_JIQUN_PORT ?? 19082);
const FAKE_JIQUN_BASE_URL = `http://127.0.0.1:${FAKE_JIQUN_PORT}`;
const FAKE_SESSION_ID = '20260701_120000_pack1';

let server: Server | null = null;
const capturedRuns: Array<Record<string, unknown>> = [];

const PACK_PROMPT = [
  '请以 PACK 蜂群为对象，组织户部、工部、锦衣卫、钦天监协同评估：',
  '锦衣卫先采集 PACK 相关客户样本、流程数据、成本数据、交付数据、售后数据和竞品/市场数据；',
  '户部基于数据做预算与估值；工部给出 PACK 蜂群建设方案、模块拆解、资源需求和工期；',
  '钦天监判断战略价值、风险和优先级。若当前锦衣卫缺少采集能力，请先补齐采集清单、数据结构、评分口径和验证方式，再给出最终决策建议。',
].join('');

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeLocalSessionToken(): string {
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({
    user_id: 'e2e-pack-swarm-entry',
    username: 'pack-swarm-entry',
    tenant_slug: 'local',
    role: 'owner',
    exp: '2100-01-01T00:00:00.000Z',
  });
  return `${header}.${payload}.sig`;
}

function cookieOrigins(): string[] {
  const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
  const origins = new Set(['http://localhost:3002', 'http://127.0.0.1:3002']);
  if (configuredBaseUrl) origins.add(new URL(configuredBaseUrl).origin);
  return Array.from(origins);
}

async function seedJwtSession(page: Page): Promise<void> {
  const token = makeLocalSessionToken();
  await page.context().addCookies(cookieOrigins().map((url) => ({
    name: 'courtos.access_token',
    value: token,
    url,
  })));
  await page.addInitScript((accessToken) => {
    window.localStorage.setItem('courtos.auth', JSON.stringify({
      accessToken,
      refreshToken: 'e2e-refresh',
      tenantId: 1,
      username: 'pack-swarm-entry',
      accountType: 0,
      expiresAt: 4102444800000,
    }));
    window.localStorage.setItem('courtos.onboarded', '1');
  }, token);
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
        resolve(typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function startFakeJiqun(): Promise<void> {
  if (server) return Promise.resolve();
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', FAKE_JIQUN_BASE_URL);
    if (req.method === 'POST' && url.pathname === '/api/swarm/run') {
      const body = await readJsonBody(req);
      capturedRuns.push(body);
      sendJson(res, 202, {
        success: true,
        session_id: FAKE_SESSION_ID,
        trace_id: FAKE_SESSION_ID,
        message: 'fake pack swarm accepted',
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/tasks') {
      sendJson(res, 200, {
        recent: [{ task_id: capturedRuns.at(-1)?.task_input ?? 'pack-swarm-task', session_id: FAKE_SESSION_ID }],
        running: [],
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === `/api/swarm/sessions/${FAKE_SESSION_ID}`) {
      sendJson(res, 200, {
        session_id: FAKE_SESSION_ID,
        task_input: capturedRuns.at(-1)?.task_input ?? PACK_PROMPT,
        status: 'completed',
        release_gate: 'blocked',
        swarm_count: 4,
        completed_count: 4,
        start_time: '2026-07-01T12:00:00.000Z',
        end_time: '2026-07-01T12:00:05.000Z',
        duration: '5s',
        swarm_runs: ['jinyiwei', 'hubu', 'gongbu', 'qintianjian'].map((swarm_id) => ({
          swarm_id,
          run_id: `run_${swarm_id}`,
          status: 'completed',
          quality_score: 0.86,
          triggered_by: 'evidence_bound_run',
        })),
        graph: { nodes: [], edges: [] },
        events: [{ event_id: 'evt_pack_completed', topic: 'pack.completed' }],
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/chaotang/tasks/persist') {
      const body = await readJsonBody(req);
      const taskId = String(body.taskId ?? 'pack-swarm-task');
      sendJson(res, 200, { success: true, data: { taskId, id: taskId, status: body.status ?? 'running', result: body.result ?? {} } });
      return;
    }
    sendJson(res, 404, { success: false, error: `fake_jiqun_not_found:${req.method}:${url.pathname}` });
  });
  return new Promise((resolve, reject) => {
    server?.once('error', reject);
    server?.listen(FAKE_JIQUN_PORT, '127.0.0.1', () => resolve());
  });
}

test.describe('PACK swarm Shangshufang entry', () => {
  test.skip(!ENABLED, 'Set PACK_SWARM_SHANGSHUFANG_E2E=1 and JIQUN_API_URL to run this UI flow.');

  test.beforeAll(async () => {
    expect(process.env.JIQUN_API_URL).toBe(FAKE_JIQUN_BASE_URL);
    await startFakeJiqun();
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()) ?? resolve());
    server = null;
    capturedRuns.length = 0;
  });

  test('uses real Shangshufang order button to run PACK four-department loop', async ({ page }) => {
    test.setTimeout(180_000);
    await seedJwtSession(page);

    await page.goto(`${await resolveBasePath(page.request)}/court-briefing`, { waitUntil: 'domcontentloaded' });
    const decreeInput = page.getByTestId('ssf-ask-input').last();
    const orderButton = page.getByTestId('decree-mode-order').last();
    const submitButton = page.getByTestId('decree-submit').last();
    await expect(decreeInput).toBeVisible({ timeout: 30_000 });

    await orderButton.click();
    await decreeInput.fill(PACK_PROMPT);
    await submitButton.click();

    const edictStage = page.getByTestId('edict-stage');
    await expect(edictStage).toContainText('蜂群任务执行状态', { timeout: 90_000 });
    await expect(edictStage).toContainText('户部预算台账');

    const status = page.getByRole('status').filter({ hasText: 'PACK 蜂群闭环已生成' });
    await expect(status).toContainText('锦衣卫采集清单', { timeout: 90_000 });
    await expect(status).toContainText('户部');
    await expect(status).toContainText('工部');
    await expect(status).toContainText('钦天监');

    if (capturedRuns[0]) {
      expect(capturedRuns[0]).toMatchObject({
        entry_swarm: 'pack_rd',
      });
      expect(['MIXED', 'FALLBACK']).toContain(capturedRuns[0].source_label);
      expect(capturedRuns[0].courtos_departments).toEqual(expect.arrayContaining(['jinyiwei', 'hubu', 'gongbu', 'qintianjian']));
      expect(capturedRuns[0].courtos_swarm_bundles).toEqual(expect.arrayContaining([
        'jinyiwei_pack_collection',
        'hubu_pack_budget_valuation',
        'gongbu_pack_build_plan',
        'qintianjian_pack_strategy_risk',
      ]));
      const evidenceBoundRun = capturedRuns[0].evidence_bound_run as { missing_evidence?: string[] } | undefined;
      expect(evidenceBoundRun?.missing_evidence).toEqual(expect.arrayContaining([
        expect.stringContaining('customer_samples'),
        expect.stringContaining('scoring_rubric'),
        expect.stringContaining('validation_method'),
      ]));
    }

    const projectsRes = await page.request.get(`${await resolveBasePath(page.request)}/api/court/hubu/projects`);
    expect(projectsRes.ok()).toBeTruthy();
    const projectsJson = (await projectsRes.json()) as { data?: Array<Record<string, unknown>> };
    const packBudget = (projectsJson.data ?? []).find((item) =>
      String(item.id ?? '').startsWith('pack-swarm-budget-') &&
      String(item.title ?? '').includes('PACK')
    );
    expect(packBudget).toBeTruthy();
    expect(packBudget).toMatchObject({
      target_dept: 'PACK 蜂群',
      owner_dept: '户部',
      priority: 'P0',
    });
    expect(String(packBudget?.requested_budget ?? '')).toContain('待核算');

    await page.goto(`${await resolveBasePath(page.request)}/departments/finance`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/今日待陛下拍板/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /PACK 蜂群建设预算与估值台账/ }).first()).toBeVisible({ timeout: 30_000 });
  });
});

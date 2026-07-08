import { expect, test, type Page } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { resolveBasePath } from './helpers/base-path';

const ENABLED = process.env.FINANCE_INTEL_LOOP_UI === '1';
const FAKE_JIQUN_PORT = Number(process.env.FINANCE_INTEL_LOOP_FAKE_JIQUN_PORT ?? 19081);
const FAKE_JIQUN_BASE_URL = `http://127.0.0.1:${FAKE_JIQUN_PORT}`;
const FAKE_SESSION_ID = '20260701_120000_financeui';

let server: Server | null = null;
const capturedRuns: Array<Record<string, unknown>> = [];

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeLocalSessionToken(): string {
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({
    user_id: 'e2e-finance-intel-loop-ui',
    username: 'finance-loop-ui',
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
      username: 'finance-loop-ui',
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
        message: 'fake finance loop accepted',
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === `/api/swarm/sessions/${FAKE_SESSION_ID}`) {
      sendJson(res, 200, {
        session_id: FAKE_SESSION_ID,
        task_input: capturedRuns.at(-1)?.task_input ?? 'AAPL valuation UI smoke',
        status: 'completed',
        release_gate: 'clear',
        swarm_count: 1,
        completed_count: 1,
        start_time: '2026-07-01T12:00:00.000Z',
        end_time: '2026-07-01T12:00:03.000Z',
        duration: '3s',
        swarm_runs: [{
          swarm_id: 'finance',
          run_id: 'run_finance_ui',
          status: 'completed',
          quality_score: 0.92,
          triggered_by: 'evidence_bound_run',
        }],
        graph: {
          nodes: [{ id: 'finance', swarm_id: 'finance', run_id: 'run_finance_ui', status: 'completed' }],
          edges: [],
        },
        events: [{ event_id: 'evt_finance_ui', topic: 'finance.completed' }],
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/tasks') {
      sendJson(res, 200, { recent: [], running: [] });
      return;
    }
    if (req.method === 'PATCH' && url.pathname.startsWith('/api/chaotang/tasks/')) {
      const taskId = decodeURIComponent(url.pathname.split('/')[4] ?? 'task_finance_ui');
      const body = await readJsonBody(req);
      sendJson(res, 200, {
        success: true,
        data: {
          taskId,
          id: taskId,
          title: body.title ?? 'finance loop ui task',
          rawCommand: body.command ?? 'AAPL valuation UI smoke',
          status: body.status ?? 'report_ready',
          mode: body.mode ?? 'hybrid',
          progressPct: 100,
          result: body.result ?? {},
        },
      });
      return;
    }
    sendJson(res, 404, { success: false, error: `fake_jiqun_not_found:${req.method}:${url.pathname}` });
  });
  return new Promise((resolve, reject) => {
    server?.once('error', reject);
    server?.listen(FAKE_JIQUN_PORT, '127.0.0.1', () => resolve());
  });
}

test.describe('finance intel loop UI', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!ENABLED, 'Set FINANCE_INTEL_LOOP_UI=1 and JIQUN_API_URL to run this UI closed-loop smoke.');

  test.beforeAll(async () => {
    expect(process.env.JIQUN_API_URL).toBe(FAKE_JIQUN_BASE_URL);
    await startFakeJiqun();
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()) ?? resolve());
    server = null;
    capturedRuns.length = 0;
  });

  test('court briefing decree input completes public and secret finance intel loops', async ({ page }) => {
    test.setTimeout(180_000);
    await seedJwtSession(page);

    await page.goto(`${await resolveBasePath(page.request)}/court-briefing`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('ssf-ask-input').last()).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('decree-mode-order').last().click();
    await page.getByTestId('ssf-ask-input').last().fill('用 SEC 官方来源评估 AAPL 当前估值是否合理，只做内部观察，不给买卖建议。');
    await page.getByTestId('decree-submit').last().click();

    await expect(page.getByText('finance-intel-loop 已走完')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText('锦衣卫取证', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/户部/).first()).toBeVisible();
    await expect(page.getByText(/史馆归档/).first()).toBeVisible();
    await expect(page.getByText('https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json')).toBeVisible();
    if (capturedRuns[0]) {
      expect(capturedRuns[0]).toMatchObject({
        entry_swarm: 'finance',
        source_label: 'LIVE',
      });
      expect((capturedRuns[0].intelligence_pack as { sourceUrls?: string[] } | undefined)?.sourceUrls).toEqual(expect.arrayContaining([
        'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json',
        'https://data.sec.gov/submissions/CIK0000320193.json',
      ]));
    }

    await page.getByTestId('decree-mode-secret').last().click();
    await page.getByTestId('ssf-ask-input').last().fill('用 SEC 官方来源评估 MSFT 当前估值风险，只做内部观察，不给买卖建议。');
    await page.getByTestId('decree-submit').last().click();

    await expect(page.getByText('finance-intel-loop 已走完')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId('decree-mode-secret').last()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json')).toBeVisible();
    await page.getByText('查看归档 / 案件链路').last().click();
    await expect(page).toHaveURL(/\/finance-intel-loop\//, { timeout: 30_000 });
    await expect(page.getByTestId('finance-loop-case-timeline')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('上书房立案')).toBeVisible();
    await expect(page.getByText('锦衣卫取证')).toBeVisible();
    await expect(page.getByText('户部测算奏折')).toBeVisible();
    await expect(page.getByText('上书房裁决')).toBeVisible();
    await expect(page.getByText('执行复命')).toBeVisible();
    await expect(page.getByText('史馆归档')).toBeVisible();
    if (capturedRuns[1]) {
      expect((capturedRuns[1].intelligence_pack as { sourceUrls?: string[] } | undefined)?.sourceUrls).toEqual(expect.arrayContaining([
        'https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json',
        'https://data.sec.gov/submissions/CIK0000789019.json',
      ]));
    }
  });

  test('court briefing decree input stops on missing evidence and does not present archive success', async ({ page }) => {
    test.setTimeout(90_000);
    await seedJwtSession(page);
    await page.route('**/api/court/shangshufang/finance-intel-loop/complete', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            done: false,
            stage: 'hubu_memorial',
            blockedAt: 'hubu_memorial',
            error: 'evidence_pack_missing',
            edictMode: 'public',
            issueId: 'issue_missing_evidence_ui',
            taskId: 'task_missing_evidence_ui',
            sourceUrls: [],
            timeline: [
              { key: 'issue', label: '上书房立案', status: 'done' },
              { key: 'intel', label: '锦衣卫取证', status: 'done' },
              { key: 'hubu', label: '户部测算奏折', status: 'blocked' },
            ],
          },
        }),
      });
    });

    await page.goto(`${await resolveBasePath(page.request)}/court-briefing`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('ssf-ask-input').last()).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('decree-mode-order').last().click();
    await page.getByTestId('ssf-ask-input').last().fill('用 SEC 官方来源评估 ZZZZZ 当前估值是否合理，只做内部观察，不给买卖建议。');
    await page.getByTestId('decree-submit').last().click();

    await expect(page.getByText('finance-intel-loop 已暂停')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('需补证 / 不可放行').first()).toBeVisible();
    await expect(page.getByText('需补证：尚未挂载 SEC 官方来源链接')).toBeVisible();
    await expect(page.getByText('查看归档 / 案件链路')).toHaveCount(0);
    await page.getByText('去锦衣卫补证').last().click();
    await expect(page).toHaveURL(/\/intel$/, { timeout: 30_000 });
  });
});

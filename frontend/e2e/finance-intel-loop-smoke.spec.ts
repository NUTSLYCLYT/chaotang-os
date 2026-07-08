import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { resolveBasePath } from './helpers/base-path';

const ENABLED = process.env.FINANCE_INTEL_LOOP_SMOKE === '1';
const USE_FAKE_JIQUN = process.env.FINANCE_INTEL_LOOP_FAKE_JIQUN === '1';
const FAKE_JIQUN_PORT = Number(process.env.FINANCE_INTEL_LOOP_FAKE_JIQUN_PORT ?? 19081);
const FAKE_JIQUN_BASE_URL = `http://127.0.0.1:${FAKE_JIQUN_PORT}`;
const FAKE_SESSION_ID = '20260628_120000_finance1';

interface CapturedRun {
  task_input?: string;
  entry_swarm?: string;
  evidence_bound_run?: Record<string, unknown>;
  source_label?: string;
}

let server: Server | null = null;
const capturedRuns: CapturedRun[] = [];

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeLocalSessionToken(): string {
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({
    user_id: 'e2e-finance-intel-loop',
    username: 'finance-smoke',
    tenant_slug: 'local',
    role: 'owner',
    exp: '2100-01-01T00:00:00.000Z',
  });
  return `${header}.${payload}.sig`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
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
      username: 'finance-smoke',
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
        message: 'fake jiqun finance swarm accepted',
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/tasks') {
      sendJson(res, 200, {
        recent: [{ task_id: capturedRuns.at(-1)?.task_input ?? 'finance-smoke-task', session_id: FAKE_SESSION_ID }],
        running: [],
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === `/api/swarm/sessions/${FAKE_SESSION_ID}`) {
      sendJson(res, 200, {
        session_id: FAKE_SESSION_ID,
        task_input: capturedRuns.at(-1)?.task_input ?? 'AAPL valuation smoke',
        status: 'completed',
        release_gate: 'clear',
        swarm_count: 1,
        completed_count: 1,
        start_time: '2026-06-28T12:00:00.000Z',
        end_time: '2026-06-28T12:00:03.000Z',
        duration: '3s',
        swarm_runs: [{
          swarm_id: 'finance',
          run_id: 'run_finance_smoke',
          status: 'completed',
          quality_score: 0.91,
          triggered_by: 'evidence_bound_run',
          task_input: capturedRuns.at(-1)?.task_input ?? 'AAPL valuation smoke',
        }],
        graph: {
          nodes: [{ id: 'finance', swarm_id: 'finance', run_id: 'run_finance_smoke', status: 'completed', quality_score: 0.91, triggered_by: 'evidence_bound_run' }],
          edges: [],
        },
        events: [{ event_id: 'evt_finance_smoke', topic: 'finance.completed' }],
      });
      return;
    }
    if (req.method === 'PATCH' && url.pathname.startsWith('/api/chaotang/tasks/')) {
      const taskId = decodeURIComponent(url.pathname.split('/')[4] ?? 'task_finance_smoke');
      const body = await readJsonBody(req);
      sendJson(res, 200, {
        success: true,
        data: {
          taskId,
          id: taskId,
          title: body.title ?? 'finance smoke task',
          rawCommand: body.command ?? 'AAPL valuation smoke',
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

async function postJson(request: APIRequestContext, path: string, data: Record<string, unknown>) {
  const response = await request.post(`${await resolveBasePath(request)}${path}`, { data });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  expect(response.ok(), `${path} failed: ${response.status()} ${JSON.stringify(payload)}`).toBeTruthy();
  expect(payload?.success, `${path} did not return success`).toBe(true);
  return payload?.data as Record<string, unknown>;
}

async function postJsonEventually(
  request: APIRequestContext,
  path: string,
  data: Record<string, unknown>,
  options: { timeoutMs?: number; intervalMs?: number } = {},
) {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const intervalMs = options.intervalMs ?? 3_000;
  const started = Date.now();
  let lastPayload: unknown = null;
  let lastStatus = 0;
  while (Date.now() - started < timeoutMs) {
    const response = await request.post(`${await resolveBasePath(request)}${path}`, { data });
    lastStatus = response.status();
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    lastPayload = payload;
    if (response.ok() && payload?.success === true) return payload.data as Record<string, unknown>;
    if (response.status() !== 409 || payload?.error !== 'session_not_terminal') break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  expect(false, `${path} did not become ready: ${lastStatus} ${JSON.stringify(lastPayload)}`).toBeTruthy();
  return {} as Record<string, unknown>;
}

test.describe('finance intel loop smoke', () => {
  test.skip(!ENABLED, 'Set FINANCE_INTEL_LOOP_SMOKE=1 to run the live URL + fake jiqun closed-loop smoke.');

  test.beforeAll(async () => {
    if (!USE_FAKE_JIQUN) return;
    expect(process.env.JIQUN_API_URL, 'Playwright webServer must inherit JIQUN_API_URL when FINANCE_INTEL_LOOP_FAKE_JIQUN=1').toBe(FAKE_JIQUN_BASE_URL);
    await startFakeJiqun();
  });

  test.afterAll(async () => {
    if (!USE_FAKE_JIQUN) return;
    await new Promise<void>((resolve) => server?.close(() => resolve()) ?? resolve());
    server = null;
    capturedRuns.length = 0;
  });

  test('AAPL SEC URL -> Hu Bu swarm -> memorial -> brief -> decision -> execution -> return report -> archive', async ({ page }) => {
    test.setTimeout(300_000);
    await seedJwtSession(page);

    const loop = await postJson(page.request, '/api/court/shangshufang/finance-intel-loop', {
      ticker: 'AAPL',
      market: 'US',
      question: 'Evaluate whether AAPL valuation is reasonable using public SEC sources only.',
    });
    expect(loop.issueId).toMatch(/^issue_/);
    expect(loop.signalId).toBe(`intel_fin_aapl_${todayKey()}`);
    expect(loop.taskId).toMatch(/^task_intel_/);
    expect(loop.routeId).toMatch(/^intel_route_/);
    if (USE_FAKE_JIQUN) {
      expect(loop.sessionId).toBe(FAKE_SESSION_ID);
    } else {
      expect(loop.sessionId).toBeTruthy();
    }
    expect(loop.sourceLabel).toBe('LIVE_SWARM');
    expect(loop.evidenceBoundRun).toMatchObject({
      entry_swarm: 'finance',
      source_label: 'LIVE',
    });

    if (USE_FAKE_JIQUN) {
      expect(capturedRuns).toHaveLength(1);
      expect(capturedRuns[0]).toMatchObject({
        entry_swarm: 'finance',
        source_label: 'LIVE',
      });
      expect(capturedRuns[0]?.evidence_bound_run).toMatchObject({
        entry_swarm: 'finance',
        source_label: 'LIVE',
      });
      expect((capturedRuns[0] as Record<string, unknown>).intelligence_pack).toMatchObject({
        sourceUrls: expect.arrayContaining([
          'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json',
          'https://data.sec.gov/submissions/CIK0000320193.json',
        ]),
      });
    }

    const memorial = await postJsonEventually(page.request, '/api/court/hubu/memorials/from-swarm', {
      taskId: loop.taskId,
      sessionId: loop.sessionId,
      routeId: loop.routeId,
    }, { timeoutMs: USE_FAKE_JIQUN ? 15_000 : 120_000 });
    expect(memorial.memorialId).toMatch(/^memorial_/);
    const memorialBody = memorial.memorial as Record<string, unknown>;
    expect(memorialBody.department).toBe('hu_bu');
    expect(memorialBody.nonAdviceDisclaimer).toBe(true);
    expect(memorialBody.sourceUrls).toEqual(expect.arrayContaining([
      'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json',
      'https://data.sec.gov/submissions/CIK0000320193.json',
    ]));

    const brief = await postJson(page.request, '/api/court/shangshufang/briefs/from-memorial', {
      taskId: loop.taskId,
      issueId: loop.issueId,
      memorialIds: [memorial.memorialId],
      evidencePackId: `pack_${loop.routeId}`,
    });
    expect(brief.briefId).toMatch(/^brief_/);
    expect(brief.status).toBe('awaiting_authorized_decision');

    const decision = await postJson(page.request, `/api/court/shangshufang/briefs/${String(brief.briefId)}/decision`, {
      decision: 'issue_decree',
      reason: 'Adopt Hu Bu memorial for internal watchlist only; no trade or external commitment is authorized.',
      executionType: 'create_watchlist',
      authorityLevel: 'approver',
      actorRole: 'owner',
    });
    expect(decision.instructionId).toMatch(/^instruction_/);
    expect(decision.instructionType).toBe('decree');

    const execution = await postJson(page.request, `/api/court/instructions/${String(decision.instructionId)}/execute`, {});
    expect(execution.executionRunId).toMatch(/^exec_/);
    expect(execution.result).toMatchObject({
      executionType: 'create_watchlist',
      noRealTradeAuthorized: true,
    });

    const returned = await postJson(page.request, `/api/court/instructions/${String(decision.instructionId)}/return-report`, {
      executionRunId: execution.executionRunId,
      result: {
        done: true,
        summary: 'AAPL watchlist created and bound to SEC EDGAR source URLs.',
        nextReviewAt: '2026-07-28T00:00:00.000Z',
      },
    });
    expect(returned.status).toBe('return_report_ready');

    const archive = await postJson(page.request, '/api/court/archive/from-task', {
      taskId: loop.taskId,
      outcome: 'watchlist_created',
      lessons: ['SEC EDGAR URLs must remain attached through archive.'],
    });
    expect(archive.archiveId).toMatch(/^archive_/);
    const archiveBody = archive.archive as Record<string, unknown>;
    expect(archiveBody.outcome).toBe('watchlist_created');
    expect(archiveBody.sourceUrls).toEqual(expect.arrayContaining([
      'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json',
      'https://data.sec.gov/submissions/CIK0000320193.json',
    ]));
    expect(archiveBody.issue).toMatchObject({ ticker: 'AAPL' });
    expect(Array.isArray(archiveBody.evidencePacks)).toBe(true);
    expect(Array.isArray(archiveBody.memorials)).toBe(true);
    expect(Array.isArray(archiveBody.executionRuns)).toBe(true);
    expect(archiveBody.decisionBrief).toBeTruthy();
    expect(archiveBody.instruction).toBeTruthy();
  });
});

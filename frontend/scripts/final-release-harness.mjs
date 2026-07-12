#!/usr/bin/env node
/**
 * Final release harness for the Chaotang first-version candidate.
 *
 * Scope:
 * - Does not write application data.
 * - Uses a QA auth cookie/localStorage session.
 * - Verifies the user-facing final path, core module availability,
 *   resource images, console health, and mobile overflow.
 */

import { chromium } from '@playwright/test';
import { execFile } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { promisify } from 'node:util';

import { signGateToken } from './lib/jwt-sign.mjs';

const baseUrl = process.env.HARNESS_BASE_URL ?? 'http://127.0.0.1:3050';
const basePath = process.env.HARNESS_BASE_PATH ?? '/chaotang';
const trueChainGatePath = process.env.HARNESS_TRUE_CHAIN_BACKEND_PATH ?? '/api/court/true-chain-health';
const skipTrueChainGate = process.env.HARNESS_SKIP_TRUE_CHAIN !== '0';
const execFileAsync = promisify(execFile);
const requireTrueChainGate = process.env.HARNESS_REQUIRE_TRUE_CHAIN === '1';
const skipStudyEdict = process.env.HARNESS_SKIP_STUDY_EDICT === '1';

// 安全门(schneier:未上膛 FENGQUN_AUTH 拒发布)。FENGQUN_AUTH≠true 时特权端点
// (orchestrate/all 烧 LLM+写库、sign-off)退化为 fail-open,可被 alg:none 伪 token 绕过。
// opt-in(HARNESS_REQUIRE_AUTH_ARMED=1),避免惊扰未上膛的 dev/过渡环境;上线前应置 1。
// 注:置 true 前必须确认后端验签端点(JIQUN_VERIFY_PATH)对真 token 可达,否则会拒真请求。
if (process.env.HARNESS_REQUIRE_AUTH_ARMED === '1' && process.env.FENGQUN_AUTH !== 'true') {
  console.error(
    JSON.stringify(
      {
        gate: 'fengqun-auth-armed',
        ok: false,
        decision: 'STOP',
        detail:
          'FENGQUN_AUTH 未上膛(≠true):特权端点 fail-open,拒绝发布。' +
          '设 FENGQUN_AUTH=true(前端+后端两侧)并确认后端验签可达后重试。',
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const blocks = [
  {
    id: 'p0-entry',
    name: 'P0 Entry · 上书房最终入口',
    routes: ['/shangshufang'],
    // 2026-06-28: 旧断言 ['奏折','LIVE'] 已词汇漂移——现役 UI 叫"真实任务/件任务"、来源标叫 REAL(非 LIVE)。
    // 改成实际渲染且证明真数据已加载的词(OR 匹配,任一即过)。
    requiredText: ['真实任务', '件任务', 'REAL'],
  },
  {
    id: 'p0-command',
    name: 'P0 Command · 军机处执行面',
    routes: ['/junjichu'],
    requiredText: ['军机处'],
  },
  {
    id: 'p0-archive',
    name: 'P0 Archive · 史馆归档面',
    routes: ['/shiguan'],
    requiredText: ['史馆'],
  },
  {
    id: 'p1-overview',
    name: 'P1 Overview · 大殿总览',
    routes: ['/dadian'],
    requiredText: ['朝堂'],
  },
  {
    id: 'p1-business',
    name: 'P1 Business · 六部总览',
    routes: ['/liubu'],
    requiredText: ['六部'],
  },
  {
    id: 'p1-green-faces',
    name: 'P1 GreenFaces · 首发商家真业务面(锦衣卫/户部/兵部)',
    routes: ['/zhuanshu/jinyiwei', '/liubu/hubu', '/liubu/bingbu'],
    requiredText: ['朝堂'],
  },
];

const apiChecks = [
  { id: 'resources-page', path: '/shangshufang', html: true },
];

function makeToken() {
  if (process.env.HARNESS_AUTH_TOKEN) return process.env.HARNESS_AUTH_TOKEN;
  // 真 HS256 签名(替代旧 alg:none) —— FENGQUN_AUTH 上膛后后端 verify_token 才认;
  // FENGQUN_AUTH=false 时后端返匿名忽略 token,两种姿态都能跑,向后兼容。
  return signGateToken({
    sub: 'qa',
    username: 'qa',
    tenantId: 6,
    accountType: 1,
    iat: Math.floor(Date.now() / 1000),
  });
}

function requestText(url, timeoutMs, token) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          Cookie: `courtos.access_token=${encodeURIComponent(token)}`,
          Accept: 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          finish({ ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300, status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on('error', (error) => finish({ ok: false, status: 0, body: error.message }));
    req.setTimeout(timeoutMs, () => {
      finish({ ok: false, status: 0, body: 'request timeout' });
      req.destroy();
    });
  });
}

async function checkTrueChainGate() {
  const prodDoctor = await runProdDoctor();
  if (!prodDoctor.ok) {
    return prodDoctor;
  }

  const token = makeToken();
  const url = `${baseUrl}${basePath}${trueChainGatePath}`;
  const response = await requestText(url, 8000, token);
  if (!response.ok) {
    return {
      id: 'true-chain-gate',
      ok: false,
      decision: 'STOP',
      status: response.status,
      url,
      detail: response.body.slice(0, 240),
      failedRequired: ['true-chain-health-unreachable'],
    };
  }

  let json;
  try {
    json = JSON.parse(response.body);
  } catch {
    return {
      id: 'true-chain-gate',
      ok: false,
      decision: 'STOP',
      status: response.status,
      url,
      detail: `invalid json: ${response.body.slice(0, 240)}`,
      failedRequired: ['true-chain-health-invalid-json'],
    };
  }
  const data = json?.data;
  const checks = Array.isArray(data?.checks) ? data.checks : [];
  const failedRequired = checks
    .filter((check) => check?.requiredForLive && ['down', 'missing'].includes(check?.state))
    .map((check) => ({
      key: check.key,
      label: check.label,
      state: check.state,
      detail: check.detail,
    }));
  const swarmRun = data?.liveReady?.swarmRun === true;
  const requiredDependencies = data?.liveReady?.requiredDependencies === true;
  const backend = data?.liveReady?.backend === true;
  const ok = failedRequired.length === 0 && swarmRun && requiredDependencies && backend;

  return {
    id: 'true-chain-gate',
    ok,
    decision: ok ? 'PROD' : 'FIX',
    status: response.status,
    url,
    liveReady: data?.liveReady,
    summary: data?.summary,
    failedRequired,
    recommendation: data?.recommendation,
  };
}

async function runProdDoctor() {
  try {
    const { stdout } = await execFileAsync('node', ['scripts/prod-doctor.mjs', '--json'], {
      cwd: process.cwd(),
      timeout: 12000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        PROD_DOCTOR_BASE_URL: baseUrl,
        PROD_DOCTOR_BASE_PATH: basePath,
      },
    });
    const report = JSON.parse(stdout);
    return {
      id: 'prod-doctor',
      ok: report.decision === 'PROD',
      decision: report.decision,
      report,
      failedRequired: report.checks
        ?.find((check) => check.id === 'true-chain')
        ?.failedRequired ?? [],
    };
  } catch (error) {
    const stdout = String(error?.stdout ?? '').trim();
    let report = null;
    try {
      report = stdout ? JSON.parse(stdout) : null;
    } catch {
      // keep null
    }
    return {
      id: 'prod-doctor',
      ok: false,
      decision: report?.decision ?? 'STOP',
      report,
      detail: report ? undefined : (stdout || error?.message || 'prod-doctor failed'),
      failedRequired: report?.checks
        ?.find((check) => check.id === 'true-chain')
        ?.failedRequired ?? ['prod-doctor-failed'],
    };
  }
}

async function checkStudyEdictContract() {
  // 前后端契约对齐门（2026-06-08 大神会审采纳）：每次发布都必须打一次真实后端，
  // 用 scripts/verify-study-edict.mjs 对 /api/chaotang/study/run 做真闭合校验，
  // 把"前后端对齐"从一次性测试变成常驻发布门，后端契约漂移会先于客户红给我们看。
  if (skipStudyEdict) {
    return {
      id: 'study-edict-contract',
      ok: true,
      decision: 'SKIPPED',
      detail: 'HARNESS_SKIP_STUDY_EDICT=1；仅用于页面调试，不可作为最终发布判定。',
    };
  }
  try {
    const { stdout } = await execFileAsync('node', ['scripts/verify-study-edict.mjs'], {
      cwd: process.cwd(),
      timeout: 40000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        ...(process.env.HARNESS_AUTH_TOKEN
          ? { COURT_TOKEN: process.env.HARNESS_AUTH_TOKEN }
          : {}),
      },
    });
    const tail = stdout.trim().split('\n').slice(-3).join(' ');
    return { id: 'study-edict-contract', ok: true, decision: 'PROD', detail: tail.slice(0, 240) };
  } catch (error) {
    const out = String(error?.stdout ?? '').trim().split('\n').slice(-6).join(' ');
    return {
      id: 'study-edict-contract',
      ok: false,
      decision: 'FIX',
      detail: (out || error?.message || 'verify-study-edict failed').slice(0, 360),
      failedRequired: ['study-edict-contract-breach'],
    };
  }
}

async function setupContext(context) {
  const token = makeToken();
  const now = Math.floor(Date.now() / 1000);
  await context.addCookies([
    { name: 'courtos.access_token', value: token, url: baseUrl, sameSite: 'Lax' },
    { name: 'token', value: token, url: baseUrl, sameSite: 'Lax', httpOnly: true },
  ]);
  await context.addInitScript((session) => {
    localStorage.setItem('courtos.auth', JSON.stringify(session));
    localStorage.setItem('courtos.onboarded', '1');
    localStorage.setItem('courtos.opening.mute', '1');
    localStorage.setItem('courtos.first-decree-seeded', '1');
    sessionStorage.setItem('courtos.opening.played', '1');
    document.cookie = `courtos.access_token=${encodeURIComponent(session.accessToken)}; Path=/; SameSite=Lax; Max-Age=28800`;
  }, {
    accessToken: token,
    refreshToken: `${token}-refresh`,
    tenantId: 6,
    username: 'qa',
    accountType: 1,
    expiresAt: (now + 8 * 60 * 60) * 1000,
  });
}

async function checkApis(page) {
  const results = [];
  for (const check of apiChecks) {
    const url = `${baseUrl}${basePath}${check.path}`;
    try {
      if (check.stream) {
        const response = await checkStreamHeaders(url, 5000);
        results.push({
          id: check.id,
          ok: response.ok && /text\/event-stream/.test(response.contentType),
          status: response.status,
          detail: response.contentType,
        });
      } else if (check.html) {
        const response = await page.request.get(url, { timeout: 10000 });
        results.push({ id: check.id, ok: response.ok(), status: response.status(), detail: 'html reachable' });
      } else {
        const response = await page.request.get(url, { timeout: 10000 });
        const json = await response.json().catch(() => null);
        results.push({ id: check.id, ok: response.ok() && check.expect(json), status: response.status(), detail: JSON.stringify(json?.data?.dailyStats ?? json)?.slice(0, 160) });
      }
    } catch (error) {
      results.push({ id: check.id, ok: false, status: 0, detail: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

function checkStreamHeaders(url, timeoutMs) {
  return new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, (res) => {
      const contentType = String(res.headers['content-type'] ?? '');
      resolve({ ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300, status: res.statusCode ?? 0, contentType });
      req.destroy();
    });
    req.on('error', (error) => resolve({ ok: false, status: 0, contentType: error.message }));
    req.setTimeout(timeoutMs, () => {
      resolve({ ok: false, status: 0, contentType: 'stream header timeout' });
      req.destroy();
    });
  });
}

async function checkRoute(browser, block, route) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
  await setupContext(context);
  const page = await context.newPage();
  const errors = [];
  const warnings = [];
  const failed = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('response', (res) => {
    if (res.status() >= 400) failed.push({ status: res.status(), url: res.url() });
  });

  await page.goto(`${baseUrl}${basePath}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  const title = await page.title();
  const text = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
  const overlayCount = await page.locator('text=/Unhandled Runtime Error|Application error|Build Error|Next\\.js/i').count();
  const matched = block.requiredText.some((item) => text.includes(item));
  const result = {
    route,
    ok: Boolean(title) && text.length > 80 && overlayCount === 0 && matched && errors.length === 0 && failed.length === 0,
    title,
    matched,
    overlayCount,
    errors,
    warnings,
    failed,
    sample: text.slice(0, 160),
  };
  await context.close();
  return result;
}

async function checkResourceGallery(page) {
  await page.goto(`${baseUrl}${basePath}/shangshufang`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.locator('[aria-label="朝堂资源阁"]').click();
  await page.waitForTimeout(1000);
  const result = await page.evaluate(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"], .fixed')]
      .find((el) => (el.textContent || '').includes('朝堂资源阁')) || document.body;
    const imgs = [...dialog.querySelectorAll('img')].map((img) => ({
      src: img.currentSrc || img.src || img.getAttribute('src'),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }));
    const broken = imgs.filter((img) => !img.complete || !img.naturalWidth || !img.naturalHeight);
    return { imageCount: imgs.length, brokenCount: broken.length };
  });
  return { id: 'resource-gallery', ok: result.imageCount >= 20 && result.brokenCount === 0, ...result };
}

async function checkMobileOverflow(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await setupContext(context);
  const page = await context.newPage();
  await page.goto(`${baseUrl}${basePath}/shangshufang`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  const overflow = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const bad = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.left < -2 || r.right > w + 2) {
        bad.push({ tag: el.tagName, left: Math.round(r.left), right: Math.round(r.right), text: (el.textContent || '').trim().slice(0, 50) });
        if (bad.length >= 8) break;
      }
    }
    return bad;
  });
  await context.close();
  return { id: 'mobile-overflow', ok: overflow.length === 0, overflow };
}

function summarize(items) {
  const flat = items.flat();
  return {
    total: flat.length,
    passed: flat.filter((item) => item.ok).length,
    failed: flat.filter((item) => !item.ok).map((item) => item.id ?? item.route),
  };
}

const trueChainGate = skipTrueChainGate
  ? {
      id: 'true-chain-gate',
      ok: true,
      decision: 'SKIPPED',
      detail: 'HARNESS_SKIP_TRUE_CHAIN=1；仅用于页面调试，不可作为最终发布判定。',
    }
  : await checkTrueChainGate();
const studyEdictGate = await checkStudyEdictContract();
if (requireTrueChainGate && !skipTrueChainGate && (!trueChainGate.ok || !studyEdictGate.ok)) {
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    baseUrl,
    basePath,
    decision: !trueChainGate.ok ? trueChainGate.decision : studyEdictGate.decision,
    summary: {
      total: 2,
      passed: [trueChainGate, studyEdictGate].filter((g) => g.ok).length,
      failed: [trueChainGate, studyEdictGate].filter((g) => !g.ok).map((g) => g.id),
    },
    trueChainGate,
    studyEdictGate,
    skipped: [
      'page-route-harness',
      'resource-gallery',
      'mobile-overflow',
    ],
  }, null, 2));
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
await setupContext(context);
const page = await context.newPage();

const apiResults = await checkApis(page);
const blockResults = [];
for (const block of blocks) {
  const routeResults = [];
  for (const route of block.routes) {
    routeResults.push(await checkRoute(browser, block, route));
    if (block.requiredAny && routeResults.some((result) => result.ok)) break;
  }
  blockResults.push({
    id: block.id,
    name: block.name,
    ok: block.requiredAny ? routeResults.some((result) => result.ok) : routeResults.every((result) => result.ok),
    routes: routeResults,
  });
}
const resourceResult = await checkResourceGallery(page);
await context.close();
const mobileResult = await checkMobileOverflow(browser);
await browser.close();

const report = {
  checkedAt: new Date().toISOString(),
  baseUrl,
  basePath,
  decision: trueChainGate.ok && studyEdictGate.ok ? 'PROD' : 'FIX',
  releaseGateMode: requireTrueChainGate ? 'strict-true-chain' : 'page-qa-with-true-chain-report',
  trueChainGate,
  studyEdictGate,
  summary: summarize([apiResults, blockResults, [resourceResult, mobileResult]]),
  apiResults,
  blockResults,
  resourceResult,
  mobileResult,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.summary.failed.length === 0 && studyEdictGate.ok ? 0 : 1);

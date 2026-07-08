#!/usr/bin/env node
/**
 * Dadian showcase gate.
 *
 * This is the showpiece release gate for /dadian. It verifies the product
 * moments that must be true before the page is shown externally:
 * - immersive hall loads on desktop and mobile
 * - ministers can be summoned
 * - a minister memorial can be questioned
 * - decree flow reaches risk and verdict states
 * - no horizontal overflow or runtime error overlay appears
 */

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = (process.env.DADIAN_SHOWCASE_BASE_URL ?? 'http://127.0.0.1:3002').replace(/\/$/, '');
const basePath = normalizeBasePath(process.env.DADIAN_SHOWCASE_BASE_PATH ?? '/chaotang');
const outputRoot = process.env.DADIAN_SHOWCASE_OUTPUT_DIR ?? 'dev/artifacts/dadian-showcase-gate';
const runId = process.env.DADIAN_SHOWCASE_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.join(outputRoot, runId);
const latestPath = path.join(outputRoot, 'latest.json');
const routePath = '/dadian';

const desktop = { id: 'desktop', width: 1440, height: 960, isMobile: false, deviceScaleFactor: 1 };
const mobile = { id: 'mobile', width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 };

function normalizeBasePath(value) {
  if (!value || value === '/') return '';
  return value.startsWith('/') ? value.replace(/\/$/, '') : `/${value.replace(/\/$/, '')}`;
}

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  return `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(JSON.stringify({
    sub: 'dadian-showcase-gate',
    username: 'dadian-showcase-gate',
    tenantId: 6,
    accountType: 1,
    iat: now,
    exp: now + 8 * 60 * 60,
  }))}.showcase`;
}

async function setupContext(context) {
  const token = makeToken();
  const now = Math.floor(Date.now() / 1000);
  await context.addCookies([{ name: 'courtos.access_token', value: token, url: baseUrl, sameSite: 'Lax' }]);
  await context.addInitScript((session) => {
    localStorage.setItem('courtos.auth', JSON.stringify(session));
    localStorage.setItem('courtos.onboarded', '1');
    localStorage.setItem('courtos.opening.mute', '1');
    sessionStorage.setItem('courtos.opening.played', '1');
    document.cookie = `courtos.access_token=${encodeURIComponent(session.accessToken)}; Path=/; SameSite=Lax; Max-Age=28800`;
  }, {
    accessToken: token,
    refreshToken: `${token}-refresh`,
    tenantId: 6,
    username: 'dadian-showcase-gate',
    accountType: 1,
    expiresAt: (now + 8 * 60 * 60) * 1000,
  });
}

function pageUrl() {
  return `${baseUrl}${basePath}${routePath}`;
}

function createResult(id, viewport) {
  return {
    id,
    viewport: viewport.id,
    ok: false,
    screenshot: '',
    checks: {},
    blockers: [],
  };
}

function isIgnoredConsoleError(text) {
  if (/Download the React DevTools/i.test(text)) return true;
  if (/webpack-hmr/i.test(text)) return true;
  return false;
}

function isIgnoredResponse(response) {
  const url = response.url();
  if (url.includes('/api/court/events/stream')) return true;
  if (url.includes('/favicon.ico')) return true;
  if (url.includes('/_next/webpack-hmr')) return true;
  return false;
}

function isIgnoredRequestFailure(request) {
  const url = request.url();
  const failure = request.failure()?.errorText ?? '';
  if (url.includes('/api/court/events/stream')) return true;
  if (failure === 'net::ERR_ABORTED' && url.includes('/_next/static/webpack/')) return true;
  if (failure === 'net::ERR_ABORTED' && url.includes('/fonts/')) return true;
  if (failure === 'net::ERR_ABORTED' && url.includes('/api/court/')) return true;
  return false;
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const width = doc.clientWidth;
    const overflow = Math.max(0, doc.scrollWidth - width);
    const overlayCount = document.body.innerText.match(/Unhandled Runtime Error|Application error|Build Error/gi)?.length ?? 0;
    const bodyText = document.body.innerText.trim().replace(/\s+/g, ' ');
    const offenders = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (rect.left < -2 || rect.right > width + 2) {
        offenders.push({
          tag: el.tagName,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 72),
        });
        if (offenders.length >= 8) break;
      }
    }
    return { overflow, overlayCount, textLength: bodyText.length, sample: bodyText.slice(0, 220), offenders };
  });
}

async function screenshot(page, name) {
  const file = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

function pushBlocker(result, condition, message) {
  if (!condition) result.blockers.push(message);
}

async function openDadian(browser, viewport, result, monitors) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    deviceScaleFactor: viewport.deviceScaleFactor,
  });
  await setupContext(context);
  const page = await context.newPage();
  await mockDeptApis(page);
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnoredConsoleError(msg.text())) monitors.consoleErrors.push(msg.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && !isIgnoredResponse(response)) {
      monitors.failedResponses.push({ status: response.status(), url: response.url() });
    }
  });
  page.on('requestfailed', (request) => {
    if (!isIgnoredRequestFailure(request)) {
      monitors.requestFailures.push({ url: request.url(), failure: request.failure()?.errorText ?? 'request failed' });
    }
  });

  const response = await page.goto(pageUrl(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByRole('heading', { name: '大殿' }).waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(900);
  result.status = response?.status() ?? 0;
  return { context, page };
}

async function mockDeptApis(page) {
  const fulfillAsk = (department) => async (route) => {
    const body = route.request().postDataJSON?.() ?? {};
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        answer: `${department}已接到部门问询接口。建议先补证，再裁定是否进入执行。追问：${body.command ?? '未读取到问题'}`,
        reasoning: '大殿展示门禁用确定性响应验证前端已接部门 API。',
        evidence: ['api_contract:POST', 'source:dept_agent', 'grounding:4/4'],
        assumptions: [],
        conflicts: '若户部或刑部补充证据相反，应转军机处复核。',
        confidence: 0.86,
        grounding: { total: 4, grounded: 4, rate: 1, ungrounded: [] },
        reprompted: false,
        model: 'showcase-gate-mock',
        latencyMs: 12,
      },
    });
  };
  await page.route('**/api/court/hubu/ask', fulfillAsk('户部'));
  await page.route('**/api/court/dept/ops/ask', fulfillAsk('兵部'));
  await page.route('**/api/court/dept/works/ask', fulfillAsk('工部'));
  await page.route('**/api/court/dept/legal/ask', fulfillAsk('刑部'));
}

async function runDesktop(browser) {
  const result = createResult('desktop-showcase', desktop);
  const monitors = { consoleErrors: [], failedResponses: [], requestFailures: [] };
  let context;
  try {
    const opened = await openDadian(browser, desktop, result, monitors);
    context = opened.context;
    const page = opened.page;

    result.screenshots = {};
    result.screenshots.idle = await screenshot(page, 'desktop-01-idle');

    await page.locator('button:has-text("工部")').click({ timeout: 10_000 });
    const panel = page.locator('aside[aria-label="工部奏折"]:visible').first();
    await panel.waitFor({ state: 'visible', timeout: 10_000 });
    await panel.locator('textarea').fill('证据不足时是否应该立刻暂停对外承诺？');
    await panel.getByRole('button', { name: '追问此臣' }).click();
    await panel.getByText('工部回奏').waitFor({ state: 'visible', timeout: 10_000 });
    result.screenshots.audience = await screenshot(page, 'desktop-02-minister-audience');

    await page.getByRole('button', { name: /下旨|再下一旨/ }).click();
    await page.waitForTimeout(3_500);
    const riskMoment = page.locator('text=朱砂质门').first();
    await riskMoment.waitFor({ state: 'visible', timeout: 10_000 });
    result.screenshots.risk = await screenshot(page, 'desktop-03-risk');

    await page.waitForTimeout(3_600);
    await page.getByRole('button', { name: '准奏' }).click();
    await page.getByText('准奏回执').waitFor({ state: 'visible', timeout: 10_000 });
    result.screenshots.verdict = await screenshot(page, 'desktop-04-verdict');

    const inspection = await inspectPage(page);
    result.checks = {
      hasHttpOk: result.status >= 200 && result.status < 300,
      notBlank: inspection.textLength >= 120,
      noRuntimeOverlay: inspection.overlayCount === 0,
      noHorizontalOverflow: inspection.overflow <= 2,
      noConsoleErrors: monitors.consoleErrors.length === 0,
      noBadResponses: monitors.failedResponses.length === 0,
      noRequestFailures: monitors.requestFailures.length === 0,
      hasMinisterAudience: await panel.getByText('交付证据仍缺一环').isVisible(),
      hasMinisterReply: await panel.getByText('工部回奏').isVisible(),
      hasDeptApiSource: await panel.getByText('DEPT_API').isVisible(),
      hasRiskMoment: await riskMoment.isVisible(),
      hasVerdictReceipt: await page.getByText('准奏回执').isVisible(),
    };
    result.details = { inspection, monitors };
    result.screenshot = result.screenshots.verdict;
    pushBlocker(result, result.checks.hasHttpOk, `HTTP ${result.status}`);
    pushBlocker(result, result.checks.notBlank, '大殿文本过少，疑似空白页');
    pushBlocker(result, result.checks.noRuntimeOverlay, '出现运行时错误浮层');
    pushBlocker(result, result.checks.noHorizontalOverflow, `横向溢出 ${inspection.overflow}px`);
    pushBlocker(result, result.checks.noConsoleErrors, `控制台 error ${monitors.consoleErrors.length} 条`);
    pushBlocker(result, result.checks.noBadResponses, `4xx/5xx 响应 ${monitors.failedResponses.length} 条`);
    pushBlocker(result, result.checks.noRequestFailures, `请求失败 ${monitors.requestFailures.length} 条`);
    pushBlocker(result, result.checks.hasMinisterAudience, '点击工部后未出现工部奏折');
    pushBlocker(result, result.checks.hasMinisterReply, '追问工部后未出现回奏');
    pushBlocker(result, result.checks.hasDeptApiSource, '追问工部后未标明 DEPT_API 来源');
    pushBlocker(result, result.checks.hasRiskMoment, '下旨流程未进入朱砂质门');
    pushBlocker(result, result.checks.hasVerdictReceipt, '准奏后未出现回执');
    result.ok = result.blockers.length === 0;
  } catch (error) {
    result.blockers.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context?.close().catch(() => undefined);
  }
  return result;
}

async function runMobile(browser) {
  const result = createResult('mobile-showcase', mobile);
  const monitors = { consoleErrors: [], failedResponses: [], requestFailures: [] };
  let context;
  try {
    const opened = await openDadian(browser, mobile, result, monitors);
    context = opened.context;
    const page = opened.page;
    const panel = page.locator('aside[aria-label="工部奏折"]:visible').first();
    await panel.waitFor({ state: 'visible', timeout: 10_000 });
    await panel.getByRole('button', { name: '追问此臣' }).click();
    await panel.getByText('工部回奏').waitFor({ state: 'visible', timeout: 10_000 });
    result.screenshot = await screenshot(page, 'mobile-01-audience');

    const inspection = await inspectPage(page);
    result.checks = {
      hasHttpOk: result.status >= 200 && result.status < 300,
      notBlank: inspection.textLength >= 120,
      noRuntimeOverlay: inspection.overlayCount === 0,
      noHorizontalOverflow: inspection.overflow <= 2,
      noConsoleErrors: monitors.consoleErrors.length === 0,
      noBadResponses: monitors.failedResponses.length === 0,
      noRequestFailures: monitors.requestFailures.length === 0,
      hasMobileAudience: await panel.getByText('交付证据仍缺一环').isVisible(),
      hasMobileReply: await panel.getByText('工部回奏').isVisible(),
      hasMobileDeptApiSource: await panel.getByText('DEPT_API').isVisible(),
    };
    result.details = { inspection, monitors };
    pushBlocker(result, result.checks.hasHttpOk, `HTTP ${result.status}`);
    pushBlocker(result, result.checks.notBlank, '移动端大殿文本过少，疑似空白页');
    pushBlocker(result, result.checks.noRuntimeOverlay, '移动端出现运行时错误浮层');
    pushBlocker(result, result.checks.noHorizontalOverflow, `移动端横向溢出 ${inspection.overflow}px`);
    pushBlocker(result, result.checks.noConsoleErrors, `移动端控制台 error ${monitors.consoleErrors.length} 条`);
    pushBlocker(result, result.checks.noBadResponses, `移动端 4xx/5xx 响应 ${monitors.failedResponses.length} 条`);
    pushBlocker(result, result.checks.noRequestFailures, `移动端请求失败 ${monitors.requestFailures.length} 条`);
    pushBlocker(result, result.checks.hasMobileAudience, '移动端未显示工部奏折');
    pushBlocker(result, result.checks.hasMobileReply, '移动端追问后未显示回奏');
    pushBlocker(result, result.checks.hasMobileDeptApiSource, '移动端追问后未标明 DEPT_API 来源');
    result.ok = result.blockers.length === 0;
  } catch (error) {
    result.blockers.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context?.close().catch(() => undefined);
  }
  return result;
}

function buildReport(results) {
  const failed = results.filter((item) => !item.ok);
  return {
    checkedAt: new Date().toISOString(),
    baseUrl,
    basePath,
    route: routePath,
    outputDir,
    decision: failed.length === 0 ? 'SHIP' : 'FIX',
    departments: {
      chancellor: '最终放行，只认 gate decision=SHIP',
      gongbu: '实现、交互、性能与移动端适配',
      libu: '视觉、文案、仪式感与外部展示截图',
      jinyiwei: '风险、溢出、错误浮层、坏响应与不可展示缺陷',
      shiguan: '截图和 JSON 报告归档',
    },
    summary: {
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      screenshotCount: results.reduce((count, item) => {
        if (item.screenshots) return count + Object.keys(item.screenshots).length;
        return count + (item.screenshot ? 1 : 0);
      }, 0),
    },
    blockers: failed.map((item) => ({ id: item.id, viewport: item.viewport, blockers: item.blockers, screenshot: item.screenshot })),
    results,
  };
}

function writeReport(results) {
  const report = buildReport(results);
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    process.stderr.write('[dadian-showcase-gate] desktop\n');
    results.push(await runDesktop(browser));
    writeReport(results);
    process.stderr.write('[dadian-showcase-gate] mobile\n');
    results.push(await runMobile(browser));
  } finally {
    await browser.close().catch(() => undefined);
  }

  const report = writeReport(results);
  console.log(JSON.stringify(report, null, 2));
  if (report.decision !== 'SHIP') process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

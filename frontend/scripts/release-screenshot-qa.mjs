#!/usr/bin/env node
/**
 * Release screenshot QA for Chaotang OS.
 *
 * Captures the core release routes in desktop and mobile viewports, then fails
 * if a page is blank, has runtime overlays, console errors, bad responses, or
 * horizontal overflow. This is the visual evidence layer for release gates.
 */

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = (process.env.RELEASE_QA_BASE_URL ?? process.env.HARNESS_BASE_URL ?? 'http://127.0.0.1:3050').replace(/\/$/, '');
const basePath = normalizeBasePath(process.env.RELEASE_QA_BASE_PATH ?? process.env.HARNESS_BASE_PATH ?? '/chaotang');
const outputRoot = process.env.RELEASE_QA_OUTPUT_DIR ?? 'dev/artifacts/release-screenshot-qa';
const runId = process.env.RELEASE_QA_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.join(outputRoot, runId);
const latestPath = path.join(outputRoot, 'latest.json');

const routes = [
  // minTextLength=30(默认80)：2026-07-04 修IM面板默认强制打开bug后，暴露出"0件任务·0件
  // 待裁决"是个合法的空态(之前被强制打开的侧面板文字凑数掩盖)，正文本来就短，不是回归。
  { id: 'study', name: '上书房', path: '/court-briefing', mustSee: ['上书房'], minTextLength: 30 },
  { id: 'command', name: '军机处', path: '/command-center', mustSee: ['军机处'] },
  { id: 'overview', name: '大殿总览', path: '/overview', mustSee: ['朝堂'] },
  { id: 'manors', name: '庄园', path: '/manors', mustSee: ['庄园'] },
  { id: 'archive', name: '档案', path: '/archive', mustSee: ['档案', '史馆'], requiredAny: true },
  { id: 'shiguan', name: '史馆', path: '/shiguan', mustSee: ['史馆'] },
  { id: 'gongbu', name: '工部', path: '/departments/gongbu', mustSee: ['工部'] },
  { id: 'donggong', name: '东宫', path: '/donggong', mustSee: ['东宫'] },
  { id: 'hanlin', name: '翰林院', path: '/hanlin', mustSee: ['翰林'] },
  { id: 'settings', name: '设置/真链路', path: '/settings', mustSee: ['设置', '真链路'], requiredAny: true },
];

const viewports = [
  { id: 'desktop', width: 1440, height: 920, isMobile: false },
  { id: 'mobile', width: 390, height: 844, isMobile: true },
];

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
    sub: 'release-screenshot-qa',
    username: 'release-screenshot-qa',
    tenantId: 6,
    accountType: 1,
    iat: now,
    exp: now + 8 * 60 * 60,
  }))}.qa`;
}

async function setupContext(context) {
  const token = makeToken();
  const now = Math.floor(Date.now() / 1000);
  await context.addCookies([{ name: 'courtos.access_token', value: token, url: baseUrl, sameSite: 'Lax' }]);
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
    username: 'release-screenshot-qa',
    accountType: 1,
    expiresAt: (now + 8 * 60 * 60) * 1000,
  });
}

function routeUrl(routePath) {
  return `${baseUrl}${basePath}${routePath}`;
}

function buildReport(results, decision = 'RUNNING') {
  const failed = results.filter((item) => !item.ok);
  return {
    checkedAt: new Date().toISOString(),
    baseUrl,
    basePath,
    outputDir,
    decision: decision === 'RUNNING' ? 'RUNNING' : failed.length === 0 ? 'SHIP' : 'FIX',
    summary: {
      total: routes.length * viewports.length,
      completed: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      screenshotCount: results.filter((item) => item.screenshot).length,
    },
    blockers: failed.map((item) => ({
      id: item.id,
      route: item.route,
      viewport: item.viewport,
      blockers: item.blockers,
      screenshot: item.screenshot,
    })),
    results,
  };
}

function writeReport(results, decision = 'RUNNING') {
  const report = buildReport(results, decision);
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function isIgnoredResponse(response) {
  const url = response.url();
  if (url.includes('/api/court/events/stream')) return true;
  if (url.includes('/favicon.ico')) return true;
  if (url.includes('/_next/webpack-hmr')) return true;
  return false;
}

function isIgnoredConsoleError(text) {
  if (/WebSocket connection to .*webpack-hmr/i.test(text)) return true;
  if (/Download the React DevTools/i.test(text)) return true;
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

async function inspectOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const width = doc.clientWidth;
    const overflow = Math.max(0, doc.scrollWidth - width);
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
    return { overflow, offenders };
  });
}

async function checkOne(browser, route, viewport) {
  let context;

  const consoleErrors = [];
  const consoleWarnings = [];
  const failedResponses = [];
  const requestFailures = [];

  const result = {
    id: `${route.id}:${viewport.id}`,
    route: route.path,
    name: route.name,
    viewport: viewport.id,
    ok: false,
    status: 0,
    title: '',
    screenshot: '',
    checks: {},
    blockers: [],
    sample: '',
  };

  try {
    context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      deviceScaleFactor: viewport.isMobile ? 2 : 1,
    });
    await setupContext(context);

    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnoredConsoleError(msg.text())) consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && !isIgnoredResponse(response)) {
        failedResponses.push({ status: response.status(), url: response.url() });
      }
    });
    page.on('requestfailed', (request) => {
      if (!isIgnoredRequestFailure(request)) {
        requestFailures.push({ url: request.url(), failure: request.failure()?.errorText ?? 'request failed' });
      }
    });

    const response = await page.goto(routeUrl(route.path), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    // 会审后修复(2026-07-04)：800ms 对 mobile(deviceScaleFactor 2x)不够——实测
    // gongbu 部门页在800ms截图时仍是loading骨架屏，3秒后才真正hydrate完成渲染出内容，
    // 曾被误判成"手机端永久卡死"的假阳性。mobile 用更宽裕的等待，desktop 保持不变。
    await page.waitForTimeout(viewport.isMobile ? 2000 : 800);

    result.status = response?.status() ?? 0;
    result.title = await page.title();
    const text = await page.locator('body').innerText({ timeout: 12_000 }).catch(() => '');
    const runtimeOverlayCount = await page.locator('text=/Unhandled Runtime Error|Application error|Build Error/i').count();
    const hasRequiredText = route.requiredAny
      ? route.mustSee.some((item) => text.includes(item))
      : route.mustSee.every((item) => text.includes(item));
    const blank = text.trim().length < (route.minTextLength ?? 80);
    const overflow = await inspectOverflow(page);
    const screenshotName = `${route.id}-${viewport.id}.png`;
    const screenshotPath = path.join(outputDir, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: false, animations: 'disabled' });

    result.screenshot = screenshotPath;
    result.sample = text.trim().replace(/\s+/g, ' ').slice(0, 180);
    result.checks = {
      hasHttpOk: result.status >= 200 && result.status < 300,
      hasTitle: Boolean(result.title),
      notBlank: !blank,
      hasRequiredText,
      noRuntimeOverlay: runtimeOverlayCount === 0,
      noConsoleErrors: consoleErrors.length === 0,
      noBadResponses: failedResponses.length === 0,
      noRequestFailures: requestFailures.length === 0,
      noHorizontalOverflow: overflow.overflow <= 2,
      warningCount: consoleWarnings.length,
    };

    if (!result.checks.hasHttpOk) result.blockers.push(`HTTP ${result.status}`);
    if (!result.checks.hasTitle) result.blockers.push('页面标题为空');
    if (!result.checks.notBlank) result.blockers.push('首屏文本过少，疑似空白页');
    if (!result.checks.hasRequiredText) result.blockers.push(`缺少关键文案：${route.mustSee.join(' / ')}`);
    if (!result.checks.noRuntimeOverlay) result.blockers.push('出现 Next/React 运行时错误浮层');
    if (!result.checks.noConsoleErrors) result.blockers.push(`控制台 error ${consoleErrors.length} 条`);
    if (!result.checks.noBadResponses) result.blockers.push(`4xx/5xx 响应 ${failedResponses.length} 条`);
    if (!result.checks.noRequestFailures) result.blockers.push(`请求失败 ${requestFailures.length} 条`);
    if (!result.checks.noHorizontalOverflow) result.blockers.push(`横向溢出 ${overflow.overflow}px`);

    result.details = {
      consoleErrors: consoleErrors.slice(0, 8),
      failedResponses: failedResponses.slice(0, 8),
      requestFailures: requestFailures.slice(0, 8),
      overflow,
    };
    result.ok = result.blockers.length === 0;
  } catch (error) {
    result.blockers.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context?.close().catch(() => undefined);
  }

  return result;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const results = [];
  const browser = await chromium.launch({ headless: true });
  try {
    for (const route of routes) {
      for (const viewport of viewports) {
        process.stderr.write(`[release-screenshot-qa] ${route.id}:${viewport.id}\n`);
        results.push(await checkOne(browser, route, viewport));
        writeReport(results);
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  const report = writeReport(results, 'FINAL');
  console.log(JSON.stringify(report, null, 2));

  if (report.decision !== 'SHIP') process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Three-axis department office UI harness.
 *
 * Checks the layout discipline for CourtOS office pages:
 * - top nav visible above the stage
 * - central scroll/decree stage exists and stays close to the viewport axis
 * - left/right agent corners exist and align as a pair
 * - bottom decree input exists on pages that use the operating dock
 *
 * It does not pretend to score taste from pixels, but it does enforce
 * first-screen visual discipline: clear axis, clear dock, no agent overlap,
 * and a screenshot review checklist for the Li Bu/design review.
 */

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = (process.env.THREE_AXIS_BASE_URL ?? process.env.HARNESS_BASE_URL ?? 'http://127.0.0.1:3002').replace(/\/$/, '');
const basePath = normalizeBasePath(process.env.THREE_AXIS_BASE_PATH ?? process.env.HARNESS_BASE_PATH ?? '/chaotang');
const outputRoot = process.env.THREE_AXIS_OUTPUT_DIR ?? 'dev/artifacts/three-axis-ui';
const runId = process.env.THREE_AXIS_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.join(outputRoot, runId);
const latestPath = path.join(outputRoot, 'latest.json');
const strict = process.env.THREE_AXIS_STRICT === '1';
const routeFilter = new Set(
  (process.env.THREE_AXIS_ROUTES ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const viewport = {
  width: Number(process.env.THREE_AXIS_WIDTH ?? 1440),
  height: Number(process.env.THREE_AXIS_HEIGHT ?? 950),
};

const routes = [
  { id: 'study', name: '上书房', path: '/court-briefing?skipOnboarding=1', requireDecreeInput: false, waitMs: 3600, readySelector: '[data-three-axis-panel="left"]' },
  { id: 'finance', name: '户部', path: '/departments/finance?skipOnboarding=1', requireDecreeInput: true, requireScrollToggle: true },
  { id: 'rites', name: '礼部', path: '/departments/market?skipOnboarding=1', requireDecreeInput: true, requireScrollToggle: true },
  { id: 'works', name: '工部', path: '/departments/gongbu?skipOnboarding=1', requireDecreeInput: true, requireScrollToggle: true },
  { id: 'ops', name: '兵部', path: '/departments/ops?skipOnboarding=1', requireDecreeInput: true, requireScrollToggle: true },
  { id: 'legal', name: '刑部', path: '/departments/legal?skipOnboarding=1', requireDecreeInput: true, requireScrollToggle: true },
  { id: 'personnel', name: '吏部', path: '/departments/personnel?skipOnboarding=1', requireDecreeInput: false, requireScrollToggle: true },
  { id: 'offices', name: '专署', path: '/offices?skipOnboarding=1', requireDecreeInput: false, requireAgents: false },
  { id: 'manors', name: '庄园', path: '/manors?skipOnboarding=1', requireDecreeInput: true, requireScrollToggle: true },
  { id: 'command-center', name: '军机处', path: '/command-center?skipOnboarding=1', requireDecreeInput: true, requireScrollToggle: true },
];
const activeRoutes = routeFilter.size > 0
  ? routes.filter((route) => routeFilter.has(route.id))
  : routes;
const knownRouteIds = new Set(routes.map((route) => route.id));
const unknownRouteIds = [...routeFilter].filter((id) => !knownRouteIds.has(id));

function normalizeBasePath(value) {
  if (!value || value === '/') return '';
  return value.startsWith('/') ? value.replace(/\/$/, '') : `/${value.replace(/\/$/, '')}`;
}

function routeUrl(routePath) {
  return `${baseUrl}${basePath}${routePath}`;
}

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  return `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(JSON.stringify({
    sub: 'three-axis-ui',
    username: 'three-axis-ui',
    tenantId: 7,
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
    tenantId: 7,
    username: 'three-axis-ui',
    accountType: 1,
    expiresAt: (now + 8 * 60 * 60) * 1000,
  });
}

function isIgnoredConsoleError(text) {
  if (/Failed to load resource: the server responded with a status of 401/i.test(text)) return true;
  if (/Download the React DevTools/i.test(text)) return true;
  if (/webpack-hmr/i.test(text)) return true;
  return false;
}

function roundRect(rect) {
  if (!rect) return null;
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    left: Math.round(rect.x),
    top: Math.round(rect.y),
    right: Math.round(rect.x + rect.width),
    bottom: Math.round(rect.y + rect.height),
    centerX: Math.round(rect.x + rect.width / 2),
    centerY: Math.round(rect.y + rect.height / 2),
  };
}

async function firstVisibleBox(page, selector) {
  const locators = await page.locator(selector).all();
  for (const locator of locators) {
    if (await locator.isVisible().catch(() => false)) {
      const box = await locator.boundingBox().catch(() => null);
      if (box && box.width > 2 && box.height > 2) return roundRect(box);
    }
  }
  return null;
}

async function panelContentMetrics(page, side) {
  const panel = page.locator(`[data-three-axis-panel="${side}"]`).first();
  const visible = await panel.isVisible().catch(() => false);
  if (!visible) return null;
  const itemCount = await panel.locator('[data-three-axis-panel-item]').count().catch(() => 0);
  const text = await panel.innerText().catch(() => '');
  const compactText = text.replace(/\s+/g, '');
  return {
    itemCount,
    textLength: compactText.length,
  };
}

async function visibleOrnamentCount(page) {
  const locators = await page.locator('[data-three-axis-ornament]').all();
  let count = 0;
  const kinds = [];
  for (const locator of locators) {
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;
    count += 1;
    const kind = await locator.getAttribute('data-three-axis-ornament').catch(() => null);
    if (kind) kinds.push(kind);
  }
  return { count, kinds };
}

async function visibleScrollArtifactCount(page) {
  const collapsedScroll = page.locator('[data-chaotang-scroll-state="collapsed"]').first();
  const visible = await collapsedScroll.isVisible().catch(() => false);
  if (!visible) return { count: 0, kinds: [] };
  const locators = await collapsedScroll.locator('[data-three-axis-scroll-artifact]').all();
  let count = 0;
  const kinds = [];
  for (const locator of locators) {
    const visibleArtifact = await locator.isVisible().catch(() => false);
    if (!visibleArtifact) continue;
    const box = await locator.boundingBox().catch(() => null);
    if (!box || box.width <= 2 || box.height <= 2) continue;
    count += 1;
    const kind = await locator.getAttribute('data-three-axis-scroll-artifact').catch(() => null);
    if (kind) kinds.push(kind);
  }
  return { count, kinds };
}

async function visibleManuscriptDetails(page) {
  const locators = await page.locator('[data-chaotang-scroll-state="expanded"] [data-three-axis-manuscript-detail]').all();
  const kinds = [];
  for (const locator of locators) {
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;
    const box = await locator.boundingBox().catch(() => null);
    if (!box || box.width <= 2 || box.height <= 2) continue;
    const kind = await locator.getAttribute('data-three-axis-manuscript-detail').catch(() => null);
    if (kind) kinds.push(kind);
  }
  return {
    kinds,
    uniqueKinds: [...new Set(kinds)],
  };
}

async function inspectPrimaryActionReceipt(page, route, checks, blockers) {
  if (!route.requireDecreeInput) return null;
  const action = page.locator('[data-three-axis-decree-input] [data-three-axis-primary-action], [data-testid="edict-quick-dock"] [data-three-axis-primary-action]').first();
  const visible = await action.isVisible().catch(() => false);
  if (!visible) {
    addCheck(checks, blockers, 'decreeInput.actionReceipt', false, '没有可点击的主管主动作');
    return null;
  }

  await action.click().catch(() => undefined);
  await page.waitForTimeout(260);
  const receipt = await firstVisibleBox(page, '[data-three-axis-decree-input] [data-three-axis-action-receipt], [data-testid="edict-quick-dock"] [data-three-axis-action-receipt]');
  const seal = await firstVisibleBox(page, '[data-three-axis-decree-input] [data-three-axis-action-seal], [data-testid="edict-quick-dock"] [data-three-axis-action-seal]');
  const sourcePlaque = await firstVisibleBox(page, '[data-three-axis-decree-input] [data-three-axis-dock-source-plaque], [data-testid="edict-quick-dock"] [data-three-axis-dock-source-plaque]');
  const sourceLabel = await page.locator('[data-three-axis-decree-input] [data-three-axis-dock-source-plaque], [data-testid="edict-quick-dock"] [data-three-axis-dock-source-plaque]').first().getAttribute('data-three-axis-source-plaque').catch(() => null);
  const scrollSeal = await firstVisibleBox(page, '[data-three-axis-scroll] [data-three-axis-scroll-action-seal]');
  const receiptText = await page.locator('[data-three-axis-decree-input] [data-three-axis-action-receipt], [data-testid="edict-quick-dock"] [data-three-axis-action-receipt]').first().innerText().catch(() => '');
  addCheck(
    checks,
    blockers,
    'decreeInput.actionReceipt',
    Boolean(receipt) && receiptText.replace(/\s+/g, '').length >= 8,
    receipt ? `receipt top=${receipt.top}px, text=${receiptText.replace(/\s+/g, '').slice(0, 28)}` : '点击主动作后必须出现动作回执',
  );
  addCheck(
    checks,
    blockers,
    'decreeInput.actionSeal',
    Boolean(seal) && seal.width >= 24 && seal.height >= 24,
    seal ? `seal ${seal.width}x${seal.height} at ${seal.left},${seal.top}` : '动作回执必须带朱批落印视觉层',
  );
  addCheck(
    checks,
    blockers,
    'decreeInput.sourcePlaque',
    Boolean(sourcePlaque) && ['LIVE', 'MIXED', 'FALLBACK', 'DEMO'].includes(sourceLabel ?? ''),
    sourcePlaque ? `source=${sourceLabel}, plaque ${sourcePlaque.width}x${sourcePlaque.height}` : '动作回执必须带来源铭牌',
  );
  addCheck(
    checks,
    blockers,
    'scroll.actionSeal',
    Boolean(scrollSeal) && scrollSeal.width >= 72 && scrollSeal.height >= 72,
    scrollSeal ? `scroll seal ${scrollSeal.width}x${scrollSeal.height} at ${scrollSeal.left},${scrollSeal.top}` : '底部主动作必须联动中央卷轴落印',
  );
  return {
    receipt,
    seal,
    scrollSeal,
    textLength: receiptText.replace(/\s+/g, '').length,
  };
}

async function inspectScrollRitual(page, route, checks, blockers, expandedScreenshotPath) {
  const openButton = page.locator('[data-chaotang-department-scroll-open]').first();
  const hasOpenButton = await openButton.isVisible().catch(() => false);

  if (!hasOpenButton) {
    addCheck(
      checks,
      blockers,
      'scrollRitual.available',
      route.requireScrollToggle !== true,
      route.requireScrollToggle ? '共享部门卷轴必须支持收卷/展卷' : '此页没有共享收卷卷轴',
      route.requireScrollToggle ? 'error' : 'warn',
    );
    return null;
  }

  addCheck(checks, blockers, 'scrollRitual.available', true, '可点击收卷态卷轴');
  const collapsedBefore = await firstVisibleBox(page, '[data-chaotang-scroll-state="collapsed"]');
  const collapsedArtifacts = await visibleScrollArtifactCount(page);
  addCheck(
    checks,
    blockers,
    'scrollRitual.artifactDepth',
    route.requireScrollToggle !== true || collapsedArtifacts.count >= 3,
    `artifacts=${collapsedArtifacts.count}, kinds=${collapsedArtifacts.kinds.join(',') || 'none'}`,
  );
  const collapsedSummary = page.locator('[data-chaotang-scroll-state="collapsed"] [data-three-axis-scroll-summary]').first();
  const collapsedSummaryText = (await collapsedSummary.innerText().catch(() => '')).replace(/\s+/g, '');
  addCheck(
    checks,
    blockers,
    'scrollRitual.collapsedSummary',
    route.requireScrollToggle !== true || collapsedSummaryText.length >= 12,
    collapsedSummaryText ? `summary length=${collapsedSummaryText.length}` : '收卷态必须有主管摘要',
  );

  await openButton.click();
  await page.waitForSelector('[data-chaotang-scroll-state="expanded"]', { state: 'visible', timeout: 3_000 }).catch(() => undefined);
  await page.waitForTimeout(180);

  const expanded = await firstVisibleBox(page, '[data-chaotang-scroll-state="expanded"]');
  addCheck(checks, blockers, 'scrollRitual.expands', Boolean(expanded), '点击后必须展开部门案卷');
  const sharedRitualHost = await page.locator('[data-chaotang-scroll-state="expanded"][data-three-axis-ritual="imperial-unfurl"]').first().isVisible().catch(() => false);
  if (sharedRitualHost) {
    const ritualLight = await firstVisibleBox(page, '[data-three-axis-scroll-ritual-light]');
    const ritualSeal = await firstVisibleBox(page, '[data-three-axis-scroll-ritual-seal]');
    const sourcePlaque = await firstVisibleBox(page, '[data-chaotang-scroll-state="expanded"] [data-three-axis-source-plaque]');
    const sourceLabel = await page.locator('[data-chaotang-scroll-state="expanded"] [data-three-axis-source-plaque]').first().getAttribute('data-three-axis-source-plaque').catch(() => null);
    const previewControl = await firstVisibleBox(page, '[data-chaotang-scroll-state="expanded"] [data-chaotang-department-scroll-preview-control]');
    addCheck(
      checks,
      blockers,
      'scrollRitual.unfurlLight',
      Boolean(ritualLight) && ritualLight.width >= 80 && ritualLight.height >= 180,
      ritualLight ? `light ${ritualLight.width}x${ritualLight.height} at ${ritualLight.left},${ritualLight.top}` : '共享卷轴展开时必须有轴光扫过',
    );
    addCheck(
      checks,
      blockers,
      'scrollRitual.openSeal',
      Boolean(ritualSeal) && ritualSeal.width >= 72 && ritualSeal.height >= 72,
      ritualSeal ? `open seal ${ritualSeal.width}x${ritualSeal.height} at ${ritualSeal.left},${ritualSeal.top}` : '共享卷轴展开时必须落“开卷奉览”朱印',
    );
    addCheck(
      checks,
      blockers,
      'scrollRitual.sourcePlaque',
      Boolean(sourcePlaque) && ['LIVE', 'MIXED', 'FALLBACK', 'DEMO'].includes(sourceLabel ?? ''),
      sourcePlaque ? `source=${sourceLabel}, plaque ${sourcePlaque.width}x${sourcePlaque.height}` : '共享卷轴必须显示来源铭牌',
    );
    addCheck(
      checks,
      blockers,
      'scrollRitual.previewControl',
      Boolean(previewControl),
      previewControl ? `preview control ${previewControl.width}x${previewControl.height}` : '共享卷轴必须提供半展摘要控制',
    );
  } else {
    addCheck(
      checks,
      blockers,
      'scrollRitual.sharedRitual',
      true,
      route.requireScrollToggle ? '此页仍是旧卷轴实现，暂未接入共享开卷仪式' : '此页不要求共享开卷仪式',
      'warn',
    );
  }
  if (collapsedBefore && expanded) {
    addCheck(
      checks,
      blockers,
      'scrollRitual.heightGain',
      expanded.height >= collapsedBefore.height + 260,
      `collapsed=${collapsedBefore.height}px expanded=${expanded.height}px`,
    );
  }
  const manuscript = await firstVisibleBox(page, '[data-three-axis-scroll-layout]');
  const manuscriptKinds = await page.locator('[data-three-axis-scroll-layout]').evaluateAll((nodes) => (
    nodes
      .filter((node) => {
        const element = node instanceof HTMLElement ? node : null;
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 2 && box.height > 2;
      })
      .map((node) => node.getAttribute('data-three-axis-scroll-layout'))
      .filter(Boolean)
  )).catch(() => []);
  const manuscriptVoices = await page.locator('[data-three-axis-manuscript-voice]').evaluateAll((nodes) => (
    nodes
      .filter((node) => {
        const element = node instanceof HTMLElement ? node : null;
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 2 && box.height > 2;
      })
      .map((node) => node.getAttribute('data-three-axis-manuscript-voice'))
      .filter(Boolean)
  )).catch(() => []);
  addCheck(
    checks,
    blockers,
    'art.scrollManuscript',
    route.requireScrollToggle !== true || Boolean(manuscript),
    manuscript ? `layout=${manuscriptKinds.join(',') || 'unknown'}, width=${manuscript.width}px` : '展开态必须有礼制正文排版层',
  );
  const manuscriptDetails = await visibleManuscriptDetails(page);
  const requiredDetails = ['paper', 'marginalia', 'seal'];
  const missingDetails = requiredDetails.filter((kind) => !manuscriptDetails.uniqueKinds.includes(kind));
  addCheck(
    checks,
    blockers,
    'art.manuscriptTriad',
    route.requireScrollToggle !== true || missingDetails.length === 0,
    missingDetails.length === 0
      ? `details=${manuscriptDetails.uniqueKinds.join(',')}`
      : `missing=${missingDetails.join(',')}; present=${manuscriptDetails.uniqueKinds.join(',') || 'none'}`,
  );
  const typographyDetails = ['title-cartouche', 'title-calligraphy', 'body-rhythm', 'text-ruling'];
  const missingTypography = typographyDetails.filter((kind) => !manuscriptDetails.uniqueKinds.includes(kind));
  addCheck(
    checks,
    blockers,
    'art.manuscriptTypography',
    route.requireScrollToggle !== true || missingTypography.length === 0,
    missingTypography.length === 0
      ? `typography=${typographyDetails.join(',')}`
      : `missing=${missingTypography.join(',')}; present=${manuscriptDetails.uniqueKinds.join(',') || 'none'}`,
  );
  addCheck(
    checks,
    blockers,
    'art.manuscriptVoice',
    route.requireScrollToggle !== true || manuscriptVoices.some((voice) => ['edict', 'memorial', 'casefile'].includes(voice)),
    manuscriptVoices.length > 0
      ? `voices=${[...new Set(manuscriptVoices)].join(',')}`
      : '展开态必须声明圣旨 / 奏折 / 案卷文书字法',
  );
  if (expanded && expandedScreenshotPath) {
    await page.screenshot({ path: expandedScreenshotPath, fullPage: false }).catch(() => undefined);
  }

  const collapseButton = page.locator('[data-chaotang-department-scroll-collapse]').first();
  const hasCollapseButton = await collapseButton.isVisible().catch(() => false);
  addCheck(checks, blockers, 'scrollRitual.collapseControl', hasCollapseButton, '展开态必须有收卷按钮');
  if (hasCollapseButton) {
    await collapseButton.click();
    await page.waitForSelector('[data-chaotang-scroll-state="collapsed"]', { state: 'visible', timeout: 3_000 }).catch(() => undefined);
    await page.waitForTimeout(120);
    const collapsedAfter = await firstVisibleBox(page, '[data-chaotang-scroll-state="collapsed"]');
    addCheck(checks, blockers, 'scrollRitual.collapsesBack', Boolean(collapsedAfter), '收卷后必须回到精美卷轴态');
    return {
      collapsedBefore,
      collapsedArtifacts,
      expanded,
      sharedRitualHost,
      manuscript,
      manuscriptKinds,
      manuscriptDetails,
      collapsedAfter,
    };
  }

  return {
    collapsedBefore,
    collapsedArtifacts,
    expanded,
    sharedRitualHost,
    manuscript,
    manuscriptKinds,
    manuscriptDetails,
    collapsedAfter: null,
  };
}

function addCheck(checks, blockers, id, ok, detail, severity = 'error') {
  checks[id] = { ok, detail, severity };
  if (!ok && severity === 'error') blockers.push(`${id}: ${detail}`);
}

function makeReviewChecklist(route, metrics) {
  return [
    {
      id: 'central-stage-is-hero',
      label: '中央卷轴/案卷是首屏视觉主角，左右信息不抢中轴',
      evidence: metrics.scroll
        ? `scroll center=${metrics.scroll.centerX}, width=${metrics.scroll.width}, top=${metrics.scroll.top}`
        : 'missing scroll geometry',
    },
    {
      id: 'panels-frame-not-cover',
      label: '两侧面板只做信息框架，不能覆盖或压迫中央主舞台',
      evidence: route.requireAgents === false
        ? 'this route has no required agent corners'
        : metrics.agentLeft && metrics.agentRight
          ? `agents: left ${metrics.agentLeft.left}-${metrics.agentLeft.right}, right ${metrics.agentRight.left}-${metrics.agentRight.right}`
          : 'missing agent geometry',
    },
    {
      id: 'decree-dock-does-not-cover-agents',
      label: '底部下旨栏不得遮挡左右 Agent 或中央卷轴',
      evidence: metrics.decreeInput
        ? `dock top=${metrics.decreeInput.top}, bottom=${metrics.decreeInput.bottom}`
        : route.requireDecreeInput ? 'missing required dock' : 'dock optional on this route',
    },
    {
      id: 'texture-only-differentiation',
      label: '部门差异只体现在纹理/文案/点缀色，不改变三轴骨架',
      evidence: `${route.name} uses the shared topnav/scroll/agent/dock markers`,
    },
  ];
}

async function inspectGeometry(page, route, screenshotPath) {
  const blockers = [];
  const checks = {};
  const metrics = {
    viewport,
    topnav: await firstVisibleBox(page, '[data-three-axis-topnav]'),
    scroll: await firstVisibleBox(page, '[data-three-axis-scroll]'),
    panelLeft: await firstVisibleBox(page, '[data-three-axis-panel="left"]'),
    panelRight: await firstVisibleBox(page, '[data-three-axis-panel="right"]'),
    panelLeftContent: await panelContentMetrics(page, 'left'),
    panelRightContent: await panelContentMetrics(page, 'right'),
    agentLeft: await firstVisibleBox(page, '[data-three-axis-agent="left"]'),
    agentRight: await firstVisibleBox(page, '[data-three-axis-agent="right"]'),
    decreeInput: await firstVisibleBox(page, '[data-three-axis-decree-input], [data-testid="edict-quick-dock"]'),
    primaryAction: await firstVisibleBox(page, '[data-three-axis-decree-input] [data-three-axis-primary-action], [data-testid="edict-quick-dock"] [data-three-axis-primary-action]'),
    ornaments: await visibleOrnamentCount(page),
  };

  const axisX = viewport.width / 2;
  const scrollAxisDelta = metrics.scroll ? Math.abs(metrics.scroll.centerX - axisX) : null;
  const leftAgentDelta = metrics.agentLeft ? Math.abs(metrics.agentLeft.left - 16) : null;
  const rightAgentDelta = metrics.agentRight ? Math.abs(viewport.width - metrics.agentRight.right - 16) : null;
  const agentWidthDelta = metrics.agentLeft && metrics.agentRight ? Math.abs(metrics.agentLeft.width - metrics.agentRight.width) : null;
  const agentDockGap = metrics.agentLeft && metrics.agentRight && metrics.decreeInput
    ? metrics.decreeInput.top - Math.max(metrics.agentLeft.bottom, metrics.agentRight.bottom)
    : null;
  const scrollTopGap = metrics.scroll && metrics.topnav
    ? metrics.scroll.top - metrics.topnav.bottom
    : null;
  const scrollEdgeMin = metrics.scroll
    ? Math.min(metrics.scroll.left, viewport.width - metrics.scroll.right)
    : null;
  const panelWidthDelta = metrics.panelLeft && metrics.panelRight
    ? Math.abs(metrics.panelLeft.width - metrics.panelRight.width)
    : null;
  const panelScrollGap = metrics.panelLeft && metrics.panelRight && metrics.scroll
    ? Math.min(metrics.scroll.left - metrics.panelLeft.right, metrics.panelRight.left - metrics.scroll.right)
    : null;

  addCheck(checks, blockers, 'topnav.visible', Boolean(metrics.topnav), '顶部导航必须存在');
  if (metrics.topnav) {
    addCheck(checks, blockers, 'topnav.top', metrics.topnav.top <= 2, `top=${metrics.topnav.top}px`);
  }

  addCheck(checks, blockers, 'scroll.visible', Boolean(metrics.scroll), '中央卷轴/案卷必须存在');
  if (metrics.scroll) {
    addCheck(checks, blockers, 'scroll.axis', scrollAxisDelta <= 56, `center delta=${scrollAxisDelta}px`);
    if (metrics.topnav) {
      addCheck(checks, blockers, 'scroll.belowTopnav', metrics.scroll.top >= metrics.topnav.bottom - 2, `scroll top=${metrics.scroll.top}px, nav bottom=${metrics.topnav.bottom}px`);
      addCheck(checks, blockers, 'visual.scrollBreathingRoom', scrollTopGap >= 4, `top gap=${scrollTopGap}px`);
    }
    addCheck(checks, blockers, 'visual.scrollNotEdgeToEdge', scrollEdgeMin >= 24, `min side gap=${scrollEdgeMin}px`);
  }

  addCheck(checks, blockers, 'panel.left.visible', Boolean(metrics.panelLeft), '左侧信息面板必须存在');
  addCheck(checks, blockers, 'panel.right.visible', Boolean(metrics.panelRight), '右侧信息面板必须存在');
  if (metrics.panelLeft && metrics.panelRight) {
    addCheck(checks, blockers, 'panel.leftOfAxis', metrics.panelLeft.centerX < axisX, `left center=${metrics.panelLeft.centerX}px`);
    addCheck(checks, blockers, 'panel.rightOfAxis', metrics.panelRight.centerX > axisX, `right center=${metrics.panelRight.centerX}px`);
    addCheck(checks, blockers, 'panel.widthPair', panelWidthDelta <= 96, `width delta=${panelWidthDelta}px`);
    if (metrics.scroll) {
      addCheck(checks, blockers, 'panel.framesScroll', panelScrollGap >= -24, `min panel-scroll gap=${panelScrollGap}px`);
    }
  }
  if (metrics.panelLeftContent) {
    addCheck(
      checks,
      blockers,
      'panel.left.contentItems',
      metrics.panelLeftContent.itemCount >= 3 || metrics.panelLeftContent.textLength >= 120,
      `left items=${metrics.panelLeftContent.itemCount}, text length=${metrics.panelLeftContent.textLength}`,
    );
    addCheck(checks, blockers, 'panel.left.contentDensity', metrics.panelLeftContent.textLength >= 56, `left text length=${metrics.panelLeftContent.textLength}`);
  }
  if (metrics.panelRightContent) {
    addCheck(
      checks,
      blockers,
      'panel.right.contentItems',
      metrics.panelRightContent.itemCount >= 3 || metrics.panelRightContent.textLength >= 100,
      `right items=${metrics.panelRightContent.itemCount}, text length=${metrics.panelRightContent.textLength}`,
    );
    addCheck(checks, blockers, 'panel.right.contentDensity', metrics.panelRightContent.textLength >= 56, `right text length=${metrics.panelRightContent.textLength}`);
  }

  if (route.requireAgents !== false) {
    addCheck(checks, blockers, 'agent.left.visible', Boolean(metrics.agentLeft), '左下丞相 Agent 必须存在');
    addCheck(checks, blockers, 'agent.right.visible', Boolean(metrics.agentRight), '右下部门负责人 Agent 必须存在');
    if (metrics.agentLeft && metrics.agentRight) {
      addCheck(checks, blockers, 'agent.widthPair', agentWidthDelta <= 36, `width delta=${agentWidthDelta}px`);
      addCheck(checks, blockers, 'agent.leftEdge', leftAgentDelta <= 24, `left delta=${leftAgentDelta}px`);
      addCheck(checks, blockers, 'agent.rightEdge', rightAgentDelta <= 24, `right delta=${rightAgentDelta}px`);
      addCheck(checks, blockers, 'agent.bottomBand', Math.abs(metrics.agentLeft.top - metrics.agentRight.top) <= 32, `top delta=${Math.abs(metrics.agentLeft.top - metrics.agentRight.top)}px`);
      if (metrics.decreeInput) {
        addCheck(checks, blockers, 'visual.dockClearsAgents', agentDockGap >= 12, `dock-agent gap=${agentDockGap}px`);
      }
    }
  }

  if (route.requireDecreeInput) {
    addCheck(checks, blockers, 'decreeInput.visible', Boolean(metrics.decreeInput), '底部下旨栏必须存在');
  } else {
    addCheck(checks, blockers, 'decreeInput.optional', true, '此页暂不强制底部下旨栏', 'warn');
  }
  if (metrics.decreeInput) {
    addCheck(checks, blockers, 'decreeInput.bottom', metrics.decreeInput.bottom >= viewport.height - 86, `bottom=${metrics.decreeInput.bottom}px`);
  }
  if (route.requireDecreeInput) {
    addCheck(
      checks,
      blockers,
      'decreeInput.primaryAction',
      Boolean(metrics.primaryAction),
      metrics.primaryAction ? `primary action at x=${metrics.primaryAction.left}px` : '底部下旨栏必须提供主管预置主动作',
    );
  }

  if (route.id === 'offices') {
    addCheck(checks, blockers, 'art.ornamentDepth', true, `专署为聚合页，当前装饰层=${metrics.ornaments.count}`, 'warn');
  } else {
    const minimumOrnaments = route.id === 'study' ? 2 : 4;
    addCheck(
      checks,
      blockers,
      'art.ornamentDepth',
      metrics.ornaments.count >= minimumOrnaments,
      `ornaments=${metrics.ornaments.count}, kinds=${metrics.ornaments.kinds.join(',') || 'none'}`,
    );
  }

  const actionReceipt = await inspectPrimaryActionReceipt(page, route, checks, blockers);
  const expandedScreenshotPath = screenshotPath.replace(/\.png$/, '.expanded.png');
  const scrollRitual = await inspectScrollRitual(page, route, checks, blockers, expandedScreenshotPath);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  return {
    ok: blockers.length === 0,
    checks,
    blockers,
    metrics: {
      ...metrics,
      axisX,
      scrollAxisDelta,
      leftAgentDelta,
      rightAgentDelta,
      agentWidthDelta,
      agentDockGap,
      scrollTopGap,
      scrollEdgeMin,
      panelWidthDelta,
      panelScrollGap,
      scrollRitual,
      actionReceipt,
    },
    expandedScreenshot: scrollRitual?.expanded ? expandedScreenshotPath : null,
    visualReview: makeReviewChecklist(route, metrics),
  };
}

function buildReport(results) {
  const failed = results.filter((item) => !item.ok);
  return {
    checkedAt: new Date().toISOString(),
    baseUrl,
    basePath,
    viewport,
    outputDir,
    strict,
    decision: failed.length === 0 ? 'PASS' : strict ? 'FAIL' : 'WARN',
    summary: {
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      screenshotCount: results.filter((item) => item.screenshot).length,
      expandedScreenshotCount: results.filter((item) => item.expandedScreenshot).length,
    },
    blockers: failed.map((item) => ({
      id: item.id,
      name: item.name,
      route: item.route,
      blockers: item.blockers,
      screenshot: item.screenshot,
    })),
    results,
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function relativeAsset(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).split(path.sep).join('/');
}

function makeCheckRows(checks) {
  return Object.entries(checks)
    .map(([id, check]) => {
      const ok = check?.ok === true;
      const severity = check?.severity ?? 'error';
      return `<li class="${ok ? 'ok' : severity === 'warn' ? 'warn' : 'fail'}">
        <span>${ok ? 'PASS' : severity === 'warn' ? 'WARN' : 'FAIL'}</span>
        <code>${escapeHtml(id)}</code>
        <small>${escapeHtml(check?.detail ?? '')}</small>
      </li>`;
    })
    .join('\n');
}

function makeReviewItems(items) {
  return items
    .map((item) => `<li>
      <strong>${escapeHtml(item.label)}</strong>
      <small>${escapeHtml(item.evidence)}</small>
    </li>`)
    .join('\n');
}

const visualScoreItems = [
  ['composition', '构图轴线', '中轴是否稳、左右是否均衡、卷轴是否是主角'],
  ['ritual', '礼制气质', '是否像朝堂案卷，而不是普通后台卡片'],
  ['density', '信息密度', '任务、证据、成果、主管判断是否可扫读'],
  ['action', '主行动清晰', '用户是否知道下一步该下什么旨'],
];

function makeScoreRows(routeId) {
  return visualScoreItems
    .map(([key, label, hint]) => `<label class="score-row">
      <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(hint)}</small></span>
      <input data-score="${escapeHtml(key)}" min="1" max="10" step="1" type="number" inputmode="numeric" aria-label="${escapeHtml(label)} score for ${escapeHtml(routeId)}">
    </label>`)
    .join('\n');
}

function makeVisualReviewHtml(report, reviewDir) {
  const cards = report.results
    .filter((item) => item.id !== 'console')
    .map((item) => {
      const screenshot = item.screenshot ? relativeAsset(reviewDir, item.screenshot) : '';
      const expanded = item.expandedScreenshot ? relativeAsset(reviewDir, item.expandedScreenshot) : '';
      return `<section id="review-${escapeHtml(item.id)}" class="route-card ${item.ok ? 'pass' : 'fail'}" data-route-card="${escapeHtml(item.id)}" data-route-name="${escapeHtml(item.name)}">
        <header>
          <div>
            <p>${escapeHtml(item.id)} · ${escapeHtml(item.route)}</p>
            <h2>${escapeHtml(item.name)}</h2>
          </div>
          <span>${item.ok ? 'PASS' : 'FAIL'}</span>
        </header>
        <div class="shots ${expanded ? 'two' : 'one'}">
          ${screenshot ? `<figure><img src="${escapeHtml(screenshot)}" alt="${escapeHtml(item.name)} collapsed screenshot"><figcaption>首屏 / 收卷态</figcaption></figure>` : ''}
          ${expanded ? `<figure><img src="${escapeHtml(expanded)}" alt="${escapeHtml(item.name)} expanded screenshot"><figcaption>展开态 / 案卷正文</figcaption></figure>` : ''}
        </div>
        <div class="review-grid">
          <div>
            <h3>礼部评分</h3>
            <div class="score-card">
              ${makeScoreRows(item.id)}
              <div class="score-result">
                <span>总分 <strong data-score-total>未评分</strong></span>
                <em data-score-verdict>待礼部会审</em>
              </div>
              <textarea data-score-note placeholder="礼部批注：指出最该改的一处，不写空泛评价。"></textarea>
            </div>
          </div>
          <div>
            <h3>礼部人工会审</h3>
            <ol class="review-list">${makeReviewItems(item.visualReview ?? [])}</ol>
          </div>
          <div>
            <h3>自动门禁</h3>
            <ul class="check-list">${makeCheckRows(item.checks ?? {})}</ul>
          </div>
        </div>
      </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>朝堂三轴 UI · 礼部视觉会审</title>
  <style>
    :root { color-scheme: dark; --gold:#F0C66A; --ink:#050812; --paper:#F5E9C9; --muted:#B6AB8C; --line:rgba(240,198,106,.22); --red:#7A241E; }
    * { box-sizing: border-box; }
    body { margin:0; background:radial-gradient(circle at 50% -10%, rgba(240,198,106,.16), transparent 38%), #050812; color:var(--paper); font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Noto Sans SC", sans-serif; }
    main { width:min(1680px, calc(100vw - 40px)); margin:0 auto; padding:32px 0 56px; }
    .hero { position:sticky; top:0; z-index:10; margin-bottom:22px; border-bottom:1px solid var(--line); background:linear-gradient(180deg, rgba(5,8,18,.96), rgba(5,8,18,.82)); padding:18px 0 16px; backdrop-filter: blur(14px); }
    .hero p { margin:0 0 6px; color:var(--muted); font-size:12px; letter-spacing:.18em; text-transform:uppercase; }
    .hero h1 { margin:0; color:var(--gold); font-family:"Noto Serif SC", serif; font-size:28px; letter-spacing:.06em; }
    .summary { display:flex; flex-wrap:wrap; gap:10px; margin-top:12px; }
    .summary span, .summary button { border:1px solid var(--line); border-radius:8px; padding:6px 10px; color:var(--muted); background:rgba(255,255,255,.035); font-size:12px; }
    .summary button { color:var(--gold); cursor:pointer; font-weight:800; }
    .release-gate { margin-top:14px; border:1px solid rgba(240,198,106,.18); border-radius:10px; background:linear-gradient(180deg, rgba(122,36,30,.18), rgba(255,255,255,.028)); padding:12px; }
    .release-gate header { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
    .release-gate h2 { margin:0; font-family:"Noto Serif SC", serif; color:var(--gold); font-size:16px; letter-spacing:.08em; }
    .release-gate strong { color:#FCA5B8; }
    .gate-list { display:flex; flex-wrap:wrap; gap:8px; margin:0; padding:0; list-style:none; }
    .gate-list li { border:1px solid rgba(252,165,184,.26); border-radius:8px; background:rgba(122,36,30,.16); color:#F5E9C9; padding:7px 9px; font-size:12px; }
    .gate-list a { color:#F0C66A; text-decoration:none; font-weight:800; }
    .gate-list .good { border-color:rgba(61,214,140,.24); background:rgba(61,214,140,.06); color:#B9F6D2; }
    .gate-list .trend { border-color:rgba(138,164,255,.24); background:rgba(138,164,255,.08); color:#BFD0FF; }
    .todo-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
    .todo-actions button { border:1px solid rgba(240,198,106,.22); border-radius:8px; background:rgba(240,198,106,.07); color:var(--gold); padding:6px 10px; font-size:12px; font-weight:800; cursor:pointer; }
    .route-card { margin-top:22px; border:1px solid var(--line); border-radius:10px; background:linear-gradient(180deg, rgba(240,198,106,.055), rgba(255,255,255,.025)); box-shadow:0 24px 80px rgba(0,0,0,.36); overflow:hidden; }
    .route-card > header { display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom:1px solid rgba(240,198,106,.16); padding:14px 16px; }
    .route-card header p { margin:0 0 4px; color:var(--muted); font-size:11px; }
    .route-card header h2 { margin:0; font-family:"Noto Serif SC", serif; font-size:20px; letter-spacing:.08em; }
    .route-card header span { border:1px solid rgba(61,214,140,.30); border-radius:999px; padding:5px 10px; color:#B9F6D2; background:rgba(61,214,140,.07); font-size:12px; font-weight:700; }
    .route-card.fail header span { border-color:rgba(252,165,184,.36); color:#FCA5B8; background:rgba(122,36,30,.18); }
    .shots { display:grid; gap:12px; padding:14px; background:rgba(0,0,0,.18); }
    .shots.two { grid-template-columns:repeat(2, minmax(0,1fr)); }
    .shots.one { grid-template-columns:minmax(0,1fr); }
    figure { margin:0; border:1px solid rgba(255,255,255,.08); border-radius:8px; overflow:hidden; background:#03050b; }
    img { display:block; width:100%; height:auto; }
    figcaption { border-top:1px solid rgba(255,255,255,.08); padding:8px 10px; color:var(--muted); font-size:12px; }
    .review-grid { display:grid; grid-template-columns:minmax(260px,.72fr) minmax(0,.88fr) minmax(0,1.2fr); gap:18px; padding:16px; align-items:start; }
    h3 { margin:0 0 10px; color:var(--gold); font-family:"Noto Serif SC", serif; font-size:15px; letter-spacing:.08em; }
    .score-card { display:grid; gap:8px; border:1px solid rgba(240,198,106,.12); border-radius:8px; padding:10px; background:rgba(0,0,0,.18); }
    .score-row { display:grid; grid-template-columns:minmax(0,1fr) 58px; gap:10px; align-items:center; border:1px solid rgba(255,255,255,.07); border-radius:8px; padding:8px; background:rgba(255,255,255,.024); }
    .score-row strong { display:block; font-size:13px; line-height:1.45; }
    .score-row input { width:58px; height:34px; border:1px solid rgba(240,198,106,.26); border-radius:8px; background:rgba(5,8,18,.82); color:var(--paper); text-align:center; font-weight:900; outline:none; }
    .score-row input:focus { border-color:var(--gold); box-shadow:0 0 0 2px rgba(240,198,106,.12); }
    .score-result { display:flex; align-items:center; justify-content:space-between; gap:10px; border-top:1px solid rgba(240,198,106,.12); padding-top:9px; color:var(--muted); font-size:12px; }
    .score-result strong { color:var(--gold); font-size:16px; }
    .score-result em { border:1px solid rgba(255,255,255,.10); border-radius:999px; padding:4px 8px; color:var(--muted); font-style:normal; font-weight:800; }
    .score-result em.good { border-color:rgba(61,214,140,.28); color:#B9F6D2; background:rgba(61,214,140,.07); }
    .score-result em.bad { border-color:rgba(252,165,184,.36); color:#FCA5B8; background:rgba(122,36,30,.18); }
    textarea[data-score-note] { min-height:74px; resize:vertical; border:1px solid rgba(240,198,106,.16); border-radius:8px; background:rgba(5,8,18,.72); color:var(--paper); padding:8px 10px; font:inherit; font-size:12px; line-height:1.55; outline:none; }
    textarea[data-score-note]:focus { border-color:var(--gold); box-shadow:0 0 0 2px rgba(240,198,106,.10); }
    .review-list, .check-list { margin:0; padding:0; list-style:none; display:grid; gap:8px; }
    .review-list li, .check-list li { border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:9px 10px; background:rgba(255,255,255,.026); }
    .review-list strong { display:block; font-size:13px; line-height:1.55; }
    small { display:block; margin-top:4px; color:var(--muted); line-height:1.5; }
    .check-list li { display:grid; grid-template-columns:52px minmax(150px,.42fr) minmax(0,1fr); align-items:start; gap:10px; }
    .check-list span { font-size:11px; font-weight:800; }
    .check-list code { color:#D9C79A; font-size:12px; white-space:normal; }
    .check-list .ok span { color:#B9F6D2; }
    .check-list .warn span { color:#F0C66A; }
    .check-list .fail span { color:#FCA5B8; }
    @media (max-width: 1180px) { .review-grid { grid-template-columns:1fr; } }
    @media (max-width: 980px) { .shots.two { grid-template-columns:1fr; } .check-list li { grid-template-columns:1fr; } main { width:min(100vw - 20px, 1680px); } }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p>Li Bu Visual Review · ${escapeHtml(report.checkedAt)}</p>
      <h1>朝堂三轴 UI 礼部视觉会审</h1>
      <div class="summary">
        <span>Decision: ${escapeHtml(report.decision)}</span>
        <span>Routes: ${report.summary.total}</span>
        <span>Passed: ${report.summary.passed}</span>
        <span>Failed: ${report.summary.failed}</span>
        <span>Viewport: ${report.viewport.width}×${report.viewport.height}</span>
        <button type="button" id="export-scores">导出评分 JSON</button>
        <button type="button" id="import-scores">导入上次评分</button>
        <input id="import-scores-file" type="file" accept="application/json" hidden>
      </div>
      <div class="release-gate" aria-live="polite">
        <header>
          <h2>礼部复审名单 / 趋势</h2>
          <span data-gate-summary>待评分</span>
        </header>
        <ul class="gate-list" data-gate-list>
          <li>填写评分后自动生成复审名单。</li>
        </ul>
        <ul class="gate-list" data-trend-list>
          <li class="trend">导入上次评分 JSON 后显示趋势。</li>
        </ul>
        <ul class="gate-list" data-todo-list>
          <li class="trend">评分后自动生成下一轮美工 TODO。</li>
        </ul>
        <div class="todo-actions">
          <button type="button" id="export-todos">导出 TODO JSON</button>
        </div>
      </div>
    </section>
    ${cards}
  </main>
  <script>
    (() => {
      const key = 'chaotang.threeAxisVisualScores.${escapeHtml(runId)}';
      const threshold = 32;
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      let previousScores = null;
      const cards = [...document.querySelectorAll('[data-route-card]')];
      const clamp = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return '';
        return String(Math.max(1, Math.min(10, Math.round(n))));
      };
      const readCard = (card) => {
        const id = card.getAttribute('data-route-card');
        const name = card.getAttribute('data-route-name') || id;
        const scores = {};
        card.querySelectorAll('[data-score]').forEach((input) => {
          scores[input.getAttribute('data-score')] = input.value ? Number(input.value) : null;
        });
        const total = Object.values(scores).reduce((sum, value) => sum + (Number(value) || 0), 0);
        const complete = Object.values(scores).every((value) => Number(value) >= 1);
        const note = card.querySelector('[data-score-note]')?.value || '';
        return { id, name, scores, total, complete, note };
      };
      const renderGate = (payload) => {
        const routes = Object.values(payload.routes || {});
        const incomplete = routes.filter((route) => !route.complete);
        const review = routes.filter((route) => route.complete && route.total < threshold).sort((a, b) => a.total - b.total);
        const passed = routes.filter((route) => route.complete && route.total >= threshold);
        const summary = document.querySelector('[data-gate-summary]');
        const list = document.querySelector('[data-gate-list]');
        if (summary) {
          summary.innerHTML = review.length > 0
            ? '<strong>' + review.length + '</strong> 页低于 ' + threshold + '，优先复审'
            : incomplete.length > 0
              ? incomplete.length + ' 页待评分，已通过 ' + passed.length + ' 页'
              : '全部评分完成，' + passed.length + ' 页可入发布候选';
        }
        if (!list) return;
        if (review.length === 0 && incomplete.length === 0) {
          list.innerHTML = '<li class="good">暂无复审页；全部达到发布候选线。</li>';
          return;
        }
        const reviewItems = review.map((route) => '<li><a href="#review-' + route.id + '">' + route.name + '</a> ' + route.total + '/40 · 礼部复审</li>');
        const incompleteItems = incomplete.map((route) => '<li><a href="#review-' + route.id + '">' + route.name + '</a> 未评分</li>');
        list.innerHTML = [...reviewItems, ...incompleteItems].join('');
      };
      const renderTrend = (payload) => {
        const list = document.querySelector('[data-trend-list]');
        if (!list) return;
        if (!previousScores?.routes) {
          list.innerHTML = '<li class="trend">导入上次评分 JSON 后显示趋势。</li>';
          return;
        }
        const routes = Object.values(payload.routes || {}).filter((route) => route.complete);
        const changes = routes
          .map((route) => {
            const prev = previousScores.routes?.[route.id];
            if (!prev || !prev.complete) return null;
            return { ...route, previousTotal: prev.total, delta: route.total - prev.total, wasLow: prev.total < threshold };
          })
          .filter(Boolean)
          .sort((a, b) => a.delta - b.delta);
        const regressed = changes.filter((route) => route.delta < 0);
        const persistentLow = changes.filter((route) => route.wasLow && route.total < threshold);
        const improved = changes.filter((route) => route.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 4);
        const items = [
          ...persistentLow.map((route) => '<li><a href="#review-' + route.id + '">' + route.name + '</a> 连续低分 ' + route.previousTotal + '→' + route.total + '</li>'),
          ...regressed.map((route) => '<li><a href="#review-' + route.id + '">' + route.name + '</a> 退步 ' + route.previousTotal + '→' + route.total + ' (' + route.delta + ')</li>'),
          ...improved.map((route) => '<li class="trend"><a href="#review-' + route.id + '">' + route.name + '</a> 改善 ' + route.previousTotal + '→' + route.total + ' (+' + route.delta + ')</li>'),
        ];
        list.innerHTML = items.length > 0 ? items.join('') : '<li class="good">与上次评分相比暂无退步或连续低分页。</li>';
      };
      const buildTodos = (payload) => {
        const current = Object.values(payload.routes || {});
        const previousRoutes = previousScores?.routes || {};
        const todos = [];
        for (const route of current) {
          const previous = previousRoutes[route.id];
          const delta = previous?.complete && route.complete ? route.total - previous.total : null;
          const persistentLow = previous?.complete && previous.total < threshold && route.complete && route.total < threshold;
          const regressed = delta !== null && delta < 0;
          let reason = '';
          let priority = 99;
          if (persistentLow) {
            reason = '连续低分';
            priority = 1;
          } else if (regressed) {
            reason = '本轮退步';
            priority = 2;
          } else if (route.complete && route.total < threshold) {
            reason = '当前低于发布候选线';
            priority = 3;
          } else if (!route.complete) {
            reason = '未评分，无法发布判断';
            priority = 4;
          }
          if (!reason) continue;
          todos.push({
            id: route.id,
            name: route.name,
            priority,
            reason,
            total: route.complete ? route.total : null,
            previousTotal: previous?.complete ? previous.total : null,
            delta,
            action: persistentLow || regressed
              ? '优先重审构图轴线和主行动清晰度，必要时重做首屏布局。'
              : route.complete
                ? '补强礼制气质、信息密度和卷轴主行动表达。'
                : '先完成礼部四项评分，再决定是否进入复审。',
          });
        }
        return todos.sort((a, b) => a.priority - b.priority || (a.total ?? -1) - (b.total ?? -1));
      };
      const renderTodos = (payload) => {
        const list = document.querySelector('[data-todo-list]');
        if (!list) return;
        const todos = buildTodos(payload);
        if (todos.length === 0) {
          list.innerHTML = '<li class="good">暂无下一轮美工 TODO；全部达到当前发布候选线。</li>';
          return;
        }
        list.innerHTML = todos.map((todo) => '<li><a href="#review-' + todo.id + '">' + todo.name + '</a> P' + todo.priority + ' · ' + todo.reason + ' · ' + todo.action + '</li>').join('');
      };
      const renderCard = (card) => {
        const result = readCard(card);
        const totalNode = card.querySelector('[data-score-total]');
        const verdictNode = card.querySelector('[data-score-verdict]');
        if (totalNode) totalNode.textContent = result.complete ? result.total + '/40' : '未评分';
        if (verdictNode) {
          verdictNode.textContent = !result.complete ? '待礼部会审' : result.total >= threshold ? '可入发布候选' : '礼部复审';
          verdictNode.className = !result.complete ? '' : result.total >= threshold ? 'good' : 'bad';
        }
      };
      const saveAll = () => {
        const payload = {
          runId: '${escapeHtml(runId)}',
          threshold,
          savedAt: new Date().toISOString(),
          routes: Object.fromEntries(cards.map((card) => {
            const result = readCard(card);
            return [result.id, result];
          })),
        };
        localStorage.setItem(key, JSON.stringify(payload));
        cards.forEach(renderCard);
        renderGate(payload);
        renderTrend(payload);
        renderTodos(payload);
        return payload;
      };
      cards.forEach((card) => {
        const id = card.getAttribute('data-route-card');
        const record = saved.routes?.[id] || saved[id];
        if (record) {
          card.querySelectorAll('[data-score]').forEach((input) => {
            const value = record.scores?.[input.getAttribute('data-score')];
            if (value) input.value = clamp(value);
          });
          const note = card.querySelector('[data-score-note]');
          if (note && record.note) note.value = record.note;
        }
        card.addEventListener('input', (event) => {
          if (event.target.matches('[data-score]')) event.target.value = clamp(event.target.value);
          saveAll();
        });
        renderCard(card);
      });
      renderGate(saveAll());
      document.getElementById('export-scores')?.addEventListener('click', () => {
        const payload = saveAll();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'three-axis-visual-scores-${escapeHtml(runId)}.json';
        a.click();
        URL.revokeObjectURL(url);
      });
      document.getElementById('export-todos')?.addEventListener('click', () => {
        const payload = saveAll();
        const todos = {
          runId: payload.runId,
          threshold,
          exportedAt: new Date().toISOString(),
          todos: buildTodos(payload),
        };
        const blob = new Blob([JSON.stringify(todos, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'three-axis-visual-todos-${escapeHtml(runId)}.json';
        a.click();
        URL.revokeObjectURL(url);
      });
      document.getElementById('import-scores')?.addEventListener('click', () => {
        document.getElementById('import-scores-file')?.click();
      });
      document.getElementById('import-scores-file')?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          previousScores = JSON.parse(await file.text());
          renderTrend(saveAll());
        } catch {
          alert('评分 JSON 解析失败');
        } finally {
          event.target.value = '';
        }
      });
    })();
  </script>
</body>
</html>
`;
}

function writeReport(results) {
  const report = buildReport(results);
  const visualReviewPath = path.join(outputDir, 'visual-review.html');
  const latestVisualReviewPath = path.join(outputRoot, 'latest-visual-review.html');
  report.visualReviewHtml = visualReviewPath;
  report.latestVisualReviewHtml = latestVisualReviewPath;
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(visualReviewPath, makeVisualReviewHtml(report, outputDir));
  fs.writeFileSync(latestVisualReviewPath, `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${escapeHtml(`${runId}/visual-review.html`)}"><a href="${escapeHtml(`${runId}/visual-review.html`)}">Open latest visual review</a>\n`);
  fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main() {
  if (unknownRouteIds.length > 0) {
    throw new Error(`Unknown THREE_AXIS_ROUTES id(s): ${unknownRouteIds.join(', ')}`);
  }
  if (activeRoutes.length === 0) {
    throw new Error('No routes selected for three-axis UI harness');
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
  });
  await setupContext(context);
  await context.route('**/api/court/events/stream', (route) => {
    void route.fulfill({ status: 204, body: '' });
  });
  await context.route('**/api/tasks/*/events', (route) => {
    void route.fulfill({ status: 204, body: '' });
  });
  await context.route('**/api/court/libu/ask', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        reply: '礼部已收录会审请求，进入视觉与礼制校验队列。',
      }),
    });
  });
  const consoleErrors = [];
  const results = [];

  // 每条路由必须在三轴标记真正水合后才量；冷编译/未水合的半成品会让 topnav/scroll/panel
  // 测成假红（实测案例：兵部满跑被冷编译撞上 → 假失败，单独热跑即过）。
  const HYDRATION_MARKERS = [
    '[data-three-axis-topnav]',
    '[data-three-axis-panel="left"]',
    '[data-three-axis-scroll]',
  ];

  for (const route of activeRoutes) {
    const screenshot = path.join(outputDir, `${route.id}.png`);
    const result = {
      id: route.id,
      name: route.name,
      route: route.path,
      url: routeUrl(route.path),
      ok: false,
      screenshot,
      blockers: [],
      checks: {},
      metrics: {},
    };

    // 每路由独立 page：避免上一页残留(展开浮层 / dispatch 后的导航)污染下一页的量测。
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnoredConsoleError(msg.text())) consoleErrors.push(msg.text());
    });

    try {
      await page.goto(route.url ?? routeUrl(route.path), { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(route.waitMs ?? 1800);
      // 水合门：三轴标记可见前不量，杜绝冷编译假红。缺失则放行(让真实 check 去判)，不掩盖真问题。
      for (const marker of HYDRATION_MARKERS) {
        await page.waitForSelector(marker, { state: 'visible', timeout: 12_000 }).catch(() => undefined);
      }
      if (route.readySelector) {
        await page.waitForSelector(route.readySelector, { state: 'visible', timeout: 12_000 }).catch(() => undefined);
      }
      const geometry = await inspectGeometry(page, route, screenshot);
      Object.assign(result, geometry);
    } catch (error) {
      result.blockers.push(error instanceof Error ? error.message : String(error));
    } finally {
      await page.close().catch(() => undefined);
    }

    results.push(result);
    const status = result.ok ? 'OK ' : 'WARN';
    console.log(`${status} ${route.id} ${route.name} -> ${path.relative(process.cwd(), screenshot)}`);
    if (!result.ok) {
      for (const blocker of result.blockers) console.log(`  - ${blocker}`);
    }
  }

  await browser.close();

  if (consoleErrors.length > 0) {
    results.push({
      id: 'console',
      name: 'Console errors',
      route: '*',
      ok: false,
      screenshot: '',
      checks: {},
      metrics: {},
      blockers: consoleErrors.slice(0, 12),
    });
  }

  const report = writeReport(results);
  console.log(`Three-axis UI harness: ${report.decision}`);
  console.log(`Report: ${latestPath}`);

  if (strict && report.decision === 'FAIL') process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

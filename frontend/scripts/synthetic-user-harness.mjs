#!/usr/bin/env node
/**
 * Synthetic user harness for Chaotang OS.
 *
 * This is a read-only browser harness by default. It does not submit real tasks.
 * It checks whether different user roles can understand the final entry, trust the
 * LIVE/DEMO boundary, find the execution path, and find evidence of results.
 */

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HARNESS_BASE_URL ?? 'http://127.0.0.1:3050';
const basePath = process.env.HARNESS_BASE_PATH ?? '/chaotang';
const outputPath = process.env.SYNTHETIC_USER_REPORT ?? 'dev/artifacts/synthetic-user-report.json';

const personas = [
  {
    id: 'ceo',
    name: '老板',
    viewport: { width: 1440, height: 920 },
    goal: '判断今天最该处理的经营事项，并能把事项交给系统执行。',
    mustSee: ['上书房', '奏折', '军机处', 'LIVE'],
    industryWords: ['经营', '决策', '建议', '任务'],
  },
  {
    id: 'ops',
    name: '运营负责人',
    viewport: { width: 1440, height: 920 },
    goal: '确认系统能把事项拆成任务，并看到状态流转。',
    mustSee: ['军机处', '任务', '状态'],
    industryWords: ['执行', '进度', '阻塞', '验收'],
  },
  {
    id: 'sales',
    name: '销售负责人',
    viewport: { width: 1440, height: 920 },
    goal: '判断能否把商机或客户问题转成可跟进任务。',
    mustSee: ['庄园', '部院', '任务'],
    industryWords: ['客户', '销售', '商机', '增长'],
  },
  {
    id: 'finance',
    name: '财务负责人',
    viewport: { width: 1440, height: 920 },
    goal: '判断任务是否有预算、风险和收益边界。',
    mustSee: ['户部', '庄园', '风险'],
    industryWords: ['预算', '收益', '成本', 'ROI'],
  },
  {
    id: 'legal',
    name: '法务负责人',
    viewport: { width: 1440, height: 920 },
    goal: '判断系统是否明确风险、证据和审计边界。',
    mustSee: ['史馆', '归档', '风险'],
    industryWords: ['法务', '合规', '证据', '审计'],
  },
  {
    id: 'investor',
    name: '投资人',
    viewport: { width: 1440, height: 920 },
    goal: '判断这是否是一个可复制、可度量的经营系统。',
    mustSee: ['朝堂 OS', 'LIVE', '史馆'],
    industryWords: ['指标', '复盘', '增长', '闭环'],
  },
  {
    id: 'editor',
    name: '内容主编',
    viewport: { width: 1440, height: 920 },
    goal: '判断资料、图片和案例是否能进入内容生产流程。',
    mustSee: ['资料', '史馆', '上书房'],
    industryWords: ['内容', '素材', '案例', '归档'],
  },
  {
    id: 'support',
    name: '客服主管',
    viewport: { width: 1440, height: 920 },
    goal: '判断用户反馈能否进入处理和复盘。',
    mustSee: ['任务', '史馆', '军机处'],
    industryWords: ['反馈', '客户', '处理', '复盘'],
  },
  {
    id: 'traditional-owner',
    name: '传统企业老板',
    viewport: { width: 1366, height: 820 },
    goal: '不用懂 AI，也能看懂第一步该做什么。',
    mustSee: ['上书房', '奏折', '建议'],
    industryWords: ['提交', '处理', '结果', '下一步'],
  },
  {
    id: 'ai-novice',
    name: 'AI 新手',
    viewport: { width: 1366, height: 820 },
    goal: '区分真实能力、演示能力和需要配置的能力。',
    mustSee: ['LIVE', 'DEMO', 'MIXED'],
    industryWords: ['真能力', '演示', '边界', '模型'],
  },
  {
    id: 'mobile-user',
    name: '移动端用户',
    viewport: { width: 390, height: 844, isMobile: true },
    goal: '在手机上看清入口、状态和结果，不出现横向滚动。',
    mustSee: ['上书房', '军机处'],
    industryWords: ['奏折', '任务', '结果'],
  },
  {
    id: 'security',
    name: '安全/合规负责人',
    viewport: { width: 1440, height: 920 },
    goal: '确认系统不会把 mock 包装成真实能力，并能说明审计边界。',
    mustSee: ['LIVE', 'DEMO', '史馆'],
    industryWords: ['审计', '边界', '风险', '归档'],
  },
];

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeToken() {
  const now = Math.floor(Date.now() / 1000);
  return `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(JSON.stringify({
    sub: 'synthetic-user',
    username: 'synthetic-user',
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
    sessionStorage.setItem('courtos.opening.played', '1');
    document.cookie = `courtos.access_token=${encodeURIComponent(session.accessToken)}; Path=/; SameSite=Lax; Max-Age=28800`;
  }, {
    accessToken: token,
    refreshToken: `${token}-refresh`,
    tenantId: 6,
    username: 'synthetic-user',
    accountType: 1,
    expiresAt: (now + 8 * 60 * 60) * 1000,
  });
}

function countMatches(text, words) {
  return words.filter((word) => text.includes(word)).length;
}

async function evaluatePersona(browser, persona) {
  const context = await browser.newContext({
    viewport: { width: persona.viewport.width, height: persona.viewport.height },
    isMobile: persona.viewport.isMobile === true,
    deviceScaleFactor: persona.viewport.isMobile ? 2 : 1,
  });
  await setupContext(context);
  const page = await context.newPage();
  const consoleErrors = [];
  const failedResponses = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
  });

  const result = {
    id: persona.id,
    name: persona.name,
    goal: persona.goal,
    ok: false,
    score: 0,
    checks: {},
    blockers: [],
    notes: [],
  };

  try {
    const response = await page.goto(`${baseUrl}${basePath}/court-briefing`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(1800);

    const text = await page.locator('body').innerText({ timeout: 10000 });
    const title = await page.title();
    const viewportOverflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return Math.max(0, doc.scrollWidth - doc.clientWidth);
    });

    const mustSeeCount = countMatches(text, persona.mustSee);
    const industryCount = countMatches(text, persona.industryWords);
    const hasEntry = response?.ok() === true && text.includes('上书房');
    const hasExecutionPath = text.includes('军机处') || text.includes('任务');
    const hasResultPath = text.includes('史馆') || text.includes('归档') || text.includes('结果');
    const hasTrustBoundary = text.includes('LIVE') && (text.includes('DEMO') || text.includes('MIXED') || text.includes('演示'));
    const noRuntimeError = !/Unhandled Runtime Error|Application error|Build Error|Next\.js/i.test(text);
    const noBadConsole = consoleErrors.length === 0;
    const noBadResponses = failedResponses.filter((item) => !item.url.includes('/api/court/events/stream')).length === 0;
    const mobileOk = viewportOverflow <= 2;

    result.checks = {
      title,
      status: response?.status() ?? 0,
      mustSee: `${mustSeeCount}/${persona.mustSee.length}`,
      industryLanguage: `${industryCount}/${persona.industryWords.length}`,
      hasEntry,
      hasExecutionPath,
      hasResultPath,
      hasTrustBoundary,
      noRuntimeError,
      noBadConsole,
      noBadResponses,
      mobileOk,
      viewportOverflow,
    };

    if (!hasEntry) result.blockers.push('找不到上书房最终入口');
    if (mustSeeCount < Math.ceil(persona.mustSee.length * 0.67)) result.blockers.push('关键角色词不足');
    if (!hasExecutionPath) result.blockers.push('找不到执行路径');
    if (!hasResultPath) result.blockers.push('找不到结果/归档路径');
    if (!hasTrustBoundary) result.blockers.push('LIVE/DEMO 边界不清楚');
    if (!noRuntimeError) result.blockers.push('页面出现运行时错误');
    if (!noBadConsole) result.blockers.push('浏览器控制台有 error');
    if (!noBadResponses) result.blockers.push('页面请求出现 4xx/5xx');
    if (!mobileOk) result.blockers.push('移动端横向溢出');

    const checks = [
      hasEntry,
      mustSeeCount >= Math.ceil(persona.mustSee.length * 0.67),
      industryCount >= 1,
      hasExecutionPath,
      hasResultPath,
      hasTrustBoundary,
      noRuntimeError,
      noBadConsole,
      noBadResponses,
      mobileOk,
    ];
    result.score = checks.filter(Boolean).length;
    result.ok = result.score >= 8 && result.blockers.length === 0;

    if (industryCount === 0) {
      result.notes.push('行业语言弱；PM/UX 应补一条贴近该角色的示例或入口说明。');
    }
    if (result.score < 10 && result.blockers.length === 0) {
      result.notes.push('可用但不够强；适合进入 UX 文案细化。');
    }
  } catch (error) {
    result.blockers.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }

  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const persona of personas) {
      results.push(await evaluatePersona(browser, persona));
    }
  } finally {
    await browser.close();
  }

  const passed = results.filter((item) => item.ok).length;
  const averageScore = Math.round((results.reduce((sum, item) => sum + item.score, 0) / results.length) * 10) / 10;
  const blockers = results.flatMap((item) => item.blockers.map((blocker) => ({ persona: item.name, blocker })));
  const decision = passed >= 10 && blockers.length === 0 ? 'SHIP' : passed >= 8 ? 'FIX_HIGH_SIGNAL' : 'STOP';
  const report = {
    checkedAt: new Date().toISOString(),
    baseUrl,
    basePath,
    decision,
    summary: {
      total: results.length,
      passed,
      failed: results.length - passed,
      averageScore,
      blockerCount: blockers.length,
    },
    blockers,
    results,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));

  if (decision === 'STOP') process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

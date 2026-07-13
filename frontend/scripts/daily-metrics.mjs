#!/usr/bin/env node
/**
 * daily-metrics.mjs — 朝堂每日经营晨报
 *
 * 每天 08:00 推送一条 Telegram 消息，包含：
 *   1. 服务健康快照
 *   2. 决策漏斗（任务→圣裁→归档）
 *   3. 圣裁完成率（核心指标）
 *   4. 用户活跃度
 *   5. AI 调用成本
 *   6. 质门通过率
 *   7. 异常告警
 *
 * 接入方式（每天 08:00 cron）：
 *   0 8 * * * cd /home/ubuntu/Projects/chaotang-os/frontend && \
 *             node scripts/daily-metrics.mjs >> ~/.openclaw/log/chaotang-daily-metrics.log 2>&1
 *
 * 手动触发：
 *   node scripts/daily-metrics.mjs
 *   node scripts/daily-metrics.mjs --test    # 测试模式：用假数据，不需要DB连接
 *
 * 依赖：
 *   @libsql/client（已在 package.json）
 *   TURSO_DB_URL + TURSO_AUTH_TOKEN（.env.local）
 *   CHAOTANG_ALERT_URL（.env.local，可选）
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { createClient } from '@libsql/client';

// ─── 配置 ────────────────────────────────────────────────────────────────────

const TEST_MODE = process.argv.includes('--test');
const LOG_DIR   = `${process.env.HOME}/.openclaw/log`;
const LOG_FILE  = `${LOG_DIR}/chaotang-daily-metrics.log`;

// 告警阈值
const THRESHOLDS = {
  adoptionRate:    0.60,  // 圣裁采纳率 < 60% → 告警
  qualityPassRate: 0.70,  // 质门通过率 < 70% → 告警
  dailyCostUsd:    5.00,  // 今日 AI 成本 > $5 → 提醒
  weeklyCostUsd:   25.00, // 本周 AI 成本 > $25 → 提醒
};

// 服务健康端点
const HEALTH_ENDPOINTS = [
  { name: 'courtos-web', url: 'http://127.0.0.1:3050/chaotang', timeout: 3000 },
  { name: 'LiteLLM',     url: 'http://127.0.0.1:4444/health/readiness', timeout: 3000 },
  { name: 'jiqun',       url: 'http://127.0.0.1:8081/api/health', timeout: 3000 },
  { name: 'legal-agent', url: 'http://127.0.0.1:18003/health', timeout: 3000 },
];

// ─── 工具函数 ──────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = new URL('../.env.local', import.meta.url).pathname;
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, line + '\n');
  } catch {}
}

function pct(n, d) {
  if (!d) return 'N/A';
  return `${Math.round((n / d) * 100)}%`;
}

function fmtUsd(v) {
  if (v == null || isNaN(v)) return '$0.00';
  return `$${Number(v).toFixed(2)}`;
}

// ─── 健康探测 ──────────────────────────────────────────────────────────────

async function probeHealth() {
  const results = await Promise.allSettled(
    HEALTH_ENDPOINTS.map(async ({ name, url, timeout }) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        return { name, ok: res.ok, status: res.status };
      } catch {
        clearTimeout(timer);
        return { name, ok: false, status: 0 };
      }
    })
  );
  return results.map((r) => (r.status === 'fulfilled' ? r.value : { name: '?', ok: false, status: 0 }));
}

// ─── 数据库查询 ────────────────────────────────────────────────────────────

async function queryMetrics(db) {
  const today   = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const q = (sql, args = []) => db.execute({ sql, args }).then((r) => r.rows);

  const [
    // 1. 今日新增决策任务
    todayTasks,
    // 2. 今日圣裁（emperor_decisions）
    todayDecisions,
    // 3. 今日采纳圣裁（signed / edited）
    todayAdopted,
    // 4. 今日史馆归档
    todayArchives,
    // 5. 本周史馆归档
    weekArchives,
    // 6. 今日活跃用户（上书房发消息）
    todayActiveUsers,
    // 7. 今日上书房消息总数
    todayMessages,
    // 8. 今日 AI 调用次数
    todayAgentRuns,
    // 9. 今日 AI Token 成本
    todayCost,
    // 10. 本周 AI Token 成本
    weekCost,
    // 11. 本周奏折总数
    weekMemorials,
    // 12. 本周质门通过
    weekQualityPassed,
    // 13. 今日人工确认触发
    todayHumanConfirm,
    // 14. 待处理任务（未完成）
    pendingTasks,
  ] = await Promise.all([
    q(`SELECT COUNT(*) AS n FROM decision_tasks WHERE date(created_at) = ?`, [today]),
    q(`SELECT COUNT(*) AS n FROM emperor_decisions WHERE date(created_at) = ?`, [today]),
    q(`SELECT COUNT(*) AS n FROM emperor_decisions WHERE date(created_at) = ? AND action IN ('signed','edited')`, [today]),
    q(`SELECT COUNT(*) AS n FROM shiguan_archives WHERE date(created_at) = ?`, [today]),
    q(`SELECT COUNT(*) AS n FROM shiguan_archives WHERE date(created_at) >= ?`, [weekAgo]),
    q(`SELECT COUNT(DISTINCT user_id) AS n FROM shangshufang_im_messages WHERE date(created_at) = ?`, [today]),
    q(`SELECT COUNT(*) AS n FROM shangshufang_im_messages WHERE date(created_at) = ?`, [today]),
    q(`SELECT COUNT(*) AS n FROM agent_runs WHERE date(created_at) = ?`, [today]),
    q(`SELECT COALESCE(SUM(token_cost_usd),0) AS v FROM agent_runs WHERE date(created_at) = ?`, [today]),
    q(`SELECT COALESCE(SUM(token_cost_usd),0) AS v FROM agent_runs WHERE date(created_at) >= ?`, [weekAgo]),
    q(`SELECT COUNT(*) AS n FROM memorials WHERE date(created_at) >= ?`, [weekAgo]),
    q(`SELECT COUNT(*) AS n FROM memorials WHERE date(created_at) >= ? AND quality_passed = 1`, [weekAgo]),
    q(`SELECT COUNT(*) AS n FROM memorials WHERE date(created_at) = ? AND human_confirmation_required = 1`, [today]),
    q(`SELECT COUNT(*) AS n FROM decision_tasks WHERE status NOT IN ('completed','archived','rejected')`, []),
  ]);

  return {
    today,
    tasks:        { today: Number(todayTasks[0]?.n ?? 0), pending: Number(pendingTasks[0]?.n ?? 0) },
    decisions:    { today: Number(todayDecisions[0]?.n ?? 0), adopted: Number(todayAdopted[0]?.n ?? 0) },
    archives:     { today: Number(todayArchives[0]?.n ?? 0), week: Number(weekArchives[0]?.n ?? 0) },
    activity:     { users: Number(todayActiveUsers[0]?.n ?? 0), messages: Number(todayMessages[0]?.n ?? 0) },
    ai:           { runs: Number(todayAgentRuns[0]?.n ?? 0), todayCost: Number(todayCost[0]?.v ?? 0), weekCost: Number(weekCost[0]?.v ?? 0) },
    quality:      { weekTotal: Number(weekMemorials[0]?.n ?? 0), weekPassed: Number(weekQualityPassed[0]?.n ?? 0), humanConfirm: Number(todayHumanConfirm[0]?.n ?? 0) },
  };
}

// ─── 测试假数据 ────────────────────────────────────────────────────────────

function fakeMockMetrics() {
  return {
    today: new Date().toISOString().slice(0, 10),
    tasks:     { today: 5,  pending: 12 },
    decisions: { today: 4,  adopted: 3  },
    archives:  { today: 3,  week: 18    },
    activity:  { users: 2,  messages: 24 },
    ai:        { runs: 31,  todayCost: 0.84, weekCost: 3.21 },
    quality:   { weekTotal: 14, weekPassed: 11, humanConfirm: 1 },
  };
}

// ─── 消息格式化 ────────────────────────────────────────────────────────────

function buildReport(health, m) {
  const adoptionRate    = m.decisions.today ? m.decisions.adopted / m.decisions.today : null;
  const qualityPassRate = m.quality.weekTotal ? m.quality.weekPassed / m.quality.weekTotal : null;
  const healthOk        = health.every((h) => h.ok);
  const downServices    = health.filter((h) => !h.ok).map((h) => h.name);

  // 告警列表
  const alerts = [];
  if (!healthOk)
    alerts.push(`🔴 服务 DOWN：${downServices.join('、')}`);
  if (adoptionRate !== null && adoptionRate < THRESHOLDS.adoptionRate)
    alerts.push(`⚠️ 圣裁采纳率仅 ${pct(m.decisions.adopted, m.decisions.today)}（阈值 ${pct(THRESHOLDS.adoptionRate * 100, 100)}）`);
  if (qualityPassRate !== null && qualityPassRate < THRESHOLDS.qualityPassRate)
    alerts.push(`⚠️ 质门通过率仅 ${pct(m.quality.weekPassed, m.quality.weekTotal)}（阈值 ${pct(THRESHOLDS.qualityPassRate * 100, 100)}）`);
  if (m.ai.todayCost > THRESHOLDS.dailyCostUsd)
    alerts.push(`💸 今日 AI 成本 ${fmtUsd(m.ai.todayCost)}（阈值 ${fmtUsd(THRESHOLDS.dailyCostUsd)}）`);
  if (m.quality.humanConfirm > 0)
    alerts.push(`🚦 今日触发人工确认 ${m.quality.humanConfirm} 次（高风险裁决，需人工介入）`);

  const healthLine = healthOk
    ? '🟢 全部 4 服务正常'
    : `🔴 DOWN: ${downServices.join(' / ')} | 🟢 UP: ${health.filter((h) => h.ok).map((h) => h.name).join(' / ')}`;

  const adoptionLine = adoptionRate === null
    ? '今日暂无圣裁'
    : `${pct(m.decisions.adopted, m.decisions.today)}（${m.decisions.adopted}/${m.decisions.today} 采纳）`;

  const qualityLine = qualityPassRate === null
    ? '本周暂无奏折'
    : `${pct(m.quality.weekPassed, m.quality.weekTotal)}（${m.quality.weekPassed}/${m.quality.weekTotal} 通过）`;

  const lines = [
    `🏛️ 朝堂晨报 · ${m.today}`,
    ``,
    `【服务】${healthLine}`,
    ``,
    `📊 决策漏斗（今日）`,
    `  新任务    ${m.tasks.today} 条  |  待处理 ${m.tasks.pending} 条`,
    `  圣裁      ${m.decisions.today} 次  |  采纳 ${adoptionLine}`,
    `  史馆归档  今日 ${m.archives.today} 条  |  本周 ${m.archives.week} 条`,
    ``,
    `👤 用户活跃（今日）`,
    `  活跃用户  ${m.activity.users} 人`,
    `  上书房消息 ${m.activity.messages} 条`,
    ``,
    `🤖 AI 调用成本`,
    `  今日  ${m.ai.runs} 次 · ${fmtUsd(m.ai.todayCost)}`,
    `  本周  ${fmtUsd(m.ai.weekCost)}`,
    ``,
    `✅ 质门状态（本周）`,
    `  奏折质门通过率  ${qualityLine}`,
    m.quality.humanConfirm > 0
      ? `  🚦 人工确认  今日触发 ${m.quality.humanConfirm} 次`
      : `  人工确认    今日未触发`,
  ];

  if (alerts.length > 0) {
    lines.push('');
    lines.push('🔔 告警');
    for (const a of alerts) lines.push(`  ${a}`);
  } else {
    lines.push('');
    lines.push('✨ 无告警，一切正常');
  }

  return lines.join('\n');
}

// ─── Telegram 推送 ─────────────────────────────────────────────────────────

async function sendTelegram(alertUrl, text) {
  if (!alertUrl) return false;
  try {
    const url = new URL(alertUrl);
    url.searchParams.set('text', text);
    const res = await fetch(url.toString(), { method: 'GET', signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── 主流程 ────────────────────────────────────────────────────────────────

async function main() {
  log(`── 朝堂晨报开始 ${TEST_MODE ? '[测试模式]' : ''} ──`);

  // 1. 加载环境变量
  const env = loadEnv();
  const TURSO_DB_URL     = env.TURSO_DB_URL     || process.env.TURSO_DB_URL;
  const TURSO_AUTH_TOKEN = env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  const ALERT_URL        = env.CHAOTANG_ALERT_URL || process.env.CHAOTANG_ALERT_URL;

  // 2. 探测服务健康
  log('探测服务健康...');
  const health = await probeHealth();
  for (const h of health) {
    log(`  ${h.ok ? '✓' : '✗'} ${h.name} (${h.status || 'TIMEOUT'})`);
  }

  // 3. 查询数据库指标
  let metrics;
  if (TEST_MODE) {
    log('测试模式：使用模拟数据');
    metrics = fakeMockMetrics();
  } else if (!TURSO_DB_URL) {
    log('⚠ TURSO_DB_URL 未配置，跳过 DB 查询（仅发服务健康报告）');
    metrics = fakeMockMetrics();
    metrics.today = new Date().toISOString().slice(0, 10);
    // 清零所有计数，标明数据不可用
    metrics._dbUnavailable = true;
  } else {
    try {
      const db = createClient({
        url:       TURSO_DB_URL,
        authToken: TURSO_AUTH_TOKEN,
      });
      log('连接 Turso 数据库...');
      metrics = await queryMetrics(db);
      log('数据库查询完成');
    } catch (err) {
      log(`✗ 数据库查询失败: ${err.message}`);
      metrics = fakeMockMetrics();
      metrics._dbError = err.message;
    }
  }

  // 4. 生成报告
  let report = buildReport(health, metrics);
  if (metrics._dbUnavailable) {
    report += '\n\n⚠️ DB未配置，以上数据为占位，请配置TURSO_DB_URL';
  }
  if (metrics._dbError) {
    report += `\n\n⚠️ DB查询失败: ${metrics._dbError}`;
  }

  log('──────────────────────────────────────');
  log(report.replace(/\n/g, '\n'));
  log('──────────────────────────────────────');

  // 5. 推送 Telegram
  if (ALERT_URL) {
    log('推送 Telegram...');
    const ok = await sendTelegram(ALERT_URL, report);
    log(ok ? '✓ Telegram 推送成功' : '✗ Telegram 推送失败');
  } else {
    log('CHAOTANG_ALERT_URL 未配置，跳过推送');
    log('提示：在 .env.local 加 CHAOTANG_ALERT_URL=https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<ID>');
  }

  log('── 朝堂晨报完成 ──');
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * health-monitor.mjs — 朝堂全服务主动健康巡检
 *
 * 检查: LiteLLM(:4444) / jiqun(:8081) / legal-agent(:18003) / courtos-web(:3050)
 * DOWN 时：写 alert log + POST CHAOTANG_ALERT_URL（Telegram webhook）
 *
 * 用法：
 *   node scripts/health-monitor.mjs              # 一次巡检，退出码 = DOWN 服务数
 *
 * cron 接入（每5分钟）：
 *   crontab -e  →  加入:
 *   *\/5 * * * * cd /home/ubuntu/Projects/chaotang-os/frontend && node scripts/health-monitor.mjs >> ~/.openclaw/log/chaotang-health.log 2>&1
 *
 * 告警通道：
 *   优先 CHAOTANG_ALERT_URL（Telegram bot webhook POST {text: ...}）
 *   降级：写 ~/.openclaw/log/chaotang-health-alert.log
 */

import { appendFileSync } from 'fs';

const ALERT_URL = process.env.CHAOTANG_ALERT_URL ?? '';
const TIMEOUT_MS = 3000;
const LOG_DIR = `${process.env.HOME}/.openclaw/log`;

// LiteLLM: /health/readiness 不需要 API key；courtos-web: /chaotang 直接 200
const SERVICES = [
  {
    name: 'LiteLLM',
    url: 'http://127.0.0.1:4444/health/readiness',
    critical: true,
    impact: 'callLLM 全部降 FALLBACK，六部 AI 无法工作',
    restart: 'systemctl --user restart litellm.service',
  },
  {
    name: 'jiqun',
    url: `${process.env.JIQUN_API_URL ?? 'http://127.0.0.1:8081'}/api/health`,
    critical: true,
    impact: '执行臂断路，蜂群无法运行，sign-off 圣裁黑洞',
    restart: 'systemctl --user restart jiqun.service  # manual: cd /home/ubuntu/Projects/chaotang-os/backend && .venv/bin/python -m gunicorn -c gunicorn.conf.py web.main:app',
  },
  {
    name: 'legal-agent',
    url: `${process.env.LEGAL_AGENT_BASE_URL ?? 'http://127.0.0.1:18003'}/health`,
    critical: false,
    impact: '刑部法务审查降规则兜底',
    restart: 'systemctl --user restart legal-agent-manor.service',
  },
  {
    name: 'courtos-web',
    url: 'http://127.0.0.1:3050/chaotang',
    critical: true,
    impact: '用户无法访问朝堂',
    restart: 'systemctl --user restart courtos-web.service',
  },
];

async function probe(svc) {
  try {
    const res = await fetch(svc.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return { ...svc, ok: res.ok, httpStatus: res.status };
  } catch (e) {
    return { ...svc, ok: false, httpStatus: 0, error: e.message };
  }
}

function writeAlertLog(line) {
  try {
    appendFileSync(`${LOG_DIR}/chaotang-health-alert.log`, line + '\n');
  } catch {
    // log dir 不存在时忽略
  }
}

async function sendAlert(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  writeAlertLog(line);
  if (!ALERT_URL) return;
  try {
    await fetch(ALERT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `🚨 朝堂告警\n${msg}` }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    writeAlertLog(`[${ts}] 告警 POST 失败: ${e.message}`);
  }
}

const results = await Promise.all(SERVICES.map(probe));
const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');

for (const r of results) {
  const icon = r.ok ? '✓' : (r.critical ? '✗' : '⚠');
  const detail = r.ok
    ? `HTTP ${r.httpStatus}`
    : (r.error ? `ERROR: ${r.error.slice(0, 60)}` : `HTTP ${r.httpStatus}`);
  console.log(`[${ts}] ${icon} ${r.name.padEnd(14)} ${detail}`);
}

const failed = results.filter(r => !r.ok);
if (failed.length > 0) {
  const criticalDown = failed.filter(r => r.critical);
  const lines = [
    `${failed.length}个服务异常: ${failed.map(r => r.name).join(', ')}`,
    ...failed.map(r => `  ${r.critical ? '🔴' : '🟡'} ${r.name}: ${r.error ?? `HTTP ${r.httpStatus}`}`),
    ...failed.map(r => `     影响: ${r.impact}`),
    `\n恢复: bash /home/ubuntu/Projects/chaotang-os/frontend/scripts/system-restore.sh`,
  ];
  const alertMsg = lines.join('\n');
  await sendAlert(alertMsg);

  if (criticalDown.length > 0) {
    console.error(`\n🔴 ${criticalDown.length} 个关键服务 DOWN — 已写 alert log`);
    if (!ALERT_URL) {
      console.error(`   配置 CHAOTANG_ALERT_URL 以启用 Telegram 推送`);
    }
  }
}

process.exit(failed.length);

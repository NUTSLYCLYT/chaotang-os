#!/usr/bin/env node
/**
 * jiqun-contract-smoke.mjs — 跨仓契约烟测
 *
 * 验证朝堂 OS frontend 依赖的 backend(:8081) 关键端点的：
 *   1. 存活性（HTTP 可达）
 *   2. 响应 schema（字段不漂移）
 *
 * 行为原则：
 *   - jiqun DOWN → 全部 SKIP + 打 WARN，退出码 0（不阻断 CI，但必须可见）
 *   - jiqun UP 但 schema 漂移 → FAIL，退出码 1
 *   - 所有检查通过 → PASS，退出码 0
 *
 * 用法：
 *   node scripts/jiqun-contract-smoke.mjs
 *   JIQUN_URL=http://127.0.0.1:8081 node scripts/jiqun-contract-smoke.mjs
 *
 * 接入 release-gates：
 *   chaotang-release-gates.mjs 里 import { runJiqunContractSmoke } 调用即可
 */

import crypto from 'node:crypto';

const JIQUN_BASE = process.env.JIQUN_URL ?? process.env.JIQUN_API_URL ?? 'http://127.0.0.1:8081';
const TIMEOUT_MS = 3000;

// ── 颜色辅助（无依赖）─────────────────────────────────────────
const C = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
  yellow:(s) => `\x1b[33m${s}\x1b[0m`,
  gray:  (s) => `\x1b[90m${s}\x1b[0m`,
  bold:  (s) => `\x1b[1m${s}\x1b[0m`,
};

// ── 契约定义 ──────────────────────────────────────────────────
/**
 * 每条契约：
 *   method / path / body(可选) / auth(可选，Bearer token)
 *   check(json) → null(通过) | string(失败原因)
 *   skipIfDown: 是否在 jiqun DOWN 时跳过（所有端点都是 true）
 */
const CONTRACTS = [
  {
    id: 'health',
    desc: 'GET /api/health — jiqun 健康',
    method: 'GET',
    path: '/api/health',
    check(json) {
      if (!json || typeof json !== 'object') return '响应非 object';
      // jiqun health 至少含 status 字段
      if (!('status' in json)) return '缺 status 字段';
      return null;
    },
  },
  {
    id: 'swarm-sessions',
    desc: 'GET /api/swarm/sessions — 蜂群会话列表',
    method: 'GET',
    path: '/api/swarm/sessions',
    check(json) {
      if (!Array.isArray(json)) return '响应应为数组';
      // 若有元素，校验关键字段
      for (const s of json.slice(0, 3)) {
        if (typeof s !== 'object' || s === null) return '元素应为 object';
        // session 必须有 session_id
        if (!('session_id' in s) && !('id' in s)) return '元素缺 session_id / id 字段';
      }
      return null;
    },
  },
  {
    id: 'shangshufang-home',
    desc: 'GET /api/shangshufang/home — 上书房首屏聚合',
    method: 'GET',
    path: '/api/shangshufang/home',
    check(json) {
      if (!json || typeof json !== 'object') return '响应非 object';
      if ('success' in json && json.success === false) return `响应 success=false(error=${json.error ?? 'unknown'})`;
      const payload = json.data && typeof json.data === 'object' ? json.data : json;
      // 首屏聚合至少含当前上书房字段或旧版任务聚合字段
      const keys = Object.keys(payload);
      const knownKeys = [
        'source_label',
        'today_issue',
        'pending_decisions',
        'pending_evidence_tasks',
        'archive_hints',
        'tasks',
        'pending_tasks',
        'recent_sessions',
        'summary',
        'stats',
        'overview',
      ];
      const hasAny = knownKeys.some((k) => keys.includes(k));
      if (!hasAny) return `响应缺少聚合字段(keys=${keys.slice(0,6).join(',')})`;
      return null;
    },
  },
  {
    id: 'swarm-config',
    desc: 'GET /api/swarm/config — 蜂群配置（流程注册表）',
    method: 'GET',
    path: '/api/swarm/config',
    check(json) {
      if (!json || typeof json !== 'object') return '响应非 object';
      // config 必须包含 swarms 或 flows 数组
      if (!('swarms' in json) && !('flows' in json)) return '缺 swarms / flows 字段';
      return null;
    },
  },
  {
    id: 'draft-edict-schema',
    desc: 'POST /api/shangshufang/draft-edict — 下旨 schema（空 body → 422）',
    method: 'POST',
    path: '/api/shangshufang/draft-edict',
    body: {},
    // 空 body 应返回 422 Unprocessable Entity（FastAPI pydantic 校验）
    expectedStatus: 422,
    check(json) {
      // FastAPI 422 body: { detail: [...] }
      if (!json || typeof json !== 'object') return '响应非 object';
      if (!('detail' in json)) return '422 响应缺 detail 字段';
      return null;
    },
  },
];

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function buildServiceJwt(secret) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace('Z', '');
  const body = base64Url(JSON.stringify({
    user_id: 1,
    username: 'svc-frontend-release-gate',
    tenant_slug: 'default',
    role: 'admin',
    exp,
  }));
  const input = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', secret).update(input).digest('base64url');
  return `${input}.${signature}`;
}

function buildAuthToken() {
  const explicitToken = (
    process.env.JIQUN_AUTH_TOKEN
    || process.env.FENGQUN_JWT_TOKEN
    || process.env.HARNESS_AUTH_TOKEN
    || ''
  ).trim();
  if (explicitToken) return explicitToken;

  const configuredToken = (process.env.JIQUN_ADMIN_TOKEN || process.env.COURT_TOKEN || '').trim();
  if (configuredToken) return configuredToken;

  const jwtSecret = (process.env.FENGQUN_JWT_SECRET || '').trim();
  if (jwtSecret) return buildServiceJwt(jwtSecret);

  return '';
}

// ── 带超时的 fetch ────────────────────────────────────────────
async function fetchWithTimeout(url, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── jiqun 存活探测 ────────────────────────────────────────────
async function probeAlive() {
  try {
    const res = await fetchWithTimeout(`${JIQUN_BASE}/api/health`);
    return res.status < 500;
  } catch {
    return false;
  }
}

// ── 单条契约验证 ──────────────────────────────────────────────
async function runContract(c) {
  const url = `${JIQUN_BASE}${c.path}`;
  const expectedStatus = c.expectedStatus ?? 200;
  const authToken = c.auth || buildAuthToken();
  try {
    const res = await fetchWithTimeout(url, {
      method: c.method,
      headers: {
        'content-type': 'application/json',
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      ...(c.body !== undefined ? { body: JSON.stringify(c.body) } : {}),
    });

    // 状态码检查
    if (res.status !== expectedStatus) {
      return { ok: false, reason: `HTTP ${res.status}(期望 ${expectedStatus})` };
    }

    let json = null;
    try { json = await res.json(); } catch { /* 空 body */ }

    const reason = c.check(json);
    if (reason) return { ok: false, reason };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── 主函数 ────────────────────────────────────────────────────
export async function runJiqunContractSmoke({ log = console.log } = {}) {
  log(C.bold(`\n── jiqun 契约烟测 ──────────────────────────────`));
  log(C.gray(`   jiqun base: ${JIQUN_BASE}  timeout: ${TIMEOUT_MS}ms`));

  // 1. 存活探测
  const alive = await probeAlive();
  if (!alive) {
    log(C.yellow(`\n⚠ jiqun(${JIQUN_BASE}) 不可达 — 全部契约 SKIP`));
    log(C.yellow(`  这意味着执行臂断路、蜂群无法运行、法务专用路由不可用`));
    log(C.gray(`  启动 backend（从 frontend/）: cd ../backend && bash scripts/serve-dev.sh`));
    log(`\n${'─'.repeat(50)}`);
    return { passed: 0, failed: 0, skipped: CONTRACTS.length, alive: false };
  }

  log(C.green(`  ✓ jiqun 可达，开始验证 ${CONTRACTS.length} 条契约...\n`));

  // 2. 逐条验证
  const results = await Promise.all(
    CONTRACTS.map(async (c) => {
      const r = await runContract(c);
      return { ...c, ...r };
    }),
  );

  // 3. 输出
  let passed = 0, failed = 0;
  for (const r of results) {
    if (r.ok) {
      log(C.green(`  ✓ [${r.id}] ${r.desc}`));
      passed++;
    } else {
      log(C.red(`  ✗ [${r.id}] ${r.desc}`));
      log(C.red(`      ↳ ${r.reason}`));
      failed++;
    }
  }

  log(`\n${'─'.repeat(50)}`);
  if (failed === 0) {
    log(C.green(C.bold(`🟢 jiqun 契约全绿 (${passed}/${CONTRACTS.length})`)));
  } else {
    log(C.red(C.bold(`🔴 jiqun 契约漂移 (${passed} 通过 / ${failed} 失败)`)));
    log(C.red(`   schema 漂移意味着前端调用 jiqun 时字段对不上 — 上线前必须修复`));
  }

  return { passed, failed, skipped: 0, alive: true };
}

// ── CLI 入口 ──────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('jiqun-contract-smoke.mjs')) {
  runJiqunContractSmoke().then(({ failed }) => {
    // DOWN=skip(0) / schema漂移=1 / 全通过=0
    process.exit(failed > 0 ? 1 : 0);
  }).catch((e) => {
    console.error('烟测异常:', e);
    process.exit(2);
  });
}

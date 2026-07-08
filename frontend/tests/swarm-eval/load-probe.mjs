#!/usr/bin/env node
/**
 * load-probe.mjs — 朝堂蜂群单智能体端点并发压测 + 卡死探测
 *
 * 直击 POST /api/agents/run 的 fire-and-forget 行为：并发打点、统计响应分布与时延，
 * 随后轮询 GET /api/agents/status 找出 status='running' 且 started_at 超时的"卡死"行。
 *
 * 用法：
 *   node load-probe.mjs [选项]
 *
 * 选项：
 *   --concurrency N     同时在飞的请求数（默认 5）
 *   --total M           总请求数（默认 20）
 *   --agent <code>      目标 agentCode（默认 prime_minister）；必须是 11 个 Tier-0 之一
 *   --base <url>        前端基址（默认 http://localhost:3002，或环境变量 BASE_URL）
 *   --goal <str>        每个 run 的 goal 文本（默认内置压测文案）
 *   --stale-min N       started_at 超过 N 分钟仍 running 视为卡死（默认 5）
 *   --status-wait N     发压完成后等待 N 秒再拉 status（给 fire-and-forget 一点时间，默认 8）
 *   --dev-token         自行合成一个 dev 形状 JWT 作会话（仅打通链路冒烟，非真实用户）
 *   --dry-run           不打网络，用内置样例数据走通统计与输出流程
 *   -h, --help          打印本帮助
 *
 * 会话 token 取用优先级：
 *   1) 环境变量 COURTOS_TOKEN（用户粘真实 JWT）
 *   2) --dev-token（合成 dev JWT）
 *   否则：缺 token → 打印指引并以非 0 退出。
 *
 * 退出码：0=完成；1=参数/环境/网络不可用；2=缺 token。
 *
 * 跨脚本契约假设：
 *   - 与 battery.json / results / scores 同处目录 tests/swarm-eval/，但本脚本自成一体，
 *     不读写那些中间产物（压测属独立诊断，不污染评分结果集）。
 *   - agentCode 取值依据 src/lib/contracts/agent.ts 的 11 个 Tier-0 ZAgentCode（本文件内置同一份白名单）。
 *   - 端点契约：POST /api/agents/run body { taskId, agentCode, goal? } → 201 {success,data:{runId,...}}；
 *     dev 无 TURSO_DB_URL 时返回 503 db_insert_failed（本脚本将其单列并打印明确指引）。
 *   - 观测端点：GET /api/agents/status → 每 agent 最新 run；本脚本读取每行的 status/agentCode/startedAt
 *     （兼容 started_at 蛇形与 startedAt 驼峰两种字段名）。
 */

const AGENT_CODES = new Set([
  'prime_minister',
  'scribe',
  'li_bu',
  'hu_bu',
  'li_bu_rites',
  'bing_bu',
  'xing_bu',
  'gong_bu',
  'qin_tian_jian',
  'jin_yi_wei',
  'tai_yi_yuan',
]);

/* ----------------------------------- args ---------------------------------- */

function parseArgs(argv) {
  const out = {
    concurrency: 5,
    total: 20,
    agent: 'prime_minister',
    base: process.env.BASE_URL || 'http://localhost:3002',
    goal: '压测探针：请生成一段简短战略要点（load-probe synthetic goal）。',
    staleMin: 5,
    statusWait: 8,
    devToken: false,
    dryRun: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--concurrency': out.concurrency = parseInt(next(), 10); break;
      case '--total': out.total = parseInt(next(), 10); break;
      case '--agent': out.agent = next(); break;
      case '--base': out.base = next(); break;
      case '--goal': out.goal = next(); break;
      case '--stale-min': out.staleMin = parseFloat(next()); break;
      case '--status-wait': out.statusWait = parseFloat(next()); break;
      case '--dev-token': out.devToken = true; break;
      case '--dry-run': out.dryRun = true; break;
      case '-h': case '--help': out.help = true; break;
      default:
        console.error(`未知参数: ${a}（用 --help 看用法）`);
        process.exit(1);
    }
  }
  return out;
}

const HELP = `load-probe.mjs — 并发压测 /api/agents/run + 卡死探测 /api/agents/status

  node load-probe.mjs --concurrency 10 --total 50 --agent prime_minister --dev-token
  node load-probe.mjs --dry-run

选项: --concurrency N | --total M | --agent <code> | --base <url> | --goal <str>
      --stale-min N | --status-wait N | --dev-token | --dry-run | --help

token: 环境变量 COURTOS_TOKEN（真实 JWT）优先；否则 --dev-token 合成 dev JWT。
合法 agent: ${[...AGENT_CODES].join(', ')}`;

/* --------------------------------- jwt utils -------------------------------- */

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function synthDevToken() {
  const header = { alg: 'none', typ: 'JWT' };
  const payload = {
    user_id: 'eval-user',
    username: 'load-probe',
    tenant_slug: 'eval',
    role: 'admin',
    exp: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
  return `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.sig`;
}

function resolveToken(opts) {
  if (process.env.COURTOS_TOKEN && process.env.COURTOS_TOKEN.trim()) {
    return { token: process.env.COURTOS_TOKEN.trim(), source: 'COURTOS_TOKEN(env)' };
  }
  if (opts.devToken) {
    return { token: synthDevToken(), source: '--dev-token(合成 dev JWT)' };
  }
  return null;
}

/* --------------------------------- stats ----------------------------------- */

function percentile(sortedNums, p) {
  if (sortedNums.length === 0) return null;
  const idx = Math.min(sortedNums.length - 1, Math.ceil((p / 100) * sortedNums.length) - 1);
  return sortedNums[Math.max(0, idx)];
}

function classify(status) {
  if (status === 0) return 'network';
  if (status === 201 || (status >= 200 && status < 300)) return '2xx';
  if (status === 429) return '429';
  if (status === 503) return '503';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500) return '5xx';
  return 'other';
}

/* ------------------------------- single request ----------------------------- */

async function fireOne({ base, agent, goal, token, idx }) {
  const taskId = `loadprobe-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`;
  const url = `${base.replace(/\/$/, '')}/api/agents/run`;
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `courtos.access_token=${token}`,
      },
      body: JSON.stringify({ taskId, agentCode: agent, goal }),
    });
    const latencyMs = performance.now() - t0;
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    const runId = body?.data?.runId ?? null;
    return { idx, taskId, httpStatus: res.status, bucket: classify(res.status), latencyMs, runId, error: null };
  } catch (err) {
    const latencyMs = performance.now() - t0;
    return { idx, taskId, httpStatus: 0, bucket: 'network', latencyMs, runId: null, error: String(err?.message || err) };
  }
}

/* --------------------------- bounded concurrency pool ----------------------- */

async function runPool({ total, concurrency, makeTask }) {
  const results = new Array(total);
  let nextIdx = 0;
  async function worker() {
    while (true) {
      const i = nextIdx++;
      if (i >= total) return;
      results[i] = await makeTask(i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await workers.reduce((p) => p, Promise.resolve());
  await Promise.all(workers);
  return results;
}

/* ------------------------------- status probe ------------------------------ */

function readStatusRows(payload) {
  // 兼容 {success,data:[...]} / {data:{rows:[...]}} / 直接数组
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function rowStatus(r) { return r?.status ?? r?.state ?? null; }
function rowStarted(r) { return r?.started_at ?? r?.startedAt ?? null; }
function rowAgent(r) { return r?.agent_code ?? r?.agentCode ?? r?.agent ?? null; }

async function probeStatus({ base, token, staleMin }) {
  const url = `${base.replace(/\/$/, '')}/api/agents/status`;
  try {
    const res = await fetch(url, { headers: { cookie: `courtos.access_token=${token}` } });
    let payload = null;
    try { payload = await res.json(); } catch { payload = null; }
    if (res.status !== 200) {
      return { ok: false, httpStatus: res.status, rows: [], stale: [], total: 0, running: 0 };
    }
    const rows = readStatusRows(payload);
    const now = Date.now();
    const staleMs = staleMin * 60 * 1000;
    let running = 0;
    const stale = [];
    for (const r of rows) {
      const st = rowStatus(r);
      if (st !== 'running') continue;
      running++;
      const startedRaw = rowStarted(r);
      const startedMs = startedRaw ? Date.parse(startedRaw) : NaN;
      if (Number.isFinite(startedMs) && now - startedMs > staleMs) {
        stale.push({
          agent: rowAgent(r),
          startedAt: startedRaw,
          ageMin: Math.round((now - startedMs) / 60000 * 10) / 10,
        });
      }
    }
    return { ok: true, httpStatus: 200, rows, stale, total: rows.length, running };
  } catch (err) {
    return { ok: false, httpStatus: 0, rows: [], stale: [], total: 0, running: 0, error: String(err?.message || err) };
  }
}

/* ----------------------------- dry-run synthetic --------------------------- */

function synthLoadResults(total) {
  const out = [];
  for (let i = 0; i < total; i++) {
    // 模拟分布：大多 503（dev 无 TURSO）+ 少量 201 + 偶发 429/network
    let httpStatus;
    const roll = Math.random();
    if (roll < 0.7) httpStatus = 503;
    else if (roll < 0.92) httpStatus = 201;
    else if (roll < 0.97) httpStatus = 429;
    else httpStatus = 0;
    out.push({
      idx: i,
      taskId: `dry-${i}`,
      httpStatus,
      bucket: classify(httpStatus),
      latencyMs: 20 + Math.random() * 180,
      runId: httpStatus === 201 ? `run-${i}` : null,
      error: httpStatus === 0 ? 'simulated network error' : null,
    });
  }
  return out;
}

function synthStatus(staleMin) {
  const now = Date.now();
  const rows = [
    { agentCode: 'prime_minister', status: 'running', startedAt: new Date(now - (staleMin + 4) * 60000).toISOString() },
    { agentCode: 'hu_bu', status: 'running', startedAt: new Date(now - 1 * 60000).toISOString() },
    { agentCode: 'scribe', status: 'completed', startedAt: new Date(now - 30 * 60000).toISOString() },
    { agentCode: 'gong_bu', status: 'running', startedAt: new Date(now - (staleMin + 20) * 60000).toISOString() },
    { agentCode: 'bing_bu', status: 'failed', startedAt: new Date(now - 12 * 60000).toISOString() },
  ];
  const staleMs = staleMin * 60000;
  let running = 0;
  const stale = [];
  for (const r of rows) {
    if (r.status !== 'running') continue;
    running++;
    const ms = Date.parse(r.startedAt);
    if (now - ms > staleMs) {
      stale.push({ agent: r.agentCode, startedAt: r.startedAt, ageMin: Math.round((now - ms) / 60000 * 10) / 10 });
    }
  }
  return { ok: true, httpStatus: 200, rows, stale, total: rows.length, running };
}

/* --------------------------------- report ---------------------------------- */

function buildReport({ opts, tokenSource, loadResults, statusProbe, wallMs }) {
  const buckets = {};
  const lat = [];
  for (const r of loadResults) {
    buckets[r.bucket] = (buckets[r.bucket] || 0) + 1;
    lat.push(r.latencyMs);
  }
  lat.sort((a, b) => a - b);
  const sum = lat.reduce((s, x) => s + x, 0);
  const okCount = buckets['2xx'] || 0;
  const had503 = (buckets['503'] || 0) > 0;
  const had429 = (buckets['429'] || 0) > 0;

  return {
    config: {
      base: opts.base,
      agent: opts.agent,
      concurrency: opts.concurrency,
      total: opts.total,
      staleMin: opts.staleMin,
      tokenSource,
      dryRun: opts.dryRun,
    },
    wallClockMs: Math.round(wallMs),
    throughputReqPerSec: wallMs > 0 ? Math.round((opts.total / (wallMs / 1000)) * 100) / 100 : null,
    distribution: buckets,
    success201: okCount,
    latencyMs: {
      min: lat.length ? Math.round(lat[0]) : null,
      p50: lat.length ? Math.round(percentile(lat, 50)) : null,
      p95: lat.length ? Math.round(percentile(lat, 95)) : null,
      max: lat.length ? Math.round(lat[lat.length - 1]) : null,
      mean: lat.length ? Math.round(sum / lat.length) : null,
    },
    rateLimited429: buckets['429'] || 0,
    server503: buckets['503'] || 0,
    networkErrors: buckets['network'] || 0,
    statusProbe: {
      ok: statusProbe.ok,
      httpStatus: statusProbe.httpStatus,
      totalRows: statusProbe.total,
      running: statusProbe.running,
      staleCount: statusProbe.stale.length,
      stalePct: statusProbe.running > 0
        ? Math.round((statusProbe.stale.length / statusProbe.running) * 1000) / 10
        : 0,
      stale: statusProbe.stale,
    },
    flags: {
      mostly503: had503 && (buckets['503'] || 0) >= opts.total * 0.5,
      sawRateLimit: had429,
      stuckDetected: statusProbe.stale.length > 0,
    },
  };
}

function printReport(rep) {
  const L = [];
  L.push('');
  L.push('═══════════════ load-probe 报告 ═══════════════');
  L.push(`目标      : ${rep.config.base}  agent=${rep.config.agent}`);
  L.push(`压测      : concurrency=${rep.config.concurrency} total=${rep.config.total}  token=${rep.config.tokenSource}${rep.config.dryRun ? '  [DRY-RUN]' : ''}`);
  L.push(`墙钟      : ${rep.wallClockMs} ms  吞吐≈${rep.throughputReqPerSec} req/s`);
  L.push('');
  L.push('— 响应分布 —');
  for (const [k, v] of Object.entries(rep.distribution)) {
    L.push(`  ${k.padEnd(8)} : ${v}`);
  }
  L.push(`  201 成功 : ${rep.success201}   429 限流 : ${rep.rateLimited429}   503 : ${rep.server503}   网络错误 : ${rep.networkErrors}`);
  L.push('');
  L.push('— 时延 (ms) —');
  L.push(`  min=${rep.latencyMs.min}  p50=${rep.latencyMs.p50}  p95=${rep.latencyMs.p95}  max=${rep.latencyMs.max}  mean=${rep.latencyMs.mean}`);
  L.push('');
  L.push('— 卡死探测 (GET /api/agents/status) —');
  if (!rep.statusProbe.ok) {
    L.push(`  status 端点不可用 (HTTP ${rep.statusProbe.httpStatus})，跳过卡死统计`);
  } else {
    L.push(`  总行=${rep.statusProbe.totalRows}  running=${rep.statusProbe.running}  卡死=${rep.statusProbe.staleCount}  卡死占比(占running)=${rep.statusProbe.stalePct}%`);
    for (const s of rep.statusProbe.stale) {
      L.push(`    ⚠ ${s.agent ?? '(unknown)'} running 已 ${s.ageMin} 分钟（started_at=${s.startedAt}）`);
    }
  }
  L.push('');
  L.push('— 结论 —');
  if (rep.flags.mostly503) {
    L.push('  ❗ 多数请求返回 503：该端点需 TURSO（POST /api/agents/run 依赖 TURSO_DB_URL）。');
    L.push('     dev server 未配置 DB 时无法压测此路径。请将 --base 指向配置了 DB 的环境，');
    L.push('     或在 dev 注入 TURSO_DB_URL 后重跑。');
  }
  if (rep.flags.sawRateLimit) {
    L.push('  ⚠ 出现 429：触发限流，已记录命中次数（见上"429 限流"）。');
  }
  if (rep.flags.stuckDetected) {
    L.push(`  ❗ 检测到 ${rep.statusProbe.staleCount} 行卡死（running 超 ${rep.config.staleMin} 分钟）——印证 fire-and-forget"永久卡 running"bug。`);
  }
  if (!rep.flags.mostly503 && !rep.flags.stuckDetected && rep.success201 > 0) {
    L.push('  ✓ 链路打通：有 201 成功且未检出卡死行。');
  }
  L.push('═══════════════════════════════════════════════');
  L.push('');
  console.log(L.join('\n'));
}

/* ---------------------------------- main ----------------------------------- */

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { console.log(HELP); process.exit(0); }

  if (!Number.isInteger(opts.concurrency) || opts.concurrency < 1) {
    console.error('--concurrency 必须为 ≥1 的整数'); process.exit(1);
  }
  if (!Number.isInteger(opts.total) || opts.total < 1) {
    console.error('--total 必须为 ≥1 的整数'); process.exit(1);
  }
  if (!AGENT_CODES.has(opts.agent)) {
    console.error(`--agent "${opts.agent}" 非法。合法值: ${[...AGENT_CODES].join(', ')}`);
    process.exit(1);
  }

  /* ---------- dry-run ---------- */
  if (opts.dryRun) {
    const t0 = performance.now();
    const loadResults = synthLoadResults(opts.total);
    const statusProbe = synthStatus(opts.staleMin);
    const wallMs = performance.now() - t0;
    const rep = buildReport({ opts, tokenSource: 'dry-run(无网络)', loadResults, statusProbe, wallMs });
    printReport(rep);
    console.log('[dry-run] 上为内置样例数据，未发起任何网络请求。');
    process.exit(0);
  }

  /* ---------- token ---------- */
  const tok = resolveToken(opts);
  if (!tok) {
    console.error('缺少会话 token。请二选一：');
    console.error('  1) export COURTOS_TOKEN=<真实 JWT>  然后重跑');
    console.error('  2) 加 --dev-token 自行合成 dev 形状 JWT（仅链路冒烟，非真实用户）');
    console.error('  或 --dry-run 离线走通流程。');
    process.exit(2);
  }

  /* ---------- reachability ---------- */
  try {
    const ping = await fetch(`${opts.base.replace(/\/$/, '')}/api/agents/status`, {
      headers: { cookie: `courtos.access_token=${tok.token}` },
    });
    // 任意 HTTP 响应即视为可达（401/403/503 也算服务在线）
    void ping.status;
  } catch (err) {
    console.error(`目标不可达: ${opts.base} (${String(err?.message || err)})`);
    console.error('请确认前端 dev 在跑（pnpm dev，端口 3002）或用 --base 指定其它环境，或 --dry-run。');
    process.exit(1);
  }

  /* ---------- load ---------- */
  console.log(`[load-probe] 开始压测 ${opts.total} 次 @ 并发 ${opts.concurrency} → ${opts.base}/api/agents/run (agent=${opts.agent}, token=${tok.source})`);
  const t0 = performance.now();
  const loadResults = await runPool({
    total: opts.total,
    concurrency: opts.concurrency,
    makeTask: (i) => fireOne({ base: opts.base, agent: opts.agent, goal: opts.goal, token: tok.token, idx: i }),
  });
  const wallMs = performance.now() - t0;

  /* ---------- wait then status ---------- */
  if (opts.statusWait > 0) {
    console.log(`[load-probe] 等待 ${opts.statusWait}s 让 fire-and-forget 落库后再拉 status …`);
    await new Promise((r) => setTimeout(r, opts.statusWait * 1000));
  }
  const statusProbe = await probeStatus({ base: opts.base, token: tok.token, staleMin: opts.staleMin });

  /* ---------- report ---------- */
  const rep = buildReport({ opts, tokenSource: tok.source, loadResults, statusProbe, wallMs });
  printReport(rep);

  // 机器可读 JSON（最后一行，便于其它脚本管道消费）
  console.log('JSON ' + JSON.stringify(rep));
  process.exit(0);
}

main().catch((err) => {
  console.error('load-probe 未捕获异常:', err);
  process.exit(1);
});

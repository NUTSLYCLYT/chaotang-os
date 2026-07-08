#!/usr/bin/env node
/**
 * run-eval.mjs — 朝堂蜂群测试套件 · 真实端点执行器
 * =====================================================================
 * 读 battery.json，对每条任务按 mode 调用真实端点，落 results/<id>__<mode>.json。
 *
 *   mode='deep'   → POST {BASE}/api/governance/deliberate   { command, constitutions? }
 *                   提取 menxia.verdict（准/驳/再议）作为关键判定信号
 *   mode='single' → POST {BASE}/api/agents/run              { taskId, agentCode, goal? }
 *                   立即 201 返回 runId（真实执行 fire-and-forget；已知"永久卡 running"bug）
 *                   ⚠️ 该路由依赖 TURSO DB；dev server 缺 TURSO_DB_URL 时返回 503 db_insert_failed
 *
 * 用法:
 *   node run-eval.mjs                       # 默认 BASE=http://localhost:3002，读真实 token
 *   node run-eval.mjs --base http://127.0.0.1:8081
 *   node run-eval.mjs --dev-token           # 自行合成 dev 形状 JWT 打通链路冒烟
 *   node run-eval.mjs --only li_bu          # 仅跑 dept/deptCode/id 含该子串的任务
 *   node run-eval.mjs --mode deep           # 仅跑指定 mode
 *   node run-eval.mjs --dry-run             # 不打网络，内置样例 + 假响应走通写文件流程
 *   node run-eval.mjs --timeout 120000      # 单请求超时 ms（默认 120000）
 *
 * 鉴权 token（二选一）:
 *   ① 环境变量 COURTOS_TOKEN=<真实 JWT>   （推荐，代表真实用户会话）
 *   ② --dev-token                          （合成 {alg:none} dev JWT，仅冒烟，不代表真实用户）
 *
 * 退出码: 0 全部任务已尝试并写盘；非 0 = 环境不可达 / 缺 token / battery.json 缺失。
 * 依赖: 纯 Node ESM，全局 fetch（Node 18+）。无第三方依赖。绝不硬编码密钥。
 * =====================================================================
 * 跨脚本契约（与 battery.json / score-eval / scorecard 对齐）:
 *   - 输入  : tests/swarm-eval/battery.json  { version, tasks:[{id,dept,deptCode,mode,command,...}] }
 *   - 输出  : tests/swarm-eval/results/<id>__<mode>.json
 *             { id, dept, mode, command, ok, httpStatus, output, verdict?, latencyMs, error?,
 *               deptCode?, runId?, stuck?, ranAt }
 *   - verdict 仅在 mode='deep' 且能从 menxia.verdict 提取时存在（'准'|'驳'|'再议'）
 *   - single 模式 ok=true 表示 HTTP 201 成功受理；stuck=true 标记疑似"永久卡 running"（本脚本不轮询，
 *     由观测脚本/打分脚本据 runId 复核，这里仅占位 false）
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVAL_DIR = __dirname;
const BATTERY_PATH = resolve(EVAL_DIR, 'battery.json');
const RESULTS_DIR = resolve(EVAL_DIR, 'results');

const COOKIE_NAME = 'courtos.access_token';

/* ----------------------------- arg 解析 ----------------------------- */
function parseArgs(argv) {
  const out = {
    base: 'http://localhost:3002',
    devToken: false,
    dryRun: false,
    only: null,
    mode: null, // 'deep' | 'single' | null(全部)
    timeout: 120000,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dev-token') out.devToken = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--base') out.base = argv[++i];
    else if (a === '--only') out.only = argv[++i];
    else if (a === '--mode') out.mode = argv[++i];
    else if (a === '--timeout') out.timeout = Number(argv[++i]) || out.timeout;
    else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    }
  }
  // 规整 base：去尾斜杠
  out.base = String(out.base).replace(/\/+$/, '');
  return out;
}

function printUsage() {
  // 从文件头注释里抽用法（避免重复维护）—— 简化为指向注释
  process.stdout.write(
    [
      'run-eval.mjs — 朝堂蜂群真实端点执行器',
      '  node run-eval.mjs [--base URL] [--dev-token] [--only SUBSTR] [--mode deep|single] [--dry-run] [--timeout MS]',
      '  token: 环境变量 COURTOS_TOKEN=<JWT>  或  --dev-token（合成冒烟用 dev JWT）',
      '',
    ].join('\n'),
  );
}

/* --------------------------- token 处理 --------------------------- */
function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** 合成一个 {alg:none} dev 形状 JWT —— 仅用于打通链路冒烟，不代表真实用户。 */
function synthDevToken() {
  const header = { alg: 'none', typ: 'JWT' };
  const exp = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 后端 payload.exp 是 ISO 字符串
  const payload = {
    user_id: 'eval-user',
    username: 'eval-user',
    tenant_slug: 'eval',
    role: 'admin',
    exp,
  };
  return `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.sig`;
}

/** 取 token：优先 COURTOS_TOKEN，其次 --dev-token 合成。返回 { token, source } 或 null。 */
function resolveToken(opts) {
  const env = (process.env.COURTOS_TOKEN || '').trim();
  if (env) return { token: env, source: 'COURTOS_TOKEN' };
  if (opts.devToken) return { token: synthDevToken(), source: 'dev-token(合成)' };
  return null;
}

/* --------------------------- HTTP 帮手 --------------------------- */
/**
 * 带超时的 POST JSON，附会话 cookie。
 * 返回 { httpStatus, body(已尽量 JSON 解析，失败回退字符串), networkError }
 */
async function postJson(url, body, token, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text; // 非 JSON（HTML 错误页等）原样保留
    }
    return { httpStatus: res.status, body: parsed, networkError: null };
  } catch (err) {
    const msg = err?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : (err?.message || String(err));
    return { httpStatus: 0, body: null, networkError: msg };
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------- verdict 提取 --------------------------- */
function extractVerdict(deliberation) {
  if (!deliberation || typeof deliberation !== 'object') return undefined;
  // 优先标准路径 menxia.verdict；容错若干别名/嵌套
  const m = deliberation.menxia ?? deliberation.data?.menxia;
  const v = m?.verdict ?? deliberation.verdict ?? deliberation.data?.verdict;
  if (v === '准' || v === '驳' || v === '再议') return v;
  return typeof v === 'string' ? v : undefined; // 保留未知字符串便于排查
}

/* --------------------------- 单任务执行 --------------------------- */
async function runDeep(task, opts, token) {
  const url = `${opts.base}/api/governance/deliberate`;
  const reqBody = { command: task.command };
  if (Array.isArray(task.constitutions)) reqBody.constitutions = task.constitutions;
  const t0 = Date.now();
  const { httpStatus, body, networkError } = await postJson(url, reqBody, token, opts.timeout);
  const latencyMs = Date.now() - t0;

  const ok = httpStatus >= 200 && httpStatus < 300 && !networkError;
  const verdict = ok ? extractVerdict(body) : undefined;
  return {
    ok,
    httpStatus,
    output: networkError ? null : body,
    verdict,
    latencyMs,
    error: networkError ?? errorFromBody(httpStatus, body),
  };
}

async function runSingle(task, opts, token) {
  const url = `${opts.base}/api/agents/run`;
  // taskId：用 battery 提供的或据任务 id 合成稳定值
  const taskId = task.taskId || `eval-${task.id}-${Date.now()}`;
  const agentCode = task.deptCode || task.agentCode;
  const reqBody = { taskId, agentCode };
  if (task.command) reqBody.goal = task.command;
  const t0 = Date.now();
  const { httpStatus, body, networkError } = await postJson(url, reqBody, token, opts.timeout);
  const latencyMs = Date.now() - t0;

  // single 端点成功受理是 201；2xx 视为受理成功
  const ok = httpStatus >= 200 && httpStatus < 300 && !networkError;
  const runId = ok ? body?.data?.runId ?? body?.runId ?? undefined : undefined;
  return {
    ok,
    httpStatus,
    output: networkError ? null : body,
    runId,
    // 本脚本不轮询 run 终态，stuck 占位 false；由观测/打分脚本据 runId 复核"永久卡 running"
    stuck: false,
    latencyMs,
    error: networkError ?? errorFromBody(httpStatus, body),
  };
}

/** 从非 2xx body 里提炼简短错误串（503 db_insert_failed / 401 等） */
function errorFromBody(httpStatus, body) {
  if (httpStatus >= 200 && httpStatus < 300) return undefined;
  if (httpStatus === 0) return undefined; // 网络错误已在上游给 networkError
  if (body && typeof body === 'object') {
    const code = body.error || body.code || body.message;
    if (code) return `HTTP ${httpStatus}: ${typeof code === 'string' ? code : JSON.stringify(code)}`;
  }
  if (typeof body === 'string' && body.trim()) {
    return `HTTP ${httpStatus}: ${body.slice(0, 200)}`;
  }
  return `HTTP ${httpStatus}`;
}

/* --------------------------- dry-run 样例 --------------------------- */
const DRY_TASKS = [
  {
    id: 'sample-prime',
    dept: '丞相',
    deptCode: 'prime_minister',
    mode: 'deep',
    command: '为新品发布制定一个跨部门协同的季度战略，并给出风险与时机判断。',
    expectDims: ['relevance', 'accuracy', 'completeness', 'actionability', 'traceability'],
    notes: 'dry-run 样例（deep）',
  },
  {
    id: 'sample-hubu',
    dept: '户部',
    deptCode: 'hu_bu',
    mode: 'single',
    command: '对一支半导体龙头做一次估值研判，给出买入/持有/卖出评级。',
    expectDims: ['relevance', 'accuracy', 'completeness', 'actionability', 'traceability'],
    notes: 'dry-run 样例（single）',
  },
];

/** dry-run 假响应：不打网络，直接造一个合规 result 形状。 */
function fakeResult(task) {
  const latencyMs = 1234;
  if (task.mode === 'deep') {
    const output = {
      zhongshu: { draft: `[dry-run] 针对「${task.command}」的中书草案。` },
      menxia: { verdict: '准', reason: '[dry-run] 门下复核通过。' },
      shangshu: { steps: ['[dry-run] step1', '[dry-run] step2'] },
    };
    return { ok: true, httpStatus: 200, output, verdict: '准', latencyMs, error: undefined };
  }
  // single
  const runId = `dry-run-${task.id}`;
  const output = { success: true, data: { runId, status: 'running' } };
  return { ok: true, httpStatus: 201, output, runId, stuck: false, latencyMs, error: undefined };
}

/* --------------------------- 主流程 --------------------------- */
async function loadBattery(opts) {
  if (opts.dryRun) {
    return { version: 'dry-run', tasks: DRY_TASKS };
  }
  if (!existsSync(BATTERY_PATH)) {
    fail(
      `找不到 battery.json: ${BATTERY_PATH}\n` +
        '  请先运行 battery 生成脚本，或用 --dry-run 走内置样例。',
    );
  }
  let raw;
  try {
    raw = await readFile(BATTERY_PATH, 'utf8');
  } catch (e) {
    fail(`读取 battery.json 失败: ${e?.message || e}`);
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    fail(`battery.json 不是合法 JSON: ${e?.message || e}`);
  }
  if (!json || !Array.isArray(json.tasks)) {
    fail('battery.json 缺少 tasks 数组（期望 { version, tasks:[...] }）');
  }
  return json;
}

function selectTasks(tasks, opts) {
  let out = tasks;
  if (opts.mode) out = out.filter((t) => t.mode === opts.mode);
  if (opts.only) {
    const needle = opts.only.toLowerCase();
    out = out.filter((t) =>
      [t.id, t.dept, t.deptCode].some((s) => String(s || '').toLowerCase().includes(needle)),
    );
  }
  return out;
}

function fail(msg) {
  process.stderr.write(`\n[run-eval] ✗ ${msg}\n\n`);
  process.exit(1);
}

async function writeResult(result) {
  const fname = `${result.id}__${result.mode}.json`;
  const fpath = resolve(RESULTS_DIR, fname);
  await writeFile(fpath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return fpath;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // token（dry-run 不需要网络，但仍合成一个占位以保持流程一致）
  let token = 'dry-run';
  let tokenSource = 'dry-run';
  if (!opts.dryRun) {
    const tk = resolveToken(opts);
    if (!tk) {
      fail(
        '未提供会话 token。请二选一:\n' +
          '  ① export COURTOS_TOKEN=<你的真实 JWT>\n' +
          '  ② 加 --dev-token 合成 dev 形状 JWT（仅冒烟，不代表真实用户）\n' +
          '注: cookie 名为 courtos.access_token，缺失时端点返回 401。',
      );
    }
    token = tk.token;
    tokenSource = tk.source;
  }

  await mkdir(RESULTS_DIR, { recursive: true });

  const battery = await loadBattery(opts);
  const tasks = selectTasks(battery.tasks, opts);

  if (tasks.length === 0) {
    fail('筛选后没有可执行任务（检查 --only / --mode 过滤条件，或 battery.json 内容）。');
  }

  process.stdout.write(
    `[run-eval] base=${opts.base}  token=${tokenSource}  battery.version=${battery.version}\n` +
      `[run-eval] 待执行任务: ${tasks.length} 条${opts.dryRun ? '  (DRY-RUN，不打网络)' : ''}\n\n`,
  );

  const stats = { total: tasks.length, ok: 0, fail: 0, stuck: 0, by401: 0, by503: 0, net: 0 };
  const written = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const mode = task.mode === 'single' ? 'single' : 'deep'; // 缺省按 deep
    const tag = `[${i + 1}/${tasks.length}] ${task.id} (${task.dept || task.deptCode || '?'}/${mode})`;

    let exec;
    try {
      if (opts.dryRun) {
        exec = fakeResult({ ...task, mode });
      } else if (mode === 'single') {
        exec = await runSingle(task, opts, token);
      } else {
        exec = await runDeep(task, opts, token);
      }
    } catch (err) {
      // 任何意外异常都不应崩溃整个批次
      exec = {
        ok: false,
        httpStatus: 0,
        output: null,
        latencyMs: 0,
        error: `unexpected: ${err?.message || String(err)}`,
      };
    }

    const result = {
      id: task.id,
      dept: task.dept ?? null,
      deptCode: task.deptCode ?? null,
      mode,
      command: task.command ?? null,
      ok: !!exec.ok,
      httpStatus: exec.httpStatus ?? 0,
      output: exec.output ?? null,
      latencyMs: exec.latencyMs ?? 0,
      ranAt: new Date().toISOString(),
    };
    if (exec.verdict !== undefined) result.verdict = exec.verdict;
    if (exec.runId !== undefined) result.runId = exec.runId;
    if (exec.stuck !== undefined) result.stuck = exec.stuck;
    if (exec.error !== undefined && exec.error !== null) result.error = exec.error;

    // 统计
    if (result.ok) stats.ok++;
    else stats.fail++;
    if (result.stuck) stats.stuck++;
    if (result.httpStatus === 401) stats.by401++;
    if (result.httpStatus === 503) stats.by503++;
    if (result.httpStatus === 0) stats.net++;

    const fpath = await writeResult(result);
    written.push(fpath);

    // 进度行
    const verdictStr = result.verdict ? ` verdict=${result.verdict}` : '';
    const runStr = result.runId ? ` runId=${result.runId}` : '';
    const statusStr = result.ok ? `OK ${result.httpStatus}` : `FAIL ${result.httpStatus}`;
    const errStr = result.error ? `  ← ${result.error}` : '';
    process.stdout.write(`${tag}  ${statusStr} ${result.latencyMs}ms${verdictStr}${runStr}${errStr}\n`);
  }

  // 最终统计
  process.stdout.write(
    '\n[run-eval] ===== 汇总 =====\n' +
      `  total=${stats.total}  ok=${stats.ok}  fail=${stats.fail}  stuck=${stats.stuck}\n` +
      `  401(未授权)=${stats.by401}  503(db_insert_failed)=${stats.by503}  网络错误=${stats.net}\n` +
      `  结果已写入: ${RESULTS_DIR}/<id>__<mode>.json (${written.length} 个)\n`,
  );

  if (!opts.dryRun && stats.by401 === stats.total && stats.total > 0) {
    process.stdout.write('  ⚠️ 全部 401：token 可能无效或后端拒绝合成 dev token，请改用真实 COURTOS_TOKEN。\n');
  }
  if (!opts.dryRun && stats.by503 > 0) {
    process.stdout.write('  ⚠️ 出现 503 db_insert_failed：dev server 缺 TURSO_DB_URL，single 模式无法落库（已如实记录，非脚本错误）。\n');
  }

  // 退出码：只要完成了写盘流程即 0（任务级失败如实记录，不视为脚本失败）
  process.exit(0);
}

main().catch((err) => {
  fail(`未捕获异常: ${err?.stack || err?.message || String(err)}`);
});

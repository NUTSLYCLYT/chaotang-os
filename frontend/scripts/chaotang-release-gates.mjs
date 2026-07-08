#!/usr/bin/env node
/**
 * Chaotang release gates.
 *
 * One command for the trusted development loop:
 * 1. Type-check the app.
 * 2. Start the dev server on the repo-standard 3002 port.
 * 3. Run the critical browser gates for 上书房, 工部, 东宫.
 * 4. Stop the dev server.
 * 5. Build the production bundle with the /chaotang basePath.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

import { signGateToken } from './lib/jwt-sign.mjs';
import { runLiveBusinessGates } from './chaotang-live-business-gates.mjs';

const cwd = process.cwd();
const devUrl = process.env.CHAOTANG_GATES_DEV_URL ?? 'http://127.0.0.1:3002';
const jiqunUrl = (process.env.CHAOTANG_GATES_JIQUN_URL ?? process.env.JIQUN_API_URL ?? 'http://127.0.0.1:8081').replace(/\/$/, '');
const reuseExistingDev = process.env.CHAOTANG_GATES_REUSE_DEV === '1';
const requireRealSwarm = process.env.CHAOTANG_GATES_REAL_SWARM === '1';
const onlyRealSwarm = process.env.CHAOTANG_GATES_ONLY_REAL_SWARM === '1';
const realSwarmMinResponded = Number(process.env.CHAOTANG_GATES_REAL_SWARM_MIN_RESPONDED ?? 4);
const artifactRoot = process.env.CHAOTANG_GATES_ARTIFACT_DIR ?? path.join('dev', 'artifacts', 'chaotang-release-gates');
const runId = process.env.CHAOTANG_GATES_RUN_ID ?? timestamp().replace(/[:.]/g, '-');
const artifactDir = path.join(cwd, artifactRoot, runId);
const latestArtifactPath = path.join(cwd, artifactRoot, 'latest.json');
const auditLogPath = path.join(cwd, artifactRoot, 'release-audit.jsonl');
const screenshotQaOutputRoot = path.join('dev', 'artifacts', 'release-screenshot-qa', 'dev-gates');
const screenshotQaLatestPath = path.join(cwd, screenshotQaOutputRoot, 'latest.json');
const startedMs = Date.now();
const criticalBrowserSpecs = [
  'e2e/capability-debt.spec.ts',
  'e2e/donggong.spec.ts',
  'e2e/shiguan-release-gates.spec.ts',
  'e2e/shangshufang-ux.spec.ts',
];

function timestamp() {
  return new Date().toISOString();
}

function log(message) {
  process.stdout.write(`[chaotang-gates ${timestamp()}] ${message}\n`);
}

const report = {
  schema: 'chaotang.release-gates.v1',
  runId,
  startedAt: timestamp(),
  finishedAt: null,
  decision: 'RUNNING',
  mode: onlyRealSwarm ? 'real-swarm-smoke' : 'release',
  baseUrl: devUrl,
  artifactDir: path.relative(cwd, artifactDir),
  auditLog: path.relative(cwd, auditLogPath),
  evidence: {
    releaseReport: path.relative(cwd, latestArtifactPath),
    screenshotQaReport: null,
    screenshotQaSummary: null,
    realSwarmSmoke: null,
  },
  stages: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    durationMs: 0,
  },
};
let shuttingDown = false;
let auditWritten = false;

function writeReport() {
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.mkdirSync(path.dirname(latestArtifactPath), { recursive: true });
  const payload = `${JSON.stringify(report, null, 2)}\n`;
  fs.writeFileSync(path.join(artifactDir, 'report.json'), payload, 'utf8');
  fs.writeFileSync(latestArtifactPath, payload, 'utf8');
}

function gitCommit() {
  const envCommit = process.env.CHAOTANG_GATES_GIT_COMMIT ?? process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA;
  if (envCommit) return envCommit;

  try {
    const gitDirPath = path.join(cwd, '.git');
    const gitDirStat = fs.statSync(gitDirPath);
    const gitDir = gitDirStat.isDirectory()
      ? gitDirPath
      : path.resolve(cwd, fs.readFileSync(gitDirPath, 'utf8').replace(/^gitdir:\s*/, '').trim());
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref:')) return head;

    const ref = head.slice('ref:'.length).trim();
    const refPath = path.join(gitDir, ref);
    if (fs.existsSync(refPath)) return fs.readFileSync(refPath, 'utf8').trim();

    const packedRefsPath = path.join(gitDir, 'packed-refs');
    if (fs.existsSync(packedRefsPath)) {
      const packed = fs.readFileSync(packedRefsPath, 'utf8').split('\n');
      const match = packed.find((line) => line.endsWith(` ${ref}`));
      if (match) return match.split(' ')[0];
    }
    return null;
  } catch {
    return null;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function screenshotQaEvidence() {
  if (!fs.existsSync(screenshotQaLatestPath)) return null;
  const screenshotQaReport = readJson(screenshotQaLatestPath);
  const evidence = {
    report: path.relative(cwd, screenshotQaLatestPath),
    outputDir: screenshotQaReport.outputDir,
    decision: screenshotQaReport.decision,
    summary: screenshotQaReport.summary,
    blockers: screenshotQaReport.blockers,
  };
  report.evidence.screenshotQaReport = evidence.report;
  report.evidence.screenshotQaSummary = evidence.summary;
  return evidence;
}

function makeDevToken() {
  // 真 HS256 签名(替代旧 alg:none) —— FENGQUN_AUTH 上膛后后端 verify_token 才认;
  // FENGQUN_AUTH=false 时后端返匿名忽略 token,两种姿态都能跑,向后兼容。
  return signGateToken({
    sub: 'release-gates',
    username: 'release-gates',
    tenantId: 6,
    accountType: 1,
    iat: Math.floor(Date.now() / 1000),
  });
}

function closeStaleRunningReport() {
  if (!fs.existsSync(latestArtifactPath)) return;
  let previous;
  try {
    previous = readJson(latestArtifactPath);
  } catch {
    return;
  }
  if (previous?.decision !== 'RUNNING' || !previous.startedAt) return;
  const ageMs = Date.now() - Date.parse(previous.startedAt);
  if (!Number.isFinite(ageMs) || ageMs < 5 * 60 * 1000) return;

  const finishedAt = timestamp();
  const stages = Array.isArray(previous.stages) ? previous.stages : [];
  const running = stages.find((item) => item?.status === 'running');
  if (running) {
    running.status = 'failed';
    running.finishedAt = finishedAt;
    running.error = 'stale RUNNING report closed by next release gate run';
  }
  previous.finishedAt = finishedAt;
  previous.decision = 'FIX';
  previous.summary = {
    ...(previous.summary ?? {}),
    total: stages.length,
    passed: stages.filter((item) => item?.status === 'passed').length,
    failed: stages.filter((item) => item?.status === 'failed').length,
    durationMs: Date.parse(finishedAt) - Date.parse(previous.startedAt),
  };

  const payload = `${JSON.stringify(previous, null, 2)}\n`;
  fs.writeFileSync(latestArtifactPath, payload, 'utf8');
  if (previous.artifactDir) {
    const staleReportPath = path.join(cwd, previous.artifactDir, 'report.json');
    fs.mkdirSync(path.dirname(staleReportPath), { recursive: true });
    fs.writeFileSync(staleReportPath, payload, 'utf8');
  }
}

function appendAuditRecord() {
  if (auditWritten) return;
  fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });
  const failedStages = report.stages
    .filter((item) => item.status === 'failed')
    .map((item) => ({ id: item.id, error: item.error }));
  const record = {
    schema: 'chaotang.release-audit.v1',
    runId: report.runId,
    checkedAt: report.finishedAt ?? timestamp(),
    gitCommit: gitCommit(),
    decision: report.decision,
    durationMs: report.summary.durationMs,
    summary: report.summary,
    evidence: report.evidence,
    failedStages,
  };
  fs.appendFileSync(auditLogPath, `${JSON.stringify(record)}\n`, 'utf8');
  auditWritten = true;
}

function finalizeReport(decision, errorMessage = null) {
  report.finishedAt = timestamp();
  report.decision = decision;
  const running = report.stages.find((item) => item.status === 'running');
  if (running) {
    running.status = 'failed';
    running.finishedAt = timestamp();
    running.error = errorMessage ?? 'release gate interrupted before stage completed';
  }
  report.summary.total = report.stages.length;
  report.summary.passed = report.stages.filter((item) => item.status === 'passed').length;
  report.summary.failed = report.stages.filter((item) => item.status === 'failed').length;
  report.summary.durationMs = Date.now() - startedMs;
  writeReport();
  appendAuditRecord();
}

function installShutdownHandler(signal) {
  process.once(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    finalizeReport('FIX', `interrupted by ${signal}`);
    process.exit(1);
  });
}

installShutdownHandler('SIGINT');
installShutdownHandler('SIGTERM');
process.once('uncaughtException', (error) => {
  finalizeReport('FIX', error?.message ?? String(error));
  throw error;
});
process.once('unhandledRejection', (error) => {
  finalizeReport('FIX', error?.message ?? String(error));
  throw error;
});

async function recordStage(id, fn) {
  const startedAt = timestamp();
  const started = Date.now();
  const stage = {
    id,
    status: 'running',
    startedAt,
    finishedAt: null,
    durationMs: 0,
    error: null,
  };
  report.stages.push(stage);
  writeReport();
  try {
    const evidence = await fn();
    if (evidence && typeof evidence === 'object') {
      stage.evidence = evidence;
    }
    stage.status = 'passed';
  } catch (error) {
    stage.status = 'failed';
    stage.error = error?.message ?? String(error);
    if (error?.evidence && typeof error.evidence === 'object') {
      stage.evidence = error.evidence;
    }
    throw error;
  } finally {
    stage.finishedAt = timestamp();
    stage.durationMs = Date.now() - started;
    report.summary.total = report.stages.length;
    report.summary.passed = report.stages.filter((item) => item.status === 'passed').length;
    report.summary.failed = report.stages.filter((item) => item.status === 'failed').length;
    writeReport();
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    log(`run: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        ...options.env,
      },
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with ${code ?? signal ?? 'unknown'}`));
    });
  });
}

function requestOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function fetchJson(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.headers ?? {}),
      },
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

function portOpen(url) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const socket = net.createConnection({
      host: parsed.hostname,
      port: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80)),
    });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await requestOk(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`dev server did not become ready at ${url}`);
}

async function waitForPortClosed(url, timeoutMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!(await portOpen(url))) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`dev server port did not close at ${url}`);
}

async function startDevServer(extraEnv = {}) {
  if (await portOpen(devUrl)) {
    if (reuseExistingDev) {
      log(`reusing existing dev server: ${devUrl}`);
      return null;
    }
    throw new Error(`port 3002 already has a running app at ${devUrl}; stop it first or set CHAOTANG_GATES_REUSE_DEV=1`);
  }
  fs.rmSync(path.join(cwd, '.next', 'dev'), { recursive: true, force: true });
  log('starting dev server on 3002');
  let exited = false;
  let exitCode = null;
  let exitSignal = null;
  const child = spawn('pnpm', ['exec', 'next', 'dev', '-p', '3002', '--hostname', '127.0.0.1', '--webpack'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    detached: true,
    env: { ...process.env, ...extraEnv },
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[dev] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[dev] ${chunk}`));
  child.on('error', (error) => {
    throw error;
  });
  child.on('exit', (code, signal) => {
    exited = true;
    exitCode = code;
    exitSignal = signal;
    log(`dev server exited code=${code ?? 'null'} signal=${signal ?? 'null'}`);
  });
  await waitForServer(devUrl);
  if (exited) {
    throw new Error(`dev server exited before readiness check completed: code=${exitCode ?? 'null'} signal=${exitSignal ?? 'null'}`);
  }
  log(`dev server ready: ${devUrl}`);
  return child;
}

async function stopDevServer(child) {
  if (!child) return;
  log('stopping dev server');
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
  await new Promise((resolve) => {
    const t = setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        if (!child.killed) child.kill('SIGKILL');
      }
      resolve();
    }, 5000);
    child.once('exit', () => {
      clearTimeout(t);
      resolve();
    });
  });
  await waitForPortClosed(devUrl);
}

async function runBrowserGates() {
  let devServer = null;
  try {
    await recordStage('browser:dev-server', async () => {
      devServer = await startDevServer();
    });
    await recordStage('browser:critical-flows', async () => {
      log('browser gate start: critical flows');
      await run('pnpm', [
        'exec',
        'playwright',
        'test',
        ...criticalBrowserSpecs,
        '--project=chromium',
        '--workers=1',
      ], {
        env: {
          PLAYWRIGHT_SKIP_WEBSERVER: '1',
          PLAYWRIGHT_BASE_URL: `${devUrl}/`,
        },
      });
      log('browser gate pass: critical flows');
      return { specs: criticalBrowserSpecs };
    });
  } finally {
    await stopDevServer(devServer);
  }
}

async function runScreenshotQaGate() {
  let devServer = null;
  try {
    log('screenshot QA gate start');
    devServer = await startDevServer();
    try {
      await run('node', ['scripts/release-screenshot-qa.mjs'], {
        env: {
          RELEASE_QA_BASE_URL: devUrl,
          RELEASE_QA_BASE_PATH: '',
          RELEASE_QA_OUTPUT_DIR: screenshotQaOutputRoot,
          RELEASE_QA_RUN_ID: runId,
        },
      });
    } catch (error) {
      const evidence = screenshotQaEvidence();
      if (evidence && error && typeof error === 'object') {
        error.evidence = evidence;
      }
      throw error;
    }
    const evidence = screenshotQaEvidence();
    log('screenshot QA gate pass');
    return evidence;
  } finally {
    await stopDevServer(devServer);
  }
}

async function runRealSwarmGate() {
  if (!requireRealSwarm) {
    log('real swarm smoke skipped; set CHAOTANG_GATES_REAL_SWARM=1 to require it');
    return {
      required: false,
      reason: 'CHAOTANG_GATES_REAL_SWARM is not 1',
    };
  }

  const health = await fetchJson(`${jiqunUrl}/api/health`, { timeoutMs: 8000 });
  if (!health.ok) {
    const error = new Error(`jiqun backend health failed at ${jiqunUrl}/api/health: HTTP ${health.status}`);
    error.evidence = { jiqunUrl, status: health.status, body: health.text?.slice(0, 500) };
    throw error;
  }

  let devServer = null;
  try {
    devServer = await startDevServer({
      COURT_DEPT_TIMEOUT_MS: process.env.CHAOTANG_GATES_REAL_SWARM_DEPT_TIMEOUT_MS ?? '60000',
    });
    const token = makeDevToken();
    const command =
      process.env.CHAOTANG_GATES_REAL_SWARM_COMMAND ??
      'PACK研发蜂群流程：请复盘需求、验证、采购和试制四段瓶颈，并给出下一步责任人。';
    const response = await fetchJson(`${devUrl}/api/court/orchestrate/all`, {
      method: 'POST',
      timeoutMs: Number(process.env.CHAOTANG_GATES_REAL_SWARM_TIMEOUT_MS ?? 90_000),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `courtos.access_token=${encodeURIComponent(token)}`,
      },
      body: JSON.stringify({ command }),
    });
    const json = response.json ?? {};
    const coverage = json.coverage ?? {};
    const jiqunSwarm = json.jiqunSwarm ?? {};
    const courtTaskId = typeof json.taskId === 'string' && json.taskId.trim() ? json.taskId.trim() : null;
    const jiqunTaskId =
      typeof jiqunSwarm.taskId === 'string' && jiqunSwarm.taskId.trim() ? jiqunSwarm.taskId.trim() : null;
    const jiqunSessionId =
      typeof jiqunSwarm.sessionId === 'string' && jiqunSwarm.sessionId.trim() ? jiqunSwarm.sessionId.trim() : null;
    const evidence = {
      required: true,
      jiqunUrl,
      status: response.status,
      ok: json.ok === true,
      command,
      taskId: courtTaskId,
      jiqunTaskId,
      sessionId: jiqunSessionId,
      entrySwarm: jiqunSwarm.entrySwarm ?? null,
      streamUrl: jiqunSwarm.streamUrl ?? null,
      realExpected: coverage.realExpected ?? null,
      realResponded: coverage.realResponded ?? null,
      responded: coverage.responded ?? [],
      absent: coverage.absent ?? [],
      decisionId: json.decisionId ?? null,
    };
    report.evidence.realSwarmSmoke = evidence;

    if (!response.ok || json.ok !== true) {
      const error = new Error(`real swarm smoke failed: HTTP ${response.status}`);
      error.evidence = { ...evidence, body: response.text?.slice(0, 800) };
      throw error;
    }
    if (!courtTaskId) {
      const error = new Error('real swarm smoke failed: missing response.taskId');
      error.evidence = evidence;
      throw error;
    }
    if (!jiqunSessionId) {
      const error = new Error('real swarm smoke failed: missing jiqunSwarm.sessionId');
      error.evidence = evidence;
      throw error;
    }
    if (jiqunSwarm.entrySwarm !== 'pack_rd') {
      const error = new Error(`real swarm smoke failed: expected pack_rd, got ${jiqunSwarm.entrySwarm ?? 'null'}`);
      error.evidence = evidence;
      throw error;
    }
    if (Number(coverage.realResponded ?? 0) < realSwarmMinResponded) {
      const error = new Error(
        `real swarm smoke failed: realResponded ${coverage.realResponded ?? 0}/${coverage.realExpected ?? '?'} below ${realSwarmMinResponded}`,
      );
      error.evidence = evidence;
      throw error;
    }

    // 关键部门断言(charity-majors:计数够数不代表常被路由的部门活着)。
    // 仅在 CHAOTANG_GATES_REQUIRED_DEPTS 配置时硬失败(opt-in,不惊扰默认跑);
    // 例: CHAOTANG_GATES_REQUIRED_DEPTS=finance —— 户部 DOWN 时让 gate 立刻红。
    const requiredDepts = String(process.env.CHAOTANG_GATES_REQUIRED_DEPTS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (requiredDepts.length) {
      const respondedSet = new Set(coverage.responded ?? []);
      const missingDepts = requiredDepts.filter((d) => !respondedSet.has(d));
      if (missingDepts.length) {
        const error = new Error(
          `real swarm smoke failed: 关键部门未应答 [${missingDepts.join(', ')}] ` +
            `(responded=[${[...respondedSet].join(', ')}], absent=${JSON.stringify(coverage.absent ?? [])})`,
        );
        error.evidence = evidence;
        throw error;
      }
    }

    return evidence;
  } finally {
    await stopDevServer(devServer);
  }
}

/**
 * 真实业务门(本轮调通固化)：复用本 harness 的 dev-server + token。
 * G1/G2(免费)每次跑；G3/G4(烧 LLM)仅 CHAOTANG_LIVE_GATES_LLM=1(nightly)。
 * 注意：harness 内 next dev 无 /chaotang 前缀，故 base=devUrl 不带前缀。
 */
async function runLiveBusinessGate() {
  let devServer = null;
  try {
    devServer = await startDevServer();
    const token = makeDevToken();
    const cookie = `courtos.access_token=${encodeURIComponent(token)}`;
    const runLlm = process.env.CHAOTANG_LIVE_GATES_LLM === '1';
    const { results, failed } = await runLiveBusinessGates({
      base: devUrl, cookie, runLlm, log,
    });
    report.evidence.liveBusiness = { runLlm, results };
    if (failed.length > 0) {
      const error = new Error(`live-business gate failed: ${failed.map((f) => f.id).join(', ')}`);
      error.evidence = { failed };
      throw error;
    }
    return { runLlm, passed: results.length };
  } finally {
    await stopDevServer(devServer);
  }
}

async function main() {
  closeStaleRunningReport();
  try {
    if (!onlyRealSwarm) {
      await recordStage('typescript', () => run('pnpm', ['exec', 'tsc', '--noEmit']));
      // nodetest 是真护栏:它直跑被守护的逻辑(如 briefing 过滤 SQL)、必会咬人;
      // 而 live-business G1 在 jiqun 在线短路本地路径时是烟测(可假绿)。两者互补,缺一不可。
      await recordStage('nodetests', () => run('npm', ['run', 'test:node']));
      await runBrowserGates();
    }
    await recordStage('real-swarm-smoke', runRealSwarmGate);
    // 真实业务门:G1/G2 每次跑(含 daily onlyRealSwarm)，G3/G4 仅 nightly(CHAOTANG_LIVE_GATES_LLM=1)。
    await recordStage('live-business', runLiveBusinessGate);
    if (!onlyRealSwarm) {
      await recordStage('screenshot-qa', runScreenshotQaGate);
      await recordStage('production-build', () => run('npm', ['run', 'build']));
    }
    report.decision = onlyRealSwarm ? 'SMOKE' : 'SHIP';
    log(`PASS in ${Math.round((Date.now() - startedMs) / 1000)}s`);
  } catch (error) {
    report.decision = 'FIX';
    process.stderr.write(`[chaotang-gates] FAIL: ${error?.message ?? String(error)}\n`);
    process.exitCode = 1;
  } finally {
    report.finishedAt = timestamp();
    if (report.decision === 'RUNNING') {
      report.decision = process.exitCode ? 'FIX' : 'SHIP';
    }
    report.summary.durationMs = Date.now() - startedMs;
    report.summary.total = report.stages.length;
    report.summary.passed = report.stages.filter((item) => item.status === 'passed').length;
    report.summary.failed = report.stages.filter((item) => item.status === 'failed').length;
    writeReport();
    appendAuditRecord();
    log(`release gate report: ${path.relative(cwd, latestArtifactPath)}`);
  }
}

await main();

#!/usr/bin/env node
/**
 * Cross-process integration verification for chaotang-os.
 *
 * Starts the real backend (uvicorn) and real frontend (`next start`) processes
 * as OS-level child processes and exercises two scenarios end-to-end:
 *
 *   1. Success path: backend and frontend both running, frontend pointed at
 *      the live backend via `BACKEND_BASE_URL`. Asserts the public home page
 *      renders its visible public heading and `/health` renders the backend-healthy marker.
 *   2. Failure path: backend not started at all, frontend pointed at a held
 *      sentinel port that never serves a valid backend response. Asserts `/health` renders a graceful
 *      "backend unavailable" marker (not a 500 / crash).
 *   3. Decree BFF connectivity path (`POST /api/decrees/chancellor` -> real FastAPI
 *      `POST /api/v1/decrees/chancellor`): registers a one-off throwaway test account
 *      through the real `POST /api/auth/register` BFF to obtain a real session cookie,
 *      then submits `{"decreeText": ""}` (which fails Pydantic validation on the backend
 *      before `get_chancellor_graph()` is ever called -- see
 *      `backend/app/api/decrees.py`'s "Provider wiring pitfall" docstring) and asserts the
 *      BFF returns `{status:"error", reason:"validation"}`/422 -- never `reason:"network"` --
 *      proving the BFF really reaches the decree endpoint when the backend is healthy.
 *      A second sub-scenario points a fresh frontend instance at an unreachable sentinel
 *      (reusing `createUnavailableBackendSentinel()`) and asserts the same request instead
 *      returns `{status:"error", reason:"network"}`/503 with no internal address leaked in
 *      the response body. Never submits real decree text that could reach a real model call.
 *
 * Written in plain Node.js (no bash) on purpose so behaviour is identical on
 * a Windows development machine and on Ubuntu CI runners. All spawned child
 * processes are terminated in `finally` blocks, even when an assertion
 * throws, so no uvicorn/next process or bound port is left behind.
 *
 * Preconditions (not performed by this script):
 *   - backend/.venv exists with dev dependencies installed
 *     (`cd backend && python -m venv .venv && .venv/.../python -m pip install -e ".[dev]"`).
 *   - frontend/node_modules is installed (`cd frontend && npm ci`).
 * If `frontend/.next` is missing, this script runs `npm run build` once
 * before exercising the scenarios, so it also works as a single command in
 * CI right after `npm ci`.
 */

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const BACKEND_DIR = path.join(REPO_ROOT, "backend");
const FRONTEND_DIR = path.join(REPO_ROOT, "frontend");

const IS_WINDOWS = process.platform === "win32";
const MAX_START_ATTEMPTS = 3;

function log(message) {
  console.log(`[verify_integration] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function npmCommand() {
  return IS_WINDOWS ? "npm.cmd" : "npm";
}

/**
 * 统一封装 npm 子进程的启动方式。
 *
 * Windows 上 npm 是 `.cmd` 脚本，`spawn`/`spawnSync` 在不启用 `shell` 时会因
 * `spawn EINVAL` 失败，因此需要 `shell: true`；但 Node 对「`shell: true` +
 * 数组形式的 `args`」会输出 `DEP0190` 弃用告警（未来行为可能变为不再原样拼接）。
 * 这里改为在 Windows 上把命令与所有 `args`（本文件中只会是固定字面量或
 * `getFreePort()` 产出的纯数字端口号，不含外部/用户输入）拼接成单个字符串传给
 * `shell: true` 的 `spawn`/`spawnSync`，避免使用已弃用的调用形态；Ubuntu/CI 上
 * `shell: false` + 数组 `args` 是标准、无告警的调用方式。
 */
function spawnNpmArgs(args) {
  if (IS_WINDOWS) {
    return { command: [npmCommand(), ...args].join(" "), args: [], shell: true };
  }
  return { command: npmCommand(), args, shell: false };
}

function resolvePythonExecutable() {
  const venvPython = IS_WINDOWS
    ? path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe")
    : path.join(BACKEND_DIR, ".venv", "bin", "python");
  if (existsSync(venvPython)) {
    return venvPython;
  }
  log(
    `警告：未找到 ${venvPython}，回退使用 PATH 中的系统 ${IS_WINDOWS ? "python" : "python3"}` +
      "（需已安装 backend 依赖，否则后端进程会启动失败）。",
  );
  return IS_WINDOWS ? "python" : "python3";
}

/** 系统分配一个当前空闲的端口号：短暂监听后立即关闭，供随后真正的服务使用。 */
async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : undefined;
      server.close((closeError) => {
        if (closeError) reject(closeError);
        else if (port === undefined) reject(new Error("无法分配空闲端口"));
        else resolve(port);
      });
    });
  });
}

async function getUniqueFreePort(usedPorts) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const port = await getFreePort();
    if (!usedPorts.has(port)) {
      usedPorts.add(port);
      return port;
    }
  }
  throw new Error("无法分配本次集成校验尚未使用的唯一端口");
}

async function createUnavailableBackendSentinel() {
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.destroy();
  });
  const port = await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (typeof address === "object" && address) resolve(address.port);
      else reject(new Error("无法为不可用后端 sentinel 分配监听端口"));
    });
  });
  return {
    port,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

async function waitForHttp(url, { timeoutMs = 20000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await fetch(url, { cache: "no-store" });
    } catch (error) {
      lastError = error;
      await sleep(intervalMs);
    }
  }
  throw new Error(`等待 ${url} 就绪超时（${timeoutMs}ms）：${lastError}`);
}

async function waitForManagedHttp(managedProcess, url) {
  const deadline = Date.now() + 20000;
  let lastError;
  while (Date.now() < deadline) {
    if (managedProcess.spawnError) throw managedProcess.spawnError;
    if (
      managedProcess.child.exitCode !== null ||
      managedProcess.child.signalCode !== null
    ) {
      throw new Error(
        `${managedProcess.name} 在 HTTP 就绪前退出\n${managedProcess.describeForError()}`,
      );
    }
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.status === 200) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`等待 ${url} 就绪超时（20000ms）：${lastError}`);
}

function ensureFrontendBuilt() {
  const buildMarker = path.join(FRONTEND_DIR, ".next", "BUILD_ID");
  if (existsSync(buildMarker)) {
    return;
  }
  log("frontend 尚未构建（未找到 .next/BUILD_ID），先执行 npm run build ...");
  const { command, args, shell } = spawnNpmArgs(["run", "build"]);
  const result = spawnSync(command, args, {
    cwd: FRONTEND_DIR,
    stdio: "inherit",
    shell,
  });
  if (result.status !== 0) {
    throw new Error(`npm run build 失败，退出码 ${result.status}`);
  }
}

/** 包装一个子进程，统一负责收集输出并保证可靠终止（含 Windows 下的进程树清理）。 */
class ManagedProcess {
  constructor(name, child) {
    this.name = name;
    this.child = child;
    this.stdout = "";
    this.stderr = "";
    this.child.stdout?.on("data", (chunk) => {
      this.stdout += chunk.toString();
    });
    this.child.stderr?.on("data", (chunk) => {
      this.stderr += chunk.toString();
    });
    this.child.on("error", (error) => {
      this.spawnError = error;
    });
  }

  async kill() {
    const child = this.child;
    const pid = child.pid;
    if (pid === undefined) return;
    if (IS_WINDOWS) {
      if (child.exitCode !== null || child.signalCode !== null) return;
      await new Promise((resolve) => {
        child.once("exit", () => resolve());
        // uvicorn/next 在 Windows 上可能派生额外子进程；taskkill /T 终止整棵进程树。
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
        }).on("error", () => resolve());
        setTimeout(resolve, 5000);
      });
      return;
    }

    // detached 子进程的 PID 同时是其 PGID；负 PID 只命中本脚本创建的进程组。
    try {
      process.kill(-pid, "SIGTERM");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
    if (await waitForProcessGroupExit(pid, 3000)) return;
    try {
      process.kill(-pid, "SIGKILL");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
    await waitForProcessGroupExit(pid, 2000);
  }

  describeForError() {
    return (
      `${this.name} 进程 stderr（末尾）：\n${this.stderr.slice(-2000)}\n` +
      `${this.name} 进程 stdout（末尾）：\n${this.stdout.slice(-2000)}`
    );
  }
}

async function waitForProcessGroupExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(-pid, 0);
    } catch (error) {
      if (error?.code === "ESRCH") return true;
      throw error;
    }
    await sleep(50);
  }
  return false;
}

function startBackend(port) {
  const python = resolvePythonExecutable();
  const child = spawn(
    python,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(port)],
    { cwd: BACKEND_DIR, stdio: ["ignore", "pipe", "pipe"], detached: !IS_WINDOWS },
  );
  return new ManagedProcess("backend", child);
}

function startFrontend(port, backendBaseUrl) {
  const { command, args, shell } = spawnNpmArgs(["run", "start", "--", "-p", String(port)]);
  const child = spawn(command, args, {
    cwd: FRONTEND_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BACKEND_BASE_URL: backendBaseUrl },
    shell,
    detached: !IS_WINDOWS,
  });
  return new ManagedProcess("frontend", child);
}

async function startManagedServiceWithRetry({
  name,
  usedPorts,
  start,
  readinessPath,
}) {
  const failures = [];
  for (let attempt = 1; attempt <= MAX_START_ATTEMPTS; attempt += 1) {
    const port = await getUniqueFreePort(usedPorts);
    const managedProcess = start(port);
    try {
      await waitForManagedHttp(
        managedProcess,
        `http://127.0.0.1:${port}${readinessPath}`,
      );
      return { port, managedProcess };
    } catch (error) {
      failures.push(`端口 ${port}: ${error.message}`);
      await managedProcess.kill();
      if (attempt < MAX_START_ATTEMPTS) {
        log(`${name} 第 ${attempt} 次启动未就绪，改用新的唯一端口重试。`);
      }
    }
  }
  throw new Error(`${name} 连续启动失败：\n${failures.join("\n")}`);
}

function createPageAsserter(frontendPort, frontend) {
  return async function assertPage(pathname, { contains, matches = [], excludes } = {}) {
    const url = `http://127.0.0.1:${frontendPort}${pathname}`;
    const response = await waitForHttp(url).catch((error) => {
      throw new Error(`前端页面 ${pathname} 未能就绪：${error.message}\n${frontend.describeForError()}`);
    });
    if (response.status !== 200) {
      throw new Error(
        `前端页面 ${pathname} 返回非 200 状态码：${response.status}\n` +
          frontend.describeForError(),
      );
    }

    const html = await response.text();
    if (contains && !html.includes(contains)) {
      throw new Error(
        `前端页面 ${pathname} 缺少 ${JSON.stringify(contains)}，页面片段：${html.slice(0, 800)}\n` +
          frontend.describeForError(),
      );
    }
    for (const pattern of matches) {
      if (!pattern.test(html)) {
        throw new Error(
          `前端页面 ${pathname} 缺少可见 DOM ${pattern}，页面片段：${html.slice(0, 800)}\n` +
            frontend.describeForError(),
        );
      }
    }
    if (excludes && html.includes(excludes)) {
      throw new Error(
        `前端页面 ${pathname} 不应包含 ${JSON.stringify(excludes)}，页面片段：${html.slice(0, 800)}\n` +
          frontend.describeForError(),
      );
    }
  };
}

async function runSuccessScenario(usedPorts) {
  log("场景一（成功路径）：启动后端 + 前端指向它 ...");
  let backend;
  let frontend;
  try {
    const backendStart = await startManagedServiceWithRetry({
      name: "backend",
      usedPorts,
      start: startBackend,
      readinessPath: "/health",
    });
    backend = backendStart.managedProcess;
    const frontendStart = await startManagedServiceWithRetry({
      name: "frontend",
      usedPorts,
      start: (port) =>
        startFrontend(port, `http://127.0.0.1:${backendStart.port}`),
      readinessPath: "/",
    });
    frontend = frontendStart.managedProcess;
    const frontendPort = frontendStart.port;
    const assertPage = createPageAsserter(frontendPort, frontend);
    await assertPage("/", {
      matches: [
        /<h1[^>]*>朝堂 OS<\/h1>/,
        /<a[^>]*href="\/login"[^>]*>已有账号<\/a>/,
      ],
      excludes: "data-backend-ok",
    });
    await assertPage("/health", { contains: 'data-backend-ok="true"' });
    log("场景一通过：首页展示公开可见入口，健康页体现后端健康状态。");
  } finally {
    if (frontend) await frontend.kill();
    if (backend) await backend.kill();
  }
}

async function runFailureScenario(usedPorts) {
  log("场景二（失败路径）：后端不可用时前端应优雅降级 ...");
  const sentinel = await createUnavailableBackendSentinel();
  usedPorts.add(sentinel.port);
  let frontend;
  try {
    const frontendStart = await startManagedServiceWithRetry({
      name: "frontend（后端不可用场景）",
      usedPorts,
      start: (port) =>
        startFrontend(port, `http://127.0.0.1:${sentinel.port}`),
      readinessPath: "/",
    });
    frontend = frontendStart.managedProcess;
    const frontendPort = frontendStart.port;
    const assertPage = createPageAsserter(frontendPort, frontend);
    await assertPage("/", {
      matches: [
        /<h1[^>]*>朝堂 OS<\/h1>/,
        /<a[^>]*href="\/login"[^>]*>已有账号<\/a>/,
      ],
      excludes: "data-backend-ok",
    });
    await assertPage("/health", { contains: 'data-backend-ok="false"' });
    log("场景二通过：首页展示公开可见入口，健康页优雅体现后端不可用。");
  } finally {
    if (frontend) await frontend.kill();
    await sentinel.close();
  }
}

/**
 * BFF 会话 cookie 名称，与 `frontend/src/lib/session.ts` 的 `SESSION_COOKIE_NAME`
 * 保持一致的字面量（本脚本是独立的纯 Node.js 集成校验，不经过 Next.js/webpack 打包，
 * 无法直接 `import` TypeScript 源文件，因此在此复制常量而非引用它；两处任一变更都需要
 * 同步核对）。
 */
const SESSION_COOKIE_NAME = "courtos_session";

/** 发起一次 JSON POST 请求，返回状态码、原始文本与（若可解析）JSON 解析结果。 */
async function postJson(url, body, extraHeaders = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, headers: response.headers, text, json };
}

/** 从 `Set-Cookie` 响应头中提取指定 cookie 名称的原始（仍是 URL-encoded）值。 */
function parseSetCookieValue(setCookieHeader, cookieName) {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`(?:^|,\\s*)${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * 场景三：下旨 BFF -> FastAPI 后端代理路径的真实连通性校验。
 *
 * 覆盖 `docs/product/tasks/2026-07-28-decree-bff-backend-connectivity.md` 的验收标准
 * 第一、二条：健康后端下 BFF 确实能转发到下旨端点（而不是误报 `network`），以及后端
 * 不可达时 BFF 返回可操作且不泄露内部地址的错误。全程只发送 `decreeText: ""`，在后端
 * Pydantic 校验阶段即被拒绝（422），`get_chancellor_graph()` 不会被调用，不产生任何真实
 * 模型调用。
 */
async function runDecreeBffConnectivityScenario(usedPorts) {
  log("场景三（下旨 BFF 连通性）：健康后端下应转发到下旨端点并映射为 validation，而非 network ...");
  let backend;
  let healthyFrontend;
  try {
    const backendStart = await startManagedServiceWithRetry({
      name: "backend（下旨 BFF 场景）",
      usedPorts,
      start: startBackend,
      readinessPath: "/health",
    });
    backend = backendStart.managedProcess;
    const backendBaseUrl = `http://127.0.0.1:${backendStart.port}`;
    const frontendStart = await startManagedServiceWithRetry({
      name: "frontend（下旨 BFF 场景 · 健康后端）",
      usedPorts,
      start: (port) => startFrontend(port, backendBaseUrl),
      readinessPath: "/",
    });
    healthyFrontend = frontendStart.managedProcess;
    const frontendPort = frontendStart.port;

    // 一次性测试账号：仅本次运行使用，用户名/邮箱带时间戳与随机后缀避免冲突。
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const username = `verify-integration-${suffix}`;
    const email = `verify-integration-${suffix}@example.invalid`;
    const password = "Verify-Integration-Test-Password-123";

    const registerResponse = await postJson(
      `http://127.0.0.1:${frontendPort}/api/auth/register`,
      { username, email, password },
    );
    if (registerResponse.status !== 201) {
      throw new Error(
        `注册一次性测试账号失败，期望 201 实际 ${registerResponse.status}：${registerResponse.text.slice(0, 500)}\n` +
          healthyFrontend.describeForError(),
      );
    }
    const setCookieHeader = registerResponse.headers.get("set-cookie");
    const sessionCookieValue = parseSetCookieValue(setCookieHeader, SESSION_COOKIE_NAME);
    if (!sessionCookieValue) {
      throw new Error(
        `注册响应缺少 ${SESSION_COOKIE_NAME} 会话 cookie；Set-Cookie 头：${JSON.stringify(setCookieHeader)}`,
      );
    }

    const decreeResponse = await postJson(
      `http://127.0.0.1:${frontendPort}/api/decrees/chancellor`,
      { decreeText: "" },
      { cookie: `${SESSION_COOKIE_NAME}=${sessionCookieValue}` },
    );
    if (decreeResponse.status !== 422) {
      throw new Error(
        `健康后端场景期望下旨 BFF 返回 422（validation），实际 ${decreeResponse.status}：` +
          `${decreeResponse.text.slice(0, 500)}\n${healthyFrontend.describeForError()}`,
      );
    }
    if (
      decreeResponse.json === null ||
      decreeResponse.json.status !== "error" ||
      decreeResponse.json.reason !== "validation"
    ) {
      throw new Error(
        `健康后端场景期望响应体 {status:"error", reason:"validation"}，实际：` +
          `${JSON.stringify(decreeResponse.json)}（原文：${decreeResponse.text.slice(0, 500)}）`,
      );
    }
    log("场景三 · 正向子场景通过：健康后端下下旨 BFF 转发成功，422/validation（不是 network）。");
  } finally {
    if (healthyFrontend) await healthyFrontend.kill();
    if (backend) await backend.kill();
  }

  log("场景三（下旨 BFF 连通性）：后端不可达时应返回 network/503，且不泄露内部地址 ...");
  const sentinel = await createUnavailableBackendSentinel();
  usedPorts.add(sentinel.port);
  let unavailableFrontend;
  try {
    const frontendStart = await startManagedServiceWithRetry({
      name: "frontend（下旨 BFF 场景 · 后端不可达）",
      usedPorts,
      start: (port) => startFrontend(port, `http://127.0.0.1:${sentinel.port}`),
      readinessPath: "/",
    });
    unavailableFrontend = frontendStart.managedProcess;
    const frontendPort = frontendStart.port;

    // `readSessionId` 只检查 cookie 是否存在、非空，并不向后端校验其有效性
    // （见 `frontend/src/lib/session.ts`），因此这里无需一个真实会话即可让请求
    // 走到 `submitDecree()` 从而触发 network 分支。
    const fakeSessionCookieValue = "verify-integration-sentinel-fake-session-token";
    const decreeResponse = await postJson(
      `http://127.0.0.1:${frontendPort}/api/decrees/chancellor`,
      { decreeText: "" },
      { cookie: `${SESSION_COOKIE_NAME}=${fakeSessionCookieValue}` },
    );
    if (decreeResponse.status !== 503) {
      throw new Error(
        `后端不可达场景期望下旨 BFF 返回 503（network），实际 ${decreeResponse.status}：` +
          `${decreeResponse.text.slice(0, 500)}\n${unavailableFrontend.describeForError()}`,
      );
    }
    if (
      decreeResponse.json === null ||
      decreeResponse.json.status !== "error" ||
      decreeResponse.json.reason !== "network"
    ) {
      throw new Error(
        `后端不可达场景期望响应体 {status:"error", reason:"network"}，实际：` +
          `${JSON.stringify(decreeResponse.json)}（原文：${decreeResponse.text.slice(0, 500)}）`,
      );
    }
    const leakNeedles = [String(sentinel.port), "BACKEND_BASE_URL", "127.0.0.1"];
    for (const needle of leakNeedles) {
      if (decreeResponse.text.includes(needle)) {
        throw new Error(
          `后端不可达场景响应体不应包含内部地址信息 ${JSON.stringify(needle)}：${decreeResponse.text}`,
        );
      }
    }
    log("场景三 · 反向子场景通过：后端不可达时返回 network/503，响应体未泄露内部地址。");
  } finally {
    if (unavailableFrontend) await unavailableFrontend.kill();
    await sentinel.close();
  }
}

async function main() {
  ensureFrontendBuilt();
  const usedPorts = new Set();
  await runSuccessScenario(usedPorts);
  await runFailureScenario(usedPorts);
  await runDecreeBffConnectivityScenario(usedPorts);
  log("集成校验全部通过：成功路径、失败路径与下旨 BFF 连通性场景均可重复验证，子进程均已清理。");
}

main().catch((error) => {
  console.error(`[verify_integration] 失败：${error.stack ?? error}`);
  process.exitCode = 1;
});

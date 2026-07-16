#!/usr/bin/env node
/**
 * Cross-process integration verification for chaotang-os.
 *
 * Starts the real backend (uvicorn) and real frontend (`next start`) processes
 * as OS-level child processes and exercises two scenarios end-to-end:
 *
 *   1. Success path: backend and frontend both running, frontend pointed at
 *      the live backend via `BACKEND_BASE_URL`. Asserts the frontend home
 *      page renders the backend-healthy marker.
 *   2. Failure path: backend not started at all, frontend pointed at an
 *      unused port. Asserts the frontend home page renders a graceful
 *      "backend unavailable" marker (not a 500 / crash).
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
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    await new Promise((resolve) => {
      child.once("exit", () => resolve());
      if (IS_WINDOWS) {
        // uvicorn/next 在 Windows 上可能派生额外子进程；taskkill /T 终止整棵进程树。
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
        }).on("error", () => resolve());
      } else {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
        }, 3000);
      }
      // 兜底：即使 exit 事件因异常情况未触发，也不要无限等待。
      setTimeout(resolve, 5000);
    });
  }

  describeForError() {
    return (
      `${this.name} 进程 stderr（末尾）：\n${this.stderr.slice(-2000)}\n` +
      `${this.name} 进程 stdout（末尾）：\n${this.stdout.slice(-2000)}`
    );
  }
}

function startBackend(port) {
  const python = resolvePythonExecutable();
  const child = spawn(
    python,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(port)],
    { cwd: BACKEND_DIR, stdio: ["ignore", "pipe", "pipe"] },
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
  });
  return new ManagedProcess("frontend", child);
}

async function runSuccessScenario() {
  log("场景一（成功路径）：启动后端 + 前端指向它 ...");
  const backendPort = await getFreePort();
  const frontendPort = await getFreePort();
  const backend = startBackend(backendPort);
  let frontend;
  try {
    await waitForHttp(`http://127.0.0.1:${backendPort}/health`).catch((error) => {
      throw new Error(`后端未能就绪：${error.message}\n${backend.describeForError()}`);
    });

    frontend = startFrontend(frontendPort, `http://127.0.0.1:${backendPort}`);
    const response = await waitForHttp(`http://127.0.0.1:${frontendPort}/`).catch((error) => {
      throw new Error(`前端未能就绪：${error.message}\n${frontend.describeForError()}`);
    });

    if (response.status !== 200) {
      throw new Error(
        `前端首页返回非 200 状态码：${response.status}\n${frontend.describeForError()}`,
      );
    }
    const html = await response.text();
    if (!html.includes('data-backend-ok="true"') || !html.includes("后端状态")) {
      throw new Error(
        `前端首页未体现「后端健康」信息，页面片段：${html.slice(0, 800)}\n` +
          frontend.describeForError(),
      );
    }
    log("场景一通过：前端首页体现后端健康状态。");
  } finally {
    if (frontend) await frontend.kill();
    await backend.kill();
  }
}

async function runFailureScenario() {
  log("场景二（失败路径）：后端不可用时前端应优雅降级 ...");
  // 只借用一次「当前空闲端口」的判定，刻意不启动任何监听该端口的后端进程。
  const unreachableBackendPort = await getFreePort();
  const frontendPort = await getFreePort();
  const frontend = startFrontend(frontendPort, `http://127.0.0.1:${unreachableBackendPort}`);
  try {
    const response = await waitForHttp(`http://127.0.0.1:${frontendPort}/`).catch((error) => {
      throw new Error(`前端未能就绪：${error.message}\n${frontend.describeForError()}`);
    });

    if (response.status !== 200) {
      throw new Error(
        `前端首页在后端不可用时返回非 200 状态码：${response.status}\n` +
          frontend.describeForError(),
      );
    }
    const html = await response.text();
    if (!html.includes('data-backend-ok="false"') || !html.includes("后端不可用")) {
      throw new Error(
        `前端首页未体现「后端不可用」的优雅降级，页面片段：${html.slice(0, 800)}\n` +
          frontend.describeForError(),
      );
    }
    log("场景二通过：前端首页体现后端不可用，且未 500 / 崩溃。");
  } finally {
    await frontend.kill();
  }
}

async function main() {
  ensureFrontendBuilt();
  await runSuccessScenario();
  await runFailureScenario();
  log("集成校验全部通过：成功路径与失败路径均可重复验证，子进程均已清理。");
}

main().catch((error) => {
  console.error(`[verify_integration] 失败：${error.stack ?? error}`);
  process.exitCode = 1;
});

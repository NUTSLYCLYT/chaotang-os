#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

const LLM_ENV_KEYS = new Set([
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_BASE_URL',
  'DEEPSEEK_MODEL',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_MODEL',
]);

function parseEnvLine(line) {
  const trimmed = line.replace(/^\uFEFF/, '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
  const eq = normalized.indexOf('=');
  if (eq <= 0) return null;
  const key = normalized.slice(0, eq).trim();
  let value = normalized.slice(eq + 1).trim();
  if (!LLM_ENV_KEYS.has(key)) return null;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function loadLlmEnvFromFile(filePath) {
  if (!filePath || !existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed || !parsed.value || process.env[parsed.key]) continue;
    process.env[parsed.key] = parsed.value;
  }
}

function loadSharedJiqunLlmEnv() {
  if (process.env.CHAOTANG_IMPORT_JIQUN_ENV === '0') return;
  const cwd = process.cwd();
  const candidates = [
    process.env.JIQUN_ENV_FILE,
    process.env.JIQUN_AI_ENV_FILE,
    path.resolve(cwd, '..', 'jiqun_ai', '.env'),
    path.resolve(cwd, '..', 'jiqun_ai_fresh', '.env'),
    path.resolve(cwd, '..', 'fengQun', 'jiqun_ai_fresh', '.env'),
    '/home/ubuntu/fe/fengQun/jiqun_ai_fresh/.env',
  ];
  for (const filePath of candidates) {
    loadLlmEnvFromFile(filePath);
  }
}

loadSharedJiqunLlmEnv();

// #2 构建门：prod build/start 必须 NEXT_PUBLIC_API_MODE=real，杜绝"缺 .env 静默退化成 mock 假数据冒充 LIVE"
// (铁律13.2)。NEXT_PUBLIC_* 在 build 时内联，断言必须挂在 build 命令(本父进程)才会咬人——.env.local 仅
// Next 子进程读、本脚本看不到，故 prod 须由 shell/CI export NEXT_PUBLIC_API_MODE=real。
// 逃生阀 CHAOTANG_ALLOW_MOCK_BUILD=1(默认关)：仅 demo 打包显式放行。dev 不拦(允许本地 mock 演示)。
{
  const nextCmd = process.argv[2];
  if ((nextCmd === 'build' || nextCmd === 'start') && process.env.NEXT_PUBLIC_API_MODE !== 'real') {
    if (process.env.CHAOTANG_ALLOW_MOCK_BUILD === '1') {
      console.warn(`[release-gate] NEXT_PUBLIC_API_MODE=${String(process.env.NEXT_PUBLIC_API_MODE)}，但 CHAOTANG_ALLOW_MOCK_BUILD=1 显式放行(demo 打包)`);
    } else {
      console.error(`[release-gate] prod ${nextCmd} 要求 NEXT_PUBLIC_API_MODE=real，当前为：${String(process.env.NEXT_PUBLIC_API_MODE)}`);
      console.error('[release-gate] 缺 env 会让整仓静默退化成 mock 假数据冒充 LIVE(铁律13.2)。请 export NEXT_PUBLIC_API_MODE=real 后重试，或 CHAOTANG_ALLOW_MOCK_BUILD=1 显式放行 demo 打包。');
      process.exit(1);
    }
  }
}

process.env.BASE_PATH ||= '/chaotang';
process.env.NEXT_PUBLIC_BASE_PATH ||= process.env.BASE_PATH;

// dev/prod .next 目录隔离(2026-07-04·根治"pnpm dev 弄坏正在跑的 prod" 这个已实测发生过一次的
// 8小时故障根因)：dev(3002)与 prod(3050·systemd courtos-web.service)此前共享同一默认 `.next`，
// dev 的增量编译会覆盖/使 prod 依赖的构建产物失效。next.config.ts 早有 NEXT_DIST_DIR 隔离开关，
// 但 `pnpm dev` 从未实际设置它，隔离形同虚设。这里给 `dev` 子命令一个默认隔离目录(可被显式
// NEXT_DIST_DIR 覆盖)，`build`/`start` 不受影响(默认仍是 prod 期望的 `.next`)。
if (process.argv[2] === 'dev') {
  process.env.NEXT_DIST_DIR ||= '.next-dev';
}

const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  env: process.env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

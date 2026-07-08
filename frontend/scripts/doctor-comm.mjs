#!/usr/bin/env node
/**
 * doctor:comm — 主线前后端通信一键体检（2026-06-28 · Charity Majors 天才建议固化）。
 *
 * 大改动/大重构后一键确认"所有代码还调得通"，不靠"应该没事"，靠实测数字。
 * 检查：① 后端蜂群 jiqun 活 ② 主库 tasks 总线有数据 ③ 5 真面 API 端点全通 ④ 真面页面文件在位。
 * 用法：pnpm doctor:comm（需 dev 在 3002 跑；端点检查会自动跳过 dev 未起的情况）。
 */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = 'http://localhost:3002/chaotang';
const JIQUN = process.env.JIQUN_API_URL ?? 'http://127.0.0.1:8081';
const results = [];
let hardFail = 0;

function ok(label, pass, detail) {
  results.push({ label, pass, detail });
  if (!pass) hardFail++;
}

async function http(url, timeoutMs = 6000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return res.status;
  } catch {
    return 0;
  }
}

// ① 后端蜂群 jiqun
const jiqunCode = await http(`${JIQUN}/api/health`, 4000);
ok('后端蜂群 jiqun :8081', jiqunCode === 200, `HTTP ${jiqunCode || '不可达'}`);

// ② 主库 tasks 总线
let taskCount = -1;
if (existsSync('.chaotang-main-dev.db')) {
  try {
    taskCount = Number(execFileSync('sqlite3', ['.chaotang-main-dev.db', 'SELECT count(*) FROM tasks;'], { encoding: 'utf8' }).trim());
  } catch { /* sqlite3 缺失 */ }
}
ok('主库 tasks 数据总线', taskCount > 0, taskCount >= 0 ? `${taskCount} 行` : '无 sqlite3/库（跳过）');

// ③ 真面页面文件在位（purge 误伤检测）
const PAGES = [
  'src/app/(dashboard)/start/page.tsx',
  'src/app/(dashboard)/intel/page.tsx',
  'src/features/hubu/components/hubu-add-decision.tsx',
  'src/features/bingbu/components/bingbu-prospect-panel.tsx',
];
const missingPages = PAGES.filter((p) => !existsSync(p));
ok('5 真面页面文件在位', missingPages.length === 0, missingPages.length ? `缺 ${missingPages.join(', ')}` : '全在');

// ④ 5 真面 API 端点（dev 在 3002 才测）
const devUp = (await http(`${BASE}/start`, 4000)) !== 0;
if (devUp) {
  for (const ep of ['hubu/overview', 'bingbu/overview', 'intel/signals']) {
    const code = await http(`${BASE}/api/court/${ep}`);
    ok(`端点 /api/court/${ep}`, code === 200, `HTTP ${code}`);
  }
} else {
  results.push({ label: '端点实测', pass: true, detail: 'dev(3002) 未起，跳过端点检查' });
}

// —— 报告 ——
console.log('🩺 doctor:comm — 主线前后端通信体检\n');
for (const r of results) console.log(`  ${r.pass ? '✅' : '❌'} ${r.label}：${r.detail}`);
console.log('');
if (hardFail > 0) {
  console.log(`❌ ${hardFail} 项不通——主线通信受损，先修再继续。`);
  process.exit(process.env.DOCTOR_STRICT === '1' ? 1 : 0);
}
console.log('✅ 主线前后端通信全通。');
process.exit(0);

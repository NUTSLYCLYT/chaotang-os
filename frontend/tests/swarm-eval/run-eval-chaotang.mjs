#!/usr/bin/env node
/**
 * run-eval-chaotang.mjs —— 打【真实编排器大脑】POST /api/court/chaotang/decree/draft（Bearer），
 * 不走已死的 deliberate /consult。测的是真实 DeepSeek 驱动的"中书起草"：意图识别 + 推荐分类 +
 * 召哪些大臣 + 置信度。写 results/<id>__deep.json，供 judge.mjs / scorecard.mjs 复用。
 *
 * 用法：node run-eval-chaotang.mjs [--only <子串>] [--limit N] [--base http://localhost:3002]
 * 鉴权：默认 admin/admin123 登录取真实 token（也可 COURTOS_TOKEN）。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:3002');
const ONLY = arg('--only', null);
const LIMIT = parseInt(arg('--limit', '999'), 10);

async function token() {
  if (process.env.COURTOS_TOKEN) return process.env.COURTOS_TOKEN;
  const r = await fetch(`${BASE}/api/auth/local-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }), signal: AbortSignal.timeout(10000),
  });
  return (await r.json()).accessToken;
}

const battery = JSON.parse(await readFile(join(HERE, 'battery.json'), 'utf8'));
let tasks = battery.tasks.filter((t) => t.mode === 'deep');
if (ONLY) tasks = tasks.filter((t) => (t.id + t.deptCode + t.command).includes(ONLY));
tasks = tasks.slice(0, LIMIT);

const tok = await token();
if (!tok) { console.error('✗ 无 token（后端是否在跑？）'); process.exit(1); }
await mkdir(join(HERE, 'results'), { recursive: true });

let ok = 0, llm = 0, rule = 0, fail = 0;
console.log(`[run-eval-chaotang] ${tasks.length} 个 deep 任务 → /api/court/chaotang/decree/draft (真实大脑)`);
for (const t of tasks) {
  const t0 = Date.now();
  let rec = { id: t.id, dept: t.dept, deptCode: t.deptCode, mode: 'deep', command: t.command, ranAt: new Date().toISOString() };
  try {
    const res = await fetch(`${BASE}/api/court/chaotang/decree/draft`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ rawCommand: t.command }), signal: AbortSignal.timeout(90000),
    });
    const j = await res.json().catch(() => ({}));
    const data = j?.data ?? {};
    rec = { ...rec, ok: res.ok, httpStatus: res.status, source: data.source, latencyMs: Date.now() - t0, output: data };
    if (res.ok) { ok++; data.source === 'llm' ? llm++ : rule++; } else fail++;
  } catch (e) {
    rec = { ...rec, ok: false, httpStatus: 0, latencyMs: Date.now() - t0, error: String(e.message || e), output: null };
    fail++;
  }
  await writeFile(join(HERE, 'results', `${t.id}__deep.json`), JSON.stringify(rec, null, 2));
  console.log(`  ${rec.ok ? '✓' : '✗'} ${t.id.padEnd(20)} source=${rec.source ?? '-'} ${rec.latencyMs}ms`);
}
console.log(`\n汇总: ok=${ok} (llm=${llm} rule=${rule}) fail=${fail}`);
if (rule > 0) console.log(`⚠ ${rule} 个落 rule 兜底（个别任务大脑可能超时/解析失败）`);

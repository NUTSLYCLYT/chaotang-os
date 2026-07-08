#!/usr/bin/env node
/**
 * seed-security-gate.mjs —— 不需要 LLM 大脑的安全门验证（brain 402 时仍可跑）。
 *
 * 真大脑(/ask)欠费 402 → 无法真编排造决策；但熔断/鉴权/幂等只在 sign-off 那道门，
 * 与大脑无关。故直接往 dev 文件台账插一条【干净的、带冲突边 兵部|户部】的决策（镜像
 * recordOrchestration 的插入），再打【真 sign-off 端点】跑安全门电池：
 *   A1 无 token → 401            （密旨 fail-closed）
 *   A2 假 token → 401/403         （fail-closed）
 *   A3 chosenDept=工部(不在边) → 422（熔断/铁律2，写库前弹回）
 *   A4 chosenDept=兵部(在边) → 200 （happy path，学到偏好 +1）
 *   A5 重复签同一 id → 409        （幂等/反枚举重放）
 * 并断言：A3 未让 zeroEdgeSignoffs 增加（熔断真的没写非学习 outcome）、A4 让 prefIncrements +1。
 *
 * 运行：node tests/swarm-eval/orchestration/seed-security-gate.mjs
 */
import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';

const BASE = process.env.SWARM_BASE || 'http://localhost:3002';
const FILE = 'file:./.chaotang-ledger-dev.db';
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const pass = [], fail = [];
const ok = (l, c, d = '') => (c ? pass : fail).push(`${c ? '✅' : '❌'} ${l}${d ? ` — ${d}` : ''}`);

const ck = (tk) => ({ Cookie: `courtos.access_token=${tk}` });
async function login() {
  const r = await fetch(`${BASE}/api/auth/local-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`登录失败 ${r.status}`);
  return (await r.json()).accessToken;
}
async function signOff(tk, decisionId, chosenDept, headers) {
  const r = await fetch(`${BASE}/api/court/orchestrate/sign-off`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(headers ?? ck(tk)) }, body: JSON.stringify({ decisionId, action: 'signed', chosenDept }), signal: AbortSignal.timeout(20000) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function flywheel(tk) {
  const r = await fetch(`${BASE}/api/court/ledger/health`, { headers: ck(tk), signal: AbortSignal.timeout(15000) });
  return (await r.json().catch(() => ({}))).flywheel ?? null;
}

(async () => {
  const tk = await login();
  const db = createClient({ url: FILE });
  const { rows } = await db.execute('SELECT hash FROM boss_decisions ORDER BY id DESC LIMIT 1');
  const prev = rows[0] ? String(rows[0].hash) : '0'.repeat(64);
  const at = new Date().toISOString();
  const content = JSON.stringify({ seed: '[安全门验证种子]', edges: ['兵部|户部'], at });
  const hash = sha256(prev + content);
  const ins = await db.execute({ sql: `INSERT INTO boss_decisions (command, verdict, escalated, edges_json, prev_hash, hash, created_at) VALUES (?,?,?,?,?,?,?)`, args: ['[安全门验证种子] 应急粮草采购：兵部要追加，户部该不该批', '[seed]', 1, JSON.stringify(['兵部|户部']), prev, hash, at] });
  const id = Number(ins.lastInsertRowid);
  console.log(`▶ 已植入干净种子决策 decisionId=${id}（edge=兵部|户部，outcome=NULL）`);

  const before = await flywheel(tk);
  console.log('  插入后基线 flywheel:', JSON.stringify(before));

  const a1 = await signOff(tk, id, 'bing_bu', { 'Content-Type': 'application/json' });
  ok('A1 无 token → 401', a1.status === 401, `status=${a1.status}`);
  const a2 = await signOff(tk, id, 'bing_bu', { 'Content-Type': 'application/json', Cookie: 'courtos.access_token=deadbeef.garbage.forged' });
  ok('A2 假 token → 401/403', a2.status === 401 || a2.status === 403, `status=${a2.status}`);
  const a3 = await signOff(tk, id, 'gong_bu'); // 工部 不在 兵部|户部 → 熔断
  ok('A3 熔断 chosenDept 未命中边 → 422', a3.status === 422, `status=${a3.status} body=${JSON.stringify(a3.body)}`);
  const afterA3 = await flywheel(tk);
  ok('A3 未写库（zeroEdgeSignoffs 未增）', (afterA3?.zeroEdgeSignoffs ?? -1) === (before?.zeroEdgeSignoffs ?? -2), `${before?.zeroEdgeSignoffs}→${afterA3?.zeroEdgeSignoffs}`);
  const a4 = await signOff(tk, id, 'bing_bu'); // 兵部 在边 → 200，学到
  ok('A4 命中边签字 → 200', a4.status === 200 && a4.body?.ok === true, `status=${a4.status} body=${JSON.stringify(a4.body)}`);
  const afterA4 = await flywheel(tk);
  ok('A4 偏好 +1（复利燃料入账）', (afterA4?.prefIncrementsTotal ?? 0) === (before?.prefIncrementsTotal ?? -1) + 1, `${before?.prefIncrementsTotal}→${afterA4?.prefIncrementsTotal}`);
  ok('A4 zeroEdgeSignoffs 仍未增（只学合法边）', (afterA4?.zeroEdgeSignoffs ?? -1) === (before?.zeroEdgeSignoffs ?? -2), `${before?.zeroEdgeSignoffs}→${afterA4?.zeroEdgeSignoffs}`);
  const a5 = await signOff(tk, id, 'bing_bu'); // 重复
  ok('A5 重复 sign-off → 409', a5.status === 409, `status=${a5.status}`);

  console.log('\n═══ 安全门判定（不需大脑）═══');
  for (const p of pass) console.log(p);
  for (const f of fail) console.log(f);
  console.log(`\n通过 ${pass.length} / 失败 ${fail.length}`);
  console.log('终态 flywheel:', JSON.stringify(await flywheel(tk)));
  if (fail.length > 0) process.exit(1);
  console.log('🟢 安全门（fail-closed + 熔断 + 幂等）全绿 —— 熔断真的在写库前弹回投毒');
})().catch((e) => { console.error('✗', e.message); process.exit(1); });

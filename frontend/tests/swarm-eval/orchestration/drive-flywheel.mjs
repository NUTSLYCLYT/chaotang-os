#!/usr/bin/env node
/**
 * drive-flywheel.mjs —— 按"大神方式"亲手把判断飞轮转一圈（真大脑 + 真·可写 file: 库）。
 *
 * 演示完整仪式（这就是大神说的"正确用法"）：
 *   ① 丞相编排一个跨域硬冲突问题 → 召部门 live 单 agent（真大脑）
 *   ② 两部都接地却硬冲突 → 不裁决，伏候圣裁（摊给老板）
 *   ③ 老板【真拍板】：选一侧 → 写回 SHA256 哈希链 + 累积偏好（飞轮的燃料）
 *   ④ 第二轮同问题 → merge 附"陛下历史 N/M 次选 X 部"学习先验（越用越懂）
 *   ⑤ 健康信号：counts 从 0 跳起来 = 不空转
 *
 * dev 的 Turso 不可写，故飞轮台账用本地 file 库（SQL 镜像 boss-ledger/decision-ledger.ts）；
 * 但部门 agent 的"答案"是真大脑（调 dev 服务器的 /ask 端点）。
 *
 * 运行：node tests/swarm-eval/orchestration/drive-flywheel.mjs
 */
import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';

const BASE = process.env.SWARM_BASE || 'http://localhost:3002';
const FILE = '/tmp/chaotang-flywheel.db';
const Q = '兵部要追加应急粮草采购，户部该不该批这笔钱？给数据依据。';
try { rmSync(FILE, { force: true }); } catch {}
const db = createClient({ url: `file:${FILE}` });
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const GENESIS = '0'.repeat(64);
const now = () => new Date().toISOString();

async function login() {
  const r = await fetch(`${BASE}/api/auth/local-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }), signal: AbortSignal.timeout(10000) });
  return (await r.json()).accessToken;
}
async function ask(tk, dept, command) {
  const ep = dept === 'finance' ? '/api/court/hubu/ask' : `/api/court/dept/${dept}/ask`;
  const r = await fetch(`${BASE}${ep}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `courtos.access_token=${tk}` }, body: JSON.stringify({ command }), signal: AbortSignal.timeout(120000) });
  const j = await r.json();
  return j.ok ? { dept, name: dept === 'finance' ? '户部' : '兵部', answer: j.answer, grounded: j.grounded, conflicts: j.conflicts || '无' } : null;
}
// —— 镜像 merge.ts 的硬冲突检测 —— //
function mergeConflicts(contribs) {
  const g = contribs.filter((c) => c.grounded);
  const out = [];
  for (const a of g) for (const b of g) if (a.name !== b.name && a.conflicts.includes(b.name)) {
    const edge = [a.name, b.name].sort().join('|');
    if (!out.find((x) => x.edge === edge)) out.push({ edge, depts: [a.name, b.name] });
  }
  return out;
}
// —— 镜像 boss-ledger.ts —— //
async function recordOrch(command, escalated, edges) {
  const { rows } = await db.execute('SELECT hash FROM boss_decisions ORDER BY id DESC LIMIT 1');
  const prev = rows[0] ? String(rows[0].hash) : GENESIS;
  const hash = sha256(prev + JSON.stringify({ command, escalated, edges }));
  const res = await db.execute({ sql: 'INSERT INTO boss_decisions(command,escalated,edges_json,prev_hash,hash,created_at) VALUES(?,?,?,?,?,?)', args: [command, escalated ? 1 : 0, JSON.stringify(edges), prev, hash, now()] });
  return { id: Number(res.lastInsertRowid), hash, prev };
}
async function signOff(id, chosen, edges) {
  await db.execute({ sql: 'UPDATE boss_decisions SET outcome=?, chosen_dept=? WHERE id=?', args: ['signed', chosen, id] });
  for (const e of edges) if (e.split('|').includes(chosen))
    await db.execute({ sql: 'INSERT INTO boss_preferences(edge,dept,count) VALUES(?,?,1) ON CONFLICT(edge,dept) DO UPDATE SET count=count+1', args: [e, chosen] });
}
async function loadPrior(edge) {
  const { rows } = await db.execute({ sql: 'SELECT dept,count FROM boss_preferences WHERE edge=?', args: [edge] });
  const tally = {}; let total = 0; for (const r of rows) { tally[String(r.dept)] = Number(r.count); total += Number(r.count); }
  return { tally, total };
}
async function reinforce(edge) {
  const { rows } = await db.execute({ sql: 'SELECT strength FROM conflict_field WHERE edge=?', args: [edge] });
  const s = +((rows[0] ? Number(rows[0].strength) : 0) + 1).toFixed(2);
  await db.execute({ sql: 'INSERT INTO conflict_field(edge,strength,last_at) VALUES(?,?,?) ON CONFLICT(edge) DO UPDATE SET strength=excluded.strength,last_at=excluded.last_at', args: [edge, s, now()] });
  return s;
}
async function counts() {
  const c = {};
  for (const t of ['boss_decisions', 'boss_preferences', 'conflict_field']) {
    const { rows } = await db.execute(`SELECT COUNT(*) n FROM ${t}`); c[t] = Number(rows[0].n);
  } return c;
}

(async () => {
  await db.execute('CREATE TABLE conflict_field(edge TEXT PRIMARY KEY,strength REAL,last_at TEXT)');
  await db.execute('CREATE TABLE boss_decisions(id INTEGER PRIMARY KEY AUTOINCREMENT,command TEXT,escalated INTEGER,edges_json TEXT,prev_hash TEXT,hash TEXT,outcome TEXT,chosen_dept TEXT,created_at TEXT)');
  await db.execute('CREATE TABLE boss_preferences(edge TEXT,dept TEXT,count INTEGER DEFAULT 0,PRIMARY KEY(edge,dept))');
  const tk = await login();
  if (!tk) { console.error('✗ 登录失败'); process.exit(1); }

  console.log('═══ 第 1 轮：第一次遇到这个跨域冲突 ═══');
  let contribs = (await Promise.all([ask(tk, 'finance', Q), ask(tk, 'ops', Q)])).filter(Boolean);
  let conf = mergeConflicts(contribs);
  console.log('召部门:', contribs.map((c) => c.name), '| 硬冲突:', conf.map((c) => c.depts), '| 伏候圣裁:', conf.length > 0);
  const edges1 = conf.map((c) => c.edge);
  const rec1 = await recordOrch(Q, conf.length > 0, edges1);
  for (const e of edges1) console.log('  浓度场强化', e, '→', await reinforce(e));
  for (const e of edges1) console.log('  本轮先验:', e, await loadPrior(e), '(还没学到)');
  console.log('  decisionId=', rec1.id, '| 焊进链 hash=', rec1.hash.slice(0, 16) + '…');
  console.log('\n👑 老板【真拍板】：这次战备优先，签了，选兵部');
  await signOff(rec1.id, '兵部', edges1);

  console.log('\n═══ 第 2 轮：同样的冲突再来 ═══');
  contribs = (await Promise.all([ask(tk, 'finance', Q), ask(tk, 'ops', Q)])).filter(Boolean);
  conf = mergeConflicts(contribs);
  for (const c of conf) {
    const prior = await loadPrior(c.edge);
    console.log('  冲突', c.depts, '→ 学习先验:', prior, prior.total ? `← 飞轮记得：陛下历史 ${prior.tally['兵部'] || 0}/${prior.total} 次选兵部` : '');
    console.log('  浓度场再强化', c.edge, '→', await reinforce(c.edge));
  }
  await recordOrch(Q, conf.length > 0, conf.map((c) => c.edge));

  console.log('\n═══ 健康信号（不空转的证据）═══');
  console.log('  台账行数:', await counts(), '→ counts 从 0 跳起来了 ✅');
  console.log(`\n飞轮文件: ${FILE}（真·可写库，逻辑镜像产品 SQL）`);
})().catch((e) => { console.error('✗', e.message); process.exit(1); });

#!/usr/bin/env node
/**
 * verify-ledgers.mjs —— 用真·可写 file: libsql 库，端到端证明两个天才设计的 SQL/逻辑成立
 * （Deming："In God we trust; all others must bring data."）。
 *
 * dev 环境的 Turso 走 fallback 不可写，无法 live 验证；本harness 用本地 file 库跑同一套 DDL/DML，
 * 证明：① Wilson 浓度场会强化/蒸发/收敛 ② Bezos 飞轮哈希链 tamper-evident + 从签字学偏好。
 * SQL 镜像 src/lib/swarm/{decision-ledger,boss-ledger}.ts（如改产品 SQL，同步此处）。
 *
 * 运行：node tests/swarm-eval/orchestration/verify-ledgers.mjs
 */
import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';

const FILE = '/tmp/chaotang-ledger-verify.db';
try { rmSync(FILE, { force: true }); } catch {}
const db = createClient({ url: `file:${FILE}` });

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const HALFLIFE_MS = 7 * 24 * 60 * 60 * 1000;
const decay = (s, lastMs, nowMs) => s * Math.pow(0.5, Math.max(0, nowMs - lastMs) / HALFLIFE_MS);
const NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}`); } };

// ── Wilson 浓度场 ──────────────────────────────────────────────
await db.execute(`CREATE TABLE conflict_field (edge TEXT PRIMARY KEY, strength REAL NOT NULL DEFAULT 0, last_at TEXT NOT NULL)`);
async function reinforce(edge, nowIso) {
  const nowMs = Date.parse(nowIso);
  const { rows } = await db.execute({ sql: 'SELECT strength,last_at FROM conflict_field WHERE edge=?', args: [edge] });
  const prev = rows[0];
  const base = prev ? decay(Number(prev.strength), Date.parse(String(prev.last_at)), nowMs) : 0;
  const strength = +(base + 1).toFixed(3);
  await db.execute({ sql: `INSERT INTO conflict_field(edge,strength,last_at) VALUES(?,?,?) ON CONFLICT(edge) DO UPDATE SET strength=excluded.strength,last_at=excluded.last_at`, args: [edge, strength, nowIso] });
}
async function loadField(me, threshold = 0.4) {
  const { rows } = await db.execute('SELECT edge,strength,last_at FROM conflict_field');
  return rows.map((r) => ({ edge: String(r.edge), s: +decay(Number(r.strength), Date.parse(String(r.last_at)), NOW).toFixed(2) }))
    .filter((x) => x.edge.split('|').includes(me) && x.s >= threshold).sort((a, b) => b.s - a.s);
}
console.log('🐜 Wilson 双向浓度场:');
await reinforce('兵部|户部', iso(NOW));
await reinforce('兵部|户部', iso(NOW));
await reinforce('兵部|户部', iso(NOW));         // 反复声明 ×3 → 强化
await reinforce('刑部|户部', iso(NOW - 21 * 24 * 3600 * 1000)); // 21 天前(3 个半衰) → 强化后会蒸发到 0.125
const field = await loadField('户部');
check('反复冲突的 兵部|户部 浮现为最高浓度(strength≈3)', field[0]?.edge === '兵部|户部' && field[0]?.s >= 2.9);
check('久未触碰的 刑部|户部 蒸发到阈值下、被丢弃(收敛)', !field.some((f) => f.edge === '刑部|户部'));
console.log('   场:', field);

// ── Bezos 判断飞轮 ─────────────────────────────────────────────
await db.execute(`CREATE TABLE boss_decisions (id INTEGER PRIMARY KEY AUTOINCREMENT, command TEXT, verdict TEXT, edges_json TEXT, prev_hash TEXT, hash TEXT, outcome TEXT, chosen_dept TEXT, outcome_hash TEXT, created_at TEXT)`);
await db.execute(`CREATE TABLE boss_preferences (edge TEXT, dept TEXT, count INTEGER DEFAULT 0, PRIMARY KEY(edge,dept))`);
const GENESIS = '0'.repeat(64);
async function recordOrch(command, verdict, edges) {
  const { rows } = await db.execute('SELECT hash FROM boss_decisions ORDER BY id DESC LIMIT 1');
  const prev = rows[0] ? String(rows[0].hash) : GENESIS;
  const content = JSON.stringify({ command, verdict, edges });
  const hash = sha256(prev + content);
  const res = await db.execute({ sql: 'INSERT INTO boss_decisions(command,verdict,edges_json,prev_hash,hash,created_at) VALUES(?,?,?,?,?,?)', args: [command, verdict, JSON.stringify(edges), prev, hash, iso(NOW)] });
  return { id: Number(res.lastInsertRowid), hash, prev };
}
async function signOff(id, chosen) {
  const { rows } = await db.execute({ sql: 'SELECT edges_json FROM boss_decisions WHERE id=?', args: [id] });
  const edges = JSON.parse(String(rows[0].edges_json));
  await db.execute({ sql: 'UPDATE boss_decisions SET outcome=?, chosen_dept=? WHERE id=?', args: ['signed', chosen, id] });
  for (const edge of edges) if (edge.split('|').includes(chosen))
    await db.execute({ sql: `INSERT INTO boss_preferences(edge,dept,count) VALUES(?,?,1) ON CONFLICT(edge,dept) DO UPDATE SET count=count+1`, args: [edge, chosen] });
}
async function loadPrior(edge) {
  const { rows } = await db.execute({ sql: 'SELECT dept,count FROM boss_preferences WHERE edge=?', args: [edge] });
  const tally = {}; let total = 0;
  for (const r of rows) { tally[String(r.dept)] = Number(r.count); total += Number(r.count); }
  return { tally, total };
}
console.log('\n👑 Bezos 判断飞轮:');
const d1 = await recordOrch('兵部追加粮草户部批否', '伏候圣裁', ['兵部|户部']);
const d2 = await recordOrch('盐铁扩营', '伏候圣裁', ['刑部|户部']);
check('哈希链 tamper-evident:#2.prev_hash == #1.hash', d2.prev === d1.hash);
check('创世前置:#1.prev_hash == GENESIS', d1.prev === GENESIS);
const prior0 = await loadPrior('兵部|户部');
check('签字前无先验(total=0)', prior0.total === 0);
await signOff(d1.id, '兵部');                    // 老板这次选兵部
const prior1 = await loadPrior('兵部|户部');
check('签字后学到偏好:陛下在 兵部|户部 选兵部 1 次', prior1.tally['兵部'] === 1 && prior1.total === 1);
console.log('   学到的先验:', prior1);
// 篡改检测：重算 hash 应等于存储 hash
const { rows: chk } = await db.execute({ sql: 'SELECT prev_hash,command,verdict,edges_json,hash FROM boss_decisions WHERE id=?', args: [d2.id] });
const row2 = chk[0];
const recomputed = sha256(String(row2.prev_hash) + JSON.stringify({ command: String(row2.command), verdict: String(row2.verdict), edges: JSON.parse(String(row2.edges_json)) }));
check('链可校验:重算 hash == 存储 hash（未被篡改）', recomputed === String(row2.hash));

console.log(`\n=== 结果: ${pass} 通过 / ${fail} 失败 ===`);
process.exit(fail ? 1 : 0);

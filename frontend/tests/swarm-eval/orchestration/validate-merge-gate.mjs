#!/usr/bin/env node
/**
 * validate-merge-gate.mjs —— merge 前阻塞性验证（打真 HTTP 端点，非文件镜像）。
 *
 * 证明 5 件事，对应清单 + 飞轮三问 + 铁律：
 *   ① 密旨端点 fail-closed：无 token / 假 token → 拒（401/403）
 *   ② 熔断（铁律2）：带 chosenDept 却未命中冲突边 → 422（写库前弹回）
 *   ③ 幂等：同 decisionId 重复 sign-off → 409（杜绝枚举重放投毒）
 *   ④ 会复利（飞轮#1）：第 2 轮起 orchestrate 的 merge 真的带上学到的 prior（回路闭合，改变下一次输出）
 *   ⑤ 能看见转（飞轮#3 / Deming）：每轮 flywheel_health.conserved 恒真、zeroEdgeSignoffs 恒 0、
 *      prefIncrementsTotal 每签一轮 +1（方向性，不空转）
 *
 * 非破坏性：以启动时的 health 为基线，断言 DELTA，不删 dev 台账库。
 * 运行：node tests/swarm-eval/orchestration/validate-merge-gate.mjs [rounds]
 */
const BASE = process.env.SWARM_BASE || 'http://localhost:3002';
const ROUNDS = Number(process.argv[2] || 10); // 端到端签字轮数（含 Phase A 的 1 轮 = 共 ROUNDS 轮）
const Q = '兵部要追加应急粮草采购，户部该不该批这笔钱？给数据依据。';
const EDGE = '兵部|户部';
const IN_EDGE = 'bing_bu'; // 命中边（happy path，应学到）
const OFF_EDGE = 'gong_bu'; // 合法 code 但不在边（工部）→ 应触发熔断 422

const pass = [];
const fail = [];
const ok = (label, cond, detail = '') => (cond ? pass : fail).push(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);

async function login() {
  const r = await fetch(`${BASE}/api/auth/local-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }), signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`登录失败 HTTP ${r.status}`);
  return (await r.json()).accessToken;
}
const ck = (tk) => ({ Cookie: `courtos.access_token=${tk}` });
async function orchestrate(tk) {
  const r = await fetch(`${BASE}/api/court/orchestrate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...ck(tk) },
    body: JSON.stringify({ command: Q }), signal: AbortSignal.timeout(180000),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function signOff(tk, decisionId, chosenDept, { headers } = {}) {
  const r = await fetch(`${BASE}/api/court/orchestrate/sign-off`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(headers ?? ck(tk)) },
    body: JSON.stringify({ decisionId, action: 'signed', chosenDept }), signal: AbortSignal.timeout(20000),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function health(tk) {
  const r = await fetch(`${BASE}/api/court/ledger/health`, { headers: ck(tk), signal: AbortSignal.timeout(15000) });
  return (await r.json().catch(() => ({}))).flywheel ?? null;
}
const priorOf = (body) => (body?.merge?.conflicts ?? []).find((c) => [...(c.depts ?? [])].sort().join('|') === EDGE)?.prior ?? null;
const hasEscalation = (body) => !!body?.merge?.escalateToBoss && (body?.merge?.conflicts ?? []).some((c) => [...(c.depts ?? [])].sort().join('|') === EDGE);

(async () => {
  const tk = await login();
  console.log(`▶ 登录成功，基线采集…  (BASE=${BASE}, ROUNDS=${ROUNDS})`);
  const base = await health(tk);
  const basePref = base?.prefIncrementsTotal ?? 0;
  console.log('  基线 flywheel_health:', JSON.stringify(base));

  // ── Phase A：安全门电池（先造一个真决策 D0）──
  console.log('\n═══ Phase A · 安全门（fail-closed / 熔断 / 幂等）═══');
  let d0 = await orchestrate(tk);
  ok('orchestrate 产出真决策', d0.status === 200 && Number(d0.body?.decisionId) > 0, `status=${d0.status} id=${d0.body?.decisionId}`);
  ok('该决策含硬冲突边 兵部|户部（伏候圣裁）', hasEscalation(d0.body), `conflicts=${JSON.stringify((d0.body?.merge?.conflicts ?? []).map((c) => c.depts))}`);
  const decisionId = Number(d0.body?.decisionId);

  // A1 无 token
  const a1 = await signOff(tk, decisionId, IN_EDGE, { headers: { 'Content-Type': 'application/json' } });
  ok('A1 无 token → 拒 (401)', a1.status === 401, `status=${a1.status}`);
  // A2 假 token
  const a2 = await signOff(tk, decisionId, IN_EDGE, { headers: { 'Content-Type': 'application/json', Cookie: 'courtos.access_token=deadbeef.garbage.forged' } });
  ok('A2 假 token → 拒 (401/403)', a2.status === 401 || a2.status === 403, `status=${a2.status}`);
  // A3 熔断：合法 code 但不在边
  const a3 = await signOff(tk, decisionId, OFF_EDGE);
  ok('A3 熔断 chosenDept 未命中边 → 拒 (422)', a3.status === 422, `status=${a3.status} body=${JSON.stringify(a3.body)}`);
  // A4 happy path：命中边，签了
  const a4 = await signOff(tk, decisionId, IN_EDGE);
  ok('A4 命中边签字 → 200 且学到偏好', a4.status === 200 && a4.body?.ok === true, `status=${a4.status}`);
  // A5 幂等：重复签同一 decisionId
  const a5 = await signOff(tk, decisionId, IN_EDGE);
  ok('A5 重复 sign-off → 拒 (409)', a5.status === 409, `status=${a5.status}`);
  const hA = await health(tk);
  ok('A 后 conserved 恒真 & zeroEdgeSignoffs=0', hA?.conserved === true && hA?.zeroEdgeSignoffs === 0, JSON.stringify(hA));

  // ── Phase B：方向性飞轮（含 A4，共 ROUNDS 轮签字到同一边）──
  console.log('\n═══ Phase B · 方向性飞轮（复利 + 守恒可见）═══');
  let prevPref = hA?.prefIncrementsTotal ?? basePref + 1; // A4 已 +1
  console.log(`  round 1 (=A4 已签): prefIncrementsTotal=${prevPref}  Δ vs 基线=${prevPref - basePref}`);
  let coupledProven = false;
  for (let i = 2; i <= ROUNDS; i++) {
    const o = await orchestrate(tk);
    if (o.status === 429) { console.log(`  round ${i}: 429 限流，等 12s…`); await new Promise((r) => setTimeout(r, 12000)); }
    const id = Number(o.body?.decisionId);
    const prior = priorOf(o.body);
    if (prior?.lead === '兵部' && prior.total >= 1) coupledProven = true; // ④ 回路闭合证据
    const s = await signOff(tk, id, IN_EDGE);
    const h = await health(tk);
    const pref = h?.prefIncrementsTotal ?? prevPref;
    const climbed = pref === prevPref + 1;
    console.log(`  round ${i}: sign=${s.status} prior=${prior ? `兵部 ${prior.leadCount}/${prior.total}` : '无'} pref=${pref}(Δ+${pref - prevPref}) conserved=${h?.conserved} zeroEdge=${h?.zeroEdgeSignoffs}`);
    ok(`round ${i} 签字 200`, s.status === 200, `status=${s.status}`);
    ok(`round ${i} pref +1（复利方向性）`, climbed, `${prevPref}→${pref}`);
    ok(`round ${i} conserved 恒真 & zeroEdge=0`, h?.conserved === true && h?.zeroEdgeSignoffs === 0, JSON.stringify(h));
    prevPref = pref;
  }
  ok('④ 回路闭合：≥2 轮起 orchestrate 真的带上学到的 prior（改变下一次输出）', coupledProven, coupledProven ? '兵部 prior 已注入后续编排' : '从未观察到 prior 注入');

  const finalH = await health(tk);
  console.log('\n═══ 终态 flywheel_health ═══');
  console.log(' ', JSON.stringify(finalH));
  console.log(`  净增偏好累积 Δ = ${(finalH?.prefIncrementsTotal ?? 0) - basePref}（应 = ${ROUNDS}）`);

  console.log('\n═══ 判定 ═══');
  for (const p of pass) console.log(p);
  for (const f of fail) console.log(f);
  console.log(`\n通过 ${pass.length} / 失败 ${fail.length}`);
  if (fail.length > 0) process.exit(1);
  console.log('🟢 merge 门 1（飞轮端到端 + 安全门 + 熔断）全绿');
})().catch((e) => { console.error('✗ 验证崩溃：', e.message); process.exit(1); });

#!/usr/bin/env node
/**
 * 朝堂「真实业务」发布门禁 —— 把人肉 curl 验证固化成 CI 可复核的门(Deming:拿数据，不靠信)。
 *
 * 钉死本轮调通的不可回退断言：
 *   [免费·每次跑] G1 朝报端点烟测、G2 军机处来源诚实。
 *   [烧 LLM·runLlm] G3 六部 grounded verdict+写主库、G4 钦天监 LIVE 推演。
 *
 * ⚠️ 边界(2026-06-24 deming 实证):G1 是「端点烟测」非「过滤证明」——jiqun 在线时 briefing
 *    短路本地 SQL 路径，G1 测的是后端路径、过滤坏没坏都绿(假绿)。真正守护学习记录过滤的是
 *    src/app/api/court/shangshufang/briefing-queries.nodetest.ts(直跑 SQL、必咬人)，已接进
 *    release-gates 的 nodetests 阶段(npm run test:node)。live 烟测与单测互补，缺一不可。
 *
 * 两种用法：
 *   1. 库内集成：release-gates 复用其 dev-server + token，调 runLiveBusinessGates({base,cookie,runLlm})。
 *      —— G1/G2 接进 harness:chaotang:* 每次跑；G3/G4 走 nightly(CHAOTANG_LIVE_GATES_LLM=1)。
 *   2. 独立 CLI：pnpm dev 起在 3002 后 `node scripts/chaotang-live-business-gates.mjs`
 *      含烧 LLM：`CHAOTANG_LIVE_GATES_LLM=1 node scripts/chaotang-live-business-gates.mjs`
 * 任一断言失败 → runLiveBusinessGates 返回 failed.length>0；CLI 则退出码 1。
 */

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function hasLearningPrefix(id) {
  return String(id).startsWith('qintian_learning_') || String(id).startsWith('department_learning_');
}

/**
 * 跑全部 live-business 门。
 * @param {{ base: string, cookie: string, runLlm?: boolean, log?: (m:string)=>void }} opts
 *   base   —— API 基址(含 /chaotang 前缀与否由调用方决定：库内 next dev 无前缀、独立 pnpm dev 有 /chaotang)
 *   cookie —— `courtos.access_token=...`(decode-only BFF 接受 dev token)
 * @returns {Promise<{ results: Array<{id,desc,pass,error?}>, failed: Array<object> }>}
 */
export async function runLiveBusinessGates({ base, cookie, runLlm = false, log = () => {} }) {
  const root = base.replace(/\/$/, '');
  async function call(path, init = {}) {
    const res = await fetch(`${root}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(init.headers ?? {}) },
    });
    let json = null;
    const text = await res.text();
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { ok: res.ok, status: res.status, json };
  }

  const results = [];
  async function gate(id, desc, fn) {
    try {
      await fn();
      results.push({ id, desc, pass: true });
      log(`✅ ${id} ${desc}`);
    } catch (e) {
      results.push({ id, desc, pass: false, error: String(e?.message ?? e) });
      log(`❌ ${id} ${desc} → ${String(e?.message ?? e)}`);
    }
  }

  // G1 朝报端点烟测(过滤真守在 briefing-queries.nodetest，见文件头注 ⚠️)
  await gate('G1', '朝报端点烟测：briefing 响应正常、输出无学习前缀(过滤真守在 nodetest)', async () => {
    await call('/api/qintian/learning-path'); // 故意制造一条学习记录
    const b = await call('/api/court/shangshufang/briefing');
    assert(b.json?.success, `briefing 未成功(status ${b.status})`);
    const mem = b.json.data?.memorials ?? b.json.data?.memorialList ?? [];
    const polluted = mem.map((m) => m.taskId ?? m.id ?? '').filter(hasLearningPrefix);
    assert(polluted.length === 0, `奏折出现学习污染：${JSON.stringify(polluted)}`);
  });

  // G2 军机处来源诚实
  await gate('G2', '军机处来源诚实：有真会审→LIVE_SWARM，无→DEMO，不冒充', async () => {
    const c = await call('/api/court/grand-council/live');
    assert(c.json?.success, `grand-council/live 未成功(status ${c.status})`);
    const { sourceLabel, sessions } = c.json.data ?? {};
    assert(['LIVE_SWARM', 'DEMO'].includes(sourceLabel), `非法 sourceLabel：${sourceLabel}`);
    const n = (sessions ?? []).length;
    assert(n > 0 ? sourceLabel === 'LIVE_SWARM' : sourceLabel === 'DEMO',
      `来源与数据不符：${n} sessions 却标 ${sourceLabel}`);
  });

  if (runLlm) {
    // G3 六部真业务
    await gate('G3', '六部真业务：orchestrate grounded verdict + 写主库 taskId', async () => {
      const r = await call('/api/court/orchestrate', {
        method: 'POST',
        body: JSON.stringify({ command: '盘点本周最该推进的三个六部项目，并指出最大风险' }),
      });
      assert(r.json?.ok, `orchestrate 未成功(status ${r.status})`);
      assert(r.json.taskId, 'orchestrate 未返回 taskId(未写主库)');
      assert((r.json.called ?? []).length > 0, 'orchestrate 未召任何部门');
      assert(r.json.merge?.grounded === true, 'orchestrate verdict 未接地(grounded=false)');
      assert((r.json.merge?.verdict ?? '').length > 10, 'orchestrate verdict 为空');
    });

    // G4 钦天监真推演
    await gate('G4', '钦天监真推演：generate 出 3 情景、LIVE、概率合计≈1', async () => {
      const r = await call('/api/qintian/scenarios/generate', { method: 'POST' });
      assert(r.json?.success && r.json?.sourceLabel === 'LIVE', `generate 非 LIVE：${r.json?.sourceLabel}`);
      const data = r.json.data ?? [];
      assert(data.length === 3, `情景数应为 3，实为 ${data.length}`);
      const sum = data.reduce((a, s) => a + (Number(s.probability) || 0), 0);
      assert(Math.abs(sum - 1) < 0.25, `三情景概率合计偏离 1 过多：${sum.toFixed(2)}`);
    });
  }

  return { results, failed: results.filter((r) => !r.pass) };
}

/* ── 独立 CLI（仅直接执行时）：默认打 pnpm dev 的 /chaotang 前缀，自铸 alg:none dev token ── */
function b64url(s) {
  return Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function standaloneCookie() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const p = b64url(JSON.stringify({
    sub: 'live-business-gates', username: 'live-business-gates',
    tenantId: 6, accountType: 0, principalType: 'account', iat: now, exp: now + 3600,
  }));
  return `courtos.access_token=${h}.${p}.local`;
}

const isDirectRun = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  const base = (process.env.CHAOTANG_LIVE_GATES_URL ?? 'http://127.0.0.1:3002').replace(/\/$/, '') + '/chaotang';
  const runLlm = process.env.CHAOTANG_LIVE_GATES_LLM === '1';
  console.log(`[live-business-gates] BASE=${base} LLM=${runLlm ? 'on' : 'off'}\n`);
  const { results, failed } = await runLiveBusinessGates({
    base, cookie: standaloneCookie(), runLlm, log: (m) => console.log(m),
  });
  if (!runLlm) console.log('⏭  G3/G4(烧 LLM)已跳过 —— 设 CHAOTANG_LIVE_GATES_LLM=1 开启');
  console.log(`\n[live-business-gates] ${results.length - failed.length}/${results.length} 通过`);
  if (failed.length > 0) {
    console.log('失败门：' + failed.map((f) => f.id).join(', '));
    process.exit(1);
  }
}

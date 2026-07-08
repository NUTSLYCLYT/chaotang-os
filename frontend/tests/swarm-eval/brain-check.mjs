#!/usr/bin/env node
/**
 * brain-check.mjs — 评测前置体检：判定"智能体大脑"是真 LLM 在跑，还是 rule/骨架兜底。
 *
 * 为什么需要它：实测发现两条能力路径当前都在【兜底模式】——
 *   · /api/governance/deliberate：上游 legal-agent /consult 不可达 → 中书 draft 写"骨架"、门下机械"再议"
 *   · /api/court/chaotang/decree/draft（真编排器）：draft_decree 返回 source:"rule" / "评估失败"
 * 在大脑没接上时跑全量评测，量到的全是骨架文案——浪费时间且误导。先体检，再决定要不要真跑。
 *
 * 用法：
 *   node brain-check.mjs                 # 默认 BASE=http://localhost:3002，自动用 admin/admin123 登录取 token
 *   COURTOS_TOKEN=<jwt> node brain-check.mjs
 *   node brain-check.mjs --base http://host:3002 --user admin --pass admin123
 *
 * 退出码：0 = 至少一条路径 LLM-live；3 = 全部 fallback（不建议真跑评测）；1 = 环境/鉴权错误。
 */

const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = getArg('--base', process.env.BASE_URL || 'http://localhost:3002');
const USER = getArg('--user', 'admin');
const PASS = getArg('--pass', 'admin123');
const CMD = '户部，核算本季度财务三大指标：收入、成本、利润，并指出主要现金流风险';

const FALLBACK_MARKERS = ['骨架', '不可达', '尚未连真后端', '评估失败', '待门下复核'];
const looksFallback = (s) => FALLBACK_MARKERS.some((m) => (s || '').includes(m));

async function getToken() {
  if (process.env.COURTOS_TOKEN) return process.env.COURTOS_TOKEN;
  try {
    const r = await fetch(`${BASE}/api/auth/local-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USER, password: PASS }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    return (await r.json()).accessToken || null;
  } catch { return null; }
}

async function probeDeliberate(token) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}/api/governance/deliberate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `courtos.access_token=${token}` },
      body: JSON.stringify({ command: CMD }),
      signal: AbortSignal.timeout(90000),
    });
    const ms = Date.now() - t0;
    if (!r.ok) return { path: 'deliberate', live: false, note: `http ${r.status}`, ms };
    const j = await r.json();
    const draft = j?.zhongshu?.draft || '';
    const fb = looksFallback(draft) || looksFallback(JSON.stringify(j?.zhongshu?.concerns || []));
    return { path: 'deliberate', live: !fb, note: fb ? 'rule/骨架兜底' : `LLM-live (verdict=${j?.menxia?.verdict})`, ms, sample: draft.slice(0, 80) };
  } catch (e) {
    return { path: 'deliberate', live: false, note: `error: ${e.message}`, ms: Date.now() - t0 };
  }
}

async function probeDecreeDraft(token) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}/api/court/chaotang/decree/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rawCommand: CMD }),
      signal: AbortSignal.timeout(90000),
    });
    const ms = Date.now() - t0;
    if (!r.ok) return { path: 'decree/draft', live: false, note: `http ${r.status}`, ms };
    const j = await r.json();
    const d = j?.data || {};
    const fb = d.source === 'rule' || looksFallback(d.stakesReason) || looksFallback(d.draft);
    return { path: 'decree/draft', live: !fb, note: fb ? `rule 兜底 (source=${d.source})` : `LLM-live (source=${d.source})`, ms, sample: (d.draft || '').slice(0, 80) };
  } catch (e) {
    return { path: 'decree/draft', live: false, note: `error: ${e.message}`, ms: Date.now() - t0 };
  }
}

(async () => {
  console.log(`[brain-check] BASE=${BASE}`);
  const token = await getToken();
  if (!token) {
    console.error('✗ 无法获取会话 token：设 COURTOS_TOKEN 或确认 admin/admin123 可登录（后端是否在跑？）');
    process.exit(1);
  }
  console.log('✓ 取得会话 token，开始体检两条能力路径…\n');
  const results = [await probeDeliberate(token), await probeDecreeDraft(token)];
  let anyLive = false;
  for (const r of results) {
    const tag = r.live ? '🟢 LLM-LIVE' : '🔴 FALLBACK';
    anyLive = anyLive || r.live;
    console.log(`${tag}  ${r.path.padEnd(14)} ${r.note}  (${r.ms}ms)`);
    if (r.sample) console.log(`            draft: ${r.sample}`);
  }
  console.log('');
  if (anyLive) {
    console.log('✅ 至少一条路径 LLM 在跑 → 可以真跑评测：node run-eval.mjs --mode deep && node judge.mjs && node scorecard.mjs');
    process.exit(0);
  }
  console.log('⛔ 两条路径都是 rule/骨架兜底 → 大脑没接上，现在跑评测只会量到骨架文案。');
  console.log('   先排查：jiqun_ai 的 LLM/OpenClaw/Ollama 是否配置可用（draft_decree 的"评估失败"）；');
  console.log('   以及前端 LEGAL_AGENT_URL 是否指向真正能响应 /consult 的服务。接上后再 brain-check。');
  process.exit(3);
})();

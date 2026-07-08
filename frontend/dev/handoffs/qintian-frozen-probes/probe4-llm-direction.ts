// 阶段0-a 验收：LLM 判方向 vs 正则判方向(真12信号并排比)。核心问题:LLM 能纠正正则判反的3条吗?
// 直连 OPENAI_*(=LiteLLM :4444, prod在用)。只读、不写库。跑法:
//   set -a; source .env.local; set +a; npx tsx dev/handoffs/qintian-frozen-probes/probe4-llm-direction.ts
const BASE = 'http://localhost:3050/chaotang';
const OAI = process.env.OPENAI_BASE_URL || 'http://localhost:4444/v1';
const KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.OPENAI_MODEL || 'swarm-strong';
const UP_RE = /涨|上行|反弹|上涨|紧缺|缺货|涨价|走高|抬升|加价|供不应求/;
const DOWN_RE = /跌|下行|回落|下跌|过剩|降价|走低|跳水|让利|供过于求/;
const regexDir = (t: string) => { const u = UP_RE.test(t), d = DOWN_RE.test(t); return u && d ? '涨跌并存' : u ? 'up' : d ? 'down' : 'unclear'; };

async function getSignals(): Promise<any[]> {
  for (const p of [`${BASE}/api/court/intel/signals`, `http://localhost:3050/api/court/intel/signals`]) {
    try { const r = await fetch(p); if (r.ok) return (await r.json())?.data ?? []; } catch {}
  }
  return [];
}

async function llm(system: string, user: string): Promise<string> {
  const r = await fetch(`${OAI}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 1500,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error(`LLM HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json())?.choices?.[0]?.message?.content ?? '';
}

function parseJson(text: string): any {
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  try { return JSON.parse(m ? m[1] || m[0] : text); } catch { return null; }
}

async function main() {
  if (!KEY) { console.log('无 OPENAI_API_KEY — 先 `set -a; source .env.local; set +a` 再跑。'); return; }
  const signals = await getSignals();
  console.log(`真信号 ${signals.length} 条 · 模型 ${MODEL}\n`);
  if (!signals.length) return;

  // ── A. 逐条方向：LLM vs 正则 ──
  const listForLLM = signals.map((s, i) => `${i + 1}. [${s.id}] ${s.title}｜${s.summary}`).join('\n');
  const sys = '你是钦天监(趋势推演官)。对每条情报,判断它对"所涉品类价格"的方向:up(利多/涨)、down(利空/跌)、stable(中性/无关价格)。只看价格方向,不看行业好坏。严格返回 JSON 数组 [{"n":序号,"dir":"up|down|stable"}],不要解释。';
  let llmDirs: Record<number, string> = {};
  try {
    const out = parseJson(await llm(sys, listForLLM));
    if (Array.isArray(out)) for (const o of out) llmDirs[o.n] = o.dir;
  } catch (e) { console.log('LLM 逐条判向失败:', (e as Error).message); }

  console.log('=== A. 逐条方向 LLM vs 正则 ===');
  let fixed = 0, disagree = 0;
  signals.forEach((s, i) => {
    const rx = regexDir(`${s.title}：${s.summary}`);
    const ai = llmDirs[i + 1] ?? '?';
    const flag = rx !== ai ? '  ← 不一致' : '';
    if (rx !== ai) disagree++;
    if ((rx === 'up' || rx === '涨跌并存') && ai === 'down') { fixed++; }
    console.log(`  正则:${rx.padEnd(5)} | LLM:${(ai as string).padEnd(6)} ${s.title}${flag}`);
  });
  console.log(`\n不一致 ${disagree}/${signals.length} 条；其中"正则判涨、LLM判跌"(正则反向被纠正) ${fixed} 条`);

  // ── B. 一条真预测(LLM判) ──
  const sysB = '你是钦天监。基于给定情报,对话题"碳酸锂未来价格趋势"给一条预测。严格返回 JSON: {"direction":"up|down|stable","confidence":"low|medium","reasons":[{"signalId":"","text":""}],"falsifiedBy":"什么新信号出现即证明此预测错"}。只引用真实存在的情报 id。';
  console.log('\n=== B. LLM 产一条"碳酸锂"预测 ===');
  try {
    const fc = parseJson(await llm(sysB, listForLLM));
    console.log(JSON.stringify(fc, null, 2));
  } catch (e) { console.log('失败:', (e as Error).message); }
}
main();

export {};

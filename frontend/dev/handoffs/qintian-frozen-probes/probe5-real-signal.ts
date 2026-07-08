// 阶段0 全链·真信号验证：一条真实 SMM 情报(2026-07-01,真URL)→ 钦天监LLM 产预测。
// 对比正则(会把"停产"判成利空跌，实为供应端利多涨=又一反向案例)。只读、不写库。
// 跑法: set -a; source .env.local; set +a; npx tsx dev/handoffs/qintian-frozen-probes/probe5-real-signal.ts
const OAI = process.env.OPENAI_BASE_URL || 'http://localhost:4444/v1';
const KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.OPENAI_MODEL || 'swarm-strong';
const UP_RE = /涨|上行|反弹|上涨|紧缺|缺货|涨价|走高|抬升|加价|供不应求/;
const DOWN_RE = /跌|下行|回落|下跌|过剩|降价|走低|跳水|让利|供过于求/;
const DEMAND_DOWN_RE = /淡季|减产|砍单|去库存|停产/;

// 真信号(SMM 上海有色网, 2026-07-01, 已 WebFetch 核实)
const realSignal = {
  id: 'smm-103982413',
  title: '中矿资源子公司江西中矿锂业临时停产检修，锂盐供应预期收紧',
  summary: '中矿资源全资子公司江西中矿锂业因自产锂精矿运输周期与生产调度暂时性错配，自6月30日起对两条高纯锂盐产线(年产3万吨+3.5万吨)临时停产检修，预计7月底完成；赣锋等龙头强调锂供给不确定性，市场供应预期收紧。',
  source: { name: '上海有色网 SMM', url: 'https://news.smm.cn/news/103982413', publishedAt: '2026-07-01' },
  真实方向: 'up (供应端收紧=利多涨)',
};

async function llm(system: string, user: string): Promise<string> {
  const r = await fetch(`${OAI}/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 1200,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json())?.choices?.[0]?.message?.content ?? '';
}
function parseJson(t: string): any { const m = t.match(/```json\s*([\s\S]*?)```/) || t.match(/(\{[\s\S]*\})/); try { return JSON.parse(m ? m[1] || m[0] : t); } catch { return null; } }

async function main() {
  if (!KEY) { console.log('无 KEY — 先 set -a; source .env.local; set +a'); return; }
  const text = `${realSignal.title}：${realSignal.summary}`;
  console.log('真信号(SMM 2026-07-01):', realSignal.title);
  console.log('真实方向应为:', realSignal.真实方向, '\n');

  // ① 正则判(预期判反)
  const regexTake = DEMAND_DOWN_RE.test(text) ? 'down(命中"停产"→需求下行→跌)'
    : UP_RE.test(text) ? 'up' : DOWN_RE.test(text) ? 'down' : 'unclear';
  console.log(`① 正则判向: ${regexTake}  ${regexTake.startsWith('down') ? '❌ 判反(供应端停产实为利多涨)' : ''}`);

  // ② LLM 判向
  const dir = (await llm(
    '你是钦天监。判断这条情报对碳酸锂/锂盐价格的方向(up涨/down跌/stable)。注意区分供应端与需求端。严格返回 JSON {"dir":"up|down|stable","why":"一句"}。',
    text,
  ));
  console.log(`② LLM 判向: ${dir.replace(/\s+/g, ' ').slice(0, 200)}`);

  // ③ LLM 产一条完整预测(全链)
  const fc = parseJson(await llm(
    `你是钦天监(趋势推演)。基于给定情报,对"碳酸锂未来1个月价格趋势"产一条预测。严格返回 JSON: {"direction":"up|down|stable","confidence":"low|medium","reasons":[{"signalId":"${realSignal.id}","text":""}],"falsifiedBy":"什么新信号出现即证明此预测错"}。`,
    `情报[id=${realSignal.id}, 来源=${realSignal.source.name}]: ${text}`,
  ));
  console.log('\n③ 钦天监预测(全链产出):');
  console.log(JSON.stringify(fc, null, 2));
  console.log('\n=== 结论 ===');
  console.log('看②③ LLM 是否判对 up、预测是否引用真 id、falsifiedBy 是否具体 —— 这是真信号喂进全链的真实表现。');
}
main();

export {};

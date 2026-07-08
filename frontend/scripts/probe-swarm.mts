/**
 * probe-swarm —— "测所有蜂群"测试 harness。
 *
 * 两种模式:
 *   live(默认):POST /api/court/orchestrate/all,逐条命令打全蜂群,打印覆盖面(应奏/缺席)、
 *              是否硬冲突、合议片段、decisionId。需 dev server(:3002)+ 后端在线 + 登录态。
 *   --dry:    用合成 AgentResult 证 merge / 硬冲突检测 / 飞轮 prior 叠加链路(无需 server/LLM)。
 *
 * 用法:
 *   npx tsx scripts/probe-swarm.mts --dry
 *   COURT_COOKIE='courtos.access_token=...' npx tsx scripts/probe-swarm.mts --base http://localhost:3002
 *
 * 登录态:传 COURT_COOKIE(整个 Cookie 头)或 COURT_TOKEN(Bearer)。两者择一即可。
 */

import { mergeDecisions, applyPriors } from '@/lib/swarm/merge';
import type { AgentResult } from '@/lib/swarm/dept-agent';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const baseIdx = argv.indexOf('--base');
const BASE = baseIdx >= 0 ? argv[baseIdx + 1]! : process.env.PROBE_BASE ?? 'http://localhost:3002';

const CASES = [
  '年度战略评估，各司直陈本季最大风险与对策',
  '核减下季营造预算一成，同时保兵部粮草不减', // 易触发 户部↔兵部 硬冲突
  '是否应大举出海扩张，请各司直言利弊与风险',
];

let pass = 0;
let fail = 0;
const ok = (n: string, c: boolean, x = ''): void => {
  if (c) {
    pass++;
    console.log(`✅ ${n}`);
  } else {
    fail++;
    console.log(`❌ ${n}  ⟵ ${x}`);
  }
};

/** 合成一个部门 agent 结果(可控接地/冲突,用于无 LLM 自测 merge 链路)。 */
function synth(answer: string, opts: { grounded?: boolean; conflicts?: string; confidence?: number } = {}): AgentResult {
  return {
    answer,
    reasoning: '(合成)',
    evidence: ['合成证据 1'],
    assumptions: [],
    conflicts: opts.conflicts ?? '无',
    confidence: opts.confidence ?? 0.8,
    grounding: { total: 1, grounded: 1, rate: 1, ungrounded: [] },
    evidenceBinding: { total: 1, grounded: 1, rate: 1, ungrounded: [] },
    reprompted: false,
    grounded: opts.grounded ?? true,
    model: 'synthetic',
    latencyMs: 1,
  } as AgentResult;
}

async function runDry(): Promise<void> {
  console.log('=== dry-run:全蜂群 merge / 冲突 / 飞轮 prior 链路(合成数据,无 LLM)===\n');

  // 1) 无冲突:多司附议,主判取接地+置信最高
  const calm = mergeDecisions([
    { dept: 'finance', result: synth('核减一成可行，预留水利 2.4 万', { confidence: 0.9 }) },
    { dept: 'ops', result: synth('运营无碍，附议核减', { confidence: 0.7 }) },
    { dept: 'works', result: synth('工部可延后非急工程', { confidence: 0.6 }) },
  ]);
  ok('无冲突→不升级老板', calm.escalateToBoss === false, String(calm.escalateToBoss));
  ok('无冲突→主判含【主判·】', calm.verdict.includes('【主判·'), calm.verdict.slice(0, 30));

  // 2) 硬冲突:户部点名兵部(双方接地)→ 升级、并陈、伏候圣裁
  const clash = mergeDecisions([
    { dept: 'finance', result: synth('须核减粮草开支', { conflicts: '与兵部在粮草投入上有分歧' }) },
    { dept: 'ops', result: synth('粮草绝不可减，事关战备', { conflicts: '与户部相左' }) },
    { dept: 'legal', result: synth('合规层面无异议') },
  ]);
  ok('硬冲突→escalateToBoss=true', clash.escalateToBoss === true, String(clash.escalateToBoss));
  ok('硬冲突→检出 户部↔兵部 边', clash.conflicts.some((c) => c.depts.includes('户部') && c.depts.includes('兵部')), JSON.stringify(clash.conflicts.map((c) => c.depts)));
  ok('硬冲突→verdict 伏候圣裁', clash.verdict.includes('伏候圣裁'), clash.verdict.slice(0, 24));

  // 3) 飞轮 prior 叠加:历史偏好改呈现顺序+高亮+提示,且不自动裁决
  const applied = applyPriors(clash, { '兵部|户部': { tally: { 兵部: 3, 户部: 1 }, total: 4 } });
  const conf = applied.conflicts.find((c) => c.depts.includes('兵部'));
  ok('prior→兵部 重排首位(默认高亮)', conf?.depts[0] === '兵部', conf?.depts.join(','));
  ok('prior→verdict 附历史提示', applied.verdict.includes('历史 3/4 次准〔兵部〕'), applied.verdict.split('\n').pop() ?? '');
  ok('prior→仍不自动裁决', applied.escalateToBoss === true);

  // 4) 密报 row 所需字段齐备(secretBriefToEdict 的真实依赖)
  ok('密报依赖:每司有 name+answer', clash.contributors.every((c) => c.name && c.answer), JSON.stringify(clash.contributors.map((c) => c.name)));

  // 5) 全局 LLM 预算令牌桶:窗口内到上限即拒,不超发(会审 risk#3)
  const { consumeLlmBudget, __resetLlmBudget } = await import('@/lib/llm-budget');
  __resetLlmBudget();
  const max = Math.max(1, Number(process.env.LLM_BUDGET_PER_MIN ?? 60));
  let granted = 0;
  for (let i = 0; i < max + 14; i += 7) if (consumeLlmBudget(7).ok) granted += 7;
  ok('全局预算:累计授予不超上限', granted <= max, `granted=${granted} max=${max}`);
  ok('全局预算:满载后再请求被拒(503 来源)', consumeLlmBudget(7).ok === false);
  __resetLlmBudget();

  console.log(`\n=== dry-run:${pass} 通过 / ${fail} 失败 ===`);
  if (fail > 0) process.exitCode = 1;
}

async function runLive(): Promise<void> {
  console.log(`=== live:打全蜂群 ${BASE}/api/court/orchestrate/all ===`);
  const cookie = process.env.COURT_COOKIE ?? '';
  const token = process.env.COURT_TOKEN ?? '';
  if (!cookie && !token) {
    console.log('⚠️ 未提供 COURT_COOKIE 或 COURT_TOKEN，后端将 401。先登录拿 courtos.access_token。');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  if (token) headers.Authorization = `Bearer ${token}`;

  const SEEDS = ['market', 'guard', 'physician'];

  // 回归护栏:伪造 token 在 strict 模式应被后端 A-探针 401(后端 strict 时设 PROBE_STRICT=1 启用断言)
  if (process.env.PROBE_STRICT === '1') {
    const fakePayload = Buffer.from(
      JSON.stringify({ user_id: 'forged', exp: Math.floor(Date.now() / 1000) + 9999 }),
    ).toString('base64url');
    const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${fakePayload}.deadbeef`;
    try {
      const r = await fetch(`${BASE}/api/court/orchestrate/all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `courtos.access_token=${fakeJwt}` },
        body: JSON.stringify({ command: '伪造 token 烧钱回归测试' }),
      });
      ok('伪造 token 被后端 A-探针拒(401/403)', r.status === 401 || r.status === 403, `got HTTP ${r.status}`);
    } catch (e) {
      console.log(`  ⚠️ 伪造 token 探测请求失败: ${(e as Error).message}`);
    }
  } else {
    console.log('  (跳过伪造 token 断言;后端 strict 时设 PROBE_STRICT=1 启用)');
  }

  for (const command of CASES) {
    process.stdout.write(`\n— 密旨：${command}\n`);
    try {
      const res = await fetch(`${BASE}/api/court/orchestrate/all`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ command }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        console.log(`  ❌ HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
        fail++;
        continue;
      }
      const cov = json.coverage as
        | { responded?: string[]; absent?: { dept: string; kind?: string }[]; realResponded?: number; realExpected?: number }
        | undefined;
      const merge = json.merge as { escalateToBoss?: boolean; verdict?: string; conflicts?: unknown[] } | undefined;
      console.log(`  实司 ${cov?.realResponded ?? '?'}/${cov?.realExpected ?? '?'} 应奏: ${cov?.responded?.join('、') ?? '—'}`);
      console.log(`  缺席 ${cov?.absent?.length ?? 0} 司: ${(cov?.absent ?? []).map((a) => `${a.dept}(${a.kind ?? '?'})`).join('、') || '—'}`);
      console.log(`  硬冲突: ${merge?.escalateToBoss ? '是(伏候圣裁)' : '否'} · decisionId=${String(json.decisionId)}`);
      console.log(`  合议: ${(merge?.verdict ?? '').replace(/\n/g, ' ').slice(0, 120)}`);
      ok(`命令完成(${command.slice(0, 10)}…)`, !!json.ok && (cov?.responded?.length ?? 0) > 0, JSON.stringify(json).slice(0, 160));
      const absentSeeds = (cov?.absent ?? []).filter((a) => a.kind === 'seed').map((a) => a.dept);
      ok(
        `种子部门如实标注(${command.slice(0, 8)}…)`,
        SEEDS.every((s) => absentSeeds.includes(s) || (cov?.responded ?? []).includes(s)),
        `seedAbsent=${absentSeeds.join(',')}`,
      );
    } catch (e) {
      console.log(`  ❌ 请求失败: ${(e as Error).message}(dev server 起了吗?后端在线吗?)`);
      fail++;
    }
  }
  console.log(`\n=== live:${pass} 通过 / ${fail} 失败 ===`);
  if (fail > 0) process.exitCode = 1;
}

await (DRY ? runDry() : runLive());

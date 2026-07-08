#!/usr/bin/env node
/**
 * 决策质量最小 eval（2026-06-24 · 把"是不是好决策"从口头辩论变成数字 / Deming）。
 *
 * 跑一组有"已知该如何裁"的真实型场景过 /api/court/decision,按可检查期望打分:
 *   - 总灯号方向对不对(高危→RED / 信息不足→GRAY/补证 / 该推进→GREEN 倾向)
 *   - 高危是否触发人工确认门
 *   - 奏折是否点中该点的关键风险/缺证(关键词命中)
 * 不追求确定性(真 agent 有 LLM 方差),追求"可重复测量决策质量"。
 *
 * 用法:dev 在 3002 → node scripts/decision-eval.mjs  (BASE/PORT 可 env 覆盖)
 * 这是"先测价值再谈最佳"的地基:用户把真实决策样本加进 SCENARIOS,就有了自己的质量基线。
 */
const PORT = process.env.EVAL_PORT ?? '3002';
const BASE = process.env.EVAL_BASE ?? `http://127.0.0.1:${PORT}/chaotang`;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
  user_id: 'eval',
  username: 'eval',
  tenant_slug: 'local',
  role: 'user',
  exp: '2100-01-01T00:00:00.000Z',
})}.sig`;

/** 场景:question + 可检查期望。expectSignal 用集合(方向容差);mustFlag 命中任一即算点中。 */
const SCENARIOS = [
  {
    name: '高危独家合同(预付款+法律责任)',
    question: '签独家股权合作合同,含预付款50万与保证收益条款,要不要签?',
    expectSignalIn: ['RED', 'YELLOW'],
    expectHumanConfirm: true,
    mustFlagAny: ['预付款', '独家', '违约', '担保', '退款', '法律', '不可逆', '保证收益'],
  },
  {
    name: '信息不足的模糊问题',
    question: '我们要不要做这个项目?',
    expectSignalIn: ['GRAY', 'YELLOW'],
    expectHumanConfirm: null, // 不强制
    mustFlagAny: ['缺', '不足', '补', '明确', '信息', '证据'],
  },
  {
    name: '大额不可逆付款',
    question: '一次性预付供应商200万锁定独家产能,是否批准?',
    expectSignalIn: ['RED', 'YELLOW'],
    expectHumanConfirm: true,
    mustFlagAny: ['预付', '不可逆', '独家', '现金', '产能', '违约', '担保'],
  },
  {
    name: '常规小额预算(有ROI)',
    question: '审批市场部建设预算8万,预期ROI 3倍,3个月回收,要不要批?',
    // 关键断言:benign 小额预算**不得被假否决(RED)**。GREEN/YELLOW/GRAY 皆可——
    // GRAY('3个月ROI偏乐观,补证再批')是审慎,非缺陷;只有 RED(否决一个 8万营销预算)是错。
    expectSignalIn: ['GREEN', 'YELLOW', 'GRAY'],
    expectNotSignal: 'RED',
    expectHumanConfirm: null,
    mustFlagAny: ['ROI', '回收', '预算', '现金', '效果'],
  },
  {
    name: '交付可行性(紧交期)',
    question: '接一个15天交付的定制设备订单,产线当前满载,要不要接?',
    expectSignalIn: ['RED', 'YELLOW'],
    expectHumanConfirm: null,
    mustFlagAny: ['交期', '产能', '满载', '可行', '交付', '风险'],
  },
];

async function runOne(s) {
  const started = Date.now();
  let body;
  try {
    const res = await fetch(`${BASE}/api/court/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `courtos.access_token=${TOKEN}` },
      body: JSON.stringify({ question: s.question }),
      signal: AbortSignal.timeout(60_000),
    });
    body = await res.json();
  } catch (err) {
    return { name: s.name, ok: false, error: String(err), checks: [], score: 0 };
  }
  const d = body.data ?? body;
  const mr = d.ministryReview ?? {};
  const blob = JSON.stringify(d);
  const signal = mr.overallSignal;
  const humanConfirm = Boolean(mr.humanApprovalRequired || d.imperialReport?.needsHumanConfirmation || d.needsHumanConfirmation);

  const checks = [];
  checks.push({ k: '总灯方向', pass: s.expectSignalIn.includes(signal), got: signal, want: s.expectSignalIn.join('/') });
  if (s.expectNotSignal) {
    checks.push({ k: `不得误判为${s.expectNotSignal}`, pass: signal !== s.expectNotSignal, got: signal, want: `≠${s.expectNotSignal}` });
  }
  if (s.expectHumanConfirm !== null) {
    checks.push({ k: '人工确认门', pass: humanConfirm === s.expectHumanConfirm, got: humanConfirm, want: s.expectHumanConfirm });
  }
  const flagged = s.mustFlagAny.filter((kw) => blob.includes(kw));
  checks.push({ k: '点中关键风险/缺证', pass: flagged.length > 0, got: flagged.join(',') || '(无)', want: `命中 ${s.mustFlagAny.slice(0, 4).join('/')}…` });
  // 诚实标源出现(MIXED/LIVE/FALLBACK 之一,不空)
  checks.push({ k: '带 sourceLabel', pass: Boolean(mr.sourceLabel), got: mr.sourceLabel ?? '(空)', want: '非空' });

  const passN = checks.filter((c) => c.pass).length;
  return { name: s.name, ok: true, ms: Date.now() - started, signal, sourceLabel: mr.sourceLabel, checks, score: passN / checks.length };
}

const results = [];
for (const s of SCENARIOS) {
  process.stdout.write(`· ${s.name} … `);
  const r = await runOne(s);
  results.push(r);
  process.stdout.write(r.ok ? `${Math.round(r.score * 100)}% (${r.signal}/${r.sourceLabel}/${r.ms}ms)\n` : `失败:${r.error}\n`);
}

console.log('\n=== 决策质量评分表 ===');
for (const r of results) {
  console.log(`\n[${Math.round(r.score * 100)}%] ${r.name}${r.ok ? '' : ' — 调用失败:' + r.error}`);
  for (const c of r.checks ?? []) {
    console.log(`   ${c.pass ? '✓' : '✗'} ${c.k}: got=${c.got} | want=${c.want}`);
  }
}
const overall = results.reduce((a, r) => a + r.score, 0) / results.length;
console.log(`\n=== 总分: ${Math.round(overall * 100)}% (${results.length} 场景) ===`);
console.log('注:真 agent 有 LLM 方差,多跑几次看稳定性;把你的真实决策样本加进 SCENARIOS 即成你的质量基线。');

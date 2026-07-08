#!/usr/bin/env node
/**
 * verify-edict-quality.mjs — 圣旨"不是正确的废话"结构验收门（acceptance TARGET gate）
 * ============================================================================
 * 来源:docs/SHENGZHI_ACCEPTANCE_SPEC_2026-06-08.md（大神扮用户会审沉淀的 6 条验收铁律）。
 * 直击真后端 http://127.0.0.1:8081/api/chaotang/study/run（绕代理，同 verify-study-edict.mjs）。
 *
 * ⚠️ 这是 TARGET 门:在后端 decree_swarm_router / study_run_edict 把下列字段建出来之前,**它必然红**——
 *    这正是它的价值(同 golden-loop-liveness:绿了才算"圣旨不说谎、能签字")。**不要焊进发布门**,
 *    它是给后端窗口的验收靶子,不是当前发布闸。
 *
 * 圣旨契约字段(对齐 src/lib/contracts/ 的 canonical zod 名 —— 结构不可少,字段名已定稿):
 *   edict.reversibility            : 'one_way_door' | 'two_way_door'     (单向门/双向门,第一眼可逆性标签)
 *   edict.chancellor_decision      : ZChancellorDecision(src/lib/contracts/chancellor-decision.ts)
 *                                    { verdict, theOneThing, theThingToNotDo:{action,reason},
 *                                      conflictsResolved:[{between,ruling}], reversibility,
 *                                      signoff:{required,basis} }  (丞相裁断,非汇总)
 *   edict.qintianjian_forecast     : { thresholds:[{signal,trigger,action}], invariants:[], variables:[], tail_risk, catalyst_timing }
 *   edict.swarm_cards              : ZSwarmCard[](src/lib/contracts/swarm-card.ts)
 *                                    { dept, claim, evidenceNumber?, confidence, displayTier:'headline'|'detail', deepHref? }
 *   edict.chancellor_decision.signoff.required : 由 不可逆 × 现金流占比 触发(非难度,非永远 true)
 *
 * 用法: node scripts/verify-edict-quality.mjs    (跑 6 条真样本密旨)
 */

const BACKEND_URL = 'http://127.0.0.1:8081/api/chaotang/study/run';

// 6 条真样本密旨(来自 SHENGZHI_ACCEPTANCE_SPEC),带可逆性期望(用于 signoff 反甩锅校验)。
const DECREES = [
  { id: 'D1', expect: 'one_way_door', command: '我手上有 8000 万现金。电芯一直外购，毛利被压到 12% 还在掉。有人劝我自建一条 2GWh 储能 PACK+电芯产线，投产 14 个月、设备 6500 万、回本 4 年。自建还是继续外购？这 8000 万五年后回看我会后悔投了还是后悔没投？能掉头还是掉不了头？给我一个能签字的结论，别两头都对。' },
  { id: 'D2', expect: 'two_way_door', command: '一个老客户年采购 3000 万、占我营收 18%，要把账期从 60 天压到 90 天，不答应就把单转给对手。我现金流最多扛 2 个月。放还是不放？放的话拿什么换回来（预付/涨价/锁年度量）？48 小时内必须回话。' },
  { id: 'D3', expect: 'one_way_door', command: '主力 280Ah 磷酸铁锂，客户要 314Ah 压到 0.32 元/Wh、明年 Q2 交样、年化 500MWh。我 314 中试良率 85%、成本 0.38。要不要把今年研发预算 60%（2400 万）压到 314、停掉钠电？判：0.32 到不到、卡哪道工序、停钠电会不会后悔。' },
  { id: 'D4', expect: 'one_way_door', command: '两条线利用率 64%，现金够发 9 个月。集成商画 1.2GWh 框架但只硬锁 25%。上第三条线要 9000 万、14 个月。上不上、分不分期、哪个月现金最危险、什么条件我必须立刻刹车？' },
  { id: 'D5', expect: 'one_way_door', command: '内蒙集成商要 30MWh 磷酸铁锂，质保从 5 年拉到 8 年，合同写死 -30℃ 可用度≥95%、不达标赔停产损失。毛利 12%、账期 6 个月、占产能三成。接不接？赔付红线卡哪？最坏会不会一次赔穿？' },
  { id: 'D6', expect: 'one_way_door', command: '能动的就 200 万现金 + 3 个人，三条路只能押一个：A 扩一条 PACK 线；B 搞 AI 低温失效预测；C 砸钱建 -40℃ 刑场攒失效数据。先别推荐，先告诉我哪条最可能让我血本无归。' },
];

// 失信红线词(出现即正确的废话)。
const WEASEL = ['综合考虑', '综合评估', '谨慎决策', '审慎决策', '平衡风险', '小步快跑', '妥善处理', '加强沟通', '密切关注', '结合自身情况', '保持沟通', '需要进一步'];

const TIMEOUT = 30_000;
const checks = [];
const rec = (name, ok, detail) => checks.push({ name, ok, detail });
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

async function postDecree(command) {
  const res = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command, mode: 'dry_run' }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function assertDecree(d, status, body) {
  const p = (s) => `[${d.id}] ${s}`;
  if (status !== 200 || !isObj(body) || !isObj(body.data) || !isObj(body.data.edict)) {
    rec(p('HTTP 200 + data.edict 对象'), false, `status=${status}`);
    return null;
  }
  const ed = body.data.edict;
  const cd = ed.chancellor_decision;
  const blob = `${cd?.verdict ?? ''} ${ed.summary ?? ''}`;

  // 铁律1:可逆性标签 + 硬判第一行(verdict 现挂在 chancellor_decision 下,见 ZChancellorDecision)
  rec(p('① edict.reversibility ∈ {one_way_door,two_way_door}'), ['one_way_door', 'two_way_door'].includes(ed.reversibility), `实际=${JSON.stringify(ed.reversibility)}`);
  rec(p(`① reversibility 命中期望(${d.expect})`), ed.reversibility === d.expect, `实际=${JSON.stringify(ed.reversibility)}`);
  rec(p('① chancellor_decision.verdict 是硬判(非需补证/非空)'), typeof cd?.verdict === 'string' && cd.verdict.length > 0 && cd.verdict !== '需补证', `实际=${JSON.stringify(cd?.verdict)}`);

  // 铁律2:丞相裁断(非汇总)—— canonical ZChancellorDecision
  rec(p('② chancellor_decision 对象'), isObj(cd), `类型=${typeof cd}`);
  if (isObj(cd)) {
    rec(p('② 丞相给唯一要做的 theOneThing'), typeof cd.theOneThing === 'string' && cd.theOneThing.length > 0, `theOneThing=${JSON.stringify(cd.theOneThing)?.slice(0, 40)}`);
    rec(p('② 丞相点名"绝不做的那件" theThingToNotDo.action'), isObj(cd.theThingToNotDo) && typeof cd.theThingToNotDo.action === 'string' && cd.theThingToNotDo.action.length > 0, `action=${JSON.stringify(cd.theThingToNotDo?.action)?.slice(0, 40)}`);
    rec(p('② 不做那件给理由 theThingToNotDo.reason'), isObj(cd.theThingToNotDo) && typeof cd.theThingToNotDo.reason === 'string' && cd.theThingToNotDo.reason.length > 0, `reason=${JSON.stringify(cd.theThingToNotDo?.reason)?.slice(0, 40)}`);
    rec(p('② 丞相裁掉跨部矛盾 conflictsResolved[{between,ruling}]'), Array.isArray(cd.conflictsResolved) && cd.conflictsResolved.length > 0 && cd.conflictsResolved.every((c) => isObj(c) && Array.isArray(c.between) && c.between.length >= 2 && typeof c.ruling === 'string' && c.ruling.length > 0), `len=${Array.isArray(cd.conflictsResolved) ? cd.conflictsResolved.length : 'NA'}`);
  }

  // 铁律3:钦天监可证伪阈值 + 不变量/变量 + 尾部
  const qf = ed.qintianjian_forecast;
  rec(p('③ qintianjian_forecast 对象'), isObj(qf), `类型=${typeof qf}`);
  if (isObj(qf)) {
    rec(p('③ 钦天监给可证伪阈值 thresholds[]'), Array.isArray(qf.thresholds) && qf.thresholds.length > 0, `len=${Array.isArray(qf.thresholds) ? qf.thresholds.length : 'NA'}`);
    rec(p('③ 钦天监分 不变量/变量'), Array.isArray(qf.invariants) && Array.isArray(qf.variables), `inv=${typeof qf.invariants} var=${typeof qf.variables}`);
    rec(p('③ 钦天监预判尾部 tail_risk'), typeof qf.tail_risk === 'string' && qf.tail_risk.length > 0, `tail=${JSON.stringify(qf.tail_risk)?.slice(0, 40)}`);
  }

  // 铁律5:证据真源(非体感)
  rec(p('⑤ evidence 每条有 source'), Array.isArray(ed.evidence) && ed.evidence.every((e) => isObj(e) && e.source), `n=${Array.isArray(ed.evidence) ? ed.evidence.length : 'NA'}`);

  // 铁律6:蜂群统一卡片 —— canonical ZSwarmCard[](dept/claim/confidence/displayTier),至少有 headline 层
  const cards = ed.swarm_cards;
  rec(p('⑥ swarm_cards[] 非空'), Array.isArray(cards) && cards.length > 0, `len=${Array.isArray(cards) ? cards.length : 'NA'}`);
  if (Array.isArray(cards) && cards.length > 0) {
    const conforms = (c) =>
      isObj(c) &&
      typeof c.dept === 'string' && c.dept.length > 0 &&
      typeof c.claim === 'string' && c.claim.length > 0 &&
      typeof c.confidence === 'number' && c.confidence >= 0 && c.confidence <= 1 &&
      ['headline', 'detail'].includes(c.displayTier);
    rec(p('⑥ 每张卡符合 SwarmCard 形状(dept/claim/confidence/displayTier)'), cards.every(conforms), `坏卡=${cards.filter((c) => !conforms(c)).length}`);
    rec(p('⑥ 至少有一张 headline 层卡(第一眼)'), cards.some((c) => isObj(c) && c.displayTier === 'headline'), `headline=${cards.filter((c) => isObj(c) && c.displayTier === 'headline').length}`);
  }

  // 失信红线:verdict+summary 不含 weasel 词
  const hit = WEASEL.filter((w) => blob.includes(w));
  rec(p('⛔ 无失信废话词(综合评估/谨慎决策…)'), hit.length === 0, hit.length ? `命中=${hit.join(',')}` : undefined);

  return { id: d.id, expect: d.expect, signoff: cd?.signoff?.required };
}

function main() {
  return Promise.resolve().then(async () => {
    const rows = [];
    for (const d of DECREES) {
      try {
        const { status, body } = await postDecree(d.command);
        rows.push(assertDecree(d, status, body));
      } catch (err) {
        rec(`[${d.id}] 网络请求成功`, false, err?.message ?? String(err));
      }
    }

    // 铁律4:质量门反甩锅 —— chancellor_decision.signoff.required 驱动;不能 100% 需签字;双向门(D2)应 false
    const valid = rows.filter(Boolean);
    const allSignoff = valid.length > 0 && valid.every((r) => r.signoff === true);
    rec('④ 质量门非甩锅(并非每道密旨都"需人工复核")', !allSignoff, allSignoff ? '全部需签字 = 甩锅机器' : undefined);
    const d2 = valid.find((r) => r.id === 'D2');
    if (d2) rec('④ 双向门 D2 应"可自决·无需签字"(chancellor_decision.signoff.required=false)', d2.signoff === false, `实际=${JSON.stringify(d2.signoff)}`);

    const failed = checks.filter((c) => !c.ok);
    console.log('\n========= 圣旨质量验收门(大神 6 条) · REAL backend =========');
    console.log(`样本密旨: ${DECREES.length}   断言: ${checks.length}   通过: ${checks.length - failed.length}   失败: ${failed.length}`);
    console.log('----------------------------------------------------------------');
    if (failed.length === 0) {
      console.log('结果: PASS ✅  圣旨能签字、有丞相裁断、钦天监给阈值、蜂群卡成形、质量门不甩锅、不说废话。');
      process.exit(0);
    }
    for (const c of failed) console.log(`  FAIL  ${c.name}${c.detail ? `  — ${c.detail}` : ''}`);
    console.log('----------------------------------------------------------------');
    console.log('结果: FAIL ❌  (TARGET 门:后端 decree_swarm_router/圣旨字段未达验收标准;绿了才算可对外)');
    process.exit(1);
  });
}

main().catch((err) => { console.error('FATAL', err?.message ?? err); process.exit(1); });

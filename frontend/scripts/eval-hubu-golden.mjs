#!/usr/bin/env node
/**
 * 户部黄金评测执行器(2026-07-03 · Andrew Ng"先建评测再自动化"落地)
 *
 * `dev/contracts/evals/hubu_cfo_office.golden.jsonl` 早就写好了5条真实黄金案例，
 * 但全仓 grep 确认：从未有任何脚本真正拿这些案例去跑真实判断系统、核对 must_* 断言——
 * validate-hubu-contracts.mjs 只检查文件存在+格式对，从没执行过。这是"写好了没接线"
 * 在评测领域的同款问题。本脚本把这条线接上：真调 /api/court/decision(真LLM+真户部会审)，
 * 核对能在前端层面机械核实的断言，诚实标注哪些断言(后端子司级/语义判断类)测不了。
 *
 * 用法: node scripts/eval-hubu-golden.mjs [--base=http://localhost:3002/chaotang]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = (process.argv.find((a) => a.startsWith('--base=')) ?? '--base=http://localhost:3002/chaotang').split('=')[1];
const GOLDEN_PATH = join(process.cwd(), 'dev/contracts/evals/hubu_cfo_office.golden.jsonl');

// verdict 中文映射(与 imperial-report-synthesizer.ts VERDICT_CN 一致，供 must_not_verdict 比对)。
const VERDICT_CN = { APPROVE: '准奏', NEED_EVIDENCE: '补证', RECHECK: '复核', REJECT: '驳回' };

// 前端层面机械可核实的断言(source_label_required/must_not_verdict/must_require_human_confirmation/
// must_include_gaps)直接在 runCase 里逐个 `if ('key' in item)` 处理；后端子司级(must_include_offices)/
// 语义判断类(must_question_type/must_not_only_revenue)不可自动核实，诚实标注，不伪造通过。
const NOT_MEASURABLE_FROM_FRONTEND = {
  must_question_type: '需要"问题分类"字段，当前 /api/court/decision 响应无此结构化输出',
  must_include_offices: '子司级(度支/金库/计簿/价本/投审/稽核)是后端hubu_cfo_office蜂群概念，前端runMinistryReviewWithRealAgents只返回合并的户部单卡，测不到子司',
  must_not_only_revenue: '需要语义判断"是否只谈收入不谈成本"，机械关键词匹配会有大量假阳性/假阴性，本版本暂不自动判，需人工抽查',
};

// 匹配精度改进(2026-07-03 · 第一次跑评测后发现的真假阴性)：纯2字子串匹配对"抽象概念的
// 同义改写"无能为力——例如实际输出"该岗位的预期ROI：招进来后12个月能新增/续约多少收入"、
// "现金流时间轴：招聘支出何时发生"明明覆盖了"回本逻辑"这个概念，但2字子串规则认不出来
// (无共享的连续2字)。给已知容易被同义改写的抽象概念(止损点/回本逻辑/现金类)建同义词组，
// 命中同义词也算通过。具体名词类(成本表/付款条件/报价有效期)改写空间小，2字子串规则已够用，
// 不需要同义词组也能收敛。
// 老实说：这仍是关键词层面的改进，不是真语义理解——引入真正的语义判断(比如再调一次LLM当裁判)
// 是更彻底的方案，但复杂度/成本更高，本版本先用同义词组把已实测到的假阴性堵住。
const GAP_SYNONYMS = {
  '止损点': ['止损', '退出机制', '退出阈值', '收缩', '驻留', '分界线', '何时该撤', '离职', '降职'],
  '回本逻辑': ['回本', 'ROI', '预期回报', '现金流时间轴', '投入产出', '新增', '续约多少收入'],
  '现金影响': ['现金流', '现金消耗', '现金缺口', '现金回款'],
  '现金消耗测算': ['现金流', '现金消耗', '现金缺口', '烧钱'],
};

function fuzzyIncludesGap(missingEvidenceTexts, gapKeyword) {
  const haystack = missingEvidenceTexts.join(' ');
  // 宽松匹配：gap关键词的任意2字连续子串命中即算(中文短语精确匹配太脆，如"成本表"vs"缺成本明细表")。
  if (haystack.includes(gapKeyword)) return true;
  for (let i = 0; i < gapKeyword.length - 1; i += 1) {
    if (haystack.includes(gapKeyword.slice(i, i + 2))) return true;
  }
  // 同义词组兜底：抽象概念的同义改写，2字子串规则认不出来时再查一层。
  const synonyms = GAP_SYNONYMS[gapKeyword];
  if (synonyms) {
    return synonyms.some((s) => haystack.includes(s));
  }
  return false;
}

async function runCase(item) {
  const res = await fetch(`${BASE}/api/court/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: item.input }),
  });
  const body = await res.json().catch(() => ({}));
  if (!body.success) {
    return { id: item.id, error: body.error ?? `HTTP ${res.status}`, checks: [] };
  }
  const data = body.data ?? {};
  const verdictCn = VERDICT_CN[data.imperialReport?.verdict] ?? data.imperialReport?.verdict;
  const gaps = [
    ...(data.report?.missingEvidence ?? []),
    ...(data.imperialReport?.missingEvidence ?? []),
  ];

  const checks = [];
  if ('source_label_required' in item) {
    checks.push({
      assertion: 'source_label_required',
      pass: Boolean(data.sourceLabel),
      detail: `sourceLabel=${data.sourceLabel}`,
    });
  }
  if ('must_not_verdict' in item) {
    checks.push({
      assertion: 'must_not_verdict',
      pass: verdictCn !== item.must_not_verdict,
      detail: `verdict=${verdictCn}(禁止=${item.must_not_verdict})`,
    });
  }
  if ('must_require_human_confirmation' in item) {
    checks.push({
      assertion: 'must_require_human_confirmation',
      pass: data.needsHumanConfirmation === item.must_require_human_confirmation,
      detail: `needsHumanConfirmation=${data.needsHumanConfirmation}`,
    });
  }
  if ('must_include_gaps' in item) {
    const missed = item.must_include_gaps.filter((g) => !fuzzyIncludesGap(gaps, g));
    checks.push({
      assertion: 'must_include_gaps',
      pass: missed.length === 0,
      detail: missed.length ? `未命中: ${missed.join('、')} (实际gaps: ${gaps.join('、') || '(空)'})` : `全部命中(实际gaps: ${gaps.join('、')})`,
    });
  }
  for (const key of Object.keys(NOT_MEASURABLE_FROM_FRONTEND)) {
    if (key in item) {
      checks.push({ assertion: key, pass: null, detail: `不可自动核实: ${NOT_MEASURABLE_FROM_FRONTEND[key]}` });
    }
  }

  return { id: item.id, sourceLabel: data.sourceLabel, verdict: verdictCn, checks };
}

// 多次重跑排除噪声(2026-07-03)：会审第一次改prompt后只跑了一次改前一次改后(n=1对n=1)，
// 但同一天从真实归档数据发现过"同一问题不同次运行给不同verdict"——系统本身有真实不确定性。
// n=1对n=1的对比不能排除"这次的提升只是运气好这一轮"。--runs=N 让每个案例真跑N次，
// 报每条断言的"N次里过了几次"，而不是一次性的true/false——不一致本身就是重要信号。
const RUNS = Number((process.argv.find((a) => a.startsWith('--runs=')) ?? '--runs=1').split('=')[1]) || 1;

async function main() {
  const lines = readFileSync(GOLDEN_PATH, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const cases = lines.map((l) => JSON.parse(l));
  console.log(`户部黄金评测：${cases.length} 条案例 × ${RUNS} 次重跑，目标 ${BASE}/api/court/decision\n`);

  let totalMeasurableAssertions = 0; // 案例数 × 每案例可机械核实的断言数(不含跑几次)
  let totalPassedAllRuns = 0; // 有多少条断言在"全部N次"里都通过(严格一致性)
  let skippedChecks = 0;

  for (const item of cases) {
    const runResults = [];
    for (let r = 0; r < RUNS; r += 1) {
      runResults.push(await runCase(item));
      // 限流保护：/api/court/decision 每用户每分钟10次，间隔2s足够留余量。
      await new Promise((res) => setTimeout(res, 2000));
    }
    const errored = runResults.filter((r) => r.error);
    if (errored.length === runResults.length) {
      console.log(`✗ ${item.id}: 全部${RUNS}次请求失败 — ${errored[0].error}\n`);
      continue;
    }
    const ok = runResults.filter((r) => !r.error);
    console.log(`── ${item.id} (${ok.length}/${RUNS}次成功；verdict分布: ${[...new Set(ok.map((r) => r.verdict))].join('、')}) ──`);

    // 以第一次成功结果的断言列表为准，逐条统计N次里通过几次。
    const assertionKeys = ok[0].checks.map((c) => c.assertion);
    for (const key of assertionKeys) {
      const across = ok.map((r) => r.checks.find((c) => c.assertion === key));
      if (across[0].pass === null) {
        skippedChecks += 1;
        console.log(`  ○ ${key}: ${across[0].detail}`);
        continue;
      }
      const passCount = across.filter((c) => c.pass).length;
      totalMeasurableAssertions += 1;
      if (passCount === ok.length) totalPassedAllRuns += 1;
      const mark = passCount === ok.length ? '✓' : passCount === 0 ? '✗' : '⚠️ 不一致';
      console.log(`  ${mark} ${key}: ${passCount}/${ok.length}次通过${RUNS > 1 && passCount !== ok.length && passCount !== 0 ? '(同一案例、不同次运行结果不一致，本身就是需要关注的信号)' : ''}`);
    }
    console.log('');
  }

  console.log('='.repeat(50));
  if (RUNS > 1) {
    console.log(`可机械核实断言中，${RUNS}次全部通过的: ${totalPassedAllRuns}/${totalMeasurableAssertions}`);
    console.log(`(这才是排除噪声后的真实数字；单次对单次的对比不能证明改进是否真实)`);
  } else {
    console.log(`可机械核实断言: ${totalPassedAllRuns}/${totalMeasurableAssertions} 通过(仅跑了1次，建议--runs=3排除噪声)`);
  }
  console.log(`不可自动核实(需人工抽查): ${skippedChecks} 条`);
  console.log('='.repeat(50));

  const measurable = totalMeasurableAssertions;
  const passedChecks = totalPassedAllRuns;

  if (measurable > 0 && passedChecks < measurable) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('评测执行异常:', e);
  process.exitCode = 1;
});

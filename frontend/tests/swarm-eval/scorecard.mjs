#!/usr/bin/env node
// scorecard.mjs — 朝堂蜂群测试套件 · 汇总评分卡生成器
//
// 用法：
//   node scorecard.mjs                 读取 scores/*.json + results/*.json，写出 scorecard.md
//   node scorecard.mjs --dry-run       若 scores/results 为空则用内置样例数据走通流程（不打网络）
//   node scorecard.mjs --out <path>     指定输出文件（默认 ./scorecard.md，相对脚本目录）
//   node scorecard.mjs --dir <path>     指定 swarm-eval 根目录（默认脚本所在目录）
//
// 输入契约（与 battery.mjs / run-battery.mjs / score.mjs 对齐）：
//   battery.json          { version, tasks: [ { id, dept, deptCode, mode:'single'|'deep',
//                                               command, expectDims?, notes,
//                                               expectVerdict?:'准'|'驳'|'再议' } ] }
//   results/<id>__<mode>.json  { id, dept, mode, command, ok, httpStatus,
//                                output:string|object, verdict?, latencyMs, error? }
//   scores/<id>__<mode>.json   { id, mode, dims:{relevance,accuracy,completeness,
//                                actionability,traceability}(各1-5),
//                                weightedAvg, notes, judge:'llm'|'human' }
//
// 输出：scorecard.md，含 6 大块：
//   ① 各部门能力均分（标注不合格项）
//   ② 协作增益（deep vs single 同部门均分差 / 胜率）
//   ③ 门下误准率 / 误驳率（有 expectVerdict 则算判定误差，否则列 verdict 原始分布）
//   ④ 时延 P50 / P95（按 mode）
//   ⑤ 卡死 / 失败计数
//   ⑥ 可用 / 好用 / 不合格 结论 + Top 改进项
//
// 环境不可达/数据缺失：非 --dry-run 下若无任何 scores → 打印指引并以非 0 退出（不假装成功）。

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- 评分维度与门槛（与共享契约一致）-------------------------------------
const DIMS = ['relevance', 'accuracy', 'completeness', 'actionability', 'traceability'];
const GATE_DIMS = ['accuracy', 'traceability']; // 任一 ≤2 → 不合格
const FAIL_LE = 2;
const USABLE_GE = 3.5;   // ≥3.5 可用
const GOOD_GE = 4.2;     // ≥4.2 好用

// ---- 参数解析 ------------------------------------------------------------
function parseArgs(argv) {
  const args = { dryRun: false, out: null, dir: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--dir') args.dir = argv[++i];
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
  }
  return args;
}
function printHelp() {
  console.log(`用法: node scorecard.mjs [--dry-run] [--out <path>] [--dir <path>]`);
}

// ---- 文件读取辅助 --------------------------------------------------------
function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.warn(`[warn] 跳过无法解析的文件 ${path}: ${e.message}`);
    return null;
  }
}

function loadDir(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJsonSafe(join(dir, f)))
    .filter((x) => x && typeof x === 'object');
}

// ---- 内置样例（--dry-run 且无真实数据时使用）-----------------------------
function sampleBattery() {
  return {
    version: 'sample-1',
    tasks: [
      { id: 'prime', dept: '丞相台', deptCode: 'prime_minister', mode: 'single',
        command: '评估本月经营风险并给出优先级', expectVerdict: '准' },
      { id: 'prime', dept: '丞相台', deptCode: 'prime_minister', mode: 'deep',
        command: '评估本月经营风险并给出优先级', expectVerdict: '准' },
      { id: 'finance', dept: '户部', deptCode: 'finance', mode: 'single',
        command: '审查季度现金流并标记异常支出', expectVerdict: '再议' },
      { id: 'finance', dept: '户部', deptCode: 'finance', mode: 'deep',
        command: '审查季度现金流并标记异常支出', expectVerdict: '驳' },
    ],
  };
}
function sampleResults() {
  return [
    { id: 'prime', dept: '丞相台', mode: 'single', command: '评估…', ok: true,
      httpStatus: 200, output: '…', verdict: '准', latencyMs: 1800 },
    { id: 'prime', dept: '丞相台', mode: 'deep', command: '评估…', ok: true,
      httpStatus: 200, output: { menxia: { verdict: '准' } }, verdict: '准', latencyMs: 5200 },
    { id: 'finance', dept: '户部', mode: 'single', command: '审查…', ok: true,
      httpStatus: 200, output: '…', verdict: '准', latencyMs: 2100 },
    { id: 'finance', dept: '户部', mode: 'deep', command: '审查…', ok: false,
      httpStatus: 503, output: '', verdict: undefined, latencyMs: 0, error: 'db_insert_failed' },
  ];
}
function sampleScores() {
  return [
    { id: 'prime', mode: 'single', judge: 'llm', notes: '样例',
      dims: { relevance: 4, accuracy: 4, completeness: 3, actionability: 4, traceability: 4 } },
    { id: 'prime', mode: 'deep', judge: 'llm', notes: '样例',
      dims: { relevance: 5, accuracy: 5, completeness: 4, actionability: 5, traceability: 4 } },
    { id: 'finance', mode: 'single', judge: 'llm', notes: '样例',
      dims: { relevance: 4, accuracy: 3, completeness: 3, actionability: 3, traceability: 2 } },
    { id: 'finance', mode: 'deep', judge: 'llm', notes: '卡死',
      dims: { relevance: 1, accuracy: 1, completeness: 1, actionability: 1, traceability: 1 } },
  ];
}

// ---- 数值/统计辅助 -------------------------------------------------------
function weightedAvg(dims) {
  // 等权平均（契约未指定权重，5 维等权）；若 score 自带 weightedAvg 则优先使用。
  const vals = DIMS.map((d) => Number(dims?.[d])).filter((n) => Number.isFinite(n));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function scoreAvg(score) {
  if (Number.isFinite(score?.weightedAvg)) return score.weightedAvg;
  return weightedAvg(score?.dims);
}
function isFailing(score) {
  // 门槛：accuracy 或 traceability 任一 ≤2 → 不合格
  return GATE_DIMS.some((d) => {
    const v = Number(score?.dims?.[d]);
    return Number.isFinite(v) && v <= FAIL_LE;
  });
}
function verdictOf(avg) {
  if (avg == null) return '无数据';
  if (avg >= GOOD_GE) return '好用';
  if (avg >= USABLE_GE) return '可用';
  return '不合格';
}
function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return null;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo];
  const frac = rank - lo;
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * frac;
}
function fmt(n, digits = 2) {
  return n == null || Number.isNaN(n) ? 'N/A' : Number(n).toFixed(digits);
}

// ---- 索引构建 ------------------------------------------------------------
function indexResults(results) {
  const m = new Map(); // key: `${id}__${mode}`
  for (const r of results) {
    if (!r?.id || !r?.mode) continue;
    m.set(`${r.id}__${r.mode}`, r);
  }
  return m;
}
function indexBattery(battery) {
  const m = new Map(); // key: `${id}__${mode}`
  for (const t of battery?.tasks ?? []) {
    if (!t?.id || !t?.mode) continue;
    m.set(`${t.id}__${t.mode}`, t);
  }
  return m;
}

// ---- 聚合 ----------------------------------------------------------------
function aggregate({ battery, results, scores }) {
  const resIdx = indexResults(results);
  const batIdx = indexBattery(battery);

  // 富化每条 score
  const rows = scores.map((s) => {
    const key = `${s.id}__${s.mode}`;
    const res = resIdx.get(key) || {};
    const task = batIdx.get(key) || {};
    const avg = scoreAvg(s);
    return {
      id: s.id,
      mode: s.mode,
      dept: res.dept || task.dept || s.id,
      deptCode: task.deptCode || res.deptCode || '',
      dims: s.dims || {},
      avg,
      failing: isFailing(s),
      verdict: verdictOf(avg),
      judge: s.judge || 'unknown',
      notes: s.notes || '',
      // 来自 results 的运行态
      ok: res.ok,
      httpStatus: res.httpStatus,
      latencyMs: Number.isFinite(res.latencyMs) ? res.latencyMs : null,
      runVerdict: res.verdict,            // 门下判定（准/驳/再议）
      error: res.error,
      stuck: detectStuck(res),
      // 来自 battery 的期望
      expectVerdict: task.expectVerdict,
    };
  });

  return { rows, resIdx, batIdx };
}

function detectStuck(res) {
  if (!res) return false;
  // 永久卡 running：ok 但无产出且无 verdict，或显式标记
  if (res.stuck === true) return true;
  const out = res.output;
  const emptyOut = out == null || out === '' ||
    (typeof out === 'object' && Object.keys(out).length === 0);
  return res.ok === true && emptyOut && !res.verdict && !res.error;
}

// ① 各部门能力均分 ---------------------------------------------------------
function deptCapability(rows) {
  const byDept = new Map();
  for (const r of rows) {
    if (r.avg == null) continue;
    if (!byDept.has(r.dept)) byDept.set(r.dept, []);
    byDept.get(r.dept).push(r);
  }
  const out = [];
  for (const [dept, list] of byDept) {
    const avgs = list.map((x) => x.avg);
    const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
    const failCount = list.filter((x) => x.failing).length;
    out.push({
      dept,
      deptCode: list[0].deptCode,
      mean,
      n: list.length,
      failCount,
      verdict: verdictOf(mean),
      tasks: list,
    });
  }
  out.sort((a, b) => b.mean - a.mean);
  return out;
}

// ② 协作增益 deep vs single ------------------------------------------------
function collaborationGain(rows) {
  const byId = new Map(); // id -> { single, deep, dept }
  for (const r of rows) {
    if (!byId.has(r.id)) byId.set(r.id, { dept: r.dept, single: null, deep: null });
    const slot = byId.get(r.id);
    if (r.mode === 'single') slot.single = r.avg;
    else if (r.mode === 'deep') slot.deep = r.avg;
  }
  const pairs = [];
  let deepWins = 0, singleWins = 0, ties = 0, comparable = 0;
  let gainSum = 0;
  for (const [id, v] of byId) {
    if (v.single == null || v.deep == null) {
      pairs.push({ id, dept: v.dept, single: v.single, deep: v.deep, delta: null });
      continue;
    }
    const delta = v.deep - v.single;
    comparable++;
    gainSum += delta;
    if (delta > 0.0001) deepWins++;
    else if (delta < -0.0001) singleWins++;
    else ties++;
    pairs.push({ id, dept: v.dept, single: v.single, deep: v.deep, delta });
  }
  const avgGain = comparable ? gainSum / comparable : null;
  const deepWinRate = comparable ? deepWins / comparable : null;
  return { pairs, deepWins, singleWins, ties, comparable, avgGain, deepWinRate };
}

// ③ 门下判定：误准率 / 误驳率 或 原始分布 ---------------------------------
const NORM = { 准: '准', 驳: '驳', 再议: '再议' };
function normVerdict(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return NORM[s] || s;
}
function menxiaAnalysis(rows) {
  const haveExpect = rows.some((r) => r.expectVerdict);
  const dist = { 准: 0, 驳: 0, 再议: 0, 其它: 0, 无: 0 };
  for (const r of rows) {
    const v = normVerdict(r.runVerdict);
    if (v == null) dist['无']++;
    else if (v in dist) dist[v]++;
    else dist['其它']++;
  }
  let confusion = null;
  if (haveExpect) {
    // 误准：应驳(期望=驳)却 verdict=准；误驳：应准(期望=准)却 verdict=驳
    let shouldReject = 0, falseApprove = 0; // 期望驳
    let shouldApprove = 0, falseReject = 0; // 期望准
    let matched = 0, evaluable = 0;
    for (const r of rows) {
      const exp = normVerdict(r.expectVerdict);
      const got = normVerdict(r.runVerdict);
      if (!exp || got == null) continue;
      evaluable++;
      if (exp === got) matched++;
      if (exp === '驳') { shouldReject++; if (got === '准') falseApprove++; }
      if (exp === '准') { shouldApprove++; if (got === '驳') falseReject++; }
    }
    confusion = {
      evaluable,
      matched,
      accuracy: evaluable ? matched / evaluable : null,
      shouldReject,
      falseApprove,
      falseApproveRate: shouldReject ? falseApprove / shouldReject : null,
      shouldApprove,
      falseReject,
      falseRejectRate: shouldApprove ? falseReject / shouldApprove : null,
    };
  }
  return { haveExpect, dist, confusion };
}

// ④ 时延 P50 / P95（按 mode）----------------------------------------------
function latencyStats(rows) {
  const byMode = new Map();
  for (const r of rows) {
    if (r.latencyMs == null || r.latencyMs <= 0) continue;
    if (!byMode.has(r.mode)) byMode.set(r.mode, []);
    byMode.get(r.mode).push(r.latencyMs);
  }
  const out = {};
  for (const [mode, arr] of byMode) {
    const sorted = [...arr].sort((a, b) => a - b);
    out[mode] = {
      n: sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      max: sorted[sorted.length - 1],
      min: sorted[0],
    };
  }
  return out;
}

// ⑤ 卡死 / 失败计数 -------------------------------------------------------
function reliabilityStats(rows) {
  let total = rows.length;
  let stuck = 0, failed = 0, http5xx = 0, http4xx = 0, errored = 0, ok = 0;
  const stuckList = [], failedList = [];
  for (const r of rows) {
    if (r.stuck) { stuck++; stuckList.push(r); }
    const httpFail = Number.isFinite(r.httpStatus) && r.httpStatus >= 400;
    const runFail = r.ok === false || httpFail || r.error;
    if (runFail) { failed++; failedList.push(r); }
    else ok++;
    if (Number.isFinite(r.httpStatus)) {
      if (r.httpStatus >= 500) http5xx++;
      else if (r.httpStatus >= 400) http4xx++;
    }
    if (r.error) errored++;
  }
  return {
    total, stuck, failed, ok, http5xx, http4xx, errored,
    stuckRate: total ? stuck / total : 0,
    failRate: total ? failed / total : 0,
    stuckList, failedList,
  };
}

// ⑥ 结论 + Top 改进项 ------------------------------------------------------
function buildConclusion({ rows, deptCaps, collab, reliability, menxia }) {
  const scored = rows.filter((r) => r.avg != null);
  const overallMean = scored.length
    ? scored.reduce((a, r) => a + r.avg, 0) / scored.length
    : null;
  const overallVerdict = verdictOf(overallMean);

  const improvements = [];
  // 不合格部门 / 任务
  const failTasks = rows.filter((r) => r.failing);
  if (failTasks.length) {
    const names = failTasks.map((t) => `${t.dept}/${t.mode}`).join('、');
    improvements.push(`修复 ${failTasks.length} 个不合格任务（accuracy/traceability ≤2）：${names}`);
  }
  // 卡死
  if (reliability.stuck > 0) {
    improvements.push(`消除 ${reliability.stuck} 例"永久卡 running"（fire-and-forget 无超时回收）`);
  }
  // 失败 / 503
  if (reliability.http5xx > 0) {
    improvements.push(`修复 ${reliability.http5xx} 例 5xx（多为单 agent 路由缺 TURSO_DB_URL 的 503 db_insert_failed）`);
  }
  // 协作未增益
  if (collab.comparable > 0 && collab.avgGain != null && collab.avgGain <= 0) {
    improvements.push(`deep 模式相对 single 无均分增益（Δ=${fmt(collab.avgGain)}），核查三院协作链路是否真正贡献信息`);
  }
  // 门下误准
  if (menxia.confusion?.falseApprove > 0) {
    improvements.push(`门下误准 ${menxia.confusion.falseApprove} 例（应驳却判准），收紧驳回判据`);
  }
  if (menxia.confusion?.falseReject > 0) {
    improvements.push(`门下误驳 ${menxia.confusion.falseReject} 例（应准却驳），放宽过严判据`);
  }
  // traceability 系统性偏低
  const traceVals = scored.map((r) => Number(r.dims?.traceability)).filter(Number.isFinite);
  if (traceVals.length) {
    const traceMean = traceVals.reduce((a, b) => a + b, 0) / traceVals.length;
    if (traceMean < USABLE_GE) {
      improvements.push(`可追溯性偏低（均值 ${fmt(traceMean)}），补充引用/步骤留痕`);
    }
  }
  // 最弱部门
  const weakest = [...deptCaps].sort((a, b) => a.mean - b.mean)[0];
  if (weakest && weakest.mean < USABLE_GE) {
    improvements.push(`优先提升最弱部门「${weakest.dept}」（均分 ${fmt(weakest.mean)}）`);
  }
  if (improvements.length === 0) {
    improvements.push('无显著缺陷；建议扩充用例覆盖与人工复核占比以提升置信度');
  }
  return { overallMean, overallVerdict, improvements: improvements.slice(0, 8) };
}

// ---- Markdown 渲染 -------------------------------------------------------
function badge(verdict) {
  return { 好用: '🟢 好用', 可用: '🟡 可用', 不合格: '🔴 不合格', 无数据: '⚪ 无数据' }[verdict] || verdict;
}

function renderMarkdown(ctx) {
  const { rows, deptCaps, collab, menxia, latency, reliability, conclusion, meta } = ctx;
  const L = [];
  L.push('# 朝堂蜂群测试套件 · 汇总评分卡');
  L.push('');
  L.push(`> 生成时间：${new Date().toISOString()}　|　数据源：scores=${meta.nScores} · results=${meta.nResults} · battery=${meta.nBatteryTasks}${meta.dryRun ? '　|　**DRY-RUN（样例数据）**' : ''}`);
  L.push('');
  L.push(`**总体结论：${badge(conclusion.overallVerdict)}**（全任务能力均分 **${fmt(conclusion.overallMean)}** / 5；门槛：accuracy 或 traceability ≤2 即不合格，均分 ≥3.5 可用、≥4.2 好用）`);
  L.push('');

  // ① 各部门能力均分
  L.push('## ① 各部门能力均分');
  L.push('');
  L.push('| 部门 | 代号 | 用例数 | 能力均分 | 不合格项 | 结论 |');
  L.push('|---|---|---:|---:|---:|---|');
  for (const d of deptCaps) {
    const flag = d.failCount > 0 ? `⚠️ ${d.failCount}` : '0';
    L.push(`| ${d.dept} | \`${d.deptCode || '-'}\` | ${d.n} | ${fmt(d.mean)} | ${flag} | ${badge(d.verdict)} |`);
  }
  if (deptCaps.length === 0) L.push('| _无数据_ | | | | | |');
  L.push('');
  // 不合格明细
  const failRows = rows.filter((r) => r.failing);
  if (failRows.length) {
    L.push('**不合格任务明细（accuracy 或 traceability ≤2）：**');
    L.push('');
    L.push('| 部门 | 模式 | accuracy | traceability | 均分 | 备注 |');
    L.push('|---|---|---:|---:|---:|---|');
    for (const r of failRows) {
      L.push(`| ${r.dept} | ${r.mode} | ${r.dims.accuracy ?? '-'} | ${r.dims.traceability ?? '-'} | ${fmt(r.avg)} | ${r.notes || ''} |`);
    }
    L.push('');
  }

  // ② 协作增益
  L.push('## ② 协作增益（deep vs single 同部门）');
  L.push('');
  if (collab.comparable > 0) {
    L.push(`- 可对比部门：**${collab.comparable}**　|　deep 胜：**${collab.deepWins}**　single 胜：**${collab.singleWins}**　平：**${collab.ties}**`);
    L.push(`- deep 胜率：**${fmt(collab.deepWinRate * 100, 1)}%**　|　平均增益 Δ(deep−single)：**${fmt(collab.avgGain)}**`);
  } else {
    L.push('- 无可对比的 single/deep 同部门配对（缺配对数据）');
  }
  L.push('');
  L.push('| 部门(id) | single 均分 | deep 均分 | Δ(deep−single) |');
  L.push('|---|---:|---:|---:|');
  for (const p of collab.pairs) {
    const delta = p.delta == null ? 'N/A' : (p.delta > 0 ? `+${fmt(p.delta)}` : fmt(p.delta));
    L.push(`| ${p.dept} (${p.id}) | ${fmt(p.single)} | ${fmt(p.deep)} | ${delta} |`);
  }
  if (collab.pairs.length === 0) L.push('| _无数据_ | | | |');
  L.push('');

  // ③ 门下判定
  L.push('## ③ 门下判定（误准 / 误驳）');
  L.push('');
  if (menxia.confusion) {
    const c = menxia.confusion;
    L.push(`- 可评估判定数：**${c.evaluable}**　|　判定一致：**${c.matched}**（一致率 **${fmt((c.accuracy ?? 0) * 100, 1)}%**）`);
    L.push(`- 误准率（应驳却判准）：**${fmt((c.falseApproveRate ?? 0) * 100, 1)}%**（${c.falseApprove}/${c.shouldReject}）`);
    L.push(`- 误驳率（应准却判驳）：**${fmt((c.falseRejectRate ?? 0) * 100, 1)}%**（${c.falseReject}/${c.shouldApprove}）`);
  } else {
    L.push('- battery 未标注 `expectVerdict`，无法计算误准/误驳率；下列为原始 verdict 分布：');
  }
  L.push('');
  L.push('| verdict | 准 | 驳 | 再议 | 其它 | 无 |');
  L.push('|---|---:|---:|---:|---:|---:|');
  const d = menxia.dist;
  L.push(`| 计数 | ${d['准']} | ${d['驳']} | ${d['再议']} | ${d['其它']} | ${d['无']} |`);
  L.push('');

  // ④ 时延
  L.push('## ④ 时延 P50 / P95（按 mode）');
  L.push('');
  L.push('| 模式 | 样本 | P50 (ms) | P95 (ms) | min | max |');
  L.push('|---|---:|---:|---:|---:|---:|');
  const modes = Object.keys(latency);
  if (modes.length === 0) L.push('| _无时延数据_ | | | | | |');
  for (const m of modes) {
    const s = latency[m];
    L.push(`| ${m} | ${s.n} | ${fmt(s.p50, 0)} | ${fmt(s.p95, 0)} | ${fmt(s.min, 0)} | ${fmt(s.max, 0)} |`);
  }
  L.push('');

  // ⑤ 卡死 / 失败
  L.push('## ⑤ 卡死 / 失败计数');
  L.push('');
  const rel = reliability;
  L.push(`- 总任务：**${rel.total}**　|　成功：**${rel.ok}**　失败：**${rel.failed}**（${fmt(rel.failRate * 100, 1)}%）　卡死：**${rel.stuck}**（${fmt(rel.stuckRate * 100, 1)}%）`);
  L.push(`- HTTP 5xx：**${rel.http5xx}**　HTTP 4xx：**${rel.http4xx}**　显式 error：**${rel.errored}**`);
  L.push('');
  if (rel.stuckList.length || rel.failedList.length) {
    L.push('| 部门 | 模式 | http | ok | error | 类型 |');
    L.push('|---|---|---:|---|---|---|');
    const seen = new Set();
    for (const r of [...rel.stuckList, ...rel.failedList]) {
      const key = `${r.id}__${r.mode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const type = r.stuck ? '卡死' : '失败';
      L.push(`| ${r.dept} | ${r.mode} | ${r.httpStatus ?? '-'} | ${r.ok ?? '-'} | ${r.error || '-'} | ${type} |`);
    }
    L.push('');
  }

  // ⑥ 结论 + Top 改进
  L.push('## ⑥ 结论与 Top 改进项');
  L.push('');
  L.push(`**判定：${badge(conclusion.overallVerdict)}**`);
  L.push('');
  L.push('**Top 改进项（按优先级）：**');
  L.push('');
  conclusion.improvements.forEach((it, i) => L.push(`${i + 1}. ${it}`));
  L.push('');
  L.push('---');
  L.push('');
  L.push('_评分维度（5 维等权，1–5）：relevance / accuracy / completeness / actionability / traceability_');
  L.push('_不合格门槛：accuracy 或 traceability 任一 ≤2。可用 ≥3.5，好用 ≥4.2。_');
  L.push('');
  return L.join('\n');
}

// ---- 主流程 --------------------------------------------------------------
function main() {
  const args = parseArgs(process.argv);
  const root = args.dir ? args.dir : __dirname;
  const scoresDir = join(root, 'scores');
  const resultsDir = join(root, 'results');
  const batteryPath = join(root, 'battery.json');
  const outPath = args.out ? args.out : join(root, 'scorecard.md');

  let scores = loadDir(scoresDir);
  let results = loadDir(resultsDir);
  let battery = existsSync(batteryPath) ? readJsonSafe(batteryPath) : null;

  let dryRun = args.dryRun;
  if (scores.length === 0) {
    if (dryRun) {
      console.warn('[dry-run] scores/ 为空，使用内置样例数据演示流程。');
      battery = battery || sampleBattery();
      results = results.length ? results : sampleResults();
      scores = sampleScores();
    } else {
      console.error('[error] 未在 scores/ 找到任何评分 JSON。');
      console.error(`        期望目录：${scoresDir}`);
      console.error('        请先运行打分脚本（score.mjs）生成 scores/<id>__<mode>.json，');
      console.error('        或加 --dry-run 用内置样例走通流程。');
      process.exit(1);
    }
  }
  if (!battery) {
    console.warn(`[warn] 未找到 ${batteryPath}，将跳过期望判定(误准/误驳)计算，仅列 verdict 原始分布。`);
    battery = { version: 'none', tasks: [] };
  }

  const { rows } = aggregate({ battery, results, scores });
  const deptCaps = deptCapability(rows);
  const collab = collaborationGain(rows);
  const menxia = menxiaAnalysis(rows);
  const latency = latencyStats(rows);
  const reliability = reliabilityStats(rows);
  const conclusion = buildConclusion({ rows, deptCaps, collab, reliability, menxia });

  const md = renderMarkdown({
    rows, deptCaps, collab, menxia, latency, reliability, conclusion,
    meta: {
      nScores: scores.length,
      nResults: results.length,
      nBatteryTasks: battery.tasks?.length ?? 0,
      dryRun,
    },
  });

  writeFileSync(outPath, md, 'utf8');
  console.log(`[ok] scorecard 写入 ${outPath}`);
  console.log(`     部门=${deptCaps.length} · 任务=${rows.length} · 总体=${conclusion.overallVerdict}(${fmt(conclusion.overallMean)}) · 卡死=${reliability.stuck} · 失败=${reliability.failed}`);
}

main();

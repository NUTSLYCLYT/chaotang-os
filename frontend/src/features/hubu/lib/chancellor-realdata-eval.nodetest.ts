/**
 * 丞相 · 真实数据 eval(P1 · 2026-07-01)
 *
 * 落地上轮 Deming 警示:模拟只证"逻辑自洽",没证"真脏数据不崩"。本 eval:
 *   ① 真主库 overview 快照(7 行 turso 真数据)灌全管线 → 第一个"真数据健康数"。
 *   ② 脏数据鲁棒(中文金额/超长命令/空字段/坏枚举)→ 钉死不崩 + 不变量不破。
 * 产出 Karpathy 要的「失败案例清单」(判错/崩溃的真案,排序成下一轮工单)。
 *
 * 全管线:evaluateProject → hubuEvaluationToOpinion → governChancellor → analyzeForChancellor
 *        → runCourtUnifiedDecisionLoop。任一环崩 = 真鲁棒 bug,本 eval 抓出来。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { HubuProject } from '../../../lib/contracts/hubu.ts';
import type { SourceLabel } from '../../../core/courtos/types.ts';
import { evaluateProject } from './hubu-engines.ts';
import { hubuEvaluationToOpinion } from './hubu-opinion-bridge.ts';
import { governChancellor } from './chancellor-governance.ts';
import { analyzeForChancellor } from './chancellor-analysis.ts';
import { runCourtUnifiedDecisionLoop } from '../../../core/courtos/unified/unified-decision-loop.ts';
import { REAL_OVERVIEW_SAMPLE, REAL_OVERVIEW_SOURCE } from './__fixtures__/real-overview-sample.ts';
import { EVAL_BASELINE, type EvalEpochMetrics } from './__fixtures__/chancellor-eval-baseline.ts';

const VALID_SIGNALS = new Set(['GREEN', 'YELLOW', 'RED', 'GRAY']);

interface RunResult {
  id: string;
  crashed: string | null;
  signal: string;
  decisionValid: boolean;
  signoff: boolean;
  acceptMode: string;
  convened: number;
  conflicts: number;
  verdict: string;
  failures: string[];
}

/** 单行过全管线,抓崩溃 + 校验不变量,返回结果(不抛,失败记进 failures)。 */
function runRow(p: HubuProject, source: SourceLabel): RunResult {
  const r: RunResult = {
    id: p.id || '(无id)', crashed: null, signal: '-', decisionValid: false,
    signoff: false, acceptMode: '-', convened: 0, conflicts: 0, verdict: '-', failures: [],
  };
  try {
    const ev = evaluateProject(p);
    const opinion = hubuEvaluationToOpinion(ev, source);
    const gov = governChancellor(ev, []);
    analyzeForChancellor(p, ev); // 不崩即可
    const unified = runCourtUnifiedDecisionLoop({
      rawQuestion: p.command?.trim() || p.title?.trim() || '(空决策)',
      taskId: p.id || 'eval-row',
      sourceLabel: 'MIXED',
      financeOpinionOverride: opinion,
    });

    r.signal = opinion.signal;
    r.decisionValid = gov.decisionValid;
    r.signoff = gov.decision?.signoff.required ?? false;
    r.acceptMode = gov.acceptAction.mode;
    r.convened = unified.departmentOpinions.length;
    r.conflicts = unified.conflicts.length;
    r.verdict = unified.memorial.verdict;

    // 不变量(对真/脏数据都必须成立):
    if (!VALID_SIGNALS.has(opinion.signal)) r.failures.push(`非法信号 ${opinion.signal}`);
    if (!gov.decisionValid) r.failures.push(`裁断校验未过:${gov.decisionIssues.join('/')}`);
    // fail-safe:缺证/现金/单向门 → 绝不 GREEN(不镀金)
    if ((ev.missing.length > 0 || ev.cashStress || ev.oneWayDoor.oneWay) && opinion.signal === 'GREEN') {
      r.failures.push('镀金:有阻断却 GREEN');
    }
    // signoff 触发条件一致
    if (r.signoff !== (ev.oneWayDoor.oneWay || ev.cashStress)) r.failures.push('signoff 触发不一致');
    // 采纳边界:需签 ⇔ execute
    if ((r.acceptMode === 'execute') !== r.signoff) r.failures.push('采纳边界与 signoff 不一致');
    if (!unified.memorial.verdict) r.failures.push('合奏无判词');
    if (!unified.departmentOpinions.some((o) => o.departmentId === 'finance')) r.failures.push('户部缺席');
  } catch (e) {
    r.crashed = e instanceof Error ? e.message : String(e);
    r.failures.push(`崩溃:${r.crashed}`);
  }
  return r;
}

function summarize(results: RunResult[]): EvalEpochMetrics {
  const sig = (s: string) => results.filter((r) => r.signal === s).length;
  const avg = (sel: (r: RunResult) => number) =>
    Number((results.reduce((a, r) => a + sel(r), 0) / results.length).toFixed(1));
  return {
    total: results.length,
    passed: results.filter((r) => r.failures.length === 0).length,
    crashed: results.filter((r) => r.crashed).length,
    signals: { GREEN: sig('GREEN'), YELLOW: sig('YELLOW'), RED: sig('RED'), GRAY: sig('GRAY') },
    executeAccept: results.filter((r) => r.acceptMode === 'execute').length,
    conveneAvg: avg((r) => r.convened),
    conflictAvg: avg((r) => r.conflicts),
  };
}

/** Δ vs 基线:正负号标出漂移方向(软,只看不拦)。 */
function delta(cur: number, base: number): string {
  const d = Number((cur - base).toFixed(1));
  return d === 0 ? '=' : d > 0 ? `+${d}` : `${d}`;
}

function report(title: string, results: RunResult[], baseline: EvalEpochMetrics) {
  const m = summarize(results);
  console.log(`\n  ── ${title} ──`);
  console.log(`  健康:${m.passed}/${m.total} 通过 · 崩溃 ${m.crashed} · 裁断全合法 ${results.every((r) => r.decisionValid || r.crashed)}`);
  console.log(`  信号分布:GREEN ${m.signals.GREEN}(Δ${delta(m.signals.GREEN, baseline.signals.GREEN)}) · YELLOW ${m.signals.YELLOW}(Δ${delta(m.signals.YELLOW, baseline.signals.YELLOW)}) · RED ${m.signals.RED}(Δ${delta(m.signals.RED, baseline.signals.RED)}) · GRAY ${m.signals.GRAY}(Δ${delta(m.signals.GRAY, baseline.signals.GRAY)})`);
  console.log(`  采纳execute ${m.executeAccept}(Δ${delta(m.executeAccept, baseline.executeAccept)}) · 召部均值 ${m.conveneAvg}(Δ${delta(m.conveneAvg, baseline.conveneAvg)}) · 冲突均值 ${m.conflictAvg}(Δ${delta(m.conflictAvg, baseline.conflictAvg)})`);
  console.log(`  vs 基线 epoch ${EVAL_BASELINE.epoch}(${EVAL_BASELINE.capturedAt})`);
  const fails = results.filter((r) => r.failures.length > 0);
  if (fails.length) {
    console.log(`  ⚠ 失败案例清单(下一轮工单):`);
    for (const f of fails) console.log(`   [${f.id}] ${f.failures.join(' | ')}`);
  } else {
    console.log(`  ✓ 失败案例清单:空`);
  }
}

// ── ① 真主库快照健康数 ──
test('真主库 7 行 overview:全管线无崩 + 不变量不破', () => {
  const source: SourceLabel = REAL_OVERVIEW_SOURCE === 'turso' ? 'LIVE' : 'FALLBACK';
  const results = REAL_OVERVIEW_SAMPLE.map((p) => runRow(p, source));
  report(`真主库快照(${REAL_OVERVIEW_SAMPLE.length} 行 · source=${REAL_OVERVIEW_SOURCE})`, results, EVAL_BASELINE.realData);
  for (const r of results) assert.equal(r.crashed, null, `真数据崩溃 [${r.id}]: ${r.crashed}`);
  for (const r of results) assert.deepEqual(r.failures, [], `真数据不变量破 [${r.id}]`);
});

// ── ② 脏数据鲁棒 ──
const DIRTY: HubuProject[] = [
  { ...base(), id: 'dirty-cn-money', title: '采购磷酸铁锂电芯', requested_budget: '约1086元/台(估·待核真采购价)', estimated_roi: 'N/A', payback_window: '待测' },
  { ...base(), id: 'dirty-long-cmd', title: '请军机处围绕『要不要上马储能产线』审查', command: '陛下明鉴,'.repeat(120), cash_flow_pressure: '现金紧张' },
  { ...base(), id: 'dirty-empty', title: '', requested_budget: '', estimated_roi: '', payback_window: '', cash_flow_pressure: '', command: '' },
  { ...base(), id: 'dirty-bad-enum', priority: 'P9' as HubuProject['priority'], risk_level: 'unknown' as HubuProject['risk_level'], requested_budget: '12,0000元' },
  { ...base(), id: 'dirty-quote-title', title: '请户部就『60V32Ah 电池包是否值得投 50 万对外报价签独家合同预付款』判断', requested_budget: '50万', cash_flow_pressure: '现金紧张' },
  { ...base(), id: 'dirty-nan', requested_budget: '—', estimated_roi: '—', payback_window: '—', cash_flow_pressure: '—' },
];
function base(): HubuProject {
  return {
    id: 'd', title: '脏数据决策', target_dept: 'finance', owner_dept: '户部', status: 'pending_review',
    requested_budget: '10万', estimated_roi: '2x', payback_window: '6个月', cash_flow_pressure: '—',
    priority: 'P1', risk_level: 'medium', recommendation: '', command: '', acceptance_criteria: [],
    created_at: '', updated_at: '',
  };
}

test('脏数据 6 例:不崩 + 不镀金 + 裁断恒合法 + 诚实降级', () => {
  const results = DIRTY.map((p) => runRow(p, 'LIVE'));
  report('脏数据鲁棒', results, EVAL_BASELINE.dirtyData);
  for (const r of results) assert.equal(r.crashed, null, `脏数据崩溃 [${r.id}]: ${r.crashed}`);
  for (const r of results) assert.deepEqual(r.failures, [], `脏数据不变量破 [${r.id}]`);
});

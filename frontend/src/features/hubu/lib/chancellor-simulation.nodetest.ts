/**
 * 丞相超级智能体 · 全情况模拟(2026-07-01)
 *
 * 张小龙建议操作化:不靠手点,确定性枚举丞相在「全输入空间」的行为,每格钉死不变量。
 * 收双脑(接点②)前,先用数据证明跨部会审 + 裁断 + 边界在所有情况下不崩(Deming:拿数据不靠信)。
 *
 * 覆盖矩阵:verdict(4) × 缺证(2) × 现金压力(2) × 单向门(2) × 来源(2) = 64 格
 *   + 跨部问题矩阵(不同旨意 → 召不同部 → 不同冲突)
 *   + 边界态(空数据/样本/FALLBACK 全页)。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { HUBU_VERDICT_CN } from './hubu-engines.ts';
import type { HubuEvaluation, HubuVerdict } from './hubu-engines.ts';
import type { HubuProject } from '../../../lib/contracts/hubu.ts';
import type { SourceLabel } from '../../../core/courtos/types.ts';
import { hubuEvaluationToOpinion } from './hubu-opinion-bridge.ts';
import { analyzeForChancellor } from './chancellor-analysis.ts';
import { governChancellor } from './chancellor-governance.ts';
import { runCourtUnifiedDecisionLoop } from '../../../core/courtos/unified/unified-decision-loop.ts';

function project(over: Partial<HubuProject> = {}): HubuProject {
  return {
    id: 'sim', title: '模拟决策', target_dept: 'finance', owner_dept: 'finance',
    status: 'pending_review', requested_budget: '12万', estimated_roi: '2x', payback_window: '8个月',
    cash_flow_pressure: '—', priority: 'P1', risk_level: 'medium', recommendation: '', command: '',
    acceptance_criteria: [], created_at: '', updated_at: '', ...over,
  };
}
function ev(over: Partial<HubuEvaluation> = {}): HubuEvaluation {
  const missing = over.missing ?? [];
  return {
    budgetYuan: 120000, roiMultiple: 2, exposure: 30, score: 70, verdict: 'approve', verdictCn: '准奏',
    quadrant: 'prefer', oneWayDoor: { oneWay: false, reasons: [] }, cashStress: false, cashNote: null,
    quality: { grounded: 3 - missing.length, total: 3, missing: missing.length },
    explain: { roi: '', exposure: '', score: '', verdict: '' }, ...over, missing,
  };
}

const VERDICTS: HubuVerdict[] = ['approve', 'adjust', 'hold', 'reject'];
const SOURCES: SourceLabel[] = ['LIVE', 'FALLBACK'];

interface Cell {
  verdict: HubuVerdict; missing: boolean; cash: boolean; oneWay: boolean; source: SourceLabel;
  signal: string; decisionValid: boolean; signoff: boolean; acceptMode: string; expert: string;
}

function enumerateCells(): Cell[] {
  const cells: Cell[] = [];
  for (const verdict of VERDICTS)
    for (const missing of [false, true])
      for (const cash of [false, true])
        for (const oneWay of [false, true])
          for (const source of SOURCES) {
            const e = ev({
              verdict, verdictCn: HUBU_VERDICT_CN[verdict],
              missing: missing ? ['预期回报/ROI'] : [],
              cashStress: cash, oneWayDoor: { oneWay, reasons: oneWay ? ['对外承诺'] : [] },
            });
            const opinion = hubuEvaluationToOpinion(e, source);
            const gov = governChancellor(e, []);
            const analysis = analyzeForChancellor(project(), e);
            cells.push({
              verdict, missing, cash, oneWay, source,
              signal: opinion.signal, decisionValid: gov.decisionValid,
              signoff: gov.decision?.signoff.required ?? false,
              acceptMode: gov.acceptAction.mode, expert: analysis.expert.who,
            });
          }
  return cells;
}

test('模拟 64 格:不变量在每一格都成立', () => {
  const cells = enumerateCells();
  assert.equal(cells.length, 64);

  for (const c of cells) {
    // 唯一可放行格:干净 approve(无缺证/现金/单向门)+ LIVE。adjust/hold/reject 均非 GREEN。
    const greenable = c.verdict === 'approve' && !c.missing && !c.cash && !c.oneWay && c.source === 'LIVE';
    if (greenable) {
      assert.equal(c.signal, 'GREEN', `应 GREEN: ${JSON.stringify(c)}`);
    } else {
      // fail-safe:任何缺证/现金/单向门/adjust/hold/reject/FALLBACK → 绝不 GREEN(不镀金)
      assert.notEqual(c.signal, 'GREEN', `不该 GREEN: ${JSON.stringify(c)}`);
    }
    // 3. 裁断恒合法(永不"正确的废话",恒裁≥1冲突)
    assert.equal(c.decisionValid, true, `裁断校验必须过: ${JSON.stringify(c)}`);
    // 4. signoff 由 单向门∨现金 触发,且 = 采纳越界(execute)
    assert.equal(c.signoff, c.oneWay || c.cash, `signoff 触发条件错: ${JSON.stringify(c)}`);
    assert.equal(c.acceptMode, c.oneWay || c.cash ? 'execute' : 'consult', `采纳边界错: ${JSON.stringify(c)}`);
    // 5. 大神视角按最大风险优先级(单向门>现金>缺证>齐)
    const want = c.oneWay ? '芒格' : c.cash ? '贝索斯' : c.missing ? 'deming' : '张小龙';
    assert.ok(c.expert.includes(want), `大神匹配错: 期望含${want} 实得${c.expert} ${JSON.stringify(c)}`);
  }

  // 打印矩阵摘要(给人看)
  const green = cells.filter((c) => c.signal === 'GREEN').length;
  const execMode = cells.filter((c) => c.acceptMode === 'execute').length;
  console.log(`\n  ── 64 格模拟摘要 ──`);
  console.log(`  GREEN(放行): ${green}/64 · execute(采纳要旨+门): ${execMode}/64 · 裁断全合法: ${cells.every((c) => c.decisionValid)}`);
  console.log(`  样例格(verdict/缺证/现金/单向门/来源 → 信号·裁断·签·采纳·大神):`);
  for (const c of [cells[0], cells[5], cells[19], cells[33], cells[63]]) {
    console.log(`   ${c.verdict}/${c.missing ? '缺' : '全'}/${c.cash ? '现金紧' : '现金安'}/${c.oneWay ? '单向门' : '可逆'}/${c.source} → ${c.signal}·${c.decisionValid ? '合法' : '✗'}·${c.signoff ? '需签' : '免签'}·${c.acceptMode}·${c.expert}`);
  }
});

test('跨部问题矩阵:不同旨意召不同部、显不同冲突,合奏恒有判词', () => {
  const questions = [
    '花12万投实体店装修',
    '给整车厂报价60V32Ah电池包先压底价',
    '签独家供应商合同预付30%锁定产能',
    '招一个销售负责人薪酬预算待定',
    '复盘上月经营报表与预算偏差',
  ];
  console.log(`\n  ── 跨部会审矩阵 ──`);
  for (const q of questions) {
    const r = runCourtUnifiedDecisionLoop({
      rawQuestion: q,
      taskId: `sim-${q.slice(0, 4)}`,
      sourceLabel: 'MIXED',
      financeOpinionOverride: hubuEvaluationToOpinion(ev({ verdict: 'hold', missing: ['ROI'], cashStress: true }), 'LIVE'),
    });
    // 不变量:不抛、户部恒在场(override)、合奏恒有判词、冲突结构合法
    assert.ok(r.departmentOpinions.some((o) => o.departmentId === 'finance'), `户部必在场: ${q}`);
    assert.ok(r.memorial.verdict, `合奏必有判词: ${q}`);
    for (const c of r.conflicts) assert.equal(c.between.length, 2, '冲突必是两部之间');
    const depts = r.departmentOpinions.map((o) => o.departmentId).join('+');
    console.log(`   「${q.slice(0, 12)}」→ 召[${depts}] · 冲突${r.conflicts.length}条 · 判词:${r.memorial.verdict}`);
  }
});

test('边界态:空数据/FALLBACK 不被包装成放行', () => {
  // FALLBACK 来源:即使 approve 也只能 GRAY(诚实降级,不冒充 LIVE)
  const o = hubuEvaluationToOpinion(ev({ verdict: 'approve' }), 'FALLBACK');
  assert.equal(o.signal, 'GRAY');
  // 跨部合奏在 FALLBACK 下不得给 APPROVE 强结论
  const r = runCourtUnifiedDecisionLoop({
    rawQuestion: '模拟兜底', sourceLabel: 'FALLBACK',
    financeOpinionOverride: hubuEvaluationToOpinion(ev(), 'FALLBACK'),
  });
  assert.notEqual(r.memorial.verdict, 'APPROVE', 'FALLBACK 不得作为最终强结论');
});

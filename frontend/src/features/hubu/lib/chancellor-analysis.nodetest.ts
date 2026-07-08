import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeForChancellor, pickHeroProject } from './chancellor-analysis.ts';
import type { HubuEvaluation } from './hubu-engines.ts';
import type { HubuProject } from '../../../lib/contracts/hubu.ts';

function project(over: Partial<HubuProject> = {}): HubuProject {
  return {
    id: 'p1', title: '花12万投实体店装修', target_dept: 'finance', owner_dept: 'finance',
    status: 'pending_review', requested_budget: '12万', estimated_roi: '2x', payback_window: '8个月',
    cash_flow_pressure: '—', priority: 'P1', risk_level: 'medium', recommendation: '', command: '',
    acceptance_criteria: [], created_at: '', updated_at: '', ...over,
  };
}

function ev(over: Partial<HubuEvaluation> = {}): HubuEvaluation {
  return {
    budgetYuan: 120000, roiMultiple: 2, exposure: 30, score: 70, verdict: 'approve', verdictCn: '准奏',
    quadrant: 'prefer', oneWayDoor: { oneWay: false, reasons: [] }, missing: [], cashStress: false,
    cashNote: null, quality: { grounded: 3, total: 3, missing: 0 },
    explain: { roi: '', exposure: '', score: '', verdict: '' }, ...over,
  };
}

// ── 铁律4 回归:震撼门绝不给样本/空数据镀金 ──
test('pickHeroProject([]) → null(空数据不镀金 · 贝索斯警示)', () => {
  assert.equal(pickHeroProject([]), null);
});

test('pickHeroProject 取最急那件(P0 优先于 P1)', () => {
  const p0 = project({ id: 'a', priority: 'P0', risk_level: 'high' });
  const p1 = project({ id: 'b', priority: 'P1', risk_level: 'low' });
  assert.equal(pickHeroProject([p1, p0])?.id, 'a');
});

// ── Claude Code DNA:受理回执 + 可验证目标 ──
test('受理回执:把命令式翻成含预算的可验证目标', () => {
  const a = analyzeForChancellor(project({ requested_budget: '50万' }), ev());
  assert.match(a.goal, /是否值得投 50万/);
  assert.ok(a.acceptance.some((x) => /回报需 ≥ 1x/.test(x)), '验收标准必含不亏本底线');
});

// ── 分析计划状态由真实裁决驱动 ──
test('缺证时核证/标缺证步骤为 warn,无缺证为 done', () => {
  const warn = analyzeForChancellor(project(), ev({ missing: ['预期回报/ROI'], quality: { grounded: 2, total: 3, missing: 1 } }));
  const coreCheck = warn.plan.find((s) => s.step === '核证');
  const flag = warn.plan.find((s) => s.step === '标缺证');
  assert.equal(coreCheck?.status, 'warn');
  assert.equal(flag?.status, 'warn');

  const clean = analyzeForChancellor(project(), ev());
  assert.equal(clean.plan.find((s) => s.step === '核证')?.status, 'done');
  assert.equal(clean.plan.find((s) => s.step === '标缺证')?.status, 'done');
});

// ── 缺证 → 可执行下一步 ──
test('每条缺证生成一条可执行补证动作', () => {
  const a = analyzeForChancellor(project(), ev({ missing: ['ROI', '目标售价'] }));
  assert.equal(a.missingActions.filter((m) => /ROI|售价/.test(m.label)).length, 2);
});

// ── 大神视角按最大风险匹配(单向门 > 现金 > 缺证 > 齐了) ──
test('单向门 → 芒格+塔勒布,且验收含亲裁', () => {
  const a = analyzeForChancellor(project(), ev({ oneWayDoor: { oneWay: true, reasons: ['对外承诺'] } }));
  assert.match(a.expert.who, /芒格/);
  assert.ok(a.acceptance.some((x) => /亲裁/.test(x)));
});

test('现金压力 → 贝索斯(优先级高于缺证)', () => {
  const a = analyzeForChancellor(project(), ev({ cashStress: true, missing: ['ROI'] }));
  assert.match(a.expert.who, /贝索斯/);
});

test('仅缺证(无单向门/现金) → deming', () => {
  const a = analyzeForChancellor(project(), ev({ missing: ['ROI'] }));
  assert.match(a.expert.who, /deming/);
});

test('数据齐全 → 张小龙(防冲动批)', () => {
  const a = analyzeForChancellor(project(), ev());
  assert.match(a.expert.who, /张小龙/);
});

// ── 确定性:同输入同输出(Karpathy 流水线,非自由发挥) ──
test('确定性:同输入两次调用结果全等', () => {
  const p = project({ priority: 'P0' });
  const e = ev({ missing: ['ROI'], cashStress: true });
  assert.deepEqual(analyzeForChancellor(p, e), analyzeForChancellor(p, e));
});

// ── 永远可拒 ──
test('始终带"可拒/可撤销"安全网', () => {
  const a = analyzeForChancellor(project(), ev());
  assert.match(a.rejectable, /可驳回|可撤销/);
});

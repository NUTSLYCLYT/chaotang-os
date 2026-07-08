import test from 'node:test';
import assert from 'node:assert/strict';

import { hubuEvaluationToOpinion } from './hubu-opinion-bridge.ts';
import type { HubuEvaluation } from './hubu-engines.ts';

function ev(over: Partial<HubuEvaluation> = {}): HubuEvaluation {
  return {
    budgetYuan: 120000, roiMultiple: 2, exposure: 30, score: 70, verdict: 'approve', verdictCn: '准奏',
    quadrant: 'prefer', oneWayDoor: { oneWay: false, reasons: [] }, missing: [], cashStress: false,
    cashNote: null, quality: { grounded: 3, total: 3, missing: 0 },
    explain: { roi: '', exposure: '', score: '', verdict: '' }, ...over,
  };
}

test('数据齐全 + approve + LIVE → GREEN/APPROVE', () => {
  const o = hubuEvaluationToOpinion(ev(), 'LIVE');
  assert.equal(o.signal, 'GREEN');
  assert.equal(o.verdict, 'APPROVE');
  assert.equal(o.departmentId, 'finance');
});

test('铁律4:缺证 → 绝不 GREEN/APPROVE', () => {
  const o = hubuEvaluationToOpinion(ev({ verdict: 'approve', missing: ['ROI'], quality: { grounded: 2, total: 3, missing: 1 } }), 'LIVE');
  assert.notEqual(o.signal, 'GREEN');
  assert.notEqual(o.verdict, 'APPROVE');
  assert.deepEqual(o.missingEvidence, ['ROI']);
});

test('铁律4:单向门 → RED/RECHECK + 需人工确认 + 风险显形', () => {
  const o = hubuEvaluationToOpinion(ev({ oneWayDoor: { oneWay: true, reasons: ['对外承诺'] } }), 'LIVE');
  assert.equal(o.signal, 'RED');
  assert.equal(o.verdict, 'RECHECK');
  assert.equal(o.needsHumanConfirmation, true);
  assert.ok(o.risks.some((r) => /单向门/.test(r)));
});

test('铁律4:现金压力 → 不放行 + 风险含现金断流', () => {
  const o = hubuEvaluationToOpinion(ev({ cashStress: true }), 'LIVE');
  assert.notEqual(o.signal, 'GREEN');
  assert.ok(o.risks.some((r) => /现金断流/.test(r)));
  assert.equal(o.needsHumanConfirmation, true);
});

test('reject → RED/REJECT', () => {
  const o = hubuEvaluationToOpinion(ev({ verdict: 'reject' }), 'LIVE');
  assert.equal(o.signal, 'RED');
  assert.equal(o.verdict, 'REJECT');
});

test('FALLBACK 来源 → GRAY(不冒充真信号)', () => {
  const o = hubuEvaluationToOpinion(ev(), 'FALLBACK');
  assert.equal(o.signal, 'GRAY');
});

test('确定性:同输入两次全等', () => {
  const e = ev({ cashStress: true, missing: ['ROI'] });
  assert.deepEqual(hubuEvaluationToOpinion(e, 'LIVE'), hubuEvaluationToOpinion(e, 'LIVE'));
});

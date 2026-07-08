/**
 * 钦天监尾部审计原语回归断言(铁律4)。跑: pnpm test:node
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  computeCycleHeat,
  streakToDanger,
  assessRuin,
  SIGNAL_WEIGHTS,
  type CycleSignals,
  type DeathCondition,
} from './tail-audit.ts';

const zeroSignals: CycleSignals = {
  correlationToOne: 0,
  winStreakDanger: 0,
  replicationAccel: 0,
  valuationHeat: 0,
  evidenceDeficit: 0,
};

// ── 逆周期温度计 ──
test('温度计:全冷信号→0分常温档,审查旋钮全松', () => {
  const h = computeCycleHeat(zeroSignals);
  assert.equal(h.score, 0);
  assert.equal(h.tier, 'normal');
  assert.equal(h.knobs.forceReverseStress, false);
  assert.equal(h.knobs.p10FloorMultiplier, 1.0);
});

test('温度计:全热信号→100分过热档,p10地板抬高+必跑压测', () => {
  const h = computeCycleHeat({
    correlationToOne: 1, winStreakDanger: 1, replicationAccel: 1, valuationHeat: 1, evidenceDeficit: 1,
  });
  assert.equal(h.score, 100);
  assert.equal(h.tier, 'hot');
  assert.equal(h.knobs.forceReverseStress, true);
  assert.ok(h.knobs.p10FloorMultiplier > 1, 'p10 地板应抬高');
  assert.equal(h.knobs.splitHighCorrelationExposure, true);
});

test('温度计:越顺越热(信号升→档位单调不降)', () => {
  const cold = computeCycleHeat(zeroSignals).score;
  const mid = computeCycleHeat({ ...zeroSignals, correlationToOne: 0.6, winStreakDanger: 0.6 }).score;
  const hotter = computeCycleHeat({ ...zeroSignals, correlationToOne: 1, winStreakDanger: 1, replicationAccel: 1 }).score;
  assert.ok(cold < mid && mid < hotter, `应单调:${cold}<${mid}<${hotter}`);
});

test('温度计:权重相关性奔1与连胜并列最高(各25)', () => {
  assert.equal(SIGNAL_WEIGHTS.correlationToOne, 25);
  assert.equal(SIGNAL_WEIGHTS.winStreakDanger, 25);
  assert.ok(SIGNAL_WEIGHTS.correlationToOne >= SIGNAL_WEIGHTS.replicationAccel);
});

test('连胜危险度:0连胜=0,越长越近1且单调饱和', () => {
  assert.equal(streakToDanger(0), 0);
  assert.ok(streakToDanger(4) > 0.5 && streakToDanger(4) < 0.7);
  assert.ok(streakToDanger(20) > 0.9 && streakToDanger(20) < 1);
  assert.ok(streakToDanger(8) > streakToDanger(4), '单调');
});

// ── 死法地图 ──
const deaths: DeathCondition[] = [
  { description: '现金流断', alreadyTrue: true },
  { description: '大客户流失', alreadyTrue: false },
  { description: '监管收紧', alreadyTrue: false },
];

test('死法地图:无 ruin 红线→pass,但报"离死多近"', () => {
  const r = assessRuin(deaths, { irreversiblePayment: false, blastRadiusOverThreshold: false, externalCommitment: false });
  assert.equal(r.verdict, 'pass');
  assert.equal(r.redlinesHit.length, 0);
  assert.equal(r.conditionsAlreadyMet, 1);
  assert.equal(r.totalConditions, 3);
});

test('死法地图:任一 ruin 红线(不可逆付款)即一票否决,不看期望收益', () => {
  const r = assessRuin(deaths, { irreversiblePayment: true, blastRadiusOverThreshold: false, externalCommitment: false });
  assert.equal(r.verdict, 'veto');
  assert.ok(r.redlinesHit.some((x) => x.includes('亏不起')));
});

test('死法地图:三条红线全踩→veto且全部列出', () => {
  const r = assessRuin([], { irreversiblePayment: true, blastRadiusOverThreshold: true, externalCommitment: true });
  assert.equal(r.verdict, 'veto');
  assert.equal(r.redlinesHit.length, 3);
});

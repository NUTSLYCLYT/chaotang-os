/**
 * 储君考绩 · 册封就绪度仪表 + 褫夺程序(测试 + 仪表打印)
 *
 * 测机器:册封门、致命零容忍褫夺、四使观察、丞相回避不能独证、诚实校准。
 * 打仪表:当前真就绪度(真兑现回填 P2 未接通前 = 0/N,诚实显示差距,非空转)。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assessReadiness,
  assessDethrone,
  type CrownPrinceCaseRecord,
} from './crown-prince-track-record.ts';

function rec(over: Partial<CrownPrinceCaseRecord> = {}): CrownPrinceCaseRecord {
  return {
    caseId: 'c', riskClass: 'reversible', highStakes: false, outcome: 'matched',
    predictionConfidence: 'medium', concededWhenOverruled: true,
    yushiEvidenceFabricated: false, qintianRuinMissed: false,
    irreversibleMisApproved: false, jinyiweiAnomaly: false, ...over,
  };
}

/** 造一批"干净达标"的真案(N 件,含高风险覆盖)。 */
function cleanCases(n: number): CrownPrinceCaseRecord[] {
  return Array.from({ length: n }, (_, i) =>
    rec({ caseId: `ok-${i}`, highStakes: i % 5 === 0, riskClass: i % 5 === 0 ? 'irreversible' : 'reversible' }),
  );
}

// ── 册封正路 ──
test('30 干净达标真案 → 就绪 ready=true · score 高', () => {
  const r = assessReadiness(cleanCases(30));
  assert.equal(r.deposed, false);
  assert.equal(r.ready, true);
  assert.ok(r.score >= 90, `score=${r.score}`);
  assert.equal(r.independentlyCertified, true);
});

// ── 褫夺:致命零容忍(先写褫夺,芒格) ──
test('死法地图漏判 1 次 → 立即褫夺 · 就绪度清零', () => {
  const cases = [...cleanCases(40), rec({ caseId: 'ruin', qintianRuinMissed: true })];
  assert.equal(assessDethrone(cases).deposed, true);
  const r = assessReadiness(cases);
  assert.equal(r.deposed, true);
  assert.equal(r.ready, false);
  assert.equal(r.score, 0, '致命错误就绪度必须清零,40 案也救不回');
});

test('不可逆"该否未否" → 立即褫夺', () => {
  const r = assessReadiness([...cleanCases(40), rec({ caseId: 'irr', irreversibleMisApproved: true })]);
  assert.equal(r.deposed, true);
  assert.equal(r.ready, false);
});

test('御史查实证据造假 → 褫夺 + 独立联署不过', () => {
  const cases = [...cleanCases(40), rec({ caseId: 'fake', yushiEvidenceFabricated: true })];
  const r = assessReadiness(cases);
  assert.equal(r.deposed, true);
  assert.equal(r.independentlyCertified, false);
  assert.equal(r.ready, false);
});

test('锦衣卫查实作弊异动 → 褫夺 + 独立联署不过', () => {
  const r = assessReadiness([...cleanCases(40), rec({ caseId: 'cheat', jinyiweiAnomaly: true })]);
  assert.equal(r.deposed, true);
  assert.equal(r.independentlyCertified, false);
});

// ── 诚实校准(Russell:敢让步才敢给手) ──
test('高信心却判错 → 诚实校准不过 → 不册封', () => {
  const cases = [...cleanCases(30), rec({ caseId: 'overconf', outcome: 'mismatched', predictionConfidence: 'high', concededWhenOverruled: true })];
  const r = assessReadiness(cases);
  assert.equal(r.deposed, false, '高信心错判不是致命褫夺,但');
  assert.equal(r.honestCalibration, false);
  assert.equal(r.ready, false, '诚实校准不过不得册封');
});

test('被否拒不认错 → 诚实校准不过', () => {
  const r = assessReadiness([...cleanCases(30), rec({ caseId: 'stub', outcome: 'mismatched', predictionConfidence: 'low', concededWhenOverruled: false })]);
  assert.equal(r.honestCalibration, false);
  assert.equal(r.ready, false);
});

// ── 案量/覆盖门 ──
test('真案不足 → 未就绪 + 阻塞列明', () => {
  const r = assessReadiness(cleanCases(10));
  assert.equal(r.ready, false);
  assert.ok(r.blockers.some((b) => /10\/30/.test(b)));
});

test('只考送分题(无高风险覆盖)→ 不就绪(芒格:不能只过送分题)', () => {
  const lowOnly = Array.from({ length: 30 }, (_, i) => rec({ caseId: `low-${i}`, highStakes: false, riskClass: 'reversible' }));
  const r = assessReadiness(lowOnly);
  assert.equal(r.highStakesCovered, false);
  assert.equal(r.ready, false);
});

// ── 当前真状态(0 真案)──
test('零真案(当前态)→ 就绪度 0% · 诚实显差距,不空转', () => {
  const r = assessReadiness([]);
  assert.equal(r.casesAccumulated, 0);
  assert.equal(r.agreementRate, null);
  assert.equal(r.ready, false);
  assert.equal(r.score, 0);
});

// ── 仪表打印(给人看)──
test('册封就绪度仪表 · 当前态 + 达标样例', () => {
  const now = assessReadiness([]); // 真兑现 P2 未接通 → 0 真案
  const demo = assessReadiness(cleanCases(30)); // 达标长什么样
  const fmt = (r: ReturnType<typeof assessReadiness>) =>
    `就绪度 ${r.score}% · 已积 ${r.casesAccumulated}/${r.requiredCases} 真案 · 一致率 ${r.agreementRate === null ? '—' : Math.round(r.agreementRate * 100) + '%'}(需 ${Math.round(r.requiredRate * 100)}%) · 死法漏判 ${r.ruinMisses} · 独立联署 ${r.independentlyCertified ? '✓' : '待'} · ${r.ready ? '可册封' : '未就绪'}`;
  console.log(`\n  ── 册封就绪度仪表 ──`);
  console.log(`  【当前】${fmt(now)}`);
  console.log(`         阻塞:${now.blockers.join(' | ')}`);
  console.log(`         注:真兑现回填(P2)未接通,这是框架就绪度;接 P2 后每兑现一案自动累进。`);
  console.log(`  【达标样例】${fmt(demo)}`);
  console.log(`  褫夺条款(致命零容忍·任一即废):死法漏判 / 不可逆该否未否 / 御史证据造假 / 锦衣卫作弊异动`);
  assert.equal(now.score, 0);
  assert.equal(demo.ready, true);
});

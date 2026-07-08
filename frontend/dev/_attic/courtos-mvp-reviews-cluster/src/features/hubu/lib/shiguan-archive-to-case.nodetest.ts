/**
 * 史馆→考绩 adapter + 军机处历史基线诚实性(测试)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { shiguanArchiveToCrownPrinceCase, shiguanArchivesToCases, type ShiguanArchiveInput } from './shiguan-archive-to-case.ts';
import { assessReadiness } from './crown-prince-track-record.ts';

function arc(over: Partial<ShiguanArchiveInput> & { verdict?: string; signal?: string; flags?: string[] } = {}): ShiguanArchiveInput {
  const { verdict, signal, flags, ...rest } = over;
  return {
    id: 'a1',
    retrospective_status: 'not_started',
    archive: { learning_record: { verdict, overallSignal: signal }, risk_flags: flags },
    ...rest,
  };
}

// ── 来源诚实:历史一律 court ──
test('史馆历史一律标 court(不冒充太子自预测)', () => {
  const c = shiguanArchiveToCrownPrinceCase(arc());
  assert.equal(c.predictorSource, 'court');
});

// ── 结果矩阵 ──
test('not_started → pending', () => {
  assert.equal(shiguanArchiveToCrownPrinceCase(arc({ retrospective_status: 'not_started' })).outcome, 'pending');
});
test('达成 + APPROVE → matched', () => {
  assert.equal(shiguanArchiveToCrownPrinceCase(arc({ retrospective_status: '达成', verdict: 'APPROVE' })).outcome, 'matched');
});
test('达成 + REJECT → mismatched(说别做却成了)', () => {
  assert.equal(shiguanArchiveToCrownPrinceCase(arc({ retrospective_status: '达成', verdict: 'REJECT' })).outcome, 'mismatched');
});
test('未达成 + APPROVE → mismatched(说做却没成)', () => {
  assert.equal(shiguanArchiveToCrownPrinceCase(arc({ retrospective_status: '未达成', verdict: 'APPROVE' })).outcome, 'mismatched');
});
test('未达成 + REJECT → matched(说别做,也确实没成)', () => {
  assert.equal(shiguanArchiveToCrownPrinceCase(arc({ retrospective_status: '未达成', verdict: 'REJECT' })).outcome, 'matched');
});
test('部分 → 保守 mismatched', () => {
  assert.equal(shiguanArchiveToCrownPrinceCase(arc({ retrospective_status: '部分', verdict: 'APPROVE' })).outcome, 'mismatched');
});

// ── 风险类推导 ──
test('含不可逆 risk_flag → irreversible + highStakes', () => {
  const c = shiguanArchiveToCrownPrinceCase(arc({ flags: ['legal_commitment_risk'] }));
  assert.equal(c.riskClass, 'irreversible');
  assert.equal(c.highStakes, true);
});
test('无 risk_flag → reversible + 非高风险', () => {
  const c = shiguanArchiveToCrownPrinceCase(arc({ flags: [] }));
  assert.equal(c.riskClass, 'reversible');
  assert.equal(c.highStakes, false);
});

// ── 致命旗标历史回灌恒 false(占位) ──
test('史馆历史四使致命旗标恒 false(无信号,不假造)', () => {
  const c = shiguanArchiveToCrownPrinceCase(arc({ retrospective_status: '达成', verdict: 'REJECT' }));
  assert.equal(c.qintianRuinMissed, false);
  assert.equal(c.yushiEvidenceFabricated, false);
  assert.equal(c.jinyiweiAnomaly, false);
});

// ── 诚实核心:纯军机处历史喂仪表 → 案量涨、太子一致率恒 —、不就绪 ──
test('40 条军机处历史真兑现 → 就绪度仍 0(court 不计册封一致率)', () => {
  const archives = Array.from({ length: 40 }, (_, i) =>
    arc({ id: `h-${i}`, retrospective_status: '达成', verdict: 'APPROVE', flags: i % 5 === 0 ? ['formal_quote_risk'] : [] }),
  );
  const cases = shiguanArchivesToCases(archives);
  const r = assessReadiness(cases);
  assert.equal(r.casesAccumulated, 0, '太子自预测案=0(全是 court 历史)');
  assert.equal(r.agreementRate, null, '太子一致率必须为 null,不被军机处成绩冒充');
  assert.equal(r.courtBaselineCases, 40, '军机处基线案量应显 40');
  assert.equal(r.courtCalibrationRate, 1, '军机处校准率(基线)可算');
  assert.equal(r.ready, false, '再多军机处历史也册封不了太子');
  assert.equal(r.score, 0);
});

// ── 仪表打印:接真史馆后的诚实态 ──
test('仪表 · 军机处基线 + 太子就绪(演示)', () => {
  const history = Array.from({ length: 41 }, (_, i) =>
    arc({ id: `court-${i}`, retrospective_status: i < 30 ? '达成' : 'not_started', verdict: 'APPROVE' }),
  );
  const r = assessReadiness(shiguanArchivesToCases(history));
  console.log(`\n  ── 册封就绪度仪表(接真史馆历史)──`);
  console.log(`  太子:就绪度 ${r.score}% · 自预测真兑现 ${r.casesAccumulated}/${r.requiredCases} · 一致率 ${r.agreementRate === null ? '—(尚无太子自预测)' : Math.round(r.agreementRate * 100) + '%'} · ${r.ready ? '可册封' : '未就绪'}`);
  console.log(`  军机处基线(灰显·不计册封):已回填 ${r.courtBaselineCases} 案 · 系统校准率 ${r.courtCalibrationRate === null ? '—' : Math.round(r.courtCalibrationRate * 100) + '%'}`);
  console.log(`  阻塞:${r.blockers.join(' | ')}`);
  console.log(`  诚实:军机处历史只填基线;太子未下过一注,一致率恒 — → 唯一解锁=第一条太子自预测真兑现。`);
  assert.equal(r.agreementRate, null);
  assert.ok(r.courtBaselineCases > 0);
});

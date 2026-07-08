import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastPriceTrend, forecastNewEnergyTopic, filterNewEnergySignals } from './price-forecast.ts';
import type { IntelSignal } from '../../../lib/contracts/intel.ts';

function makeSignal(overrides: Partial<IntelSignal> & Pick<IntelSignal, 'id' | 'title' | 'summary'>): IntelSignal {
  return {
    category: 'neutral',
    level: 'info',
    region: 'CN',
    regionLabel: '中国',
    industry: '新能源',
    credibility: 'medium',
    sources: [{ name: '测试来源', publishedAt: '2026-07-01T00:00:00Z' }],
    firstSeenAt: '2026-07-01T00:00:00Z',
    lastUpdatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

test('多信号同向(价库涨+行业反弹+旺季)→上行 medium + 锁价', () => {
  const f = forecastPriceTrend({ material: '电芯', libraryTrend: 'up', industryNotes: ['碳酸锂价近期反弹'], deptNotes: ['旺季备货'] });
  assert.equal(f.direction, 'up');
  assert.equal(f.confidence, 'medium');
  assert.equal(f.reasons.length, 3);
  assert.match(f.advice, /锁价/);
  assert.equal(f.label, '预测·非真价'); // 永远🟡
});

test('行业回落→下行 + 观望', () => {
  const f = forecastPriceTrend({ material: '铜排', industryNotes: ['铜价回落'] });
  assert.equal(f.direction, 'down');
  assert.match(f.advice, /观望|分批/);
});

test('无任何信号→unknown(不瞎判方向)', () => {
  const f = forecastPriceTrend({ material: '某料' });
  assert.equal(f.direction, 'unknown');
  assert.match(f.advice, /不瞎判|询真价/);
});

test('涨跌抵消→stable;每条理由带来源', () => {
  const f = forecastPriceTrend({ material: '电芯', industryNotes: ['锂价上涨'], deptNotes: ['淡季减产'] });
  assert.equal(f.direction, 'stable');
  assert.ok(f.reasons.every((r) => r.source.length > 0));
});

test('红线:confidence永不为high', () => {
  const f = forecastPriceTrend({ material: '电芯', libraryTrend: 'up', industryNotes: ['涨','紧缺','涨价'], deptNotes: ['旺季','扩产'] });
  assert.notEqual(f.confidence as string, 'high');
});

test('无信号→confidence诚实降为unknown(非low)', () => {
  const f = forecastPriceTrend({ material: '某料' });
  assert.equal(f.confidence, 'unknown');
});

test('falsifiedBy 无信号时说明"未成立"，不是空话', () => {
  const f = forecastPriceTrend({ material: '某料' });
  assert.match(f.falsifiedBy, /未成立|没有.*信号/);
});

test('falsifiedBy 引用真实理由文本与来源，随理由变化(证伪性非模板复读)', () => {
  const up = forecastPriceTrend({ material: '电芯', industryNotes: ['碳酸锂价近期反弹'] });
  const down = forecastPriceTrend({ material: '电芯', industryNotes: ['铜价回落'] });
  assert.match(up.falsifiedBy, /上行/);
  assert.match(down.falsifiedBy, /下行/);
  assert.notEqual(up.falsifiedBy, down.falsifiedBy);
  assert.match(up.falsifiedBy, /锦衣卫行业情报/);
});

test('industrySignals 保留 signalId→citedSignalIds 去重收集', () => {
  const s1 = makeSignal({ id: 'sig_1', title: '电池级碳酸锂价格反弹', summary: '现货价上涨' });
  const s2 = makeSignal({ id: 'sig_2', title: '动力电池出口下跌', summary: '需求走低' });
  const f = forecastPriceTrend({ material: '电芯', industrySignals: [s1, s2] });
  assert.deepEqual([...f.citedSignalIds].sort(), ['sig_1', 'sig_2']);
  assert.ok(f.reasons.some((r) => r.signalId === 'sig_1'));
});

test('filterNewEnergySignals 只留电池/新能源相关，剔除无关信号', () => {
  const relevant = makeSignal({ id: 'sig_a', title: '锂电池新增产能', summary: '扩产落地' });
  const unrelated = makeSignal({ id: 'sig_b', title: '欧盟 AI Act 配套细则加速落地', summary: 'AI 监管', industry: 'AI / 监管' });
  const filtered = filterNewEnergySignals([relevant, unrelated]);
  assert.deepEqual(filtered.map((s) => s.id), ['sig_a']);
});

test('forecastNewEnergyTopic 任意话题+全量信号→自动筛相关信号并生成预测', () => {
  const relevant = makeSignal({ id: 'sig_c', title: '新能源车电池装机量紧缺', summary: '供不应求' });
  const unrelated = makeSignal({ id: 'sig_d', title: '欧盟 AI Act 配套细则加速落地', summary: 'AI 监管', industry: 'AI / 监管' });
  const f = forecastNewEnergyTopic('电动车电池产业趋势', [relevant, unrelated]);
  assert.equal(f.direction, 'up');
  assert.deepEqual(f.citedSignalIds, ['sig_c']);
});

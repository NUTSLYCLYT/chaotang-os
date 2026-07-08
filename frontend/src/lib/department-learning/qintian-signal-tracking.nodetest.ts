import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQintianPredictionRecord,
  computeSignalSourceReliability,
  qintianPredictionRecordId,
} from './qintian-signal-tracking.ts';
import { forecastPriceTrend, forecastNewEnergyTopic } from '../../features/qintian/lib/price-forecast.ts';
import type { DepartmentLearningRecord } from '../contracts/department-learning.ts';
import type { IntelSignal } from '../contracts/intel.ts';

function makeSignal(overrides: Partial<IntelSignal> & Pick<IntelSignal, 'id' | 'title' | 'summary'>): IntelSignal {
  return {
    category: 'neutral',
    level: 'info',
    region: 'CN',
    regionLabel: '中国',
    industry: '新能源',
    credibility: 'medium',
    sources: [{ name: '测试来源A', publishedAt: '2026-07-01T00:00:00Z' }],
    firstSeenAt: '2026-07-01T00:00:00Z',
    lastUpdatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function makeRecord(overrides: Partial<DepartmentLearningRecord>): DepartmentLearningRecord {
  return {
    id: 'r1',
    agentCode: 'qin_tian_jian',
    agentName: '钦天监',
    calibrationTarget: 'test',
    metricName: 'forecast_trigger_hit_rate',
    sourceLabel: 'PRIMARY',
    verdict: 'observing',
    dueAt: '2026-08-01T00:00:00Z',
    nextLesson: '',
    calibrationDelta: '',
    evidence: [],
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

test('qintianPredictionRecordId 同一话题产生同一 id(去重覆盖，不无限堆积)', () => {
  assert.equal(qintianPredictionRecordId('电动车电池产业趋势'), qintianPredictionRecordId('电动车电池产业趋势'));
  assert.notEqual(qintianPredictionRecordId('话题A'), qintianPredictionRecordId('话题B'));
});

test('buildQintianPredictionRecord verdict 恒为 observing，citedSignalIds 透传', () => {
  const s1 = makeSignal({ id: 'sig_1', title: '动力电池紧缺', summary: '供不应求' });
  const forecast = forecastNewEnergyTopic('电动车电池趋势', [s1]);
  const record = buildQintianPredictionRecord('电动车电池趋势', forecast);
  assert.equal(record.verdict, 'observing');
  assert.equal(record.agentCode, 'qin_tian_jian');
  assert.deepEqual(record.citedSignalIds, ['sig_1']);
  assert.equal(record.sourceLabel, 'PRIMARY'); // 有真信号引用
});

test('buildQintianPredictionRecord 无引用信号时 sourceLabel 退回 RULE_SEED', () => {
  const forecast = forecastPriceTrend({ material: '某话题' });
  const record = buildQintianPredictionRecord('某话题', forecast);
  assert.equal(record.sourceLabel, 'RULE_SEED');
  assert.deepEqual(record.citedSignalIds, []);
});

test('computeSignalSourceReliability 样本不足→reliabilityRate 为 null(不编0%/NaN)', () => {
  const signals = [makeSignal({ id: 'sig_1', title: 't', summary: 's', sources: [{ name: '路透社', publishedAt: '2026-07-01T00:00:00Z' }] })];
  const records = [makeRecord({ id: 'r1', verdict: 'observing', citedSignalIds: ['sig_1'] })];
  const rollup = computeSignalSourceReliability(records, signals);
  assert.equal(rollup.length, 1);
  assert.equal(rollup[0]!.source, '路透社');
  assert.equal(rollup[0]!.reliabilityRate, null);
  assert.equal(rollup[0]!.totalCitations, 1);
});

test('computeSignalSourceReliability 按来源正确统计 confirmed/refuted 比例', () => {
  const signals = [
    makeSignal({ id: 'sig_1', title: 't1', summary: 's1', sources: [{ name: '路透社', publishedAt: '2026-07-01T00:00:00Z' }] }),
    makeSignal({ id: 'sig_2', title: 't2', summary: 's2', sources: [{ name: '彭博', publishedAt: '2026-07-01T00:00:00Z' }] }),
  ];
  const records = [
    makeRecord({ id: 'r1', verdict: 'confirmed', citedSignalIds: ['sig_1'] }),
    makeRecord({ id: 'r2', verdict: 'refuted', citedSignalIds: ['sig_1'] }),
    makeRecord({ id: 'r3', verdict: 'confirmed', citedSignalIds: ['sig_1'] }),
    makeRecord({ id: 'r4', verdict: 'confirmed', citedSignalIds: ['sig_2'] }),
  ];
  const rollup = computeSignalSourceReliability(records, signals);
  const reuters = rollup.find((r) => r.source === '路透社')!;
  const bloomberg = rollup.find((r) => r.source === '彭博')!;
  assert.equal(reuters.confirmed, 2);
  assert.equal(reuters.refuted, 1);
  assert.equal(reuters.reliabilityRate, Number((2 / 3).toFixed(4)));
  assert.equal(bloomberg.reliabilityRate, 1);
});

test('computeSignalSourceReliability 忽略无 citedSignalIds 的记录(非钦天监预测触发)', () => {
  const signals = [makeSignal({ id: 'sig_1', title: 't', summary: 's' })];
  const records = [makeRecord({ id: 'r1', verdict: 'confirmed', citedSignalIds: undefined })];
  const rollup = computeSignalSourceReliability(records, signals);
  assert.equal(rollup.length, 0);
});

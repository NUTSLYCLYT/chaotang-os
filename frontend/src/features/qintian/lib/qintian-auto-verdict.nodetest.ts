/**
 * 任务5/6/7 回归断言(2026-07-04)：证伪自动生效 / 预测过期 / 锦衣卫反查引用。
 * node --test strip-types 跑(test:core)。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { citedSourcesContradict } from './price-forecast.ts';
import { effectiveVerdict } from '../../../lib/department-learning/qintian-signal-tracking.ts';
import { auditQintianCitations } from '../../../lib/jinyiwei/qintian-citation-audit.ts';
import type { IntelSignal } from '../../../lib/contracts/intel.ts';
import type { DepartmentLearningRecord } from '../../../lib/contracts/department-learning.ts';

const sig = (id: string, source: string, title: string, summary: string): IntelSignal =>
  ({ id, title, summary, industry: '新能源', firstSeenAt: '2026-07-01T00:00:00Z', sources: [{ name: source }] } as unknown as IntelSignal);

const rec = (over: Partial<DepartmentLearningRecord>): DepartmentLearningRecord =>
  ({
    id: 'qintian_prediction_碳酸锂',
    calibrationTarget: '「碳酸锂」⬆️ 大概率上行预测是否兑现',
    verdict: 'observing',
    dueAt: '2999-01-01T00:00:00Z',
    citedSignalIds: ['s1'],
    ...over,
  } as unknown as DepartmentLearningRecord);

// 任务5：引用来源冒出反向信号 → 证伪；同向不误触发
test('citedSourcesContradict: up 预测遇同来源下跌信号即证伪', () => {
  const latest = [sig('s1', '上交所', '碳酸锂紧缺', '碳酸锂价格上涨'), sig('s2', '上交所', '碳酸锂回落', '碳酸锂价格回落')];
  assert.equal(citedSourcesContradict('up', ['s1'], latest), true);
});
test('citedSourcesContradict: 只有原同向信号时不误触发', () => {
  const latest = [sig('s1', '上交所', '碳酸锂紧缺', '碳酸锂价格上涨')];
  assert.equal(citedSourcesContradict('up', ['s1'], latest), false);
});
test('citedSourcesContradict: 别的来源的反向信号不算(只认引用来源)', () => {
  const latest = [sig('s1', '上交所', '碳酸锂紧缺', '上涨'), sig('s9', '某小号', '碳酸锂跳水', '跳水')];
  assert.equal(citedSourcesContradict('up', ['s1'], latest), false);
});

// 任务6：过 dueAt 未定论 → stale；未过 → observing；已定论不动
test('effectiveVerdict: 过期未定论标 stale', () => {
  const latest = [sig('s1', '上交所', '碳酸锂紧缺', '上涨')];
  assert.equal(effectiveVerdict(rec({ dueAt: '2000-01-01T00:00:00Z' }), latest).verdict, 'stale');
});
test('effectiveVerdict: 证伪优先于过期，且 reason 带触发信号', () => {
  const latest = [sig('s1', '上交所', '碳酸锂紧缺', '上涨'), sig('s2', '上交所', '碳酸锂回落', '回落')];
  const result = effectiveVerdict(rec({ dueAt: '2000-01-01T00:00:00Z' }), latest);
  assert.equal(result.verdict, 'refuted');
  assert.ok(result.reason.includes('上交所') && result.reason.includes('碳酸锂回落'), result.reason);
});
test('effectiveVerdict: 已 confirmed 的记录不被翻动', () => {
  const latest = [sig('s2', '上交所', '碳酸锂回落', '回落')];
  assert.equal(effectiveVerdict(rec({ verdict: 'confirmed', citedSignalIds: ['s1'] }), latest).verdict, 'confirmed');
});
test('effectiveVerdict: observing 时 reason 为空', () => {
  const latest = [sig('s1', '上交所', '碳酸锂紧缺', '上涨')];
  assert.equal(effectiveVerdict(rec({}), latest).reason, '');
});

// 任务7：引用的信号最新流里没有 → missing
test('auditQintianCitations: 引用了已消失的信号即 not clean', () => {
  const latest = [sig('s1', '上交所', '碳酸锂紧缺', '上涨')];
  const audits = auditQintianCitations([rec({ citedSignalIds: ['s1', 'sX'] })], latest);
  assert.equal(audits.length, 1);
  assert.deepEqual(audits[0]!.missingSignalIds, ['sX']);
  assert.equal(audits[0]!.clean, false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceGrade } from './source-grade.ts';
import type { IntelSignal } from '../../../lib/contracts/intel.ts';

function signal(over: Partial<IntelSignal>): IntelSignal {
  return {
    id: 'x', category: 'risk', level: 'warning', title: 't', summary: 's',
    region: 'CN', regionLabel: '中国', industry: '电池', credibility: 'medium',
    sources: [], firstSeenAt: '2026-07-05T00:00:00Z', lastUpdatedAt: '2026-07-05T00:00:00Z',
    ...over,
  };
}

// —— 会审 CRITICAL 回归：真主库行 credibility 被 rowToSignal 硬编码成 'medium'，
//    绝不能因此落 mixed —— 否则默认筛选 'real' 会让真实数据地图空屏 ——
test('turso + credibility=medium(后端桩) → real，不落 mixed（防默认 real 空屏）', () => {
  assert.equal(sourceGrade(signal({ credibility: 'medium' }), 'turso'), 'real');
});

test('turso + high/verified → real', () => {
  assert.equal(sourceGrade(signal({ credibility: 'high' }), 'turso'), 'real');
  assert.equal(sourceGrade(signal({ credibility: 'verified' }), 'turso'), 'real');
});

test('turso + low → mixed（唯一降级到 mixed 的路径）', () => {
  assert.equal(sourceGrade(signal({ credibility: 'low' }), 'turso'), 'mixed');
});

test('fallback 源 → 一律 fallback（演示样例）', () => {
  assert.equal(sourceGrade(signal({ credibility: 'verified' }), 'fallback'), 'fallback');
  assert.equal(sourceGrade(signal({ credibility: 'medium' }), 'fallback'), 'fallback');
});

// —— 核心不变式：真主库(turso)任何非 low 信号都算 real，保证默认 'real' 筛选不清空 ——
test('turso 非 low 信号恒 real → 默认 real 筛选下必有可见点', () => {
  const turso = [signal({ credibility: 'medium' }), signal({ credibility: 'high' }), signal({ credibility: 'verified' })];
  assert.ok(turso.every((s) => sourceGrade(s, 'turso') === 'real'));
});

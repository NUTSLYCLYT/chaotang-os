/**
 * SourceLabelGuard 单测 · 离线运行（无需 vitest）：
 *   node --experimental-strip-types --test src/core/courtos/source-label.nodetest.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSourceLabel,
  isSourceLabel,
  isLiveLike,
  isFallbackLike,
  mergeTwo,
  mergeSourceLabels,
} from './source-label.ts';

test('isSourceLabel 识别合法/非法', () => {
  assert.equal(isSourceLabel('LIVE'), true);
  assert.equal(isSourceLabel('DEMO'), true);
  assert.equal(isSourceLabel('NOPE'), false);
  assert.equal(isSourceLabel(undefined), false);
});

test('assertSourceLabel 缺失即抛（禁静默）', () => {
  assert.throws(() => assertSourceLabel(undefined));
  assert.throws(() => assertSourceLabel('xxx'));
  assert.doesNotThrow(() => assertSourceLabel('MIXED'));
});

test('isLiveLike / isFallbackLike', () => {
  assert.equal(isLiveLike('LIVE'), true);
  assert.equal(isLiveLike('LIVE_SWARM'), true);
  assert.equal(isLiveLike('MIXED'), false);
  assert.equal(isFallbackLike('FALLBACK'), true);
  assert.equal(isFallbackLike('DEMO'), true);
  assert.equal(isFallbackLike('LIVE'), false);
});

test('mergeTwo worst-wins 语义', () => {
  assert.equal(mergeTwo('LIVE', 'LIVE'), 'LIVE');
  assert.equal(mergeTwo('LIVE', 'LIVE_SWARM'), 'LIVE_SWARM');
  assert.equal(mergeTwo('LIVE', 'FALLBACK'), 'MIXED');
  assert.equal(mergeTwo('LIVE', 'DEMO'), 'MIXED');
  assert.equal(mergeTwo('FALLBACK', 'FALLBACK'), 'FALLBACK');
  assert.equal(mergeTwo('DEMO', 'DEMO'), 'DEMO');
  assert.equal(mergeTwo('FALLBACK', 'DEMO'), 'DEMO');
});

test('mergeSourceLabels 多路聚合', () => {
  assert.equal(mergeSourceLabels(['LIVE', 'LIVE', 'LIVE']), 'LIVE');
  assert.equal(mergeSourceLabels(['LIVE', 'DEMO']), 'MIXED');
  assert.equal(mergeSourceLabels(['LIVE_SWARM', 'FALLBACK']), 'MIXED');
  assert.throws(() => mergeSourceLabels([]));
});

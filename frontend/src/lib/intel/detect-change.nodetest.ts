import assert from 'node:assert/strict';
import test from 'node:test';

import { detectChange } from './detect-change';

test('detectChange finds 新增/消失/持续 by key presence', () => {
  const prev = [{ key: 'a', value: 50 }, { key: 'b', value: 30 }];
  const curr = [{ key: 'a', value: 50 }, { key: 'c', value: 40 }];

  const result = detectChange(prev, curr);
  assert.deepEqual(result.新增, ['c']);
  assert.deepEqual(result.消失, ['b']);
  assert.deepEqual(result.持续, ['a']);
  assert.deepEqual(result.突变, []);
});

test('detectChange flags 突变 when numeric value swings past threshold', () => {
  const prev = [{ key: 'a', value: 50 }];
  const curr = [{ key: 'a', value: 80 }];

  const result = detectChange(prev, curr, 20);
  assert.equal(result.突变.length, 1);
  assert.equal(result.突变[0].reason, 'value');
  assert.equal(result.突变[0].delta, 30);
  assert.deepEqual(result.持续, []);
});

test('detectChange does not flag 突变 when swing is within threshold', () => {
  const prev = [{ key: 'a', value: 50 }];
  const curr = [{ key: 'a', value: 55 }];

  const result = detectChange(prev, curr, 20);
  assert.deepEqual(result.突变, []);
  assert.deepEqual(result.持续, ['a']);
});

test('detectChange falls back to level comparison when no numeric value available', () => {
  const prev = [{ key: 'a', level: 'watch' }];
  const curr = [{ key: 'a', level: 'critical' }];

  const result = detectChange(prev, curr);
  assert.equal(result.突变.length, 1);
  assert.equal(result.突变[0].reason, 'level');
  assert.equal(result.突变[0].delta, null);
  assert.equal(result.突变[0].from, 'watch');
  assert.equal(result.突变[0].to, 'critical');
});

test('detectChange returns all-empty on two empty rounds (honest baseline)', () => {
  const result = detectChange([], []);
  assert.deepEqual(result, { 新增: [], 消失: [], 突变: [], 持续: [] });
});

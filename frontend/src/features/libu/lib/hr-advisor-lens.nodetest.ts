import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adviseLens } from './hr-advisor-lens.ts';
test('辞退→Schneier+Bezos看不可逆法律雷', () => {
  const l = adviseLens('termination');
  assert.ok(l.experts.includes('schneier'));
  assert.match(l.focus, /违法解除|不可逆/);
});
test('期权→Bezos+Taleb单向门尾部', () => {
  assert.ok(adviseLens('equity').experts.includes('taleb'));
});

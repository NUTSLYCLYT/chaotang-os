import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capPerRun } from './gate.ts';
import type { RaiseDraft } from './types';

const mk = (id: string, p: number | null): RaiseDraft => ({
  sourceTaskId: id, command: id, title: id, priority: p, reality: 'real', meta: {},
});

test('capPerRun 取最高优先级 N 条,null 排最后', () => {
  const out = capPerRun([mk('a', 50), mk('b', 90), mk('c', null), mk('d', 70)], { maxPerRun: 2 });
  assert.deepEqual(out.map((d) => d.sourceTaskId), ['b', 'd']);
});

test('capPerRun maxPerRun 0 → 空', () => {
  assert.equal(capPerRun([mk('a', 1)], { maxPerRun: 0 }).length, 0);
});

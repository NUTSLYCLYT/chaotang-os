import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectMaturity } from './project-maturity.ts';
test('成熟度=真/总,给下一步', () => {
  const m = projectMaturity([
    { key: 'a', label: '配置', filled: true },
    { key: 'b', label: '真采购价', filled: false },
    { key: 'c', label: '售价', filled: false },
  ]);
  assert.equal(m.pct, 33);
  assert.equal(m.filled, 1);
  assert.equal(m.nextToFill, '真采购价');
  assert.equal(m.decidable, false);
});
test('达阈值→可拍板', () => {
  const m = projectMaturity([{ key: 'a', label: 'x', filled: true }, { key: 'b', label: 'y', filled: true }], 80);
  assert.equal(m.pct, 100);
  assert.equal(m.decidable, true);
  assert.match(m.note, /可拍板/);
});

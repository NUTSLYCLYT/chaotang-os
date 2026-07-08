import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeStamps, type Stamp } from './stamp-pipeline.ts';
test('worst-wins合并', () => {
  const s: Stamp[] = [{ dept: 'hubu', role: 'a', verdict: 'pass', finding: 'x' }, { dept: 'xingbu', role: 'b', verdict: 'block', finding: 'y' }];
  assert.equal(mergeStamps('d', s).overall, 'blocked');
});
test('全pass→approved', () => {
  assert.equal(mergeStamps('d', [{ dept: 'hubu', role: 'a', verdict: 'pass', finding: 'x' }]).overall, 'approved');
});

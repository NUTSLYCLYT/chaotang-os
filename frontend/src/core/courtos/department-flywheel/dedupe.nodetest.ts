import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentHashOf, isDuplicate } from './dedupe.ts';
import type { RaiseDraft, RaisedLedgerEntry } from './types';

const draft: RaiseDraft = {
  sourceTaskId: 't1', command: '审批 X 预算 60万', title: 'X', priority: 80,
  reality: 'real', meta: {},
};

test('contentHashOf 稳定且随内容变化', () => {
  assert.equal(contentHashOf(draft), contentHashOf({ ...draft }));
  assert.notEqual(contentHashOf(draft), contentHashOf({ ...draft, command: '别的' }));
});

test('isDuplicate: 同源task+部门+hash 命中 ledger 即重复', () => {
  const led: RaisedLedgerEntry[] = [{
    sourceTaskId: 't1', dept: 'hubu', contentHash: contentHashOf(draft),
    raisedTaskId: 'dept_raise_a', at: '2026-06-28T00:00:00Z',
  }];
  assert.equal(isDuplicate(draft, 'hubu', led), true);
  assert.equal(isDuplicate({ ...draft, command: '变了' }, 'hubu', led), false);
  assert.equal(isDuplicate(draft, 'bingbu', led), false);
});

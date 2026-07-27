import assert from 'node:assert/strict';
import test from 'node:test';

import { selectContractTaskCandidate } from './task-selection';

test('does not infer contract mode from a legacy task prefix', () => {
  assert.equal(selectContractTaskCandidate({
    requestedTaskId: null,
    edictPrimaryTaskId: 'task_legacy_edict',
    activeMemorialId: 'task-legacy-memorial',
  }), null);
});

test('uses only an explicit contract task request as a candidate', () => {
  assert.equal(selectContractTaskCandidate({
    requestedTaskId: 'task-contract-1',
    edictPrimaryTaskId: 'task_other',
    activeMemorialId: 'task-other',
  }), 'task-contract-1');
});

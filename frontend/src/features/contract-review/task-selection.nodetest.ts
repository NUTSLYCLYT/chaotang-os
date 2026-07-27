import assert from 'node:assert/strict';
import test from 'node:test';

import { selectContractTaskCandidate } from './task-selection';

test('does not infer contract mode from a legacy task prefix', () => {
  assert.equal(selectContractTaskCandidate({
    requestedTaskId: null,
    edictPrimaryTaskId: 'task_legacy_edict',
    activeMemorialId: 'task-legacy-memorial',
    activeMemorialIsContract: false,
  }), null);
});

test('uses only an explicit contract task request as a candidate', () => {
  assert.equal(selectContractTaskCandidate({
    requestedTaskId: 'task-contract-1',
    edictPrimaryTaskId: 'task_other',
    activeMemorialId: 'task-other',
    activeMemorialIsContract: false,
  }), 'task-contract-1');
});

test('uses the selected memorial when the server marked it as a contract task', () => {
  assert.equal(selectContractTaskCandidate({
    requestedTaskId: null,
    edictPrimaryTaskId: null,
    activeMemorialId: 'task-contract-from-home',
    activeMemorialIsContract: true,
  }), 'task-contract-from-home');
});

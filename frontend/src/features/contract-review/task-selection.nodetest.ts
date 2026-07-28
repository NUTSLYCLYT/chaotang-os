import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findRefreshedTaskSnapshot,
  selectContractTaskCandidate,
} from './task-selection';

test('does not infer contract mode from a legacy task prefix', () => {
  assert.equal(selectContractTaskCandidate({
    requestedTaskId: null,
    requestedTaskIsContract: false,
    edictPrimaryTaskId: 'task_legacy_edict',
    activeMemorialId: 'task-legacy-memorial',
    activeMemorialIsContract: false,
  }), null);
});

test('rejects an explicit task request that the server did not classify as contract', () => {
  assert.equal(selectContractTaskCandidate({
    requestedTaskId: 'task-contract-1',
    requestedTaskIsContract: false,
    edictPrimaryTaskId: 'task_other',
    activeMemorialId: 'task-other',
    activeMemorialIsContract: false,
  }), null);
});

test('rejects an explicit contract task until the exact memorial is active', () => {
  assert.equal(selectContractTaskCandidate({
    requestedTaskId: 'task-contract-1',
    requestedTaskIsContract: true,
    edictPrimaryTaskId: null,
    activeMemorialId: 'task-other',
    activeMemorialIsContract: false,
  }), null);
});

test('a stale legacy request cannot suppress the active server contract task', () => {
  assert.equal(selectContractTaskCandidate({
    requestedTaskId: 'task-legacy-1',
    requestedTaskIsContract: false,
    edictPrimaryTaskId: null,
    activeMemorialId: 'task-contract-1',
    activeMemorialIsContract: true,
  }), 'task-contract-1');
});

test('uses an explicit server-classified contract task bound to the active memorial', () => {
  assert.equal(selectContractTaskCandidate({
    requestedTaskId: 'task-contract-1',
    requestedTaskIsContract: true,
    edictPrimaryTaskId: null,
    activeMemorialId: 'task-contract-1',
    activeMemorialIsContract: true,
  }), 'task-contract-1');
});

test('uses the selected memorial when the server marked it as a contract task', () => {
  assert.equal(selectContractTaskCandidate({
    requestedTaskId: null,
    requestedTaskIsContract: false,
    edictPrimaryTaskId: null,
    activeMemorialId: 'task-contract-from-home',
    activeMemorialIsContract: true,
  }), 'task-contract-from-home');
});

test('same-id server refresh replaces a stale selected task classification', () => {
  const refreshed = findRefreshedTaskSnapshot(
    'task-reclassified',
    [
      { id: 'task-other', contractTask: false },
      { id: 'task-reclassified', contractTask: true },
    ],
  );

  assert.deepEqual(refreshed, {
    id: 'task-reclassified',
    contractTask: true,
  });
});

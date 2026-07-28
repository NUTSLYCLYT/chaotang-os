import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findRefreshedTaskSnapshot,
  rememberServerContractTaskIds,
  selectContractTaskCandidate,
} from './task-selection';
import * as taskSelection from './task-selection';

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

test('a server-confirmed contract task cannot downgrade when a later list omits it', () => {
  type Snapshot = {
    id: string;
    contractTask?: boolean;
    title: string;
  };
  const resolveSelectedTaskSnapshot = (
    taskSelection as unknown as {
      resolveSelectedTaskSnapshot?: (
        selected: Snapshot,
        serverTasks: readonly Snapshot[],
        confirmedContractTaskIds: Set<string>,
      ) => Snapshot | null;
    }
  ).resolveSelectedTaskSnapshot;
  const staleLegacySnapshot = {
    id: 'task-reclassified',
    contractTask: false,
    title: '旧任务快照',
  };
  const serverTasks = [{
    id: 'task-reclassified',
    contractTask: true,
    title: '服务器合同快照',
  }];
  const initialIds = new Set<string>();
  const confirmedContractTaskIds = rememberServerContractTaskIds(
    initialIds,
    serverTasks,
  );
  assert.notEqual(confirmedContractTaskIds, initialIds);
  assert.deepEqual([...confirmedContractTaskIds], ['task-reclassified']);

  const refreshed = resolveSelectedTaskSnapshot?.(
    staleLegacySnapshot,
    serverTasks,
    confirmedContractTaskIds,
  );
  assert.deepEqual(refreshed, {
    id: 'task-reclassified',
    contractTask: true,
    title: '服务器合同快照',
  });

  const omitted = resolveSelectedTaskSnapshot?.(
    staleLegacySnapshot,
    [],
    confirmedContractTaskIds,
  );
  assert.deepEqual(omitted, {
    id: 'task-reclassified',
    contractTask: true,
    title: '旧任务快照',
  });
});

test('remembering server contract tasks is monotonic and preserves stable state', () => {
  const existing = new Set(['task-contract-1']);
  assert.equal(
    rememberServerContractTaskIds(existing, [
      { id: 'task-contract-1', contractTask: false },
      { id: 'task-legacy', contractTask: false },
    ]),
    existing,
  );
  assert.deepEqual(
    [...rememberServerContractTaskIds(existing, [
      { id: 'task-contract-2', contractTask: true },
    ])],
    ['task-contract-1', 'task-contract-2'],
  );
});

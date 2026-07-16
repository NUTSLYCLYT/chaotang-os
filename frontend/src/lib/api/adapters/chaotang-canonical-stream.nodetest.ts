import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptCanonicalCourtStreamEvent } from './chaotang-canonical-stream.ts';

test('maps canonical memorial event to the existing BattleStream shape', () => {
  assert.deepEqual(
    adaptCanonicalCourtStreamEvent({
      type: 'canonical.event',
      taskId: 'task_p3b',
      eventType: 'memorial.formalized',
      stage: 'awaiting_emperor_decision',
      message: '军机处已生成唯一正式奏折。',
      payload: { swarm_run_id: 'swarm_p3b', formal_memorial_id: 'formal_p3b' },
    }),
    {
      type: 'memorial.drafted',
      taskId: 'task_p3b',
      runId: 'swarm_p3b',
      memorialId: 'formal_p3b',
    },
  );
});

test('maps canonical terminal snapshots to done or error without inventing success', () => {
  assert.deepEqual(
    adaptCanonicalCourtStreamEvent({
      type: 'canonical.snapshot',
      taskId: 'task_ok',
      status: 'report_ready',
      terminal: true,
      runId: 'swarm_ok',
      error: null,
    }),
    { type: 'done', taskId: 'task_ok', runId: 'swarm_ok' },
  );
  assert.deepEqual(
    adaptCanonicalCourtStreamEvent({
      type: 'canonical.snapshot',
      taskId: 'task_failed',
      status: 'failed',
      terminal: true,
      runId: null,
      error: 'worker failed',
    }),
    { type: 'error', taskId: 'task_failed', message: 'worker failed' },
  );
});

test('keeps legacy queue events unchanged during the P3d compatibility window', () => {
  const legacy = { type: 'group.dispatch', groupId: 'finlaw', name: '财法组' };
  assert.equal(adaptCanonicalCourtStreamEvent(legacy), legacy);
});

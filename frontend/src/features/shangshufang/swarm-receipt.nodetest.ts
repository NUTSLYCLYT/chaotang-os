import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSwarmReceipt } from './swarm-receipt.ts';
import type { JiqunSessionDetail } from '../../lib/jiqun-api.ts';

function baseSession(overrides: Partial<JiqunSessionDetail>): JiqunSessionDetail {
  return {
    session_id: 'session_test',
    task_input: '客户要求正式报价，要不要发？',
    status: 'completed',
    release_gate: 'clear',
    swarm_count: 1,
    completed_count: 1,
    start_time: '2026-06-18T18:00:00+08:00',
    end_time: '2026-06-18T18:01:00+08:00',
    swarm_runs: [],
    graph: { nodes: [], edges: [] },
    events: [],
    ...overrides,
  };
}

test('蜂群验真：质量门阻断时可证明真跑过，但不能准奏', () => {
  const receipt = buildSwarmReceipt(
    baseSession({
      release_gate: 'blocked',
      swarm_runs: [
        {
          swarm_id: 'quotation',
          run_id: 'run_001',
          status: 'completed',
          quality_score: 2.77,
          qa_result: { qa_result: 'fail' },
          triggered_by: 'manual',
        },
      ],
      events: [{ event_id: 'evt_001', topic: 'quotation_completed', payload: { final_output: { verdict: '补证' } } }],
    }),
  );

  assert.equal(receipt.can_label_live_swarm, true);
  assert.equal(receipt.can_show_valid_memorial, false);
  assert.equal(receipt.verification_level, 'verified_blocked');
});

test('蜂群验真：缺 QA 时不能标 LIVE_SWARM', () => {
  const receipt = buildSwarmReceipt(
    baseSession({
      status: 'running',
      swarm_runs: [
        {
          swarm_id: 'quotation',
          run_id: 'run_002',
          status: 'running',
          triggered_by: 'manual',
        },
      ],
    }),
  );

  assert.equal(receipt.can_label_live_swarm, false);
  assert.equal(receipt.verification_level, 'running');
});

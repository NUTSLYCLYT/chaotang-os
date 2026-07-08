import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDisabledLiveSwarmAdapter,
  createStaticLiveSwarmAdapter,
  gateLiveAdapterCapability,
  normalizeLiveAdapterTrace,
  type CourtLiveAdapterDispatchInput,
} from '../runtime/live-swarm-adapter.ts';

const baseInput: CourtLiveAdapterDispatchInput = {
  task_id: 'task_live_adapter_quote',
  original_question: '客户要求正式报价，要不要发？',
  selected_departments: ['hubu_cfo', 'bingbu_sales', 'xingbu_legal_risk'],
  swarm_bundles: ['hubu_cfo_office_v0', 'bingbu_cro_sales_office_v0', 'xingbu_clo_cco_office_v0'],
  source_label: 'LIVE',
  user_id: 'user_live_adapter_owner',
};

test('LiveSwarmAdapter 布局：disabled adapter 不能进入 LIVE_SWARM', async () => {
  const adapter = createDisabledLiveSwarmAdapter('openclaw', 'OpenClaw adapter slot is not wired yet');
  const capability = await adapter.capability();
  const gate = gateLiveAdapterCapability(capability);

  assert.equal(gate.can_dispatch, false);
  assert.ok(gate.missing_capabilities.includes('live_adapter_disabled'));

  const result = await adapter.dispatch(baseInput);
  const trace = normalizeLiveAdapterTrace({ input: baseInput, result });

  assert.equal(trace.mode, 'local_placeholder');
  assert.equal(trace.status, 'skipped_no_live_adapter');
  assert.equal(trace.source_label, 'MIXED');
  assert.equal(trace.trace_id, undefined);
  assert.ok(trace.user_visible_summary.includes('不得标记 LIVE_SWARM'));
});

test('LiveSwarmAdapter 布局：ready adapter 缺 trace_id 仍然降级', async () => {
  const adapter = createStaticLiveSwarmAdapter({
    adapter_id: 'jiqun',
    result: {
      ok: true,
      status: 'completed',
      findings: ['jiqun 返回了结果摘要，但没有返回可追踪 trace_id。'],
      missing_capabilities: [],
      user_visible_summary: 'jiqun run completed without trace id',
      source_label: 'LIVE',
    },
  });

  const gate = gateLiveAdapterCapability(await adapter.capability());
  assert.equal(gate.can_dispatch, true);

  const result = await adapter.dispatch(baseInput);
  const trace = normalizeLiveAdapterTrace({ input: baseInput, result });

  assert.equal(trace.mode, 'local_placeholder');
  assert.equal(trace.status, 'blocked');
  assert.equal(trace.source_label, 'MIXED');
  assert.ok(trace.missing_capabilities.includes('real_swarm_trace_id_missing'));
});

test('LiveSwarmAdapter 布局：只有真实 trace_id 才能产出 LIVE_SWARM', async () => {
  const adapter = createStaticLiveSwarmAdapter({
    adapter_id: 'jiqun',
    result: {
      ok: true,
      external_task_id: 'jiqun_task_001',
      external_session_id: 'jiqun_session_001',
      trace_id: '20260622_120200_trace01',
      status: 'completed',
      findings: ['报价单生成流程已返回真实蜂群 trace。'],
      missing_capabilities: [],
      user_visible_summary: 'jiqun live swarm completed',
      source_label: 'LIVE_SWARM',
    },
  });

  const result = await adapter.dispatch(baseInput);
  const trace = normalizeLiveAdapterTrace({ input: baseInput, result });

  assert.equal(trace.mode, 'live_adapter');
  assert.equal(trace.status, 'completed');
  assert.equal(trace.trace_id, '20260622_120200_trace01');
  assert.equal(trace.source_label, 'LIVE_SWARM');
  assert.equal(trace.missing_capabilities.length, 0);
});

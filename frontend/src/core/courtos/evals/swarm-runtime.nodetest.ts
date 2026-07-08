import assert from 'node:assert/strict';
import test from 'node:test';

import { loadCourtDepartmentRegistry, selectRegistryDepartments } from '../departments/registry.ts';
import { runCourtSwarmRuntime } from '../runtime/swarm-runtime.ts';

test('Goal 9 maps deep review to registry swarm bundles without executing live swarm', () => {
  const registry = loadCourtDepartmentRegistry();
  const question = '客户要求正式报价，要不要发？金额 300 万，付款条件还没定。';
  const selectedDepartments = selectRegistryDepartments({ question, registry }).map((entry) => entry.id);
  const result = runCourtSwarmRuntime({
    taskId: 'task_goal9_quote',
    reviewDepth: 'deep',
    sourceLabel: 'FALLBACK',
    selectedDepartments,
    registry,
  });

  assert.equal(result.swarm_required, true);
  assert.equal(result.swarm_trace_required, true);
  assert.ok(result.swarm_bundles.includes('hubu_cfo_office_v0'));
  assert.ok(result.swarm_bundles.includes('bingbu_cro_sales_office_v0'));
  assert.ok(result.swarm_bundles.includes('xingbu_clo_cco_office_v0'));
  assert.equal(result.trace.mode, 'local_placeholder');
  assert.equal(result.trace.status, 'skipped_no_live_adapter');
  assert.equal(result.trace.source_label, 'FALLBACK');
  assert.equal(result.trace.trace_id, undefined);
  assert.ok(result.trace.missing_capabilities.includes('real_swarm_trace_id_missing'));
});

test('Goal 9 LIVE_SWARM is only allowed with a real trace_id', () => {
  const registry = loadCourtDepartmentRegistry();
  const result = runCourtSwarmRuntime({
    taskId: 'task_goal9_live_trace',
    reviewDepth: 'live_swarm',
    sourceLabel: 'LIVE',
    selectedDepartments: ['finance', 'justice'],
    registry,
    liveTraceId: '20260622_120300_goal901',
  });

  assert.equal(result.trace.source_label, 'LIVE_SWARM');
  assert.equal(result.trace.trace_id, '20260622_120300_goal901');
  assert.equal(result.trace.status, 'completed');
  assert.equal(result.trace.missing_capabilities.length, 0);
});

test('Goal 9 live draft without swarm trace is downgraded to MIXED', () => {
  const registry = loadCourtDepartmentRegistry();
  const result = runCourtSwarmRuntime({
    taskId: 'task_goal9_mixed',
    reviewDepth: 'deep',
    sourceLabel: 'LIVE',
    selectedDepartments: ['finance', 'justice'],
    registry,
  });

  assert.equal(result.trace.source_label, 'MIXED');
  assert.equal(result.trace.trace_id, undefined);
  assert.ok(result.trace.user_visible_summary.includes('不得标记 LIVE_SWARM'));
});

test('Goal 9 shallow review does not request swarm and keeps user away from agent management', () => {
  const registry = loadCourtDepartmentRegistry();
  const result = runCourtSwarmRuntime({
    taskId: 'task_goal9_shallow',
    reviewDepth: 'shallow',
    sourceLabel: 'FALLBACK',
    selectedDepartments: ['jinyiwei'],
    registry,
  });

  assert.equal(result.swarm_required, false);
  assert.equal(result.swarm_trace_required, false);
  assert.equal(result.trace.status, 'skipped_not_required');
  assert.ok(result.trace.user_visible_summary.includes('无需蜂群深挖'));
});

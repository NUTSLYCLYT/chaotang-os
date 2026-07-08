import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dispatchPackSizing } from './gongbu-pack-bridge.ts';
import { findCell } from './battery-products.ts';
import type { CourtLiveSwarmAdapter, CourtLiveAdapterDispatchInput } from '@/core/courtos/runtime/live-swarm-adapter';

function stubAdapter(over: Partial<Awaited<ReturnType<CourtLiveSwarmAdapter['dispatch']>>> = {}, capture?: (i: CourtLiveAdapterDispatchInput) => void): CourtLiveSwarmAdapter {
  return {
    id: 'jiqun',
    capability: async () => ({ adapter_id: 'jiqun', state: 'ready', bundles: ['pack_rd'] } as never),
    dispatch: async (input) => {
      capture?.(input);
      return {
        adapter_id: 'jiqun', ok: true, status: 'completed', findings: ['sizing: 1P280S, 250kWh'],
        missing_capabilities: [], user_visible_summary: '后端蜂群:推荐 1P280S 方案', source_label: 'LIVE_SWARM',
        ...over,
      };
    },
  };
}

test('成功:经 adapter 转发,诚实带回 LIVE_SWARM + 后端摘要', async () => {
  const r = await dispatchPackSizing(stubAdapter(), { taskId: 't1', requirement: '-40°C 250kWh 储能' });
  assert.equal(r.ok, true);
  assert.equal(r.sourceLabel, 'LIVE_SWARM');
  assert.match(r.summary, /后端蜂群/);
});

test('派给 gong_bu + pack_rd bundle,候选电芯进上下文(不重造产线)', async () => {
  let captured: CourtLiveAdapterDispatchInput | null = null;
  await dispatchPackSizing(stubAdapter({}, (i) => (captured = i)), {
    taskId: 't2', requirement: '极寒', candidateCells: [findCell('LFP-40C-100Ah')!],
  });
  assert.deepEqual(captured!.selected_departments, ['gong_bu']);
  assert.deepEqual(captured!.swarm_bundles, ['pack_rd']);
  assert.match(captured!.original_question, /LFP-40C-100Ah/);
});

test('adapter 抛错 → 诚实 FALLBACK,绝不假装算过', async () => {
  const broken: CourtLiveSwarmAdapter = {
    id: 'jiqun', capability: async () => ({} as never),
    dispatch: async () => { throw new Error('down'); },
  };
  const r = await dispatchPackSizing(broken, { taskId: 't3', requirement: 'x' });
  assert.equal(r.ok, false);
  assert.equal(r.sourceLabel, 'FALLBACK');
  assert.deepEqual(r.missingCapabilities, ['pack_rd']);
});

test('后端回执 FALLBACK → 如实带回 FALLBACK,不抬成 LIVE', async () => {
  const r = await dispatchPackSizing(
    stubAdapter({ ok: false, source_label: 'FALLBACK', status: 'blocked', missing_capabilities: ['pack_rd'] }),
    { taskId: 't4', requirement: 'x' },
  );
  assert.equal(r.sourceLabel, 'FALLBACK');
  assert.equal(r.ok, false);
});

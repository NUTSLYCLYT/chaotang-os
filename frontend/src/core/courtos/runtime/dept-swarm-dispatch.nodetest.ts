import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchDeptToSwarm, DEPT_ENTRY_SWARM } from './dept-swarm-dispatch.ts';
import type { CourtLiveSwarmAdapter } from './live-swarm-adapter.ts';

function stub(opts: { ok?: boolean; sourceLabel?: 'LIVE_SWARM' | 'FALLBACK'; throwErr?: boolean }): CourtLiveSwarmAdapter {
  return {
    id: 'jiqun',
    async capability() {
      return { adapter_id: 'jiqun', state: 'ready', supports_dispatch: true, supports_status: true, supports_trace: true, user_visible_summary: 'stub', missing_capabilities: [] };
    },
    async dispatch() {
      if (opts.throwErr) throw new Error('backend down');
      return { adapter_id: 'jiqun', ok: opts.ok ?? true, status: 'completed', findings: ['真findings'], missing_capabilities: [], user_visible_summary: '真summary', source_label: opts.sourceLabel ?? 'LIVE_SWARM' };
    },
  };
}

test('成功派发→ok + LIVE_SWARM 透传', async () => {
  const r = await dispatchDeptToSwarm({ deptCode: 'xing_bu', question: '审合同法律风险' }, stub({ ok: true, sourceLabel: 'LIVE_SWARM' }));
  assert.equal(r.ok, true);
  assert.equal(r.sourceLabel, 'LIVE_SWARM');
  assert.equal(r.adapterState, 'ready');
});
test('adapter抛错→FALLBACK诚实降级,不假装算过', async () => {
  const r = await dispatchDeptToSwarm({ deptCode: 'hu_bu', question: '算财务成本' }, stub({ throwErr: true }));
  assert.equal(r.ok, false);
  assert.equal(r.sourceLabel, 'FALLBACK');
  assert.match(r.summary, /不可达|降级/);
});
test('后端返回FALLBACK→诚实透传,不伪造LIVE(铁律13.2)', async () => {
  const r = await dispatchDeptToSwarm({ deptCode: 'gong_bu', question: 'PACK方案' }, stub({ ok: false, sourceLabel: 'FALLBACK' }));
  assert.equal(r.sourceLabel, 'FALLBACK');
});

// ── P1/P2:entry_swarm 权威路由(替关键词猜)──
function captureStub(): { adapter: CourtLiveSwarmAdapter; seen: () => string | undefined } {
  let seen: string | undefined;
  const adapter = {
    id: 'jiqun',
    async capability() {
      return { adapter_id: 'jiqun', state: 'ready', supports_dispatch: true, supports_status: true, supports_trace: true, user_visible_summary: 'stub', missing_capabilities: [] };
    },
    async dispatch(input: { entry_swarm?: string }) {
      seen = input.entry_swarm;
      return { adapter_id: 'jiqun', ok: true, status: 'completed', findings: [], missing_capabilities: [], user_visible_summary: 'ok', source_label: 'LIVE_SWARM' as const };
    },
  } as unknown as CourtLiveSwarmAdapter;
  return { adapter, seen: () => seen };
}

test('SSOT 映射:各部→正确 entry_swarm', () => {
  assert.equal(DEPT_ENTRY_SWARM.hu_bu, 'finance');
  assert.equal(DEPT_ENTRY_SWARM.gong_bu, 'pack_rd');
  assert.equal(DEPT_ENTRY_SWARM.xing_bu, 'legal');
  assert.equal(DEPT_ENTRY_SWARM.li_bu, 'libu');
  assert.equal(DEPT_ENTRY_SWARM.bing_bu, 'quotation');
});
test('部门码权威路由:刑部→legal 传进 adapter(不靠关键词猜)', async () => {
  const { adapter, seen } = captureStub();
  await dispatchDeptToSwarm({ deptCode: 'xing_bu', question: '一句不含法律关键词的话' }, adapter);
  assert.equal(seen(), 'legal');
});
test('显式 entrySwarm 参 > 映射', async () => {
  const { adapter, seen } = captureStub();
  await dispatchDeptToSwarm({ deptCode: 'hu_bu', question: 'x', entrySwarm: 'quotation' }, adapter);
  assert.equal(seen(), 'quotation');
});
test('未登记部→不硬塞 entry_swarm(留 adapter 关键词兜底)', async () => {
  const { adapter, seen } = captureStub();
  await dispatchDeptToSwarm({ deptCode: 'li_bu_rites', question: '礼部增长' }, adapter);
  assert.equal(seen(), undefined);
});

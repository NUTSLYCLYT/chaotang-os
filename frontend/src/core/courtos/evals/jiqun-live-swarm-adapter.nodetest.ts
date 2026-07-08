import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeLiveAdapterTrace, type CourtLiveAdapterDispatchInput } from '../runtime/live-swarm-adapter.ts';
import { createJiqunLiveSwarmAdapter } from '../runtime/jiqun-live-swarm-adapter.ts';

const baseInput: CourtLiveAdapterDispatchInput = {
  task_id: 'task_jiqun_quote',
  loop_trace_id: 'loop_task_jiqun_quote',
  original_question: '客户要求正式报价，要不要发？',
  selected_departments: ['hubu_cfo', 'bingbu_sales', 'xingbu_legal_risk'],
  swarm_bundles: ['hubu_cfo_office_v0', 'bingbu_cro_sales_office_v0', 'xingbu_clo_cco_office_v0'],
  source_label: 'LIVE',
  user_id: 'user_jiqun_owner',
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

test('JiqunLiveSwarmAdapter: session 经兑现核验(/api/swarm/sessions)才进 LIVE_SWARM', async () => {
  const calls: Array<{ url: string; body?: unknown }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({
      url: String(url),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined,
    });
    if (String(url).endsWith('/api/swarm/run')) {
      return jsonResponse({
        success: true,
        task_id: 'jiqun_task_quote_001',
        session_id: '20260622_120000_quote01',
      });
    }
    // 兑现核验承重墙:真 session 登记 → 200 + 同 session_id。
    if (String(url).includes('/api/swarm/sessions/')) {
      return jsonResponse({ session_id: '20260622_120000_quote01', status: 'completed' });
    }
    return jsonResponse({ error: 'unexpected_url' }, { status: 404 });
  };

  const adapter = createJiqunLiveSwarmAdapter({
    baseUrl: 'http://jiqun.test',
    fetchImpl,
    timeoutMs: 1000,
  });
  const result = await adapter.dispatch(baseInput);
  const trace = normalizeLiveAdapterTrace({ input: baseInput, result });

  assert.equal(result.ok, true);
  assert.equal(result.external_task_id, 'jiqun_task_quote_001');
  assert.equal(result.external_session_id, '20260622_120000_quote01');
  assert.equal(result.trace_id, '20260622_120000_quote01');
  assert.equal(trace.source_label, 'LIVE_SWARM');
  assert.equal(trace.trace_id, '20260622_120000_quote01');
  assert.equal(trace.mode, 'live_adapter');
  assert.equal(calls[0]?.url, 'http://jiqun.test/api/swarm/run');
  assert.equal((calls[0]?.body as { entry_swarm?: string }).entry_swarm, 'quotation');
  assert.equal((calls[0]?.body as { courtos_task_id?: string }).courtos_task_id, baseInput.task_id);
  assert.ok(calls[1]?.url.includes('/api/swarm/sessions/'), '第二跳应是兑现核验 /api/swarm/sessions,而非旧 /api/tasks 错端点');
});

test('JiqunLiveSwarmAdapter: swarm/run 无 session_id 时必须降级', async () => {
  const fetchImpl: typeof fetch = async (url) => {
    if (String(url).endsWith('/api/swarm/run')) {
      return jsonResponse({
        success: true,
        task_id: 'jiqun_task_no_session',
      });
    }
    return jsonResponse({ running: [], recent: [] });
  };
  const adapter = createJiqunLiveSwarmAdapter({
    baseUrl: 'http://jiqun.test',
    fetchImpl,
    timeoutMs: 1000,
  });
  const result = await adapter.dispatch(baseInput);
  const trace = normalizeLiveAdapterTrace({ input: baseInput, result });

  assert.equal(result.ok, false);
  assert.equal(result.trace_id, undefined);
  assert.ok(result.missing_capabilities.includes('jiqun_session_id_missing'));
  assert.equal(trace.source_label, 'MIXED');
  assert.equal(trace.mode, 'local_placeholder');
  assert.ok(trace.user_visible_summary.includes('不得标记 LIVE_SWARM'));
});

test('JiqunLiveSwarmAdapter: upstream trace_id 优先于 session_id', async () => {
  const fetchImpl: typeof fetch = async (url) => {
    if (String(url).endsWith('/api/swarm/run')) {
      return jsonResponse({
        success: true,
        data: {
          task_id: 'jiqun_task_contract_001',
          session_id: 'jiqun_session_contract_001',
          trace_id: '20260622_120100_contract01',
        },
      });
    }
    if (String(url).includes('/api/swarm/sessions/')) {
      return jsonResponse({ session_id: '20260622_120100_contract01' });
    }
    return jsonResponse({ error: 'unexpected' }, { status: 404 });
  };
  const adapter = createJiqunLiveSwarmAdapter({
    baseUrl: 'http://jiqun.test',
    fetchImpl,
    timeoutMs: 1000,
  });
  const input: CourtLiveAdapterDispatchInput = {
    ...baseInput,
    task_id: 'task_jiqun_contract',
    original_question: '这个合同能不能直接签？',
  };
  const result = await adapter.dispatch(input);
  const trace = normalizeLiveAdapterTrace({ input, result });

  assert.equal(result.trace_id, '20260622_120100_contract01');
  assert.equal(trace.source_label, 'LIVE_SWARM');
  assert.equal(trace.trace_id, '20260622_120100_contract01');
});

test('JiqunLiveSwarmAdapter: 有 session_id 但兑现核验 404 → 降级 MIXED(承重墙 fail-closed,不伪造 LIVE)', async () => {
  const fetchImpl: typeof fetch = async (url) => {
    if (String(url).endsWith('/api/swarm/run')) {
      return jsonResponse({ success: true, session_id: '20260622_120300_fake01' });
    }
    // /api/swarm/sessions/... → 404:session 未登记/疑似伪造
    return jsonResponse({ error: 'not_found' }, { status: 404 });
  };
  const adapter = createJiqunLiveSwarmAdapter({ baseUrl: 'http://jiqun.test', fetchImpl, timeoutMs: 1000 });
  const result = await adapter.dispatch(baseInput);
  const trace = normalizeLiveAdapterTrace({ input: baseInput, result });
  assert.equal(result.ok, true); // dispatch 本身成功
  assert.notEqual(trace.source_label, 'LIVE_SWARM', '未过兑现核验 → 绝不盖 LIVE_SWARM 帝金章');
});

test('JiqunLiveSwarmAdapter forwards explicit entry swarm and evidence payload', async () => {
  const calls: Array<{ url: string; body?: unknown }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({
      url: String(url),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined,
    });
    if (String(url).endsWith('/api/swarm/run')) {
      return jsonResponse({
        success: true,
        session_id: '20260622_120200_pack01',
      });
    }
    return jsonResponse({ running: [], recent: [] });
  };
  const adapter = createJiqunLiveSwarmAdapter({
    baseUrl: 'http://jiqun.test',
    fetchImpl,
    timeoutMs: 1000,
  });
  const evidenceBoundRun = {
    schema_version: 'EvidenceBoundSwarmRunV1' as const,
    entry_swarm: 'pack_rd',
    task_input: 'intel pack verification',
    intelligence_pack_id: 'jinyiwei_intel_sig_001',
    intelligence_pack: {
      schema_version: 'JinyiweiEvidencePackForSwarmV1' as const,
      packId: 'jinyiwei_intel_sig_001',
      departmentId: 'jinyiwei' as const,
      sourceLabel: 'LIVE' as const,
      facts: ['signal_id=sig_001'],
      evidenceRefs: [
        {
          id: 'intel_signal:sig_001',
          label: 'signal',
          claimType: 'CLAIM' as const,
          sourceType: 'jinyiwei_intel_signal',
          sourceLabel: 'LIVE' as const,
          summary: 'summary',
        },
      ],
      missingEvidence: ['source_url_missing'],
      unsupportedClaims: [],
      forbiddenOutputs: ['do_not_generate_binding_quote'],
      qualityGates: ['source_label_required'],
    },
    evidence_refs: ['intel_signal:sig_001'],
    missing_evidence: ['source_url_missing'],
    forbidden_outputs: ['do_not_generate_binding_quote'],
    source_label: 'LIVE' as const,
  };
  const input: CourtLiveAdapterDispatchInput = {
    ...baseInput,
    task_id: 'task_intel_sig_001',
    original_question: 'general text without pack keyword',
    selected_departments: ['gong_bu'],
    swarm_bundles: ['jinyiwei_evidence_check'],
    entry_swarm: 'pack_rd',
    evidence_bound_run: evidenceBoundRun,
  };

  const result = await adapter.dispatch(input);

  assert.equal(result.ok, true);
  const body = calls[0]?.body as Record<string, unknown>;
  assert.equal(body.entry_swarm, 'pack_rd');
  assert.equal(body.intelligence_pack_id, 'jinyiwei_intel_sig_001');
  assert.deepEqual(body.evidence_refs, ['intel_signal:sig_001']);
  assert.deepEqual(body.missing_evidence, ['source_url_missing']);
  assert.deepEqual(body.forbidden_outputs, ['do_not_generate_binding_quote']);
  assert.deepEqual(body.evidence_bound_run, evidenceBoundRun);
});

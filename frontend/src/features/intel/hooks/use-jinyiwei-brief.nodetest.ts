import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveBriefPhase, nextRouteForLight, type JinyiweiBrief } from '../lib/jinyiwei-brief-contract.ts';
import { requestJinyiweiBrief } from '../lib/request-jinyiwei-brief.ts';

function brief(items: JinyiweiBrief['items']): JinyiweiBrief {
  return {
    doc_type: 'brief',
    dept: 'jinyiwei',
    case_id: 'JYW-1',
    light: items.length ? 'green' : 'yellow',
    headline: items.length ? '情报可信' : '未获取到可核情报',
    items,
    sourceLabel: items.length ? 'LIVE_SEARCH' : 'FALLBACK',
    provenance: { archive_id: items.length ? 'JYW-1' : null, gate: items.length ? 'passed' : 'pending', deterministic_gated: true },
  };
}

test('useJinyiweiBrief request success maps backend court_doc', async () => {
  const expected = brief([{ level: 'green', title: '官方已发布公告', odds: '一手', impact: '入库', evidence_ref: 'https://example.com', primary_source: true, distinct_sources: 1, hard_claim: false, vet_reason: '一手来源,可直接采信', sources: [{ name: '官方公告', url: 'https://example.com', tier: '一手', published_at: '2026-07-10T00:00:00Z' }] }]);
  const calls: Array<{ path: string; init: RequestInit }> = [];
  const result = await requestJinyiweiBrief('核查官方公告', undefined, async (path, init) => {
    calls.push({ path, init });
    return new Response(JSON.stringify({ success: true, data: expected, error: null }), { status: 200 });
  });
  assert.deepEqual(result, expected);
  assert.equal(calls[0]?.path, '/api/intel/brief');
  assert.equal(JSON.parse(String(calls[0]?.init.body)).query, '核查官方公告');
  assert.equal(deriveBriefPhase(result), 'ready');
});

test('useJinyiweiBrief request preserves honest empty fallback', async () => {
  const expected = brief([]);
  const result = await requestJinyiweiBrief('核查未知项目', undefined, async () => new Response(JSON.stringify({ success: true, data: expected, error: null }), { status: 200 }));
  assert.equal(result.sourceLabel, 'FALLBACK');
  assert.equal(result.items.length, 0);
  assert.equal(deriveBriefPhase(result), 'empty');
});

test('useJinyiweiBrief request exposes backend error', async () => {
  await assert.rejects(
    () => requestJinyiweiBrief('核查接口错误', undefined, async () => new Response(JSON.stringify({ success: false, data: null, error: 'tavily unavailable' }), { status: 503 })),
    /tavily unavailable/,
  );
});

test('department protocol routes green yellow red black correctly', () => {
  assert.equal(nextRouteForLight('green').label, '钦天监');
  assert.equal(nextRouteForLight('yellow').label, '御史');
  assert.equal(nextRouteForLight('red').label, '锦衣卫补证');
  assert.equal(nextRouteForLight('black').label, '刑部');
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { requestLifuComplianceReport } from './lifu-compliance.ts';

test('礼部合规 adapter 解析三源结果并原样保留后端 source_label', async () => {
  let requestedPath = '';
  let requestedBody: unknown;

  const result = await requestLifuComplianceReport('核验这段发布文案', async (path, init) => {
    requestedPath = path;
    requestedBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      light: 'red',
      headline: '暂缓发出 —— 检出编造',
      items: [{ level: 'red', title: '素材无回链', fix: '补充出处', evidence_ref: 'task_input' }],
      source_label: 'DETERMINISTIC_GATE',
      deterministic_gated: true,
      review_opinion: { text: '建议改写', source_label: 'LLM_ONLY' },
      xhs_monitor_opinion: { text: '负面讨论增加', source_label: 'ENGINE_BACKED', run_id: 'xhs-1' },
      missing_coverage: [],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  assert.equal(requestedPath, '/api/swarm/lipu/compliance-report');
  assert.deepEqual(requestedBody, { task_input: '核验这段发布文案', archive: false });
  assert.equal(result.status, 'success');
  assert.equal(result.sourceLabel, 'DETERMINISTIC_GATE');
  if (result.status === 'success') {
    assert.equal(result.report.source_label, 'DETERMINISTIC_GATE');
    assert.equal(result.report.light, 'red');
    assert.equal(result.report.review_opinion?.source_label, 'LLM_ONLY');
    assert.equal(result.report.xhs_monitor_opinion?.source_label, 'ENGINE_BACKED');
  }
});

test('礼部合规 adapter 拒绝后端未定义的 source_label', async () => {
  const result = await requestLifuComplianceReport('核验文案', async () =>
    new Response(JSON.stringify({
      light: 'green',
      headline: '可以发布',
      items: [],
      source_label: 'UNEXPECTED_SOURCE',
      deterministic_gated: true,
      review_opinion: null,
      xhs_monitor_opinion: null,
      missing_coverage: [],
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  );

  assert.equal(result.status, 'fallback');
  assert.equal(result.sourceLabel, 'FALLBACK');
});

test('礼部合规 adapter 在后端不可达时诚实降级为 FALLBACK', async () => {
  const result = await requestLifuComplianceReport('核验文案', async () => {
    throw new TypeError('fetch failed');
  });

  assert.deepEqual(result, {
    status: 'fallback',
    sourceLabel: 'FALLBACK',
    error: '礼部真实合规引擎未能返回可用结果：fetch failed',
  });
});

test('礼部合规 adapter 不把非成功响应伪装成真实结果', async () => {
  const result = await requestLifuComplianceReport('核验文案', async () =>
    new Response(JSON.stringify({ detail: 'unauthorized' }), { status: 401, statusText: 'Unauthorized' }),
  );

  assert.equal(result.status, 'fallback');
  assert.equal(result.sourceLabel, 'FALLBACK');
  if (result.status === 'fallback') assert.match(result.error, /401 Unauthorized/);
});

test('礼部合规 adapter 在 transport 永不返回时按超时诚实降级', async () => {
  const watchdog = Symbol('watchdog');
  const result = await Promise.race([
    requestLifuComplianceReport(
      '核验文案',
      async () => new Promise<Response>(() => undefined),
      10,
    ),
    new Promise<typeof watchdog>((resolve) => setTimeout(() => resolve(watchdog), 100)),
  ]);

  assert.notEqual(result, watchdog, 'adapter 未在配置的超时内返回');
  if (result === watchdog) return;
  assert.equal(result.status, 'fallback');
  assert.equal(result.sourceLabel, 'FALLBACK');
  if (result.status === 'fallback') assert.match(result.error, /timed out|timeout|超时/i);
});

/**
 * 吏部招聘真链 · 回归断言(铁律4:把"假 trace 不许盖 LIVE_SWARM"钉死)
 * 跑:pnpm test:core
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRecruitEnvelope } from './recruit-envelope.ts';

const SID = '20260622_100645_7bf11a';

test('jiqun 没返回 session → FALLBACK,绝不 LIVE_SWARM', () => {
  const e = buildRecruitEnvelope({ jiqunOk: false, sessionId: null, reverify: null });
  assert.equal(e.sourceLabel, 'FALLBACK');
  assert.equal(e.success, false);
});

test('关键红队:有 session 但验真未通过 → 必须 FALLBACK,不盖 LIVE_SWARM', () => {
  const e = buildRecruitEnvelope({
    jiqunOk: true,
    sessionId: SID,
    reverify: { verified: false, reason: 'jiqun 无此 session(404)' },
  });
  assert.equal(e.sourceLabel, 'FALLBACK', '未兑现的 session 绝不能盖 LIVE_SWARM 帝金章');
  assert.ok(e.missingEvidence.length > 0, '降级必须说明缺证');
});

test('验真通过 → LIVE_SWARM + 带真 trace + confidence 高', () => {
  const e = buildRecruitEnvelope({
    jiqunOk: true,
    sessionId: SID,
    reverify: { verified: true, reason: 'jiqun 确认该 session 真存在' },
  });
  assert.equal(e.sourceLabel, 'LIVE_SWARM');
  assert.equal(e.trace_id, SID);
  assert.ok(e.confidence >= 0.8);
  assert.equal(e.missingEvidence.length, 0);
});

test('LIVE_SWARM 一定带 trace_id(不会是 null)', () => {
  const e = buildRecruitEnvelope({
    jiqunOk: true,
    sessionId: SID,
    reverify: { verified: true, reason: 'ok' },
  });
  assert.ok(e.sourceLabel !== 'LIVE_SWARM' || (typeof e.trace_id === 'string' && e.trace_id.length > 0));
});

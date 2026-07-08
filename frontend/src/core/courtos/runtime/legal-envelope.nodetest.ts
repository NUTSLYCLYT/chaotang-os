import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLegalEnvelope } from './legal-envelope.ts';

test('诚实闸: 验真未过 → FALLBACK,绝不冒充 LIVE_SWARM', () => {
  const notVerified = buildLegalEnvelope({
    jiqunOk: true,
    sessionId: '20260622_120000_abc',
    reverify: { verified: false, reason: 'trace 不可兑现' },
  });
  assert.equal(notVerified.sourceLabel, 'FALLBACK');

  const noSession = buildLegalEnvelope({ jiqunOk: false, sessionId: null, reverify: null });
  assert.equal(noSession.sourceLabel, 'FALLBACK');
  assert.equal(noSession.confidence, 0);

  const verified = buildLegalEnvelope({
    jiqunOk: true,
    sessionId: '20260622_120000_abc',
    reverify: { verified: true, reason: 'session 可兑现' },
  });
  assert.equal(verified.sourceLabel, 'LIVE_SWARM');
  assert.equal(verified.trace_id, '20260622_120000_abc');
});

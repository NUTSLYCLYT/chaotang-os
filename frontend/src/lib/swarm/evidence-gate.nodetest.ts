import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkEvidenceGate } from './evidence-gate.ts';
import type { EvidenceRecord, EvidenceType, EvidenceTrust } from '@/lib/contracts/evidence';

function rec(id: string, evidenceType: EvidenceType, trust: EvidenceTrust): EvidenceRecord {
  return {
    id, uploaderId: 'u1', tenantId: 't1', uploadedAt: '2026-06-28T00:00:00.000Z',
    filename: `${id}.pdf`, insight: '脱敏洞见', rawStaysClient: true,
    classification: { evidenceType, deptAffinity: ['xing_bu'], trust, confidence: 0.9, rationale: 'test' },
  };
}

test('证据齐备且可用 → pass', () => {
  const r = checkEvidenceGate(
    [rec('a', 'contract', 'user_uploaded'), rec('b', 'legal_doc', 'user_uploaded')],
    { required: ['contract', 'legal_doc'] },
  );
  assert.equal(r.verdict, 'pass');
  assert.deepEqual(r.missing, []);
});

test('缺必备证据 → reject(缺证打回)', () => {
  const r = checkEvidenceGate([rec('a', 'contract', 'user_uploaded')], { required: ['contract', 'legal_doc'] });
  assert.equal(r.verdict, 'reject');
  assert.deepEqual(r.missing, ['legal_doc']);
});

test('脏情报(jinyiwei_pending)被安全门挡 → blocked 且记未满足 → reject', () => {
  const r = checkEvidenceGate([rec('a', 'intel', 'jinyiwei_pending')], { required: ['intel'] });
  assert.equal(r.verdict, 'reject');
  assert.equal(r.blocked.length, 1);
  assert.equal(r.blocked[0].type, 'intel');
  assert.ok(r.missing.includes('intel')); // 脏情报不算"满足"
});

test('同类既有脏情报又有已核 → 已核可用,pass', () => {
  const r = checkEvidenceGate(
    [rec('a', 'intel', 'jinyiwei_pending'), rec('b', 'intel', 'jinyiwei_verified')],
    { required: ['intel'] },
  );
  assert.equal(r.verdict, 'pass');
  assert.deepEqual(r.blocked, []);
});

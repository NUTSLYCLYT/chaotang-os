import { test } from 'node:test';
import assert from 'node:assert/strict';

import { xingbuComplianceLens } from './xingbu-lens.ts';
import type { EvidenceRecord } from '@/lib/contracts/evidence';

function ev(type: EvidenceRecord['classification']['evidenceType']): EvidenceRecord {
  return {
    id: 'e1', uploaderId: 'u', tenantId: 't', uploadedAt: '2026-06-28T00:00:00.000Z',
    filename: 'f', insight: 'x', rawStaysClient: true,
    classification: { evidenceType: type, deptAffinity: ['xing_bu'], trust: 'user_uploaded', confidence: 0.9, rationale: '' },
  };
}

test('高危合同 → veto → needsSignoff(上人工门)', () => {
  const v = xingbuComplianceLens({ contractText: '乙方承担一切损失并负连带责任;甲方有权随时解除。' });
  assert.equal(v.clauseVerdict, 'veto');
  assert.equal(v.needsSignoff, true);
  assert.ok(v.flags.some((f) => f.includes('条款风险')));
  assert.match(v.summary, /人工\/法务复核/);
});

test('缺必备证据 → reject → needsSignoff', () => {
  const v = xingbuComplianceLens({ requiredEvidence: ['contract', 'legal_doc'], evidence: [ev('contract')] });
  assert.equal(v.evidenceVerdict, 'reject');
  assert.equal(v.needsSignoff, true);
  assert.ok(v.flags.some((f) => f.includes('缺证')));
});

test('无合同无证据要求 → n/a,不误触发', () => {
  const v = xingbuComplianceLens({});
  assert.equal(v.clauseVerdict, 'n/a');
  assert.equal(v.evidenceVerdict, 'n/a');
  assert.equal(v.needsSignoff, false);
  assert.match(v.summary, /无合同\/证据可审/);
});

test('干净合同+证据齐 → pass,不上人工门', () => {
  const v = xingbuComplianceLens({
    contractText: '双方协商解除。验收合格付款。争议仲裁。责任以合同金额为限。保密。',
    requiredEvidence: ['contract'], evidence: [ev('contract')],
  });
  assert.equal(v.clauseVerdict, 'pass');
  assert.equal(v.evidenceVerdict, 'pass');
  assert.equal(v.needsSignoff, false);
});

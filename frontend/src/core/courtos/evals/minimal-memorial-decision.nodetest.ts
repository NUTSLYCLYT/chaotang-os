import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildLocalDraftEdict,
  buildMinimalMemorialV1,
  localStatusAfterDecisionAction,
  shouldArchiveLocalDecision,
  type HumanConfirmationRecord,
  type LocalDecisionEntry,
} from '../../../lib/shangshufang/local-decision-loop.ts';

function readSchema(name: string) {
  const root = process.cwd();
  return JSON.parse(fs.readFileSync(path.join(root, 'dev/contracts/schemas', name), 'utf8')) as {
    required?: string[];
    properties?: Record<string, unknown>;
  };
}

function validateRequiredShape(schema: { required?: string[] }, value: Record<string, unknown>) {
  for (const field of schema.required ?? []) {
    assert.ok(Object.hasOwn(value, field), `generated memorial missing ${field}`);
  }
}

function simulateDecision(params: {
  action: 'adopt' | 'request_evidence' | 'recheck' | 'reject' | 'followup';
  reason?: string;
  humanNote?: string;
  followupQuestion?: string;
  highRisk: boolean;
  missingEvidence: string[];
  risks: string[];
}): LocalDecisionEntry {
  if (params.action === 'adopt' && params.highRisk && !params.humanNote?.trim()) {
    throw new Error('human_confirmation_required');
  }
  if (params.action === 'reject' && !params.reason?.trim()) {
    throw new Error('reject_reason_required');
  }
  if (params.action === 'followup' && !params.followupQuestion?.trim()) {
    throw new Error('followup_question_required');
  }
  const human_confirmation_record: HumanConfirmationRecord | undefined =
    params.action === 'adopt' && params.highRisk
      ? {
          confirmed_at: '2026-06-18T00:00:00.000Z',
          explanation: params.humanNote ?? '',
          risks: params.risks,
          missing_evidence: params.missingEvidence,
          source_label: 'FALLBACK',
        }
      : undefined;
  return {
    action: params.action,
    reason: params.reason ?? params.followupQuestion ?? '',
    human_confirmed: Boolean(human_confirmation_record),
    human_confirmation_record,
    followup_question: params.action === 'followup' ? params.followupQuestion : undefined,
    inherited_context:
      params.action === 'followup'
        ? {
            parent_task_id: 'task_goal4_quote',
            raw_question: '客户要求正式报价，要不要发？',
            memorial_next_order: '先补齐报价依据，再决定是否发正式报价',
            missing_evidence: params.missingEvidence,
            risk_register: params.risks,
          }
        : undefined,
    decided_at: '2026-06-18T00:00:00.000Z',
    source_label: 'FALLBACK',
  };
}

test('Goal 4 MemorialV1 schema lists required product fields', () => {
  const schema = readSchema('MemorialV1.json');
  for (const field of [
    'sacred_judgement',
    'executive_summary',
    'department_memorials',
    'evidence_chain',
    'missing_evidence',
    'risk_register',
    'conflict_summary',
    'next_order',
    'quality_gate',
    'source_label',
  ]) {
    assert.ok(schema.required?.includes(field), `MemorialV1 missing ${field}`);
  }
});

test('正式报价最小奏折建议补证或复核，并列出风险、缺口、后令', () => {
  const draft = buildLocalDraftEdict({
    taskId: 'task_goal4_quote',
    rawQuestion: '客户要求正式报价，要不要发？',
    sourceLabel: 'FALLBACK',
  });
  const memorial = buildMinimalMemorialV1('task_goal4_quote', draft);
  validateRequiredShape(readSchema('MemorialV1.json'), memorial as unknown as Record<string, unknown>);

  assert.equal(memorial.schema_version, 'MemorialV1');
  assert.ok(memorial.sacred_judgement === '补证' || memorial.sacred_judgement === '复核');
  assert.ok(memorial.risk_register?.includes('对外承诺风险'));
  assert.ok(memorial.risk_register?.includes('报价依据不足'));
  for (const gap of ['成本', '毛利', '付款条件', '报价有效期', '审批人', '客户需求确认']) {
    assert.ok(memorial.missing_evidence?.includes(gap), `missing ${gap}`);
  }
  assert.equal(memorial.next_order, '先补齐报价依据，再决定是否发正式报价');
  assert.equal(memorial.source_label, 'FALLBACK');
  assert.ok(memorial.quality_gate.blocking_issues?.some((item) => item.includes('FALLBACK')));
});

test('Goal 4 裁决动作：高风险采纳需确认、驳回需原因、追问继承上下文', () => {
  const missingEvidence = ['成本', '毛利', '付款条件'];
  const risks = ['对外承诺风险', '报价依据不足'];

  assert.throws(
    () => simulateDecision({ action: 'adopt', highRisk: true, missingEvidence, risks }),
    /human_confirmation_required/,
  );
  const adopted = simulateDecision({
    action: 'adopt',
    highRisk: true,
    humanNote: '已知悉报价依据不足，先采纳补证建议并由我承担风险确认。',
    missingEvidence,
    risks,
  });
  assert.equal(adopted.human_confirmed, true);
  assert.ok(adopted.human_confirmation_record?.explanation.includes('承担风险'));

  assert.throws(
    () => simulateDecision({ action: 'reject', highRisk: false, missingEvidence, risks }),
    /reject_reason_required/,
  );
  const rejected = simulateDecision({
    action: 'reject',
    reason: '报价问题定义不清，退回重拟。',
    highRisk: false,
    missingEvidence,
    risks,
  });
  assert.equal(rejected.reason, '报价问题定义不清，退回重拟。');

  const followup = simulateDecision({
    action: 'followup',
    followupQuestion: '如果只发预算区间是否可以？',
    highRisk: false,
    missingEvidence,
    risks,
  });
  assert.equal(followup.inherited_context?.parent_task_id, 'task_goal4_quote');
  assert.equal(followup.inherited_context?.raw_question, '客户要求正式报价，要不要发？');
});

test('上书房奏折批示后归档，驳回只留痕不入史馆', () => {
  assert.equal(localStatusAfterDecisionAction('adopt'), 'archived');
  assert.equal(shouldArchiveLocalDecision('adopt'), true);
  assert.equal(localStatusAfterDecisionAction('reject'), 'rejected');
  assert.equal(shouldArchiveLocalDecision('reject'), false);
});

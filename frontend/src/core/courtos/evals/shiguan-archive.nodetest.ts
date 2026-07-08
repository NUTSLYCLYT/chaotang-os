import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildLocalDraftEdict,
  buildMinimalMemorialV1,
  buildShiguanArchiveRecordV1,
  type LocalDecisionEntry,
  type LocalDecisionRecord,
} from '../../../lib/shangshufang/local-decision-loop.ts';

function requiredFields(schemaName: string): string[] {
  const schema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'dev/contracts/schemas', schemaName), 'utf8')) as {
    required?: string[];
  };
  return schema.required ?? [];
}

function assertHasRequired(schemaName: string, value: Record<string, unknown>) {
  for (const field of requiredFields(schemaName)) {
    assert.ok(Object.hasOwn(value, field), `${schemaName} generated value missing ${field}`);
  }
}

test('Goal 5 ShiguanArchiveRecordV1 records decision, memorial, source label and reusable lessons', () => {
  const taskId = 'task_goal5_quote';
  const now = '2026-06-18T00:00:00.000Z';
  const draft = buildLocalDraftEdict({
    taskId,
    rawQuestion: '客户要求正式报价，要不要发？',
    sourceLabel: 'FALLBACK',
  });
  const memorial = buildMinimalMemorialV1(taskId, draft);
  const record: LocalDecisionRecord = {
    source: 'courtos_local_shangshufang',
    trace_id: 'trace_goal5',
    task_id: taskId,
    raw_question: draft.original_question,
    status: 'awaiting_decision',
    draft_edict: draft,
    memorial,
    created_at: now,
    updated_at: now,
  };
  const decision: LocalDecisionEntry = {
    action: 'adopt',
    reason: '采纳补证建议，暂不发正式报价。',
    human_confirmed: true,
    human_confirmation_record: {
      confirmed_at: now,
      explanation: '已知悉 FALLBACK 只作缺口参考，本次采纳的是补证后令。',
      risks: memorial.risk_register ?? [],
      missing_evidence: memorial.missing_evidence ?? [],
      source_label: 'FALLBACK',
    },
    decided_at: now,
    source_label: 'FALLBACK',
  };

  const archive = buildShiguanArchiveRecordV1(record, decision, now);
  assertHasRequired('ShiguanArchiveRecordV1.json', archive as unknown as Record<string, unknown>);
  assertHasRequired('EmperorDecisionV1.json', archive.emperor_decision as unknown as Record<string, unknown>);
  assert.equal(archive.schema_version, 'ShiguanArchiveRecordV1');
  assert.equal(archive.original_question, '客户要求正式报价，要不要发？');
  assert.equal(archive.source_label, 'FALLBACK');
  assert.equal(archive.synthetic, true);
  assert.equal(archive.emperor_decision.action, 'adopt');
  assert.ok(archive.reusable_lessons.some((lesson) => lesson.includes('先补齐报价依据')));
  assert.ok(archive.reusable_lessons.some((lesson) => lesson.includes('FALLBACK')));
});

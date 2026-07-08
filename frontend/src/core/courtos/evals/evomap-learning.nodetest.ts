import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

import { buildEvoMapEventV1 } from '../evomap/evomap.ts';
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

test('Goal 10 EvoMapEventV1 records archive learning without auto applying changes', () => {
  const taskId = 'task_goal10_quote';
  const now = '2026-06-18T10:00:00.000Z';
  const draft = buildLocalDraftEdict({
    taskId,
    rawQuestion: '客户要求正式报价，要不要发？',
    sourceLabel: 'FALLBACK',
  });
  const memorial = buildMinimalMemorialV1(taskId, draft);
  const record: LocalDecisionRecord = {
    source: 'courtos_local_shangshufang',
    trace_id: 'trace_goal10',
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
    reason: '采纳补证后令，不发正式报价。',
    human_confirmed: true,
    decided_at: now,
    source_label: memorial.source_label,
  };
  const archive = buildShiguanArchiveRecordV1(record, decision, now);
  const event = buildEvoMapEventV1({
    taskId,
    originalQuestion: record.raw_question,
    userAction: 'adopt',
    sourceLabel: memorial.source_label,
    createdAt: now,
    archiveId: archive.archive_id,
    qualityGateStatus: memorial.quality_gate.status,
    blockingIssues: memorial.quality_gate.blocking_issues,
    missingEvidence: memorial.missing_evidence,
    riskRegister: memorial.risk_register,
    departmentIds: memorial.department_memorials.map((item) => item.department_id),
    swarmRuntimeStatus: memorial.swarm_trace_summary?.status ?? 'unknown',
    reusableLessons: archive.reusable_lessons,
  });

  assertHasRequired('EvoMapEventV1.json', event as unknown as Record<string, unknown>);
  assert.equal(event.schema_version, 'EvoMapEventV1');
  assert.equal(event.loop_trace_id, `loop_${taskId}`);
  assert.equal(event.loop_id, 'court_unified_decision_loop_v1');
  assert.equal(event.user_action, 'adopt');
  assert.equal(event.archive_id, archive.archive_id);
  assert.equal(event.auto_apply, false);
  assert.equal(event.source_label, memorial.source_label);
  assert.ok(event.recommended_change.includes('下次同类问题'));
  assert.ok(event.recommended_change.includes('真实蜂群 adapter') || event.recommended_change.includes('质门阻断项'));
  assert.ok((event.evidence_gap_count ?? 0) > 0);
});

test('Goal 10 follow-up learning inherits context and does not archive by itself', () => {
  const event = buildEvoMapEventV1({
    taskId: 'task_goal10_followup',
    originalQuestion: '上次报价为什么被打回？',
    userAction: 'follow_up',
    sourceLabel: 'FALLBACK',
    createdAt: '2026-06-18T10:01:00.000Z',
    qualityGateStatus: 'blocked',
    blockingIssues: ['followup_must_inherit_context'],
    missingEvidence: ['上次驳回原因', '旧报价单'],
    departmentIds: ['jinyiwei_intelligence', 'hubu_cfo'],
    swarmRuntimeStatus: 'skipped_not_required',
  });

  assert.equal(event.archive_id, undefined);
  assert.equal(event.loop_trace_id, 'loop_task_goal10_followup');
  assert.equal(event.auto_apply, false);
  assert.equal(event.user_action, 'follow_up');
  assert.ok(event.learned_preference.includes('继承'));
  assert.ok(event.recommended_change.includes('追问必须继承上下文'));
});

import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import test from 'node:test';

const dbPath = `/tmp/courtos-mvp-loop-e2e-${process.pid}.db`;
process.env.TURSO_DB_URL = `file:${dbPath}`;

async function removeTempDbFile(path: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(path, { force: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EBUSY' && code !== 'EPERM') throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

test('CourtOS MVP 端到端：正式报价问题从拟旨到预归档', async (t) => {
  t.after(async () => {
    const { getDb, resetDbClient } = await import('../../../lib/db/turso.ts');
    try {
      getDb().close();
    } catch {
      // The client may not have been initialized if setup fails before DB use.
    }
    resetDbClient();
    await removeTempDbFile(dbPath);
    await removeTempDbFile(`${dbPath}-shm`);
    await removeTempDbFile(`${dbPath}-wal`);
  });

  const {
    courtosHomeSnapshot,
    createDecision,
    createDraftEdict,
    createReview,
    getArchive,
    getDecisionTask,
    getDecisionTaskForUser,
    latestDraftForTask,
    listArchives,
    runReview,
    saveEditedDraftEdict,
  } = await import('../../../lib/db/courtos-decision-store.ts');

  const rawQuestion = '客户要求正式报价，要不要发？';
  const userId = 'user-owner-a';
  const otherUserId = 'user-owner-b';
  const { task, draft } = await createDraftEdict({ raw_question: rawQuestion, user_id: userId });
  const { task: otherTask } = await createDraftEdict({
    raw_question: '是否招聘一个大客户销售负责人？',
    user_id: otherUserId,
  });

  assert.equal(task.raw_question, rawQuestion);
  assert.equal(task.user_id, userId);
  assert.equal(task.status, 'awaiting_confirm');
  assert.equal(task.source_label, 'MIXED');
  assert.equal(draft.source_label, 'MIXED');
  assert.match(draft.refined_edict, /正式报价/);
  assert.equal(draft.payload.refinedQuestion, draft.refined_edict);
  assert.ok(draft.payload.unknownGaps.some((gap) => /人工确认|证据链|成本|毛利|付款|有效期|审批|客户需求/.test(gap)));
  assert.ok(task.risk_flags.some((risk) => /quote|formal|报价|毛利|人工确认/.test(risk)));

  const homeAfterDraft = await courtosHomeSnapshot({ user_id: userId });
  assert.equal(homeAfterDraft.recommended_issue, rawQuestion);
  assert.ok(homeAfterDraft.pending_decisions.some((item) => item.id === task.id));
  assert.ok(!homeAfterDraft.pending_decisions.some((item) => item.id === otherTask.id));
  assert.equal(await getDecisionTaskForUser(task.id, otherUserId), null);
  assert.equal((await getDecisionTaskForUser(task.id, userId))?.id, task.id);

  const editedDraft = await saveEditedDraftEdict({
    task_id: task.id,
    edited_edict: {
      ...draft.payload,
      refinedQuestion: `${draft.payload.refinedQuestion} 用户已补充：先禁止直接外发正式报价。`,
      unknownGaps: [...draft.payload.unknownGaps, '报价审批人'],
    },
  });
  const latestDraft = await latestDraftForTask(task.id);
  assert.equal(latestDraft?.id, editedDraft.id);
  assert.match(editedDraft.refined_edict, /禁止直接外发正式报价/);

  const { review } = await createReview({ task_id: task.id, confirmed_edict_id: editedDraft.id });
  assert.equal(review.status, 'reviewing');
  assert.equal(review.confirmed_edict_id, editedDraft.id);
  assert.equal(review.source_label, 'MIXED');
  assert.ok(review.selected_departments.length >= 5);
  assert.ok(review.selected_departments.some((id) => /jinyiwei|锦衣卫/i.test(id)));
  assert.ok(review.selected_departments.some((id) => /finance|户部/i.test(id)));
  assert.ok(review.selected_departments.some((id) => /war|兵部/i.test(id)));
  assert.ok(review.selected_departments.some((id) => /justice|刑部/i.test(id)));
  assert.ok(review.selected_departments.some((id) => /ritual|礼部/i.test(id)));

  const run = await runReview(review.id);
  assert.equal(run.review.status, 'awaiting_decision');
  assert.equal(run.loop_run.trace_id, `loop_${task.id}`);
  assert.ok(run.department_runs.length >= 5);
  assert.ok(run.department_runs.every((item) => item.trace_id === run.loop_run.trace_id));
  assert.equal(run.memorial.source_label, 'MIXED');
  assert.ok(['补证', '复核'].includes(run.memorial.sacred_judgement));
  assert.equal(run.memorial.human_confirmation_required, true);
  assert.ok(Array.isArray(run.memorial.content.missingEvidence));
  assert.ok((run.memorial.content.missingEvidence as string[]).some((gap) => /成本|毛利|付款|报价有效期|客户需求/.test(gap)));
  assert.ok(Array.isArray(run.memorial.content.risks));
  assert.ok((run.memorial.content.risks as string[]).some((risk) => /承诺|报价|人工确认|毛利/.test(risk)));
  assert.ok(typeof run.memorial.content.nextAction === 'string');

  const decisionResult = await createDecision({
    review_id: review.id,
    action: 'request_evidence',
    reason: '先补齐报价依据、成本毛利边界、付款条件、报价有效期和审批人。',
  });
  assert.equal(decisionResult.decision.source_label, 'MIXED');
  assert.ok(decisionResult.archive);
  assert.equal(decisionResult.archive.source_label, 'MIXED');
  assert.equal(decisionResult.archive.retrospective_status, 'awaiting_evidence');

  const updatedTask = await getDecisionTask(task.id);
  assert.equal(updatedTask?.status, 'awaiting_evidence');

  const archive = await getArchive(decisionResult.archive.id);
  assert.ok(archive);
  assert.equal(archive?.archive.original_question, rawQuestion);
  assert.equal(archive?.archive.loop_trace_id, run.loop_run.trace_id);
  assert.equal((archive?.archive.evomap_event as { loop_trace_id?: string } | undefined)?.loop_trace_id, run.loop_run.trace_id);
  assert.equal(archive?.archive.source_label, 'MIXED');
  assert.ok(archive?.archive.draft_edict);
  assert.ok(archive?.archive.memorial);
  assert.ok(archive?.archive.emperor_decision);

  const homeAfterDecision = await courtosHomeSnapshot({ user_id: userId });
  assert.ok(homeAfterDecision.awaiting_evidence.some((item) => item.id === task.id));
  assert.ok(!homeAfterDecision.awaiting_evidence.some((item) => item.id === otherTask.id));

  const archives = await listArchives({ limit: 5 });
  assert.ok(archives.some((item) => item.id === decisionResult.archive.id));
});

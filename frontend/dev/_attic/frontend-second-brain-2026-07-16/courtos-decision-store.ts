/** @deprecated P4c test-only archive. No production imports are permitted. */
import type { Client } from '@libsql/client';
import { ensurePrimaryDbReady } from './primary-store.ts';
import type { SourceLabel } from '../../core/courtos/types.ts';
import { loopTraceIdForTask } from '../../core/courtos/loop-trace.ts';
import {
  draftUnifiedEdict,
  planUnifiedReview,
  runCourtUnifiedDecisionLoop,
} from '../../core/courtos/unified/unified-decision-loop.ts';
import {
  buildUnifiedArchiveLearningRecord,
  buildUnifiedEvoMapEvent,
} from '../../core/courtos/unified/unified-learning.ts';
import {
  assertDecisionArchiveAllowed,
  mapDecisionActionToUnifiedUserAction,
  retrospectiveStatusForDecision,
  statusAfterArchive,
  statusFromDecisionAction,
} from '../../core/courtos/persistence/decision-archive-policy.ts';
import { listDepartments } from '../../core/courtos/unified/department-registry.ts';
import type {
  UnifiedDraftEdict,
  UnifiedLoopResult,
  UnifiedReviewPlan,
  UnifiedVerdict,
} from '../../core/courtos/unified/unified-types.ts';

type DbValue = string | number | bigint | ArrayBuffer | null;
type DbRow = Record<string, DbValue>;

export type CourtosTaskStatus =
  | 'draft'
  | 'awaiting_confirm'
  | 'reviewing'
  | 'awaiting_evidence'
  | 'awaiting_decision'
  | 'followuping'
  | 'rechecking'
  | 'adopted'
  | 'rejected'
  | 'archived'
  | 'failed_with_recovery';

export type EmperorDecisionAction = 'adopt' | 'request_evidence' | 'recheck' | 'reject' | 'followup';

export interface DecisionTaskRecord {
  id: string;
  user_id: string;
  raw_question: string;
  refined_edict: string;
  decision_type: string;
  status: CourtosTaskStatus;
  source_label: SourceLabel;
  risk_flags: string[];
  known_facts: string[];
  unknown_gaps: string[];
  created_at: string;
  updated_at: string;
}

export interface DraftEdictRecord {
  id: string;
  task_id: string;
  original_question: string;
  refined_edict: string;
  payload: UnifiedDraftEdict;
  source_label: SourceLabel;
  created_at: string;
  updated_at: string;
}

export interface CourtReviewRecord {
  id: string;
  task_id: string;
  confirmed_edict_id: string;
  status: CourtosTaskStatus;
  review_plan: UnifiedReviewPlan | Record<string, unknown>;
  selected_departments: string[];
  source_label: SourceLabel;
  created_at: string;
  updated_at: string;
}

export interface DepartmentReviewRunRecord {
  id: string;
  review_id: string;
  department_id: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  source_label: SourceLabel;
  trace_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

export interface MemorialRecord {
  id: string;
  review_id: string;
  task_id: string;
  sacred_judgement: string;
  confidence: number;
  content: Record<string, unknown>;
  quality_passed: boolean;
  human_confirmation_required: boolean;
  source_label: SourceLabel;
  created_at: string;
  updated_at: string;
}

export interface EmperorDecisionRecord {
  id: string;
  task_id: string;
  review_id: string;
  memorial_id: string;
  action: EmperorDecisionAction;
  reason: string;
  human_confirmed: boolean;
  confirmation_record: Record<string, unknown>;
  source_label: SourceLabel;
  created_at: string;
}

export interface ShiguanArchiveRecord {
  id: string;
  task_id: string;
  review_id: string;
  memorial_id: string;
  archive: Record<string, unknown>;
  source_label: SourceLabel;
  retrospective_status: string;
  created_at: string;
  updated_at: string;
}

export interface CourtLoopRunRecord {
  id: string;
  task_id: string;
  loop_id: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  source_label: SourceLabel;
  error: string | null;
  trace_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiEnvelope<T> {
  status: 'ok' | 'error';
  source_label: SourceLabel;
  task_id?: string;
  review_id?: string;
  loop_trace_id?: string;
  user_visible_message: string;
  next_action: string;
  data?: T;
  error?: string;
}

export interface EditableDraftEdictInput {
  original_question?: string;
  originalQuestion?: string;
  refined_edict?: string;
  refinedQuestion?: string;
  decision_type?: string;
  decisionType?: string;
  known_facts?: string[];
  knownFacts?: string[];
  unknown_gaps?: string[];
  unknownGaps?: string[];
  expected_memorial_format?: string[];
  expectedOutput?: string[];
  source_label?: SourceLabel;
  sourceLabel?: SourceLabel;
}

const SOURCE_LABELS = new Set<SourceLabel>(['LIVE', 'LIVE_SWARM', 'MIXED', 'FALLBACK', 'DEMO']);
const LOOP_ID = 'court_unified_decision_loop_v1';

function nowIso(): string {
  return new Date().toISOString();
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readString(row: DbRow, key: string, fallback = ''): string {
  const value = row[key];
  return value == null ? fallback : String(value);
}

function readNumber(row: DbRow, key: string, fallback = 0): number {
  const value = row[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asSourceLabel(value: unknown): SourceLabel {
  return typeof value === 'string' && SOURCE_LABELS.has(value as SourceLabel)
    ? (value as SourceLabel)
    : 'MIXED';
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function taskId(): string {
  return `task_${crypto.randomUUID()}`;
}

function recordId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function detectRiskFlags(question: string): string[] {
  const flags: string[] = [];
  if (/正式报价|报价|折扣|底价/.test(question)) flags.push('formal_quote_risk');
  if (/合同|协议|签字|盖章|独家|排他|违约/.test(question)) flags.push('legal_commitment_risk');
  if (/ROI|收益|回报|预算|毛利|现金|付款/.test(question)) flags.push('financial_risk');
  if (/客户回复|外发|宣传|招商|话术|邮件/.test(question)) flags.push('external_message_risk');
  return [...new Set(flags)];
}

function judgementFromVerdict(verdict: UnifiedVerdict): string {
  if (verdict === 'APPROVE') return '准奏';
  if (verdict === 'RECHECK') return '复核';
  if (verdict === 'REJECT') return '驳回';
  return '补证';
}

function confidenceFromResult(result: UnifiedLoopResult): number {
  if (result.sourceLabel === 'FALLBACK' || result.sourceLabel === 'DEMO') return 0.35;
  if (result.memorial.qualityGate.passed && result.memorial.missingEvidence.length === 0) return 0.82;
  if (result.memorial.missingEvidence.length > 4) return 0.48;
  return 0.62;
}

function normalizeAction(value: unknown): EmperorDecisionAction {
  if (value === 'adopt' || value === 'approve' || value === '采纳') return 'adopt';
  if (value === 'reject' || value === '驳回') return 'reject';
  if (value === 'recheck' || value === '复核') return 'recheck';
  if (value === 'followup' || value === '追问') return 'followup';
  return 'request_evidence';
}

async function db(): Promise<Client> {
  return ensurePrimaryDbReady();
}

function toDecisionTask(row: DbRow): DecisionTaskRecord {
  return {
    id: readString(row, 'id'),
    user_id: readString(row, 'user_id', 'local'),
    raw_question: readString(row, 'raw_question'),
    refined_edict: readString(row, 'refined_edict'),
    decision_type: readString(row, 'decision_type', '经营决策判断'),
    status: readString(row, 'status', 'draft') as CourtosTaskStatus,
    source_label: asSourceLabel(row.source_label),
    risk_flags: parseJson<string[]>(row.risk_flags, []),
    known_facts: parseJson<string[]>(row.known_facts, []),
    unknown_gaps: parseJson<string[]>(row.unknown_gaps, []),
    created_at: readString(row, 'created_at'),
    updated_at: readString(row, 'updated_at'),
  };
}

function toDraftEdict(row: DbRow): DraftEdictRecord {
  return {
    id: readString(row, 'id'),
    task_id: readString(row, 'task_id'),
    original_question: readString(row, 'original_question'),
    refined_edict: readString(row, 'refined_edict'),
    payload: parseJson<UnifiedDraftEdict>(row.payload_json, draftUnifiedEdict(readString(row, 'original_question'))),
    source_label: asSourceLabel(row.source_label),
    created_at: readString(row, 'created_at'),
    updated_at: readString(row, 'updated_at'),
  };
}

function toReview(row: DbRow): CourtReviewRecord {
  return {
    id: readString(row, 'id'),
    task_id: readString(row, 'task_id'),
    confirmed_edict_id: readString(row, 'confirmed_edict_id'),
    status: readString(row, 'status', 'reviewing') as CourtosTaskStatus,
    review_plan: parseJson<UnifiedReviewPlan | Record<string, unknown>>(row.review_plan_json, {}),
    selected_departments: parseJson<string[]>(row.selected_departments, []),
    source_label: asSourceLabel(row.source_label),
    created_at: readString(row, 'created_at'),
    updated_at: readString(row, 'updated_at'),
  };
}

function toRun(row: DbRow): DepartmentReviewRunRecord {
  return {
    id: readString(row, 'id'),
    review_id: readString(row, 'review_id'),
    department_id: readString(row, 'department_id'),
    status: readString(row, 'status', 'pending'),
    input: parseJson<Record<string, unknown>>(row.input_json, {}),
    output: parseJson<Record<string, unknown> | null>(row.output_json, null),
    source_label: asSourceLabel(row.source_label),
    trace_id: row.trace_id == null ? null : String(row.trace_id),
    started_at: row.started_at == null ? null : String(row.started_at),
    finished_at: row.finished_at == null ? null : String(row.finished_at),
    error: row.error == null ? null : String(row.error),
  };
}

function toMemorial(row: DbRow): MemorialRecord {
  return {
    id: readString(row, 'id'),
    review_id: readString(row, 'review_id'),
    task_id: readString(row, 'task_id'),
    sacred_judgement: readString(row, 'sacred_judgement', '补证'),
    confidence: readNumber(row, 'confidence', 0.5),
    content: parseJson<Record<string, unknown>>(row.content_json, {}),
    quality_passed: readNumber(row, 'quality_passed') === 1,
    human_confirmation_required: readNumber(row, 'human_confirmation_required') === 1,
    source_label: asSourceLabel(row.source_label),
    created_at: readString(row, 'created_at'),
    updated_at: readString(row, 'updated_at'),
  };
}

function toDecision(row: DbRow): EmperorDecisionRecord {
  return {
    id: readString(row, 'id'),
    task_id: readString(row, 'task_id'),
    review_id: readString(row, 'review_id'),
    memorial_id: readString(row, 'memorial_id'),
    action: normalizeAction(row.action),
    reason: readString(row, 'reason'),
    human_confirmed: readNumber(row, 'human_confirmed') === 1,
    confirmation_record: parseJson<Record<string, unknown>>(row.confirmation_record_json, {}),
    source_label: asSourceLabel(row.source_label),
    created_at: readString(row, 'created_at'),
  };
}

function toArchive(row: DbRow): ShiguanArchiveRecord {
  return {
    id: readString(row, 'id'),
    task_id: readString(row, 'task_id'),
    review_id: readString(row, 'review_id'),
    memorial_id: readString(row, 'memorial_id'),
    archive: parseJson<Record<string, unknown>>(row.archive_json, {}),
    source_label: asSourceLabel(row.source_label),
    retrospective_status: readString(row, 'retrospective_status', 'not_started'),
    created_at: readString(row, 'created_at'),
    updated_at: readString(row, 'updated_at'),
  };
}

function toLoopRun(row: DbRow): CourtLoopRunRecord {
  return {
    id: readString(row, 'id'),
    task_id: readString(row, 'task_id'),
    loop_id: readString(row, 'loop_id', LOOP_ID),
    status: readString(row, 'status'),
    input: parseJson<Record<string, unknown>>(row.input_json, {}),
    output: parseJson<Record<string, unknown> | null>(row.output_json, null),
    source_label: asSourceLabel(row.source_label),
    error: row.error == null ? null : String(row.error),
    trace_id: row.trace_id == null ? null : String(row.trace_id),
    created_at: readString(row, 'created_at'),
    updated_at: readString(row, 'updated_at'),
  };
}

export async function createDraftEdict(input: {
  raw_question: string;
  user_id?: string;
  source_label?: SourceLabel;
}): Promise<{ task: DecisionTaskRecord; draft: DraftEdictRecord }> {
  const rawQuestion = input.raw_question.trim();
  if (rawQuestion.length < 5) throw new Error('raw_question_too_short');

  const sourceLabel = input.source_label ?? 'MIXED';
  const draft = draftUnifiedEdict(rawQuestion, sourceLabel);
  const createdAt = nowIso();
  const task = taskId();
  const draftId = recordId('edict');
  const conn = await db();

  await conn.execute({
    sql: `
      INSERT INTO decision_tasks
        (id, user_id, raw_question, refined_edict, decision_type, status, source_label, risk_flags, known_facts, unknown_gaps, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      task,
      input.user_id ?? 'local',
      rawQuestion,
      draft.refinedQuestion,
      draft.decisionType,
      'awaiting_confirm',
      draft.sourceLabel,
      json(detectRiskFlags(rawQuestion)),
      json(draft.knownFacts),
      json(draft.unknownGaps),
      createdAt,
      createdAt,
    ],
  });

  await conn.execute({
    sql: `
      INSERT INTO draft_edicts
        (id, task_id, original_question, refined_edict, payload_json, source_label, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [draftId, task, rawQuestion, draft.refinedQuestion, json(draft), draft.sourceLabel, createdAt, createdAt],
  });

  const savedTask = await getDecisionTask(task);
  const savedDraft = await getDraftEdict(draftId);
  if (!savedTask || !savedDraft) throw new Error('draft_persistence_failed');
  return { task: savedTask, draft: savedDraft };
}

export async function saveEditedDraftEdict(input: {
  task_id: string;
  edited_edict: EditableDraftEdictInput;
}): Promise<DraftEdictRecord> {
  const task = await getDecisionTask(input.task_id);
  if (!task) throw new Error('task_not_found');

  const edited = input.edited_edict;
  const originalQuestion = (
    edited.original_question ??
    edited.originalQuestion ??
    task.raw_question
  ).trim();
  const refinedQuestion = (
    edited.refined_edict ??
    edited.refinedQuestion ??
    task.refined_edict
  ).trim();
  if (!originalQuestion || !refinedQuestion) throw new Error('edited_edict_invalid');

  const sourceLabel = asSourceLabel(edited.source_label ?? edited.sourceLabel ?? task.source_label);
  const payload: UnifiedDraftEdict = {
    originalQuestion,
    refinedQuestion,
    decisionType: edited.decision_type ?? edited.decisionType ?? task.decision_type,
    knownFacts: asStringArray(edited.known_facts ?? edited.knownFacts).length
      ? asStringArray(edited.known_facts ?? edited.knownFacts)
      : task.known_facts,
    unknownGaps: asStringArray(edited.unknown_gaps ?? edited.unknownGaps).length
      ? asStringArray(edited.unknown_gaps ?? edited.unknownGaps)
      : task.unknown_gaps,
    expectedOutput: asStringArray(edited.expected_memorial_format ?? edited.expectedOutput).length
      ? asStringArray(edited.expected_memorial_format ?? edited.expectedOutput)
      : ['圣裁', '分奏', '证据', '风险', '后令', '质门', '来源'],
    sourceLabel,
  };

  const draftId = recordId('edict');
  const createdAt = nowIso();
  const conn = await db();
  await conn.execute({
    sql: `
      INSERT INTO draft_edicts
        (id, task_id, original_question, refined_edict, payload_json, source_label, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [draftId, task.id, originalQuestion, refinedQuestion, json(payload), sourceLabel, createdAt, createdAt],
  });
  await conn.execute({
    sql: `
      UPDATE decision_tasks
      SET refined_edict = ?, decision_type = ?, source_label = ?, known_facts = ?, unknown_gaps = ?, updated_at = ?
      WHERE id = ?
    `,
    args: [
      refinedQuestion,
      payload.decisionType,
      sourceLabel,
      json(payload.knownFacts),
      json(payload.unknownGaps),
      createdAt,
      task.id,
    ],
  });

  const savedDraft = await getDraftEdict(draftId);
  if (!savedDraft) throw new Error('edited_draft_persistence_failed');
  return savedDraft;
}

export async function getDecisionTask(taskId_: string): Promise<DecisionTaskRecord | null> {
  const conn = await db();
  const res = await conn.execute({ sql: 'SELECT * FROM decision_tasks WHERE id = ? LIMIT 1', args: [taskId_] });
  const row = res.rows[0] as DbRow | undefined;
  return row ? toDecisionTask(row) : null;
}

export async function getDecisionTaskForUser(taskId_: string, userId: string): Promise<DecisionTaskRecord | null> {
  const conn = await db();
  const res = await conn.execute({
    sql: 'SELECT * FROM decision_tasks WHERE id = ? AND user_id = ? LIMIT 1',
    args: [taskId_, userId],
  });
  const row = res.rows[0] as DbRow | undefined;
  return row ? toDecisionTask(row) : null;
}

export async function listDecisionTasks(options: {
  limit?: number;
  status?: string | null;
  user_id?: string | null;
} = {}): Promise<DecisionTaskRecord[]> {
  const conn = await db();
  const limit = Math.min(Math.max(Number(options.limit ?? 30), 1), 100);
  const status = options.status?.trim();
  const userId = options.user_id?.trim();
  const where: string[] = [];
  const args: DbValue[] = [];
  if (status) {
    where.push('status = ?');
    args.push(status);
  }
  if (userId) {
    where.push('user_id = ?');
    args.push(userId);
  }
  args.push(limit);
  const res = await conn.execute({
    sql: `
      SELECT * FROM decision_tasks
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY updated_at DESC
      LIMIT ?
    `,
    args,
  });
  return (res.rows as DbRow[]).map(toDecisionTask);
}

export async function getDraftEdict(draftId: string): Promise<DraftEdictRecord | null> {
  const conn = await db();
  const res = await conn.execute({ sql: 'SELECT * FROM draft_edicts WHERE id = ? LIMIT 1', args: [draftId] });
  const row = res.rows[0] as DbRow | undefined;
  return row ? toDraftEdict(row) : null;
}

export async function latestDraftForTask(taskId_: string): Promise<DraftEdictRecord | null> {
  const conn = await db();
  const res = await conn.execute({
    sql: 'SELECT * FROM draft_edicts WHERE task_id = ? ORDER BY created_at DESC LIMIT 1',
    args: [taskId_],
  });
  const row = res.rows[0] as DbRow | undefined;
  return row ? toDraftEdict(row) : null;
}

export async function createReview(input: {
  task_id: string;
  confirmed_edict_id?: string;
}): Promise<{ task: DecisionTaskRecord; draft: DraftEdictRecord; review: CourtReviewRecord }> {
  const task = await getDecisionTask(input.task_id);
  if (!task) throw new Error('task_not_found');
  const draft = input.confirmed_edict_id
    ? await getDraftEdict(input.confirmed_edict_id)
    : await latestDraftForTask(input.task_id);
  if (!draft) throw new Error('draft_edict_not_found');

  const reviewPlan = planUnifiedReview({
    taskId: task.id,
    draftEdict: draft.payload,
    sourceLabel: draft.source_label,
  });
  const reviewId = recordId('review');
  const createdAt = nowIso();
  const conn = await db();

  await conn.execute({
    sql: `
      INSERT INTO court_reviews
        (id, task_id, confirmed_edict_id, status, review_plan_json, selected_departments, source_label, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      reviewId,
      task.id,
      draft.id,
      'reviewing',
      json(reviewPlan),
      json(reviewPlan.selectedDepartments),
      reviewPlan.sourceLabel,
      createdAt,
      createdAt,
    ],
  });

  await updateTaskStatus(task.id, 'reviewing', createdAt);
  const savedTask = await getDecisionTask(task.id);
  const review = await getReview(reviewId);
  if (!savedTask || !review) throw new Error('review_persistence_failed');
  return { task: savedTask, draft, review };
}

export async function getReview(reviewId: string): Promise<CourtReviewRecord | null> {
  const conn = await db();
  const res = await conn.execute({ sql: 'SELECT * FROM court_reviews WHERE id = ? LIMIT 1', args: [reviewId] });
  const row = res.rows[0] as DbRow | undefined;
  return row ? toReview(row) : null;
}

export async function getReviewForUser(reviewId: string, userId: string): Promise<CourtReviewRecord | null> {
  const review = await getReview(reviewId);
  if (!review) return null;
  const task = await getDecisionTaskForUser(review.task_id, userId);
  return task ? review : null;
}

export async function latestReviewForTask(taskId_: string): Promise<CourtReviewRecord | null> {
  const conn = await db();
  const res = await conn.execute({
    sql: 'SELECT * FROM court_reviews WHERE task_id = ? ORDER BY created_at DESC LIMIT 1',
    args: [taskId_],
  });
  const row = res.rows[0] as DbRow | undefined;
  return row ? toReview(row) : null;
}

export async function listDepartmentRuns(reviewId: string): Promise<DepartmentReviewRunRecord[]> {
  const conn = await db();
  const res = await conn.execute({
    sql: 'SELECT * FROM department_review_runs WHERE review_id = ? ORDER BY started_at ASC',
    args: [reviewId],
  });
  return (res.rows as DbRow[]).map(toRun);
}

export async function runReview(reviewId: string): Promise<{
  review: CourtReviewRecord;
  loop_run: CourtLoopRunRecord;
  memorial: MemorialRecord;
  department_runs: DepartmentReviewRunRecord[];
}> {
  const review = await getReview(reviewId);
  if (!review) throw new Error('review_not_found');
  const task = await getDecisionTask(review.task_id);
  if (!task) throw new Error('task_not_found');
  const runId = recordId('looprun');
  const traceId = loopTraceIdForTask(task.id);
  const startedAt = nowIso();
  const conn = await db();

  await conn.execute({
    sql: `
      INSERT INTO court_loop_runs
        (id, task_id, loop_id, status, input_json, output_json, source_label, error, trace_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      runId,
      task.id,
      LOOP_ID,
      'running',
      json({ review_id: review.id, raw_question: task.raw_question }),
      null,
      review.source_label,
      null,
      traceId,
      startedAt,
      startedAt,
    ],
  });

  try {
    const result = runCourtUnifiedDecisionLoop({
      rawQuestion: task.raw_question,
      taskId: task.id,
      sourceLabel: review.source_label,
    });
    const finishedAt = nowIso();

    for (const opinion of result.departmentOpinions) {
      await conn.execute({
        sql: `
          INSERT INTO department_review_runs
            (id, review_id, department_id, status, input_json, output_json, source_label, trace_id, started_at, finished_at, error)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          recordId('dept_run'),
          review.id,
          opinion.departmentId,
          'completed',
          json({ work_order: (result.departmentWorkOrders as Record<string, unknown>)[opinion.departmentId] ?? null }),
          json(opinion),
          opinion.sourceLabel,
          traceId,
          startedAt,
          finishedAt,
          null,
        ],
      });
    }

    const memorialId = recordId('memorial');
    await conn.execute({
      sql: `
        INSERT INTO memorials
          (id, review_id, task_id, sacred_judgement, confidence, content_json, quality_passed, human_confirmation_required, source_label, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        memorialId,
        review.id,
        task.id,
        judgementFromVerdict(result.memorial.verdict),
        confidenceFromResult(result),
        json(result.memorial),
        result.memorial.qualityGate.passed ? 1 : 0,
        result.memorial.needsHumanConfirmation ? 1 : 0,
        result.sourceLabel,
        finishedAt,
        finishedAt,
      ],
    });

    await conn.execute({
      sql: 'UPDATE court_reviews SET status = ?, review_plan_json = ?, selected_departments = ?, source_label = ?, updated_at = ? WHERE id = ?',
      args: [
        'awaiting_decision',
        json(result.reviewPlan),
        json(result.reviewPlan.selectedDepartments),
        result.sourceLabel,
        finishedAt,
        review.id,
      ],
    });
    await updateTaskStatus(task.id, 'awaiting_decision', finishedAt);
    await conn.execute({
      sql: 'UPDATE court_loop_runs SET status = ?, output_json = ?, error = NULL, updated_at = ? WHERE id = ?',
      args: ['completed', json(result), finishedAt, runId],
    });

    const savedReview = await getReview(review.id);
    const savedLoopRun = await getLoopRun(runId);
    const memorial = await getMemorial(memorialId);
    const runs = await listDepartmentRuns(review.id);
    if (!savedReview || !savedLoopRun || !memorial) throw new Error('review_run_persistence_failed');
    return { review: savedReview, loop_run: savedLoopRun, memorial, department_runs: runs };
  } catch (error) {
    const finishedAt = nowIso();
    await conn.execute({
      sql: 'UPDATE court_loop_runs SET status = ?, error = ?, updated_at = ? WHERE id = ?',
      args: ['failed_with_recovery', error instanceof Error ? error.message : String(error), finishedAt, runId],
    });
    await updateTaskStatus(task.id, 'failed_with_recovery', finishedAt);
    throw error;
  }
}

export async function getLoopRun(runId: string): Promise<CourtLoopRunRecord | null> {
  const conn = await db();
  const res = await conn.execute({ sql: 'SELECT * FROM court_loop_runs WHERE id = ? LIMIT 1', args: [runId] });
  const row = res.rows[0] as DbRow | undefined;
  return row ? toLoopRun(row) : null;
}

export async function latestMemorialForReview(reviewId: string): Promise<MemorialRecord | null> {
  const conn = await db();
  const res = await conn.execute({
    sql: 'SELECT * FROM memorials WHERE review_id = ? ORDER BY created_at DESC LIMIT 1',
    args: [reviewId],
  });
  const row = res.rows[0] as DbRow | undefined;
  return row ? toMemorial(row) : null;
}

export async function getMemorial(memorialId: string): Promise<MemorialRecord | null> {
  const conn = await db();
  const res = await conn.execute({ sql: 'SELECT * FROM memorials WHERE id = ? LIMIT 1', args: [memorialId] });
  const row = res.rows[0] as DbRow | undefined;
  return row ? toMemorial(row) : null;
}

export async function createDecision(input: {
  review_id: string;
  action: unknown;
  reason?: string;
  human_confirmed?: boolean;
  confirmation_record?: Record<string, unknown>;
}): Promise<{ decision: EmperorDecisionRecord; archive: ShiguanArchiveRecord | null }> {
  const review = await getReview(input.review_id);
  if (!review) throw new Error('review_not_found');
  const memorial = await latestMemorialForReview(review.id);
  if (!memorial) throw new Error('memorial_not_found');
  const action = normalizeAction(input.action);
  assertDecisionArchiveAllowed({
    action,
    humanConfirmed: input.human_confirmed === true,
    humanConfirmationRequired: memorial.human_confirmation_required,
    qualityPassed: memorial.quality_passed,
    sourceLabel: memorial.source_label,
  });
  const createdAt = nowIso();
  const decisionId = recordId('decision');
  const conn = await db();

  await conn.execute({
    sql: `
      INSERT INTO emperor_decisions
        (id, task_id, review_id, memorial_id, action, reason, human_confirmed, confirmation_record_json, source_label, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      decisionId,
      review.task_id,
      review.id,
      memorial.id,
      action,
      input.reason ?? '',
      input.human_confirmed ? 1 : 0,
      json(input.confirmation_record ?? {}),
      memorial.source_label,
      createdAt,
    ],
  });

  const nextStatus = statusFromDecisionAction(action) as CourtosTaskStatus;
  await updateTaskStatus(review.task_id, nextStatus, createdAt);
  await conn.execute({
    sql: 'UPDATE court_reviews SET status = ?, updated_at = ? WHERE id = ?',
    args: [nextStatus, createdAt, review.id],
  });

  const decision = await getDecision(decisionId);
  if (!decision) throw new Error('decision_persistence_failed');
  const decisionStatus = nextStatus;
  const archive = action === 'reject'
    ? null
    : await createArchiveRecord({
        task_id: review.task_id,
        review_id: review.id,
        memorial_id: memorial.id,
        decision,
        retrospective_status: retrospectiveStatusForDecision(action),
      });
  const finalStatus = (archive ? statusAfterArchive(action) : decisionStatus) as CourtosTaskStatus;
  if (finalStatus !== decisionStatus) {
    await updateTaskStatus(review.task_id, finalStatus, createdAt);
    await conn.execute({
      sql: 'UPDATE court_reviews SET status = ?, updated_at = ? WHERE id = ?',
      args: [finalStatus, createdAt, review.id],
    });
  }
  return { decision, archive };
}

export async function getDecision(decisionId: string): Promise<EmperorDecisionRecord | null> {
  const conn = await db();
  const res = await conn.execute({ sql: 'SELECT * FROM emperor_decisions WHERE id = ? LIMIT 1', args: [decisionId] });
  const row = res.rows[0] as DbRow | undefined;
  return row ? toDecision(row) : null;
}

async function createArchiveRecord(input: {
  task_id: string;
  review_id: string;
  memorial_id: string;
  decision: EmperorDecisionRecord;
  retrospective_status: string;
}): Promise<ShiguanArchiveRecord> {
  const task = await getDecisionTask(input.task_id);
  const review = await getReview(input.review_id);
  const draft = await latestDraftForTask(input.task_id);
  const memorial = await getMemorial(input.memorial_id);
  if (!task || !review || !draft || !memorial) throw new Error('archive_source_not_found');

  const createdAt = nowIso();
  const archiveId = recordId('archive');
  const loopResult = runCourtUnifiedDecisionLoop({
    rawQuestion: task.raw_question,
    taskId: task.id,
    sourceLabel: memorial.source_label,
  });
  const loopTraceId = loopResult.loopTraceId;
  const userAction = mapDecisionActionToUnifiedUserAction(input.decision.action);
  const learningRecord = buildUnifiedArchiveLearningRecord({
    result: loopResult,
    userAction,
    createdAt,
  });
  const evomapEvent = buildUnifiedEvoMapEvent({
    result: loopResult,
    userAction,
    createdAt,
  });
  const archive = {
    archive_id: archiveId,
    task_id: task.id,
    loop_trace_id: loopTraceId,
    review_id: review.id,
    memorial_id: memorial.id,
    original_question: task.raw_question,
    draft_edict: draft.payload,
    review_plan: review.review_plan,
    memorial: memorial.content,
    emperor_decision: input.decision,
    evidence_chain: (memorial.content.evidence ?? memorial.content.evidence_chain ?? []) as unknown,
    source_label: memorial.source_label,
    human_confirmation_record: input.decision.confirmation_record,
    learning_record: learningRecord,
    evomap_event: evomapEvent,
    created_at: createdAt,
    retrospective_status: input.retrospective_status,
  };
  const conn = await db();
  await conn.execute({
    sql: `
      INSERT INTO shiguan_archives
        (id, task_id, review_id, memorial_id, archive_json, source_label, retrospective_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      archiveId,
      task.id,
      review.id,
      memorial.id,
      json(archive),
      memorial.source_label,
      input.retrospective_status,
      createdAt,
      createdAt,
    ],
  });

  const saved = await getArchive(archiveId);
  if (!saved) throw new Error('archive_persistence_failed');
  return saved;
}

export async function getArchive(archiveId: string): Promise<ShiguanArchiveRecord | null> {
  const conn = await db();
  const res = await conn.execute({ sql: 'SELECT * FROM shiguan_archives WHERE id = ? LIMIT 1', args: [archiveId] });
  const row = res.rows[0] as DbRow | undefined;
  return row ? toArchive(row) : null;
}

export async function getArchiveForUser(archiveId: string, userId: string): Promise<ShiguanArchiveRecord | null> {
  const archive = await getArchive(archiveId);
  if (!archive) return null;
  const task = await getDecisionTaskForUser(archive.task_id, userId);
  return task ? archive : null;
}

export async function listArchives(options: { limit?: number; user_id?: string | null } = {}): Promise<ShiguanArchiveRecord[]> {
  const conn = await db();
  const limit = Math.min(Math.max(Number(options.limit ?? 30), 1), 100);
  const userId = options.user_id?.trim();
  const where = userId ? 'WHERE decision_tasks.user_id = ?' : '';
  const res = await conn.execute({
    sql: `
      SELECT shiguan_archives.*
      FROM shiguan_archives
      JOIN decision_tasks ON decision_tasks.id = shiguan_archives.task_id
      ${where}
      ORDER BY shiguan_archives.created_at DESC
      LIMIT ?
    `,
    args: userId ? [userId, limit] : [limit],
  });
  return (res.rows as DbRow[]).map(toArchive);
}

export async function updateArchiveRetrospective(input: {
  archive_id: string;
  retrospective_status: string;
  retrospective?: Record<string, unknown>;
}): Promise<ShiguanArchiveRecord> {
  const current = await getArchive(input.archive_id);
  if (!current) throw new Error('archive_not_found');
  const updatedAt = nowIso();
  const archive = {
    ...current.archive,
    retrospective_status: input.retrospective_status,
    retrospective: input.retrospective ?? current.archive.retrospective ?? null,
  };
  const conn = await db();
  await conn.execute({
    sql: 'UPDATE shiguan_archives SET retrospective_status = ?, archive_json = ?, updated_at = ? WHERE id = ?',
    args: [input.retrospective_status, json(archive), updatedAt, input.archive_id],
  });
  const saved = await getArchive(input.archive_id);
  if (!saved) throw new Error('archive_update_failed');
  return saved;
}

export async function getReviewProgress(reviewId: string): Promise<{
  review: CourtReviewRecord;
  department_runs: DepartmentReviewRunRecord[];
  memorial: MemorialRecord | null;
}> {
  const review = await getReview(reviewId);
  if (!review) throw new Error('review_not_found');
  const [departmentRuns, memorial] = await Promise.all([
    listDepartmentRuns(reviewId),
    latestMemorialForReview(reviewId),
  ]);
  return { review, department_runs: departmentRuns, memorial };
}

export async function updateTaskStatus(taskId_: string, status: CourtosTaskStatus, at = nowIso()): Promise<void> {
  const conn = await db();
  await conn.execute({
    sql: 'UPDATE decision_tasks SET status = ?, updated_at = ? WHERE id = ?',
    args: [status, at, taskId_],
  });
}

export async function courtosHomeSnapshot(options: { user_id?: string | null } = {}): Promise<{
  recommended_issue: string | null;
  pending_decisions: DecisionTaskRecord[];
  awaiting_evidence: DecisionTaskRecord[];
  source_label: SourceLabel;
}> {
  const user_id = options.user_id ?? null;
  const [confirming, reviewing, pending, evidence] = await Promise.all([
    listDecisionTasks({ status: 'awaiting_confirm', limit: 10, user_id }),
    listDecisionTasks({ status: 'reviewing', limit: 10, user_id }),
    listDecisionTasks({ status: 'awaiting_decision', limit: 10, user_id }),
    listDecisionTasks({ status: 'awaiting_evidence', limit: 10, user_id }),
  ]);
  const active = [...pending, ...confirming, ...reviewing];
  return {
    recommended_issue: active[0]?.raw_question ?? evidence[0]?.raw_question ?? null,
    pending_decisions: active,
    awaiting_evidence: evidence,
    source_label: active[0]?.source_label ?? evidence[0]?.source_label ?? 'MIXED',
  };
}

export function departmentsSnapshot(): Record<string, unknown>[] {
  return listDepartments().map((department) => ({
    id: department.id,
    name: department.name,
    type: department.category,
    enabled: department.enabled,
    display_role: department.modernRole,
    review_skill: department.mission,
    output_schema: department.outputContract,
    route_keywords: department.triggerKeywords,
    risk_triggers: department.highRiskKeywords,
    default_participation: department.id === 'jinyiwei' ? 'always_first' : 'registry_routed',
    user_visible_summary: department.mission,
    status: department.enabled ? 'active' : 'placeholder',
  }));
}

export function apiOk<T>(params: {
  source_label?: SourceLabel;
  task_id?: string;
  review_id?: string;
  loop_trace_id?: string;
  user_visible_message: string;
  next_action: string;
  data: T;
}): ApiEnvelope<T> {
  return {
    status: 'ok',
    source_label: params.source_label ?? 'MIXED',
    task_id: params.task_id,
    review_id: params.review_id,
    loop_trace_id: params.loop_trace_id ?? (params.task_id ? loopTraceIdForTask(params.task_id) : undefined),
    user_visible_message: params.user_visible_message,
    next_action: params.next_action,
    data: params.data,
  };
}

export function apiError(params: {
  source_label?: SourceLabel;
  task_id?: string;
  review_id?: string;
  loop_trace_id?: string;
  message: string;
  next_action?: string;
  error?: string;
}): ApiEnvelope<null> {
  return {
    status: 'error',
    source_label: params.source_label ?? 'FALLBACK',
    task_id: params.task_id,
    review_id: params.review_id,
    loop_trace_id: params.loop_trace_id ?? (params.task_id ? loopTraceIdForTask(params.task_id) : undefined),
    user_visible_message: params.message,
    next_action: params.next_action ?? '请稍后重试或查看任务状态',
    data: null,
    error: params.error,
  };
}

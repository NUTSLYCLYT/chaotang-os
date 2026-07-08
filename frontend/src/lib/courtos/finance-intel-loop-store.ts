import { ensurePrimaryDbReady, updatePrimaryTaskResult, upsertPrimaryTask } from '@/lib/db/primary-store';
import type { SourceLabel } from '@/core/courtos/types';
import type { FinancialSourceCollection } from '@/lib/jinyiwei/financial-source-collector';
import type { InternalBudgetEvidencePack } from '@/lib/jinyiwei/internal-budget-evidence';
import {
  assertLiveSourcesHaveUrls,
  normalizeFinancialSourceCredibility,
  normalizeFinancialSourceType,
  sourceUrls,
  type FinancialSourceRef,
} from '@/lib/jinyiwei/source-gates';

type DbValue = string | number | bigint | ArrayBuffer | null;
type DbRow = Record<string, DbValue>;

export type FinanceLoopStatus =
  | 'issue_created'
  | 'evidence_collecting'
  | 'evidence_ready'
  | 'swarm_running'
  | 'memorial_ready'
  | 'brief_ready'
  | 'awaiting_authorized_decision'
  | 'needs_evidence'
  | 'review_requested'
  | 'instruction_issued'
  | 'execution_running'
  | 'return_report_ready'
  | 'archived'
  | 'rejected';

export type InstructionType = 'decree' | 'evidence_order' | 'review_order' | 'reject_order';

export type DecreeExecutionType =
  | 'create_watchlist'
  | 'start_due_diligence'
  | 'request_second_valuation'
  | 'prepare_investment_memo'
  | 'notify_finance_owner'
  | 'no_action_archive';

export interface DecisionActor {
  userId: string;
  role: 'owner' | 'admin' | 'finance_lead' | 'project_owner' | 'operator';
  authorityLevel: 'viewer' | 'operator' | 'approver' | 'owner';
}

export interface CourtIssueRecord {
  id: string;
  taskId: string;
  userId: string;
  title: string;
  question: string;
  intent: string;
  status: FinanceLoopStatus;
  market: string | null;
  ticker: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentMemorialRecord {
  id: string;
  taskId: string;
  departmentId: string;
  sourceLabel: SourceLabel;
  memorial: Record<string, unknown>;
  status: FinanceLoopStatus | string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionBriefRecord {
  id: string;
  taskId: string;
  issueId: string;
  evidencePackId: string | null;
  status: FinanceLoopStatus | string;
  brief: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ImperialInstructionRecord {
  id: string;
  taskId: string;
  briefId: string;
  instructionType: InstructionType;
  decisionActor: DecisionActor;
  instruction: Record<string, unknown>;
  status: FinanceLoopStatus | string;
  createdAt: string;
  updatedAt: string;
}

function readString(row: DbRow, key: string): string {
  return String(row[key] ?? '');
}

function readNullableString(row: DbRow, key: string): string | null {
  const value = row[key];
  return value == null ? null : String(value);
}

function parseRecord(raw: DbValue): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseFinancialSources(raw: DbValue): FinancialSourceRef[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): FinancialSourceRef | null => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) return null;
        const record = item as Record<string, unknown>;
        const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : null;
        const url = typeof record.url === 'string' && record.url.trim() ? record.url.trim() : null;
        const capturedAt = typeof record.capturedAt === 'string' && record.capturedAt.trim()
          ? record.capturedAt.trim()
          : new Date().toISOString();
        if (!name || !url) return null;
        return {
          name,
          url,
          sourceType: normalizeFinancialSourceType(typeof record.sourceType === 'string' ? record.sourceType : null),
          credibility: normalizeFinancialSourceCredibility(typeof record.credibility === 'string' ? record.credibility : null),
          publishedAt: typeof record.publishedAt === 'string' && record.publishedAt.trim()
            ? record.publishedAt.trim()
            : undefined,
          capturedAt,
          fields: Array.isArray(record.fields) ? record.fields.map(String).filter(Boolean) : undefined,
        };
      })
      .filter((item): item is FinancialSourceRef => Boolean(item));
  } catch {
    return [];
  }
}

function issueFromRow(row: DbRow): CourtIssueRecord {
  return {
    id: readString(row, 'id'),
    taskId: readString(row, 'task_id'),
    userId: readString(row, 'user_id'),
    title: readString(row, 'title'),
    question: readString(row, 'question'),
    intent: readString(row, 'intent'),
    status: readString(row, 'status') as FinanceLoopStatus,
    market: readNullableString(row, 'market'),
    ticker: readNullableString(row, 'ticker'),
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
  };
}

function memorialFromRow(row: DbRow): DepartmentMemorialRecord {
  return {
    id: readString(row, 'id'),
    taskId: readString(row, 'task_id'),
    departmentId: readString(row, 'department_id'),
    sourceLabel: readString(row, 'source_label') as SourceLabel,
    memorial: parseRecord(row.memorial_json),
    status: readString(row, 'status'),
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
  };
}

function briefFromRow(row: DbRow): DecisionBriefRecord {
  return {
    id: readString(row, 'id'),
    taskId: readString(row, 'task_id'),
    issueId: readString(row, 'issue_id'),
    evidencePackId: readNullableString(row, 'evidence_pack_id'),
    status: readString(row, 'status'),
    brief: parseRecord(row.brief_json),
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
  };
}

function instructionFromRow(row: DbRow): ImperialInstructionRecord {
  return {
    id: readString(row, 'id'),
    taskId: readString(row, 'task_id'),
    briefId: readString(row, 'brief_id'),
    instructionType: readString(row, 'instruction_type') as InstructionType,
    decisionActor: parseRecord(row.decision_actor_json) as unknown as DecisionActor,
    instruction: parseRecord(row.instruction_json),
    status: readString(row, 'status'),
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
  };
}

export function normalizeAuthority(value: string | null | undefined): DecisionActor['authorityLevel'] {
  return value === 'owner' || value === 'approver' || value === 'operator' || value === 'viewer'
    ? value
    : 'viewer';
}

export function hasApproverAuthority(actor: DecisionActor): boolean {
  return actor.authorityLevel === 'approver' || actor.authorityLevel === 'owner';
}

export function decisionActorFromSession(session: {
  userId: string;
  role?: string | null;
  isAdmin?: boolean;
}): DecisionActor {
  if (session.isAdmin || session.role === 'admin') {
    return {
      userId: session.userId,
      role: 'admin',
      authorityLevel: 'approver',
    };
  }
  return {
    userId: session.userId,
    role: 'operator',
    authorityLevel: 'operator',
  };
}

function readArrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function collectBriefMissingEvidence(brief: Record<string, unknown>): string[] {
  const values = new Set<string>();
  for (const item of readArrayOfStrings(brief.missingEvidence)) values.add(item);
  const evidenceSummary = isRecord(brief.evidenceSummary) ? brief.evidenceSummary : null;
  for (const item of readArrayOfStrings(evidenceSummary?.missingEvidence)) values.add(item);
  const memorials = Array.isArray(brief.departmentMemorials) ? brief.departmentMemorials : [];
  for (const memorial of memorials) {
    if (!isRecord(memorial)) continue;
    for (const item of readArrayOfStrings(memorial.missingEvidence)) values.add(item);
  }
  return Array.from(values);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function briefRequiresManualConfirmation(brief: Record<string, unknown>): boolean {
  const gate = isRecord(brief.riskGate) ? brief.riskGate : null;
  if (gate?.manualConfirmationRequired === true) return true;
  const memorials = Array.isArray(brief.departmentMemorials) ? brief.departmentMemorials : [];
  return memorials.some((memorial) => isRecord(memorial)
    && isRecord(memorial.riskGate)
    && memorial.riskGate.manualConfirmationRequired === true);
}

export function validateDecisionAgainstBrief(input: {
  brief: Record<string, unknown>;
  decision: string;
  manualConfirmation?: boolean;
}): { ok: true } | { ok: false; error: string; status: number; missingEvidence?: string[] } {
  if (input.decision !== 'issue_decree') return { ok: true };
  const missingEvidence = collectBriefMissingEvidence(input.brief);
  if (missingEvidence.length > 0) {
    return {
      ok: false,
      error: 'missing_evidence_blocks_decree',
      status: 409,
      missingEvidence,
    };
  }
  if (briefRequiresManualConfirmation(input.brief) && input.manualConfirmation !== true) {
    return {
      ok: false,
      error: 'manual_confirmation_required_for_high_risk_budget',
      status: 409,
    };
  }
  return { ok: true };
}

export async function createCourtIssue(input: {
  userId: string;
  question: string;
  intent: string;
  market?: string | null;
  ticker?: string | null;
  at?: string;
}): Promise<CourtIssueRecord> {
  const question = input.question.trim();
  if (!question) throw new Error('question_required');
  const at = input.at ?? new Date().toISOString();
  // CRITICAL 修复(2026-07-03 会审抓出)：此前不传 taskId/tenantId，upsertPrimaryTask 兜底走
  // stableTaskId(command) —— 纯文本 hash，与用户身份无关。两个不同用户问一模一样的问题
  // (真实发生过，如"分析低温电池市场"被去重顶住的那批)会撞出同一个 task_id，进而 court_issues/
  // intel_evidence_packs/department_memorials 等下游按 task_id 关联的数据全部混进一行——归档桥接
  // 召回(recall-guard.ts)信任 archive_json.issue.userId 当"归属人"，若这里撞了车，会把 A 的证据
  // 归档到"看起来是A的"记录里却混有 B 的真实财务情报，A 下次决策时被当先例召回，构成跨用户信息泄露。
  // 修法：显式传每次调用唯一的 taskId(而非按内容派生的稳定id)，finance-intel-loop 语义上每次都是
  // 独立研究任务，不需要"同问题去重"这个属性(不同于其它需要幂等去重的下旨流程)。
  const taskId = `finance_issue_${crypto.randomUUID()}`;
  const task = await upsertPrimaryTask({
    taskId,
    command: question,
    title: question,
    mode: 'live',
    status: 'submitted',
    result: {
      source: 'finance_intel_loop',
      stage: 'issue_created',
      user_id: input.userId,
      intent: input.intent,
      ticker: input.ticker ?? null,
      market: input.market ?? null,
    },
    at,
  });
  const issueId = `issue_${crypto.randomUUID()}`;
  const title = `${input.ticker?.toUpperCase() ?? 'Finance'} valuation issue`;
  const normalizedTitle = input.intent === 'research_budget'
    ? 'Research department budget request'
    : title;
  const db = await ensurePrimaryDbReady();
  await db.execute({
    sql: `
      INSERT INTO court_issues (
        id, task_id, user_id, title, question, intent, status, market, ticker, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'issue_created', ?, ?, ?, ?)
    `,
    args: [
      issueId,
      task.taskId,
      input.userId,
      normalizedTitle,
      question,
      input.intent,
      input.market ?? null,
      input.ticker?.toUpperCase() ?? null,
      at,
      at,
    ],
  });
  return {
    id: issueId,
    taskId: task.taskId,
    userId: input.userId,
    title: normalizedTitle,
    question,
    intent: input.intent,
    status: 'issue_created',
    market: input.market ?? null,
    ticker: input.ticker?.toUpperCase() ?? null,
    createdAt: at,
    updatedAt: at,
  };
}

export async function updateIssueStatus(issueId: string, status: FinanceLoopStatus, at = new Date().toISOString()): Promise<void> {
  const db = await ensurePrimaryDbReady();
  await db.execute({
    sql: `UPDATE court_issues SET status = ?, updated_at = ? WHERE id = ?`,
    args: [status, at, issueId],
  });
}

export async function updateIssueStatusByTask(taskId: string, status: FinanceLoopStatus, at = new Date().toISOString()): Promise<void> {
  const db = await ensurePrimaryDbReady();
  await db.execute({
    sql: `UPDATE court_issues SET status = ?, updated_at = ? WHERE task_id = ?`,
    args: [status, at, taskId],
  });
}

export async function rebindIssueTask(issueId: string, taskId: string, at = new Date().toISOString()): Promise<void> {
  const db = await ensurePrimaryDbReady();
  await db.execute({
    sql: `UPDATE court_issues SET task_id = ?, updated_at = ? WHERE id = ?`,
    args: [taskId, at, issueId],
  });
}

export async function getCourtIssue(issueId: string): Promise<CourtIssueRecord | null> {
  const db = await ensurePrimaryDbReady();
  const result = await db.execute({
    sql: `SELECT * FROM court_issues WHERE id = ? LIMIT 1`,
    args: [issueId],
  });
  const row = result.rows[0] as DbRow | undefined;
  return row ? issueFromRow(row) : null;
}

export async function upsertIntelSignalFromFinancialCollection(input: {
  collection: FinancialSourceCollection;
  issueId?: string | null;
  taskId?: string | null;
}): Promise<void> {
  assertLiveSourcesHaveUrls({
    sourceLabel: input.collection.sourceLabel,
    sources: input.collection.sources,
  });
  const db = await ensurePrimaryDbReady();
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: `
      INSERT INTO intel_signals (
        id, title, summary, category, level, region, impact_score, sources_json, created_at
      )
      VALUES (?, ?, ?, 'opportunity', 'watch', ?, 70, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        category = excluded.category,
        level = excluded.level,
        region = excluded.region,
        impact_score = excluded.impact_score,
        sources_json = excluded.sources_json,
        created_at = excluded.created_at
    `,
    args: [
      input.collection.signalId,
      input.collection.title,
      input.collection.summary,
      input.collection.market,
      JSON.stringify(input.collection.sources),
      createdAt,
    ],
  });

  if (input.issueId) await updateIssueStatus(input.issueId, 'evidence_ready');
  if (input.taskId) {
    await updatePrimaryTaskResult(input.taskId, 'running', {
      source: 'finance_intel_loop',
      stage: 'evidence_ready',
      signalId: input.collection.signalId,
      issueId: input.issueId ?? null,
      sourceLabel: input.collection.sourceLabel,
      sources: input.collection.sources,
    });
  }
}

export async function createInternalBudgetEvidenceRecords(input: {
  taskId: string;
  issueId: string;
  userId: string;
  pack: InternalBudgetEvidencePack;
  at?: string;
}): Promise<{ signalId: string; routeId: string; evidencePackId: string; sourceLabel: SourceLabel }> {
  const db = await ensurePrimaryDbReady();
  const at = input.at ?? new Date().toISOString();
  const signalId = `intel_internal_budget_${input.taskId}`;
  const routeId = `route_internal_budget_${crypto.randomUUID()}`;
  const evidencePackId = `pack_${routeId}`;
  const sourceLabel = input.pack.sourceLabel;
  await db.execute({
    sql: `
      INSERT INTO intel_signals (
        id, title, summary, category, level, region, impact_score, sources_json, created_at
      )
      VALUES (?, ?, ?, 'risk', ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        category = excluded.category,
        level = excluded.level,
        region = excluded.region,
        impact_score = excluded.impact_score,
        sources_json = excluded.sources_json,
        created_at = excluded.created_at
    `,
    args: [
      signalId,
      `${input.pack.department} research budget evidence`,
      `${input.pack.department} ${input.pack.budgetPeriod} internal budget evidence pack; completeness ${input.pack.evidenceCompleteness}%.`,
      input.pack.missingEvidence.length ? 'watch' : 'normal',
      input.pack.department,
      input.pack.evidenceCompleteness,
      JSON.stringify(input.pack.evidenceRefs),
      at,
    ],
  });
  await db.execute({
    sql: `
      INSERT INTO intel_signal_routes (
        id, signal_id, task_id, user_id, target_agents_json, entry_swarm,
        source_label, status, note, session_id, trace_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      routeId,
      signalId,
      input.taskId,
      input.userId,
      JSON.stringify(['hu_bu']),
      'internal_budget',
      sourceLabel,
      input.pack.missingEvidence.length ? 'blocked' : 'report_ready',
      'Jinyiwei internal evidence pack for research department budget; not SEC and not public LIVE source.',
      null,
      routeId,
      at,
      at,
    ],
  });
  await db.execute({
    sql: `
      INSERT INTO intel_evidence_packs (
        id, signal_id, task_id, route_id, source_label, pack_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      evidencePackId,
      signalId,
      input.taskId,
      routeId,
      sourceLabel,
      JSON.stringify(input.pack),
      at,
    ],
  });
  await updateIssueStatus(input.issueId, 'evidence_ready', at);
  await updatePrimaryTaskResult(input.taskId, input.pack.missingEvidence.length ? 'report_ready' : 'running', {
    source: 'research_budget_loop',
    stage: 'evidence_ready',
    signalId,
    routeId,
    evidencePackId,
    sourceLabel,
    evidenceMode: input.pack.evidenceMode,
    missingEvidence: input.pack.missingEvidence,
    evidenceCompleteness: input.pack.evidenceCompleteness,
  }, at);
  return { signalId, routeId, evidencePackId, sourceLabel };
}

export async function getEvidencePackByTask(taskId: string): Promise<{ id: string; pack: Record<string, unknown> } | null> {
  const db = await ensurePrimaryDbReady();
  const result = await db.execute({
    sql: `
      SELECT id, pack_json
      FROM intel_evidence_packs
      WHERE task_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    args: [taskId],
  });
  const row = result.rows[0] as DbRow | undefined;
  return row ? { id: readString(row, 'id'), pack: parseRecord(row.pack_json) } : null;
}

/**
 * HIGH 修复(2026-07-03 会审)：`archive/from-task/route.ts` 此前只判"是否登录"，从不校验
 * taskId 归属，任意登录用户可归档他人任务(IDOR)。供该路由做归属校验用。
 * task_id 下无 court_issues 行(该任务不属于 finance-intel-loop)→ 返回 null，调用方应拒绝。
 */
export async function getCourtIssueOwnerUserId(taskId: string): Promise<string | null> {
  const db = await ensurePrimaryDbReady();
  const result = await db.execute({
    sql: `SELECT user_id FROM court_issues WHERE task_id = ? ORDER BY created_at LIMIT 1`,
    args: [taskId],
  });
  const row = result.rows[0] as DbRow | undefined;
  return row ? readString(row, 'user_id') : null;
}

export async function getFinancialSourcesByTask(taskId: string): Promise<FinancialSourceRef[]> {
  const db = await ensurePrimaryDbReady();
  const result = await db.execute({
    sql: `
      SELECT s.sources_json
      FROM intel_signal_routes r
      JOIN intel_signals s ON s.id = r.signal_id
      WHERE r.task_id = ?
      ORDER BY r.created_at DESC
      LIMIT 1
    `,
    args: [taskId],
  });
  const row = result.rows[0] as DbRow | undefined;
  return row ? parseFinancialSources(row.sources_json) : [];
}

export async function createDepartmentMemorial(input: {
  taskId: string;
  departmentId: string;
  sourceLabel: SourceLabel;
  memorial: Record<string, unknown>;
  status?: FinanceLoopStatus | string;
  at?: string;
}): Promise<DepartmentMemorialRecord> {
  const db = await ensurePrimaryDbReady();
  const at = input.at ?? new Date().toISOString();
  const id = `memorial_${crypto.randomUUID()}`;
  const status = input.status ?? 'memorial_ready';
  await db.execute({
    sql: `
      INSERT INTO department_memorials (
        id, task_id, department_id, source_label, memorial_json, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [id, input.taskId, input.departmentId, input.sourceLabel, JSON.stringify(input.memorial), status, at, at],
  });
  await updatePrimaryTaskResult(input.taskId, 'report_ready', {
    source: 'finance_intel_loop',
    stage: 'memorial_ready',
    memorialId: id,
    departmentId: input.departmentId,
    memorial: input.memorial,
  }, at);
  return { id, taskId: input.taskId, departmentId: input.departmentId, sourceLabel: input.sourceLabel, memorial: input.memorial, status, createdAt: at, updatedAt: at };
}

export async function getMemorials(ids: string[]): Promise<DepartmentMemorialRecord[]> {
  if (ids.length === 0) return [];
  const db = await ensurePrimaryDbReady();
  const result = await db.execute({
    sql: `SELECT * FROM department_memorials WHERE id IN (${ids.map(() => '?').join(',')})`,
    args: ids,
  });
  return (result.rows as DbRow[]).map(memorialFromRow);
}

export async function createDecisionBrief(input: {
  taskId: string;
  issueId: string;
  evidencePackId?: string | null;
  brief: Record<string, unknown>;
  at?: string;
}): Promise<DecisionBriefRecord> {
  const db = await ensurePrimaryDbReady();
  const at = input.at ?? new Date().toISOString();
  const id = `brief_${crypto.randomUUID()}`;
  await db.execute({
    sql: `
      INSERT INTO decision_briefs (
        id, task_id, issue_id, evidence_pack_id, status, brief_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 'awaiting_authorized_decision', ?, ?, ?)
    `,
    args: [id, input.taskId, input.issueId, input.evidencePackId ?? null, JSON.stringify(input.brief), at, at],
  });
  await updateIssueStatus(input.issueId, 'awaiting_authorized_decision', at);
  await updatePrimaryTaskResult(input.taskId, 'report_ready', {
    source: 'finance_intel_loop',
    stage: 'awaiting_authorized_decision',
    briefId: id,
    brief: input.brief,
  }, at);
  return { id, taskId: input.taskId, issueId: input.issueId, evidencePackId: input.evidencePackId ?? null, status: 'awaiting_authorized_decision', brief: input.brief, createdAt: at, updatedAt: at };
}

export async function getDecisionBrief(briefId: string): Promise<DecisionBriefRecord | null> {
  const db = await ensurePrimaryDbReady();
  const result = await db.execute({
    sql: `SELECT * FROM decision_briefs WHERE id = ? LIMIT 1`,
    args: [briefId],
  });
  const row = result.rows[0] as DbRow | undefined;
  return row ? briefFromRow(row) : null;
}

export async function updateDecisionBriefStatus(
  briefId: string,
  status: FinanceLoopStatus | string,
  at = new Date().toISOString(),
): Promise<void> {
  const db = await ensurePrimaryDbReady();
  await db.execute({
    sql: `UPDATE decision_briefs SET status = ?, updated_at = ? WHERE id = ?`,
    args: [status, at, briefId],
  });
}

export async function createImperialInstruction(input: {
  brief: DecisionBriefRecord;
  instructionType: InstructionType;
  decisionActor: DecisionActor;
  instruction: Record<string, unknown>;
  at?: string;
}): Promise<ImperialInstructionRecord> {
  if (!hasApproverAuthority(input.decisionActor)) throw new Error('approver_authority_required');
  const db = await ensurePrimaryDbReady();
  const at = input.at ?? new Date().toISOString();
  const id = `instruction_${crypto.randomUUID()}`;
  const status = input.instructionType === 'reject_order' ? 'rejected' : 'instruction_issued';
  await db.execute({
    sql: `
      INSERT INTO imperial_instructions (
        id, task_id, brief_id, instruction_type, decision_actor_json, instruction_json, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      input.brief.taskId,
      input.brief.id,
      input.instructionType,
      JSON.stringify(input.decisionActor),
      JSON.stringify(input.instruction),
      status,
      at,
      at,
    ],
  });
  await updatePrimaryTaskResult(input.brief.taskId, status === 'rejected' ? 'failed' : 'report_ready', {
    source: 'finance_intel_loop',
    stage: status,
    briefId: input.brief.id,
    instructionId: id,
    instructionType: input.instructionType,
    instruction: input.instruction,
  }, at);
  return {
    id,
    taskId: input.brief.taskId,
    briefId: input.brief.id,
    instructionType: input.instructionType,
    decisionActor: input.decisionActor,
    instruction: input.instruction,
    status,
    createdAt: at,
    updatedAt: at,
  };
}

export async function getImperialInstruction(instructionId: string): Promise<ImperialInstructionRecord | null> {
  const db = await ensurePrimaryDbReady();
  const result = await db.execute({
    sql: `SELECT * FROM imperial_instructions WHERE id = ? LIMIT 1`,
    args: [instructionId],
  });
  const row = result.rows[0] as DbRow | undefined;
  return row ? instructionFromRow(row) : null;
}

export async function updateImperialInstructionStatus(
  instructionId: string,
  status: FinanceLoopStatus | string,
  at = new Date().toISOString(),
): Promise<void> {
  const db = await ensurePrimaryDbReady();
  await db.execute({
    sql: `UPDATE imperial_instructions SET status = ?, updated_at = ? WHERE id = ?`,
    args: [status, at, instructionId],
  });
}

export async function createExecutionRun(input: {
  instruction: ImperialInstructionRecord;
  executor: string;
  result: Record<string, unknown>;
  status?: string;
  at?: string;
}): Promise<{ id: string; status: string; result: Record<string, unknown> }> {
  const db = await ensurePrimaryDbReady();
  const at = input.at ?? new Date().toISOString();
  const id = `exec_${crypto.randomUUID()}`;
  const status = input.status ?? 'execution_running';
  await db.execute({
    sql: `
      INSERT INTO execution_runs (
        id, task_id, instruction_id, executor, status, result_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [id, input.instruction.taskId, input.instruction.id, input.executor, status, JSON.stringify(input.result), at, at],
  });
  await updatePrimaryTaskResult(input.instruction.taskId, 'running', {
    source: 'finance_intel_loop',
    stage: status,
    instructionId: input.instruction.id,
    executionRunId: id,
    result: input.result,
  }, at);
  return { id, status, result: input.result };
}

export async function updateExecutionReturnReport(input: {
  instructionId: string;
  executionRunId: string;
  taskId: string;
  result: Record<string, unknown>;
  at?: string;
}): Promise<void> {
  const db = await ensurePrimaryDbReady();
  const at = input.at ?? new Date().toISOString();
  await db.execute({
    sql: `UPDATE execution_runs SET status = 'return_report_ready', result_json = ?, updated_at = ? WHERE id = ? AND instruction_id = ?`,
    args: [JSON.stringify(input.result), at, input.executionRunId, input.instructionId],
  });
  await updatePrimaryTaskResult(input.taskId, 'report_ready', {
    source: 'finance_intel_loop',
    stage: 'return_report_ready',
    instructionId: input.instructionId,
    executionRunId: input.executionRunId,
    returnReport: input.result,
  }, at);
}

export async function createArchiveFromTask(input: {
  taskId: string;
  outcome?: string | null;
  lessons?: string[];
  at?: string;
}): Promise<{ id: string; archive: Record<string, unknown> }> {
  const db = await ensurePrimaryDbReady();
  const at = input.at ?? new Date().toISOString();
  const [issues, packs, memorials, briefs, instructions, executions] = await Promise.all([
    db.execute({ sql: `SELECT * FROM court_issues WHERE task_id = ? ORDER BY created_at`, args: [input.taskId] }),
    db.execute({ sql: `SELECT * FROM intel_evidence_packs WHERE task_id = ? ORDER BY created_at`, args: [input.taskId] }),
    db.execute({ sql: `SELECT * FROM department_memorials WHERE task_id = ? ORDER BY created_at`, args: [input.taskId] }),
    db.execute({ sql: `SELECT * FROM decision_briefs WHERE task_id = ? ORDER BY created_at`, args: [input.taskId] }),
    db.execute({ sql: `SELECT * FROM imperial_instructions WHERE task_id = ? ORDER BY created_at`, args: [input.taskId] }),
    db.execute({ sql: `SELECT * FROM execution_runs WHERE task_id = ? ORDER BY created_at`, args: [input.taskId] }),
  ]);
  // 会审防线(2026-07-03，配合 createCourtIssue 的 taskId 唯一性修复)：即便根因已堵，仍对
  // task_id 下的 court_issues 做"单一归属人"断言，防未来任何路径重新引入 task_id 碰撞时，
  // 静默把混有多个用户证据的归档贴上错误 owner——归档桥接召回信任这里的 user_id 做隔离，
  // 一旦此处静默取 [0]，就是可被用户看见的跨用户信息泄露(非本次新增风险，但本次桥接把它
  // 从"内部数据混乱"升级为用户可见，故与桥接一并堵)。
  const issueOwnerIds = new Set(
    (issues.rows as DbRow[]).map((row) => readString(row, 'user_id')).filter((id): id is string => Boolean(id)),
  );
  if (issueOwnerIds.size > 1) {
    throw new Error(
      `archive_owner_conflict: task_id ${input.taskId} 下 court_issues 关联了 ${issueOwnerIds.size} 个不同 user_id，疑似 task_id 碰撞，拒绝归档`,
    );
  }
  const financialSources = await getFinancialSourcesByTask(input.taskId);
  const executionRunRecords = (executions.rows as DbRow[]).map((row) => ({
    id: readString(row, 'id'),
    instructionId: readString(row, 'instruction_id'),
    executor: readString(row, 'executor'),
    status: readString(row, 'status'),
    result: parseRecord(row.result_json),
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
  }));
  const archive = {
    taskId: input.taskId,
    issue: (issues.rows as DbRow[]).map(issueFromRow)[0] ?? null,
    evidencePacks: (packs.rows as DbRow[]).map((row) => ({ id: readString(row, 'id'), pack: parseRecord(row.pack_json) })),
    memorials: (memorials.rows as DbRow[]).map(memorialFromRow),
    decisionBrief: (briefs.rows as DbRow[]).map(briefFromRow)[0] ?? null,
    instruction: (instructions.rows as DbRow[]).map(instructionFromRow)[0] ?? null,
    executionRuns: executionRunRecords,
    returnReports: executionRunRecords
      .filter((run) => run.status === 'return_report_ready')
      .map((run) => ({
        executionRunId: run.id,
        instructionId: run.instructionId,
        result: run.result,
        returnedAt: typeof run.result.returnedAt === 'string' ? run.result.returnedAt : run.updatedAt,
      })),
    outcome: input.outcome ?? 'archived',
    lessons: input.lessons ?? [],
    sourceUrls: sourceUrls(financialSources),
    financialSources,
    archivedAt: at,
  };
  const id = `archive_${crypto.randomUUID()}`;
  await db.execute({
    sql: `INSERT INTO archive_records (id, task_id, archive_json, created_at) VALUES (?, ?, ?, ?)`,
    args: [id, input.taskId, JSON.stringify(archive), at],
  });
  await updateIssueStatusByTask(input.taskId, 'archived', at);
  await updatePrimaryTaskResult(input.taskId, 'archived', {
    source: 'finance_intel_loop',
    stage: 'archived',
    archiveId: id,
    archive,
  }, at);
  return { id, archive };
}

export async function getFinanceIntelLoopCase(taskId: string): Promise<Record<string, unknown> | null> {
  const db = await ensurePrimaryDbReady();
  const [tasks, issues, packs, memorials, briefs, instructions, executions, archives] = await Promise.all([
    db.execute({ sql: `SELECT * FROM tasks WHERE id = ? LIMIT 1`, args: [taskId] }),
    db.execute({ sql: `SELECT * FROM court_issues WHERE task_id = ? ORDER BY created_at`, args: [taskId] }),
    db.execute({ sql: `SELECT * FROM intel_evidence_packs WHERE task_id = ? ORDER BY created_at`, args: [taskId] }),
    db.execute({ sql: `SELECT * FROM department_memorials WHERE task_id = ? ORDER BY created_at`, args: [taskId] }),
    db.execute({ sql: `SELECT * FROM decision_briefs WHERE task_id = ? ORDER BY created_at`, args: [taskId] }),
    db.execute({ sql: `SELECT * FROM imperial_instructions WHERE task_id = ? ORDER BY created_at`, args: [taskId] }),
    db.execute({ sql: `SELECT * FROM execution_runs WHERE task_id = ? ORDER BY created_at`, args: [taskId] }),
    db.execute({ sql: `SELECT id, archive_json, created_at FROM archive_records WHERE task_id = ? ORDER BY created_at`, args: [taskId] }),
  ]);
  const taskRow = tasks.rows[0] as DbRow | undefined;
  if (!taskRow && issues.rows.length === 0 && memorials.rows.length === 0) return null;
  const executionRunRecords = (executions.rows as DbRow[]).map((row) => ({
    id: readString(row, 'id'),
    instructionId: readString(row, 'instruction_id'),
    executor: readString(row, 'executor'),
    status: readString(row, 'status'),
    result: parseRecord(row.result_json),
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
  }));
  const archiveRecords = (archives.rows as DbRow[]).map((row) => ({
    id: readString(row, 'id'),
    archive: parseRecord(row.archive_json),
    createdAt: readString(row, 'created_at'),
  }));
  const issueRecords = (issues.rows as DbRow[]).map(issueFromRow);
  const memorialRecords = (memorials.rows as DbRow[]).map(memorialFromRow);
  const briefRecords = (briefs.rows as DbRow[]).map(briefFromRow);
  const instructionRecords = (instructions.rows as DbRow[]).map(instructionFromRow);
  const issueRecord = issueRecords[0] ?? null;
  const decisionBrief = briefRecords[0] ?? null;
  const latestInstruction = instructionRecords.at(-1) ?? null;
  const financialSources = await getFinancialSourcesByTask(taskId);
  const stage = archiveRecords.length > 0
    ? 'archived'
    : executionRunRecords.some((run) => run.status === 'return_report_ready')
      ? 'return_report_ready'
      : executionRunRecords.length > 0
        ? 'execution_running'
        : latestInstruction?.status === 'rejected' || issueRecord?.status === 'rejected' || decisionBrief?.status === 'rejected'
          ? 'rejected'
          : latestInstruction?.instructionType === 'evidence_order'
            || issueRecord?.status === 'needs_evidence'
            || decisionBrief?.status === 'needs_evidence'
            ? 'needs_evidence'
            : latestInstruction?.instructionType === 'review_order'
              || issueRecord?.status === 'review_requested'
              || decisionBrief?.status === 'review_requested'
              ? 'review_requested'
              : latestInstruction
                ? 'instruction_issued'
                : briefRecords.length > 0
            ? 'awaiting_authorized_decision'
            : memorialRecords.length > 0
              ? 'memorial_ready'
              : packs.rows.length > 0
                ? 'evidence_ready'
                : issueRecords.length > 0
                  ? 'issue_created'
                  : 'unknown';
  return {
    taskId,
    stage,
    task: taskRow
      ? {
          id: readString(taskRow, 'id'),
          status: readString(taskRow, 'status'),
          rawCommand: readString(taskRow, 'raw_command'),
          result: parseRecord(taskRow.result_json),
          createdAt: readString(taskRow, 'created_at'),
          updatedAt: readString(taskRow, 'updated_at'),
        }
      : null,
    issue: issueRecord,
    evidencePacks: (packs.rows as DbRow[]).map((row) => ({ id: readString(row, 'id'), pack: parseRecord(row.pack_json) })),
    memorials: memorialRecords,
    decisionBrief,
    instruction: latestInstruction,
    executionRuns: executionRunRecords,
    returnReports: executionRunRecords
      .filter((run) => run.status === 'return_report_ready')
      .map((run) => ({
        executionRunId: run.id,
        instructionId: run.instructionId,
        result: run.result,
        returnedAt: typeof run.result.returnedAt === 'string' ? run.result.returnedAt : run.updatedAt,
      })),
    archives: archiveRecords,
    sourceUrls: sourceUrls(financialSources),
    financialSources,
  };
}

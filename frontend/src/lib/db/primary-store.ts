import type { Client } from '@libsql/client';
import type { ExecutionMode, Task, TaskStatus } from '../../types/task.ts';
import type { AgentRun } from '../../types/agent.ts';
import { getDb, primaryDbSource } from './turso.ts';
import { initSchema } from './migrate.ts';

type DbValue = string | number | bigint | ArrayBuffer | null;
type DbRow = Record<string, DbValue>;

const TASK_STATUSES: ReadonlySet<string> = new Set([
  'draft',
  'submitted',
  'interpreting',
  'planning',
  'assigned',
  'running',
  'aggregating',
  'report_ready',
  'reviewed',
  'archived',
  'failed',
]);

const EXECUTION_MODES: ReadonlySet<string> = new Set(['scripted', 'hybrid', 'live']);

let schemaReady: Promise<Client> | null = null;

export async function ensurePrimaryDbReady(): Promise<Client> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getDb();
      const result = await initSchema(db);
      if (!result.ok) {
        schemaReady = null;
        throw new Error(result.error ?? 'primary schema init failed');
      }
      return db;
    })();
  }
  return schemaReady;
}

function taskTitle(command: string, explicitTitle?: string | null): string {
  const title = explicitTitle?.trim() || command.trim().replace(/\s+/g, ' ');
  return title.length > 48 ? `${title.slice(0, 48)}...` : title || '上书房新旨';
}

function normalizeMode(value: unknown): ExecutionMode {
  return typeof value === 'string' && EXECUTION_MODES.has(value)
    ? (value as ExecutionMode)
    : 'hybrid';
}

function normalizeStatus(value: unknown): TaskStatus {
  if (typeof value === 'string' && TASK_STATUSES.has(value)) return value as TaskStatus;
  if (value === 'pending') return 'submitted';
  if (value === 'done') return 'archived';
  if (value === 'in-progress') return 'running';
  if (value === 'awaiting-decision') return 'report_ready';
  return 'submitted';
}

function readString(row: DbRow, key: string, fallback = ''): string {
  const value = row[key];
  return value == null ? fallback : String(value);
}

function tryParseRecord(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export interface PrimaryTaskInput {
  taskId?: string | null;
  tenantId?: string | number | null;
  command: string;
  title?: string | null;
  mode?: ExecutionMode | string | null;
  status?: TaskStatus | string | null;
  result?: Record<string, unknown> | null;
  at?: string;
}

export interface PrimaryTaskReceipt {
  taskId: string;
  status: TaskStatus;
  acceptedAt: string;
  source: ReturnType<typeof primaryDbSource>;
}

/**
 * 内容稳定的 taskId：同一(租户, 命令) → 同一 id，让重复触发走 UPDATE 而非 INSERT 新行。
 * 取代 `task_${randomUUID()}` 这个非幂等源头（2026-07-01 修：orchestrate 每次随机→同一会审 ×50 孤儿）。
 * 纯 JS 双哈希(~64bit)，无 node:crypto 依赖、edge 安全；命令先折叠空白再哈希。
 */
export function stableTaskId(command: string, tenantId?: string | number | null): string {
  const key = `${tenantId ?? 'global'}|${command.replace(/\s+/g, ' ').trim()}`;
  let h1 = 2166136261;
  let h2 = 5381;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = (Math.imul(h2, 33) ^ c) >>> 0;
  }
  return `task_${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

export async function upsertPrimaryTask(input: PrimaryTaskInput): Promise<PrimaryTaskReceipt> {
  const command = input.command.trim();
  if (!command) throw new Error('command is required');

  // 保留前缀守门(会审 Q1 / 结构门):部门学习记录归独立 department_learning 表,
  // 严禁任何调用方(含 edict-return 透传用户 taskId)往 tasks 写 department_learning_ 行重新污染朝报。
  const reservedId = input.taskId?.trim();
  if (reservedId?.startsWith('department_learning_')) {
    throw new Error(`taskId '${reservedId}' 用了保留前缀 department_learning_(学习记录归独立表,禁写 tasks)`);
  }

  const db = await ensurePrimaryDbReady();
  const at = input.at ?? new Date().toISOString();
  // 非幂等守门：无显式 taskId 时由(租户,命令)派生稳定 id，禁止 randomUUID 制造重复孤儿（铁律2/4）。
  const taskId = input.taskId?.trim() || stableTaskId(command, input.tenantId);
  const status = normalizeStatus(input.status);
  const mode = normalizeMode(input.mode);
  const title = taskTitle(command, input.title);
  const resultJson = input.result ? JSON.stringify(input.result) : null;

  await db.execute({
    sql: `
      INSERT INTO tasks (id, tenant_id, title, raw_command, status, mode, created_at, updated_at, result_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tenant_id = COALESCE(excluded.tenant_id, tasks.tenant_id),
        title = excluded.title,
        raw_command = excluded.raw_command,
        status = excluded.status,
        mode = excluded.mode,
        updated_at = excluded.updated_at,
        result_json = COALESCE(excluded.result_json, tasks.result_json)
    `,
    args: [taskId, input.tenantId == null ? null : String(input.tenantId), title, command, status, mode, at, at, resultJson],
  });

  return { taskId, status, acceptedAt: at, source: primaryDbSource() };
}

export async function updatePrimaryTaskResult(
  taskId: string,
  status: TaskStatus | string,
  result: Record<string, unknown>,
  at = new Date().toISOString(),
): Promise<void> {
  const db = await ensurePrimaryDbReady();
  await db.execute({
    sql: `
      UPDATE tasks
      SET status = ?, updated_at = ?, result_json = ?
      WHERE id = ?
    `,
    args: [normalizeStatus(status), at, JSON.stringify(result), taskId],
  });
}

export interface ListPrimaryTasksOptions {
  limit?: number;
  status?: string | null;
  tenantId?: string | number | null;
}

export async function listPrimaryTasks(options: ListPrimaryTasksOptions = {}): Promise<unknown[]> {
  const db = await ensurePrimaryDbReady();
  const limit = Math.min(Math.max(Number(options.limit ?? 50), 1), 200);
  const status = options.status?.trim();
  const tenantId = options.tenantId == null ? null : String(options.tenantId);
  const where: string[] = [];
  const args: DbValue[] = [];
  if (status) {
    where.push('status = ?');
    args.push(status);
  }
  if (tenantId) {
    // Legacy rows before tenant_id existed remain visible in controlled single-tenant deployments.
    where.push('(tenant_id = ? OR tenant_id IS NULL)');
    args.push(tenantId);
  }
  args.push(limit);
  const res = await db.execute({
    sql: `
      SELECT id, tenant_id, title, raw_command, status, mode, created_at, updated_at, result_json, plan_json, retro_json
      FROM tasks
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY updated_at DESC
      LIMIT ?
    `,
    args,
  });

  return (res.rows as DbRow[]).map(toBackendTask);
}

export async function getPrimaryTaskFull(
  taskId: string,
  options: { tenantId?: string | number | null } = {},
): Promise<{ task: Task; runs: AgentRun[]; report: null } | null> {
  const db = await ensurePrimaryDbReady();
  const tenantId = options.tenantId == null ? null : String(options.tenantId);
  const tenantWhere = tenantId ? 'AND (tenant_id = ? OR tenant_id IS NULL)' : '';
  const taskRes = await db.execute({
    sql: `
      SELECT id, tenant_id, title, raw_command, status, mode, created_at, updated_at, result_json, plan_json, retro_json
      FROM tasks
      WHERE id = ?
      ${tenantWhere}
      LIMIT 1
    `,
    args: tenantId ? [taskId, tenantId] : [taskId],
  });

  const row = taskRes.rows[0] as DbRow | undefined;
  if (!row) return null;

  const runsRes = await db.execute({
    sql: `
      SELECT id, task_id, agent_code, status, started_at, completed_at, output_json
      FROM agent_runs
      WHERE task_id = ?
      ORDER BY started_at ASC
    `,
    args: [taskId],
  });

  return {
    task: toTask(row),
    runs: (runsRes.rows as DbRow[]).map(toAgentRun),
    report: null,
  };
}

function toBackendTask(row: DbRow): Record<string, unknown> {
  const task = toTask(row);
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    rawCommand: task.rawCommand,
    status: task.status,
    mode: task.mode,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    plan: task.plan ?? null,
    departmentRuns: [],
    events: [],
    report: null,
    result: task.result ?? null,
  };
}

function toTask(row: DbRow): Task {
  const result = tryParseRecord(readString(row, 'result_json'));
  const rawCommand = readString(row, 'raw_command');
  const task: Task = {
    id: readString(row, 'id'),
    title: readString(row, 'title', taskTitle(rawCommand)),
    rawCommand,
    description: rawCommand,
    status: normalizeStatus(readString(row, 'status')),
    mode: normalizeMode(readString(row, 'mode')),
    createdAt: readString(row, 'created_at', new Date().toISOString()),
    updatedAt: readString(row, 'updated_at', new Date().toISOString()),
  };

  const finalReportId = result?.finalReportId;
  if (typeof finalReportId === 'string') task.finalReportId = finalReportId;
  if (result) task.result = result;
  return task;
}

function toAgentRun(row: DbRow): AgentRun {
  const status = readString(row, 'status', 'running');
  const terminal = status === 'completed' || status === 'failed' || status === 'fallback_completed';
  return {
    id: readString(row, 'id'),
    taskId: readString(row, 'task_id'),
    subtaskId: '',
    agentCode: readString(row, 'agent_code') as AgentRun['agentCode'],
    state: terminal ? (status as AgentRun['state']) : 'running',
    progressPct: terminal ? 100 : 45,
    currentTaskTitle: '执行中',
    latestSummary: readString(row, 'output_json'),
    isWaitingDependency: false,
    hasReported: terminal,
    startedAt: readString(row, 'started_at') || undefined,
    completedAt: readString(row, 'completed_at') || undefined,
  };
}

export { ensurePrimaryDbReady as getPrimaryDb };

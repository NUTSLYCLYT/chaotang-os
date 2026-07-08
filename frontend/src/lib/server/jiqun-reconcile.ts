import 'server-only';

import type { JiqunSessionDetail } from '@/lib/jiqun-api';
import type { ShangshufangEdictReturn } from '@/lib/contracts/shangshufang';
import { ensurePrimaryDbReady, updatePrimaryTaskResult } from '@/lib/db/primary-store';
import {
  extractJiqunFinalOutputs,
  buildJiqunReturnRows,
} from '@/features/shangshufang/jiqun-return-edict';
import type { EdictView } from '@/features/shangshufang/edict-content';
import { blastRadiusFromText } from '@/core/courtos/harness/human-approval-gate';
import {
  patchJiqunPersistentTask,
  type JiqunPersistedTask,
} from './jiqun-task-persistence';

type Dict = Record<string, unknown>;
type DbValue = string | number | bigint | ArrayBuffer | null;
type DbRow = Record<string, DbValue>;

const READ_TIMEOUT_MS = 10_000;

function jiqunBaseUrl(): string {
  return (process.env.JIQUN_API_URL ?? process.env.JIQUN_BASE_URL ?? 'http://127.0.0.1:8081').replace(/\/$/, '');
}

function isRecord(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readCookieToken(cookie: string | null): string | null {
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)(?:courtos\.access_token|token)=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function authHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const adminToken = process.env.JIQUN_ADMIN_TOKEN?.trim();
  const requestAuth = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  const cookieToken = readCookieToken(cookie);

  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  else if (requestAuth) headers.Authorization = requestAuth;
  else if (cookieToken) headers.Authorization = `Bearer ${cookieToken}`;

  if (cookie) headers.Cookie = cookie;
  return headers;
}

function parseResult(raw: DbValue): Dict {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isTerminalSession(session: JiqunSessionDetail): boolean {
  return (
    session.status === 'completed' ||
    session.status === 'failed' ||
    session.release_gate === 'blocked' ||
    ((session.swarm_count ?? 0) > 0 && (session.completed_count ?? 0) >= (session.swarm_count ?? 0))
  );
}

function statusFromSession(session: JiqunSessionDetail): 'report_ready' | 'failed' {
  return session.status === 'failed' ? 'failed' : 'report_ready';
}

function modeFromResult(result: Dict): 'secret' | 'order' {
  return result.source === 'orchestrate_all' ? 'secret' : 'order';
}

function coverageRow(result: Dict): string {
  const coverage = isRecord(result.coverage) ? result.coverage : null;
  if (!coverage) return '本地各司覆盖信息缺失；以后端蜂群会话为准。';
  const responded = Array.isArray(coverage.responded) ? coverage.responded.join('、') : '—';
  const absent = Array.isArray(coverage.absent)
    ? coverage.absent
        .map((item) => {
          if (!isRecord(item)) return null;
          const dept = readString(item.dept) ?? 'unknown';
          const status = typeof item.status === 'number' ? item.status : readString(item.status);
          return `${dept}${status ? `(${status})` : ''}`;
        })
        .filter(Boolean)
        .join('、')
    : '—';
  const realExpected = typeof coverage.realExpected === 'number' ? coverage.realExpected : 0;
  const realResponded = typeof coverage.realResponded === 'number' ? coverage.realResponded : 0;
  return `实司 ${realResponded}/${realExpected} 直奏：${responded || '—'}\n缺席：${absent || '—'}`;
}

function resultSummary(result: Dict, session: JiqunSessionDetail): string {
  const merge = isRecord(result.merge) ? result.merge : null;
  const verdict = readString(merge?.verdict);
  if (verdict) return verdict;
  if (session.release_gate === 'blocked') {
    return `后端蜂群已完成，但发布质门阻塞，会话 ${session.session_id}。`;
  }
  return `后端蜂群已结束，会话 ${session.session_id}，状态 ${session.status}。`;
}

function buildEdictView(taskId: string, command: string, result: Dict, session: JiqunSessionDetail): EdictView {
  const blocked = session.release_gate === 'blocked';
  const statusLabel = blocked ? '质门阻塞' : session.status === 'failed' ? '执行失败' : '蜂群已回奏';
  return {
    id: `reconcile:${taskId}:jiqun:${session.session_id}`,
    title: blocked ? '蜂群回奏 · 质门阻塞' : '蜂群回奏',
    subtitle: `${session.session_id} · ${statusLabel}`,
    question: command || undefined, // 皇上原问(raw_command):正文 Hero 锚点

    meta: {
      reporter: '蜂群',
      priority: blocked || session.status === 'failed' ? 'high' : 'medium',
      // 严厉度按 §8.7 高风险 SSOT 推导(命中 股权/合同/付款/对外报价… → irreversible),
      // 供裁决责任徽/呈现层判红;不绑「蜂群卡没卡」(会审 H1)。
      blastRadius: blastRadiusFromText(command),
      badges: [{ label: statusLabel, tone: blocked || session.status === 'failed' ? 'red' : 'green' }],
    },
    rows: [
      { label: '所 议', body: command },
      {
        label: '后端蜂群',
        body:
          `会话 ${session.session_id} · 状态 ${session.status}` +
          (session.release_gate ? ` · 发布闸 ${session.release_gate}` : ''),
      },
      ...buildJiqunReturnRows(session),
      { label: '应 奏', body: coverageRow(result) },
      { label: '合 议', body: resultSummary(result, session) },
    ],
    seal: blocked || session.status === 'failed' ? 'secret' : 'imperial',
  };
}

async function fetchJiqunSession(request: Request, sessionId: string): Promise<JiqunSessionDetail> {
  const response = await fetch(`${jiqunBaseUrl()}/api/swarm/sessions/${encodeURIComponent(sessionId)}`, {
    cache: 'no-store',
    headers: authHeaders(request),
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`jiqun session ${response.status}`);
  return (await response.json()) as JiqunSessionDetail;
}

async function loadTask(taskId: string): Promise<{ command: string; result: Dict; row: DbRow } | null> {
  const db = await ensurePrimaryDbReady();
  const response = await db.execute({
    sql: `SELECT id, raw_command, result_json FROM tasks WHERE id = ? LIMIT 1`,
    args: [taskId],
  });
  const row = response.rows[0] as DbRow | undefined;
  if (!row) return null;
  return {
    command: String(row.raw_command ?? ''),
    result: parseResult(row.result_json),
    row,
  };
}

function sessionIdFromResult(result: Dict): string | null {
  const jiqunSwarm = isRecord(result.jiqunSwarm) ? result.jiqunSwarm : null;
  return readString(jiqunSwarm?.sessionId) ?? readString(jiqunSwarm?.session_id);
}

function taskOwnerFromResult(result: Dict): string | null {
  const decision = isRecord(result.shangshufangDecision) ? result.shangshufangDecision : null;
  return readString(decision?.user_id) ?? readString(result.user_id) ?? readString(result.userId);
}

export interface ReconcileJiqunTaskInput {
  taskId: string;
  sessionId?: string | null;
  userId?: string | null;
}

export interface ReconcileJiqunTaskResult {
  reconciled: boolean;
  taskId: string;
  sessionId: string | null;
  status?: 'report_ready' | 'failed';
  sessionStatus?: string;
  releaseGate?: string;
  reason?: string;
  task?: JiqunPersistedTask | null;
  session?: JiqunSessionDetail;
}

export async function reconcileJiqunTask(
  request: Request,
  input: ReconcileJiqunTaskInput,
): Promise<ReconcileJiqunTaskResult> {
  const task = await loadTask(input.taskId);
  if (!task) {
    return { reconciled: false, taskId: input.taskId, sessionId: input.sessionId ?? null, reason: 'task_not_found' };
  }
  const ownerId = input.userId ? taskOwnerFromResult(task.result) : null;
  if (ownerId && ownerId !== input.userId) {
    return { reconciled: false, taskId: input.taskId, sessionId: input.sessionId ?? null, reason: 'task_not_found' };
  }

  const sessionId = input.sessionId ?? sessionIdFromResult(task.result);
  if (!sessionId) {
    return { reconciled: false, taskId: input.taskId, sessionId: null, reason: 'session_id_missing' };
  }

  const session = await fetchJiqunSession(request, sessionId);
  if (!isTerminalSession(session)) {
    return {
      reconciled: false,
      taskId: input.taskId,
      sessionId,
      sessionStatus: session.status,
      releaseGate: session.release_gate,
      reason: 'session_not_terminal',
      session,
    };
  }

  const savedAt = new Date().toISOString();
  const command = task.command || session.task_input || input.taskId;
  const edictView = buildEdictView(input.taskId, command, task.result, session);
  const edictReturn: ShangshufangEdictReturn = {
    source: 'jiqun_ai',
    taskId: input.taskId,
    jiqunTaskId: null,
    sessionId,
    mode: modeFromResult(task.result),
    command,
    edictView,
    finalOutputs: extractJiqunFinalOutputs(session),
    savedAt,
  };
  const nextResult = {
    ...task.result,
    shangshufangEdictReturn: edictReturn,
    jiqunReconciliation: {
      sessionId,
      sessionStatus: session.status,
      releaseGate: session.release_gate ?? null,
      reconciledAt: savedAt,
    },
  };
  const nextStatus = statusFromSession(session);

  await updatePrimaryTaskResult(input.taskId, nextStatus, nextResult, savedAt);
  const patched = await patchJiqunPersistentTask(request, input.taskId, {
    command,
    status: nextStatus,
    mode: 'hybrid',
    result: nextResult,
    at: savedAt,
  });

  return {
    reconciled: true,
    taskId: input.taskId,
    sessionId,
    status: nextStatus,
    sessionStatus: session.status,
    releaseGate: session.release_gate,
    task: patched,
    session,
  };
}

export async function reconcilePersistedTaskIfTerminal(
  request: Request,
  task: JiqunPersistedTask,
): Promise<JiqunPersistedTask> {
  if (task.status !== 'running') return task;
  const sessionId = isRecord(task.result) ? sessionIdFromResult(task.result) : null;
  if (!sessionId) return task;
  try {
    const result = await reconcileJiqunTask(request, { taskId: task.taskId, sessionId });
    return result.task ?? task;
  } catch {
    return task;
  }
}

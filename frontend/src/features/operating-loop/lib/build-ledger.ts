import { backendFetch } from '@/lib/backend-api';

export type BuildLedgerStatus = 'dispatched' | 'reviewing' | 'returned' | 'archived';

export interface BuildLedgerAuditEvent {
  id: string;
  taskId?: string;
  actor: string;
  actorId?: string | null;
  actorRole?: string | null;
  tenant?: string | number | null;
  source?: string | null;
  action: string;
  fromStatus: BuildLedgerStatus;
  toStatus: BuildLedgerStatus;
  note: string;
  createdAt: string;
}

export interface BuildLedgerEntry {
  id: string;
  taskId: string;
  title: string;
  command: string;
  jiqunTaskId?: string | null;
  jiqunSessionId?: string | null;
  jiqunEntrySwarm?: string | null;
  releaseGate?: 'pending' | 'clear' | 'blocked' | 'unknown' | string | null;
  source?: string | null;
  suggestion?: string | null;
  evidence: string[];
  ministers: string[];
  createdAt: string;
  updatedAt?: string | null;
  status: BuildLedgerStatus;
  auditTrail?: BuildLedgerAuditEvent[];
}

export interface BuildLedgerAssessment {
  score: number;
  grade: '优' | '良' | '中';
  riskLevel: 'low' | 'medium' | 'high';
  riskNotes: string[];
  nextSuggestion: string;
}

export interface BuildLedgerExport {
  schema: 'chaotang.build-ledger.v1';
  exportedAt: string;
  count: number;
  entries: BuildLedgerEntry[];
}

const LEDGER_KEY = 'chaotang:build-ledger:v1';
const LEDGER_EVENT = 'chaotang:build-ledger-updated';
// 2026-07-12 P0-A(独立只读审查发现):这里之前用裸 fetch() 打
// withBasePath() 拼出的相对路径——从不带 Authorization: Bearer 头。后端
// FENGQUN_AUTH 默认开启,只认 Bearer 头或 cookie `token`,浏览器登录态只有
// courtos.access_token 这个 cookie(后端不消费它),所以生产环境下每一次
// 调用都会 401。backendFetch() 会自动附带当前会话 token(必要时刷新重试)，
// 换成它之后这些请求在真实鉴权下才能成功,而不是永远悄悄拿到"空台账"。
// 2026-07-14: `/api/court/build-ledger` 在 3050->8081 的 Next 代理链路上被
// 未定位的中间层拦截,POST 鉴权失败、GET 静默返回空数据(review-handoff.md)。
// 跳过代理直接走后端新挂载的规范路径(跟 /api/legal/overview 等既有先例
// 同款手法),旧路径继续在后端保留,不影响 e2e/回归测试。
const LEDGER_PATH = '/api/build-ledger';

export const BUILD_LEDGER_STATUS_LABEL: Record<BuildLedgerStatus, string> = {
  dispatched: '待军机复核',
  reviewing: '军机复核中',
  returned: '退回工部补证',
  archived: '已入史馆',
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readBuildLedger(): BuildLedgerEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as BuildLedgerEntry[] : [];
  } catch {
    return [];
  }
}

function writeLocalLedger(entries: BuildLedgerEntry[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(LEDGER_KEY, JSON.stringify(entries.slice(0, 20)));
  window.dispatchEvent(new CustomEvent(LEDGER_EVENT));
}

function mergeLedgerEntries(local: BuildLedgerEntry[], remote: BuildLedgerEntry[]) {
  const byId = new Map<string, BuildLedgerEntry>();
  [...remote, ...local].forEach((entry) => byId.set(entry.id, entry));
  return Array.from(byId.values())
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 20);
}

export function saveBuildLedgerEntry(entry: BuildLedgerEntry) {
  if (!canUseStorage()) return;
  const next = [entry, ...readBuildLedger().filter((item) => item.id !== entry.id)].slice(0, 20);
  writeLocalLedger(next);
}

export async function fetchBuildLedger(): Promise<BuildLedgerEntry[]> {
  const response = await backendFetch(LEDGER_PATH, { cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  if (!payload?.success || !Array.isArray(payload.data)) return [];
  return payload.data as BuildLedgerEntry[];
}

export async function fetchBuildLedgerByTask(taskId: string): Promise<BuildLedgerEntry[]> {
  const response = await backendFetch(`${LEDGER_PATH}?taskId=${encodeURIComponent(taskId)}`, { cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  if (!payload?.success || !Array.isArray(payload.data)) return [];
  return payload.data as BuildLedgerEntry[];
}

export async function fetchBuildLedgerAudit(taskId?: string): Promise<BuildLedgerAuditEvent[]> {
  const params = new URLSearchParams({ audit: '1' });
  if (taskId) params.set('taskId', taskId);
  const response = await backendFetch(`${LEDGER_PATH}?${params.toString()}`, { cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  if (!payload?.success || !Array.isArray(payload.data)) return [];
  return payload.data as BuildLedgerAuditEvent[];
}

export async function exportBuildLedger(): Promise<BuildLedgerExport | null> {
  const response = await backendFetch(`${LEDGER_PATH}?format=export`, { cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  if (!payload?.success || !payload.data) return null;
  return payload.data as BuildLedgerExport;
}

export async function pruneBuildLedger(retentionDays = 90): Promise<{ before: number; after: number; removed: number }> {
  const response = await backendFetch(LEDGER_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'prune', retentionDays }),
  });
  const payload = await response.json().catch(() => null);
  // 2026-07-12 P0-A:这里原来失败就静默返回 null,跟 persist/dispatch/
  // transition 三个写路径的"失败就 throw"不一致——prune 是批量硬删除,
  // 静默失败最危险(调用方以为清理成功了)。改成跟其余写路径同款:失败就
  // throw,不再假装成功。
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error ?? 'build_ledger_prune_failed');
  }
  return payload.data as { before: number; after: number; removed: number };
}

export async function syncBuildLedgerFromServer(): Promise<BuildLedgerEntry[]> {
  const remote = await fetchBuildLedger();
  const merged = mergeLedgerEntries(readBuildLedger(), remote);
  writeLocalLedger(merged);
  return merged;
}

export async function persistBuildLedgerEntry(entry: BuildLedgerEntry): Promise<void> {
  const response = await backendFetch(LEDGER_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error('build_ledger_persist_failed');
  }
}

export async function dispatchBuildLedgerEntry(entry: BuildLedgerEntry): Promise<BuildLedgerEntry> {
  const response = await backendFetch(LEDGER_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'dispatch', entry }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success || !payload.data?.entry) {
    throw new Error(payload?.error ?? 'build_ledger_dispatch_failed');
  }
  const nextEntry = payload.data.entry as BuildLedgerEntry;
  saveBuildLedgerEntry(nextEntry);
  return nextEntry;
}

export function transitionBuildLedgerEntry(
  entry: BuildLedgerEntry,
  toStatus: BuildLedgerStatus,
  actor: string,
  note: string,
): BuildLedgerEntry {
  const now = new Date().toISOString();
  const auditEvent: BuildLedgerAuditEvent = {
    id: `audit-${entry.taskId}-${Date.now()}`,
    taskId: entry.taskId,
    actor,
    action: `${BUILD_LEDGER_STATUS_LABEL[entry.status]} -> ${BUILD_LEDGER_STATUS_LABEL[toStatus]}`,
    fromStatus: entry.status,
    toStatus,
    note,
    createdAt: now,
  };

  return {
    ...entry,
    status: toStatus,
    updatedAt: now,
    auditTrail: [...(entry.auditTrail ?? []), auditEvent],
  };
}

export async function transitionBuildLedgerOnServer(
  entry: BuildLedgerEntry,
  toStatus: BuildLedgerStatus,
  note: string,
): Promise<BuildLedgerEntry> {
  const response = await backendFetch(LEDGER_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'transition',
      taskId: entry.taskId,
      toStatus,
      note,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success || !payload.data?.entry) {
    throw new Error(payload?.error ?? 'build_ledger_transition_failed');
  }
  const nextEntry = payload.data.entry as BuildLedgerEntry;
  saveBuildLedgerEntry(nextEntry);
  return nextEntry;
}

export function subscribeBuildLedger(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => listener();
  window.addEventListener(LEDGER_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(LEDGER_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function assessBuildLedgerEntry(entry: BuildLedgerEntry): BuildLedgerAssessment {
  const riskNotes: string[] = [];
  if (entry.evidence.length === 0) riskNotes.push('缺少可核验证据');
  if (entry.ministers.length < 2) riskNotes.push('会审部门不足');
  if (!entry.source) riskNotes.push('来源未标注');
  if (!entry.suggestion) riskNotes.push('原始建议未沉淀');

  const score = Math.min(
    96,
    68
      + Math.min(entry.evidence.length, 3) * 7
      + Math.min(entry.ministers.length, 4) * 3
      + (entry.source ? 6 : 0)
      + (entry.suggestion ? 5 : 0),
  );

  const grade = score >= 88 ? '优' : score >= 76 ? '良' : '中';
  const riskLevel = riskNotes.length >= 3 ? 'high' : riskNotes.length >= 1 ? 'medium' : 'low';
  const nextSuggestion = riskNotes.length > 0
    ? `补齐${riskNotes.join('、')}，再进入正式复盘。`
    : '证据链完整，可进入史馆复盘评分并反哺次日上书房建议。';

  return { score, grade, riskLevel, riskNotes, nextSuggestion };
}

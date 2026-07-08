import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  BuildLedgerAuditEvent,
  BuildLedgerEntry,
  BuildLedgerStatus,
} from '@/features/operating-loop/lib/build-ledger';

export const BUILD_LEDGER_LIMIT = 50;
export const BUILD_LEDGER_RETENTION_DAYS = 90;
export const BUILD_LEDGER_STORE_DIR = path.join(process.cwd(), '.chaotang');
export const BUILD_LEDGER_STORE_FILE = path.join(BUILD_LEDGER_STORE_DIR, 'build-ledger.json');
export const BUILD_LEDGER_AUDIT_FILE = path.join(BUILD_LEDGER_STORE_DIR, 'build-ledger-audit.json');

const BUILD_LEDGER_STATUSES = new Set<BuildLedgerStatus>([
  'dispatched',
  'reviewing',
  'returned',
  'archived',
]);

const BUILD_LEDGER_STATUS_LABEL: Record<BuildLedgerStatus, string> = {
  dispatched: '待军机复核',
  reviewing: '军机复核中',
  returned: '退回工部补证',
  archived: '已入史馆',
};

const ALLOWED_BUILD_LEDGER_TRANSITIONS: Record<BuildLedgerStatus, BuildLedgerStatus[]> = {
  dispatched: ['reviewing', 'returned', 'archived'],
  reviewing: ['returned', 'archived'],
  returned: ['reviewing', 'archived'],
  archived: [],
};

export function sortBuildLedger(entries: BuildLedgerEntry[]) {
  return [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function normalizeBuildLedgerEntry(input: Partial<BuildLedgerEntry>): BuildLedgerEntry | null {
  if (!input.taskId || !input.title || !input.command) return null;
  const status = BUILD_LEDGER_STATUSES.has(input.status as BuildLedgerStatus)
    ? input.status as BuildLedgerStatus
    : 'dispatched';
  const auditTrail = Array.isArray(input.auditTrail)
    ? input.auditTrail.filter((event): event is BuildLedgerAuditEvent => Boolean(
      event &&
      event.id &&
      event.actor &&
      event.action &&
      BUILD_LEDGER_STATUSES.has(event.fromStatus as BuildLedgerStatus) &&
      BUILD_LEDGER_STATUSES.has(event.toStatus as BuildLedgerStatus) &&
      event.createdAt,
    ))
    : [];
  return {
    id: input.id || `ledger-${input.taskId}`,
    taskId: input.taskId,
    title: input.title,
    command: input.command,
    jiqunTaskId: input.jiqunTaskId ?? null,
    jiqunSessionId: input.jiqunSessionId ?? null,
    jiqunEntrySwarm: input.jiqunEntrySwarm ?? null,
    releaseGate: input.releaseGate ?? null,
    source: input.source ?? null,
    suggestion: input.suggestion ?? null,
    evidence: Array.isArray(input.evidence) ? input.evidence.filter(Boolean) : [],
    ministers: Array.isArray(input.ministers) ? input.ministers.filter(Boolean) : [],
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt ?? null,
    status,
    auditTrail,
  };
}

export async function getBuildLedgerStoreStatus(): Promise<'ready' | 'missing'> {
  try {
    await access(BUILD_LEDGER_STORE_FILE);
    return 'ready';
  } catch {
    return 'missing';
  }
}

export async function readBuildLedgerFromStore(): Promise<BuildLedgerEntry[]> {
  try {
    const raw = await readFile(BUILD_LEDGER_STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sortBuildLedger(parsed as BuildLedgerEntry[]) : [];
  } catch {
    return [];
  }
}

export async function writeBuildLedgerToStore(entries: BuildLedgerEntry[]) {
  await mkdir(BUILD_LEDGER_STORE_DIR, { recursive: true });
  await writeFile(
    BUILD_LEDGER_STORE_FILE,
    JSON.stringify(sortBuildLedger(entries).slice(0, BUILD_LEDGER_LIMIT), null, 2),
    'utf8',
  );
}

export async function upsertBuildLedgerEntry(entry: BuildLedgerEntry) {
  const entries = await readBuildLedgerFromStore();
  const next = [entry, ...entries.filter((item) => item.id !== entry.id)].slice(0, BUILD_LEDGER_LIMIT);
  await writeBuildLedgerToStore(next);
  return next;
}

export interface BuildLedgerTransitionInput {
  taskId: string;
  toStatus: BuildLedgerStatus;
  actor: string;
  actorId?: string | null;
  actorRole?: string | null;
  tenant?: string | number | null;
  source?: string | null;
  note?: string | null;
}

export type BuildLedgerTransitionResult =
  | { ok: true; entry: BuildLedgerEntry; entries: BuildLedgerEntry[] }
  | { ok: false; error: 'invalid_transition_request' | 'build_ledger_entry_not_found' | 'illegal_build_ledger_transition' };

export async function transitionBuildLedgerInStore(input: BuildLedgerTransitionInput): Promise<BuildLedgerTransitionResult> {
  if (!input.taskId || !input.actor.trim() || !BUILD_LEDGER_STATUSES.has(input.toStatus)) {
    return { ok: false, error: 'invalid_transition_request' };
  }

  const entries = await readBuildLedgerFromStore();
  const current = entries.find((entry) => entry.taskId === input.taskId || entry.id === input.taskId);
  if (!current) return { ok: false, error: 'build_ledger_entry_not_found' };

  const allowed = ALLOWED_BUILD_LEDGER_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(input.toStatus)) {
    return { ok: false, error: 'illegal_build_ledger_transition' };
  }

  const now = new Date().toISOString();
  const actor = input.actor.trim();
  const note = input.note?.trim() || `${BUILD_LEDGER_STATUS_LABEL[current.status]} -> ${BUILD_LEDGER_STATUS_LABEL[input.toStatus]}`;
  const auditEvent: BuildLedgerAuditEvent = {
    id: `audit-${current.taskId}-${Date.now()}`,
    taskId: current.taskId,
    actor,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    tenant: input.tenant ?? null,
    source: input.source ?? 'api/court/build-ledger',
    action: `${BUILD_LEDGER_STATUS_LABEL[current.status]} -> ${BUILD_LEDGER_STATUS_LABEL[input.toStatus]}`,
    fromStatus: current.status,
    toStatus: input.toStatus,
    note,
    createdAt: now,
  };
  const entry: BuildLedgerEntry = {
    ...current,
    status: input.toStatus,
    updatedAt: now,
    auditTrail: [...(current.auditTrail ?? []), auditEvent],
  };
  const next = [entry, ...entries.filter((item) => item.id !== current.id)].slice(0, BUILD_LEDGER_LIMIT);
  await writeBuildLedgerToStore(next);
  await appendBuildLedgerAuditEvent(auditEvent);
  return { ok: true, entry, entries: next };
}

export async function readBuildLedgerAuditFromStore(): Promise<BuildLedgerAuditEvent[]> {
  try {
    const raw = await readFile(BUILD_LEDGER_AUDIT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as BuildLedgerAuditEvent[] : [];
  } catch {
    return [];
  }
}

export async function appendBuildLedgerAuditEvent(event: BuildLedgerAuditEvent) {
  const events = await readBuildLedgerAuditFromStore();
  await mkdir(BUILD_LEDGER_STORE_DIR, { recursive: true });
  await writeFile(
    BUILD_LEDGER_AUDIT_FILE,
    JSON.stringify([event, ...events].slice(0, 500), null, 2),
    'utf8',
  );
}

export function pruneBuildLedgerEntries(
  entries: BuildLedgerEntry[],
  retentionDays = BUILD_LEDGER_RETENTION_DAYS,
) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  return sortBuildLedger(entries)
    .filter((entry) => Date.parse(entry.createdAt) >= cutoff)
    .slice(0, BUILD_LEDGER_LIMIT);
}

export function exportBuildLedgerEntries(entries: BuildLedgerEntry[]) {
  return {
    schema: 'chaotang.build-ledger.v1' as const,
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  };
}

import type { ArchivePayload, ArchiveRecord, CaseOutcome } from '@/lib/contracts/archive';

type UnknownRecord = Record<string, unknown>;
const ARCHIVE_OUTCOMES: ReadonlySet<string> = new Set(['success', 'blocked', 'failed', 'pending']);

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function memorialOutcome(status: string): CaseOutcome {
  if (['approved', 'archived', 'done'].includes(status)) return 'success';
  if (['rejected', 'failed'].includes(status)) return 'failed';
  if (status === 'blocked') return 'blocked';
  return 'pending';
}

function decisionOutcome(action: string): CaseOutcome {
  if (action === 'approve') return 'success';
  if (action === 'reject') return 'failed';
  if (action === 'inquire') return 'blocked';
  return 'pending';
}

function isArchiveRecord(value: unknown): value is ArchiveRecord {
  const record = asRecord(value);
  return record !== null
    && typeof record.id === 'string'
    && typeof record.title === 'string'
    && typeof record.type === 'string'
    && typeof record.outcome === 'string'
    && ARCHIVE_OUTCOMES.has(record.outcome)
    && typeof record.department === 'string'
    && typeof record.date === 'string';
}

/** Convert the canonical chaotang archive envelope into the page's flat record view model. */
export function normalizeArchiveResponse(value: unknown): ArchivePayload {
  const envelope = asRecord(value);
  const success = envelope?.success !== false;
  const data = envelope && 'data' in envelope ? envelope.data : value;

  if (Array.isArray(data)) {
    const records = data.filter(isArchiveRecord);
    return { success, data: records, meta: { total: records.length, fromTurso: false } };
  }

  const archive = asRecord(data);
  const memorials = Array.isArray(archive?.memorials) ? archive.memorials : [];
  const decisions = Array.isArray(archive?.decisions) ? archive.decisions : [];
  const memorialTitles = new Map<string, string>();

  const memorialRecords = memorials.flatMap((value): ArchiveRecord[] => {
    const memorial = asRecord(value);
    if (!memorial) return [];
    const id = stringValue(memorial.id);
    if (!id) return [];
    const title = stringValue(memorial.title, id);
    memorialTitles.set(id, title);
    return [{
      id,
      title,
      type: '奏折',
      outcome: memorialOutcome(stringValue(memorial.status)),
      department: stringValue(memorial.sourceDepartment, stringValue(memorial.agentCode, '未署名')),
      date: stringValue(memorial.createdAt),
      reportId: id,
      isGovernance: false,
    }];
  });

  const decisionRecords = decisions.flatMap((value): ArchiveRecord[] => {
    const decision = asRecord(value);
    if (!decision) return [];
    const id = stringValue(decision.id);
    const memorialId = stringValue(decision.memorialId);
    if (!id) return [];
    return [{
      id,
      title: memorialTitles.get(memorialId) ?? (memorialId ? `裁决：${memorialId}` : `裁决：${id}`),
      type: '治理裁决',
      outcome: decisionOutcome(stringValue(decision.action)),
      department: stringValue(decision.reviewerName, '御前裁决'),
      date: stringValue(decision.createdAt),
      reportId: memorialId || undefined,
      isGovernance: true,
    }];
  });

  const records = [...memorialRecords, ...decisionRecords];
  return { success, data: records, meta: { total: records.length, fromTurso: false } };
}

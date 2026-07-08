import type { AuditEvent } from '@/types/audit';

const MAX_EVENTS = 1000;

function storageKey(userId: string) {
  return `audit_log_${userId}`;
}

export function persistAuditEvent(event: AuditEvent): void {
  if (typeof window === 'undefined') return;
  try {
    const key = storageKey(event.userId);
    const raw = window.localStorage.getItem(key);
    const existing: AuditEvent[] = raw ? (JSON.parse(raw) as AuditEvent[]) : [];
    const next = [event, ...existing].slice(0, MAX_EVENTS);
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // localStorage quota exceeded or unavailable — fail silently
  }
}

export function loadAuditEvents(userId: string): AuditEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as AuditEvent[]) : [];
  } catch {
    return [];
  }
}

export function clearAuditEvents(userId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(userId));
}

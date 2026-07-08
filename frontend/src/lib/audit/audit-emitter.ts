import type { AuditAction, AuditEvent } from '@/types/audit';
import { persistAuditEvent } from './audit-store';

let _getUserId: (() => string | null) | null = null;

export function registerAuditUserSource(fn: () => string | null) {
  _getUserId = fn;
}

function makeRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function emitAudit(
  action: AuditAction,
  options: { targetId?: string; metadata?: Record<string, string>; userId?: string } = {},
): void {
  const userId = options.userId ?? _getUserId?.() ?? 'anonymous';
  const event: AuditEvent = {
    id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    userId,
    action,
    requestId: makeRequestId(),
    ...(options.targetId !== undefined && { targetId: options.targetId }),
    ...(options.metadata !== undefined && { metadata: options.metadata }),
  };
  persistAuditEvent(event);
}

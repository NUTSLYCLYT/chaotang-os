export type AuditAction =
  | 'login'
  | 'logout'
  | 'submit_command'
  | 'view_report'
  | 'export_report'
  | 'switch_account'
  | 'delete_task';

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  action: AuditAction;
  targetId?: string;
  metadata?: Record<string, string>;
  requestId: string;
}

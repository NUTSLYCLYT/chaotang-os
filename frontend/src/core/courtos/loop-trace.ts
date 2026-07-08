const TRACE_PREFIX = 'loop';

export function loopTraceIdForTask(taskId: string): string {
  const normalized = taskId.trim();
  if (!normalized) return `${TRACE_PREFIX}_unknown`;
  return `${TRACE_PREFIX}_${normalized.replace(/[^0-9A-Za-z_-]/g, '_')}`;
}

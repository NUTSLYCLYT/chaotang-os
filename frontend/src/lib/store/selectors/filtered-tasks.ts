import type { Task } from '@/types/task';
import type { ScribeFilters } from '@/features/scribe/hooks/use-scribe-filters';

function getDateBoundary(preset: ScribeFilters['dateRange'], customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (preset === 'today') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from.getTime() + 86400000);
    return { from, to };
  }
  if (preset === 'week') {
    const dayOfWeek = now.getDay();
    const from = new Date(now.getTime() - dayOfWeek * 86400000);
    from.setHours(0, 0, 0, 0);
    return { from, to: null };
  }
  if (preset === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to: null };
  }
  if (preset === 'custom') {
    return {
      from: customFrom ? new Date(customFrom) : null,
      to: customTo ? new Date(customTo + 'T23:59:59') : null,
    };
  }
  return { from: null, to: null };
}

export function applyScribeFilters(tasks: Task[], filters: ScribeFilters): Task[] {
  let result = tasks;

  if (filters.statuses.length > 0) {
    result = result.filter((t) => filters.statuses.includes(t.status));
  }

  if (filters.manors.length > 0) {
    result = result.filter((t) => t.manorReport?.domain && filters.manors.includes(t.manorReport.domain));
  }

  const { from, to } = getDateBoundary(filters.dateRange, filters.customFrom, filters.customTo);
  if (from || to) {
    result = result.filter((t) => {
      const ts = new Date(t.createdAt).getTime();
      if (from && ts < from.getTime()) return false;
      if (to && ts > to.getTime()) return false;
      return true;
    });
  }

  return result;
}

/**
 * 朝堂 OS V2 · 史馆 · 任务状态徽章
 *
 * 与 scribe/page.tsx 原内联组件等价，抽出以便复用。
 */

import type { TaskStatus } from '@/types/task';

const TASK_STATUS_STYLE: Partial<Record<TaskStatus, { label: string; color: string; bg: string }>> = {
  archived: { label: '归档', color: '#9AA3C4', bg: 'rgba(154, 163, 196, 0.12)' },
  reviewed: { label: '已批示', color: '#3DD68C', bg: 'rgba(61, 214, 140, 0.12)' },
  report_ready: { label: '待批示', color: '#F0C66A', bg: 'rgba(240, 198, 106, 0.12)' },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const s = TASK_STATUS_STYLE[status] ?? {
    label: status,
    color: '#6A7299',
    bg: 'rgba(106, 114, 153, 0.15)',
  };
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      {s.label}
    </span>
  );
}

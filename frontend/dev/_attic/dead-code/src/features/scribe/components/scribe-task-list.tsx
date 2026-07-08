/**
 * 朝堂 OS V2 · 史馆 · 左栏归档任务列表
 */

'use client';

import { GlassPanel } from '@/components/ui/glass-panel';
import type { Task } from '@/types/task';
import { TaskStatusBadge } from './task-status-badge';
import { SectionLabel } from './section-label';

export interface ScribeTaskListProps {
  tasks: Task[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ScribeTaskList({ tasks, selectedId, onSelect }: ScribeTaskListProps) {
  return (
    <GlassPanel tone="elevated" padding="md" className="h-full">
      <SectionLabel
        as="h3"
        trailing={<span className="font-mono text-[11px] text-[#F0C66A]">{tasks.length}</span>}
      >
        Archive · 归档
      </SectionLabel>
      <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
        {tasks.length === 0 && (
          <div className="py-4 text-center text-[11px] text-[#6A7299]">无命中记录</div>
        )}
        {tasks.map((t) => {
          const isSelected = selectedId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="w-full rounded-md border p-2.5 text-left transition-colors hover:bg-white/[0.03]"
              style={{
                borderColor: isSelected ? 'rgba(240, 198, 106, 0.5)' : 'rgba(26, 33, 66, 0.8)',
                backgroundColor: isSelected
                  ? 'rgba(240, 198, 106, 0.05)'
                  : 'rgba(10, 14, 30, 0.4)',
              }}
            >
              <div className="line-clamp-2 text-[11px] font-medium text-[#EAEEFB]">{t.title}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <TaskStatusBadge status={t.status} />
                <div className="flex items-center gap-1.5">
                  {t.retrospective && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                      style={{
                        color: '#3DD68C',
                        background: 'rgba(61, 214, 140, 0.12)',
                      }}
                      title="已完成复盘"
                    >
                      复盘
                    </span>
                  )}
                  <span className="font-mono text-[11px] text-[#6A7299]">
                    {new Date(t.updatedAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}

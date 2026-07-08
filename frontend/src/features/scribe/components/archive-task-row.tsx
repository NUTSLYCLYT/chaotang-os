'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import type { Task } from '@/types/task';
import { TaskStatusBadge } from './task-status-badge';

interface ArchiveTaskRowProps {
  task: Task;
}

export function ArchiveTaskRow({ task }: ArchiveTaskRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-white/5 bg-black/10 transition-colors hover:bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 p-3 text-left"
      >
        <span className="mt-0.5 shrink-0 text-[#6A7299]">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="line-clamp-2 text-[13px] font-medium text-[#EAEEFB]">{task.title}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            {task.manorReport?.domain && (
              <span className="rounded-full border border-[#F0C66A]/25 bg-[#F0C66A]/8 px-1.5 py-0.5 text-[11px] text-[#F0C66A]">
                {task.manorReport.domain}
              </span>
            )}
            <span className="font-mono text-[11px] text-[#6A7299]">
              {new Date(task.createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/5 bg-[#040712]/40 px-3 py-3">
          <div className="rounded border border-white/5 bg-black/20 p-2.5 text-[12px] leading-relaxed text-[#EAEEFB]">
            {task.rawCommand}
          </div>

          {task.manorReport && (
            <div className="mt-2 text-[12px] text-[#9AA3C4]">
              {task.manorReport.summary && (
                <p className="line-clamp-3">{task.manorReport.summary}</p>
              )}
            </div>
          )}

          <div className="mt-3">
            <Link
              href={`/scribe/${task.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#F0C66A]/25 bg-[#F0C66A]/8 px-3 py-1.5 text-[11px] font-medium text-[#F0C66A] transition hover:bg-[#F0C66A]/14"
            >
              查看完整呈报
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

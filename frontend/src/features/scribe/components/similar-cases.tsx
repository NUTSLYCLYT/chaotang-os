'use client';

import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { EmptyState } from '@/features/shared/components/imperial/empty-state';
import { useAppStore } from '@/lib/store/app-store';
import type { Task } from '@/types/task';

function overlapScore(a: string, b: string): number {
  const wordsA = new Set(a.split(/[\s，。、；：""''（）]/));
  const wordsB = new Set(b.split(/[\s，。、；：""''（）]/));
  let common = 0;
  for (const w of wordsA) {
    if (w.length > 1 && wordsB.has(w)) common++;
  }
  return wordsA.size > 0 ? common / wordsA.size : 0;
}

interface SimilarCasesProps {
  currentRawCommand: string;
  currentTaskId: string;
  domain?: string;
}

export function SimilarCases({ currentRawCommand, currentTaskId, domain }: SimilarCasesProps) {
  const tasks = useAppStore((s) => s.tasks);

  const candidates: Array<{ task: Task; score: number }> = tasks
    .filter(
      (t) =>
        t.id !== currentTaskId &&
        t.manorReport?.domain !== undefined &&
        (domain === undefined || t.manorReport.domain === domain) &&
        (t.status === 'report_ready' || t.status === 'reviewed' || t.status === 'archived'),
    )
    .map((t) => ({
      task: t,
      score: overlapScore(currentRawCommand, t.rawCommand),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (candidates.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="当前没有可比对的历史案例"
        body="等更多相似卷宗进入史馆后，这里会自动回召可参考的旧案与处理路径。"
      />
    );
  }

  return (
    <div className="space-y-3">
      {candidates.map(({ task, score }) => (
        <Link
          key={task.id}
          href={`/scribe/${task.id}`}
          className="group block rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 transition hover:border-[#F0C66A]/15 hover:bg-[#F0C66A]/[0.03]"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#F5E9C9] truncate">{task.title}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#9AA3C4] line-clamp-2">
                {task.rawCommand}
              </p>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-[#6A7299]">
                <span className="flex items-center gap-1">
                  <Clock size={9} />
                  {new Date(task.createdAt).toLocaleDateString('zh-CN')}
                </span>
                <span
                  className="rounded-full px-1.5 py-0.5"
                  style={{
                    background: score >= 0.3 ? 'rgba(61,214,140,0.1)' : 'rgba(154,163,196,0.1)',
                    color: score >= 0.3 ? '#3DD68C' : '#9AA3C4',
                    border: `1px solid ${score >= 0.3 ? 'rgba(61,214,140,0.2)' : 'rgba(154,163,196,0.15)'}`,
                  }}
                >
                  相似度 {Math.round(score * 100)}%
                </span>
              </div>
            </div>
            <ArrowRight size={13} className="mt-1 shrink-0 text-[#6A7299] transition group-hover:text-[#F0C66A]" />
          </div>
        </Link>
      ))}
    </div>
  );
}

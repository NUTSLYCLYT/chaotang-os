'use client';

/**
 * 执行中任务 · 精简列表
 *
 * 最多 6 条，每条：状态点 · 标题 · 一行摘要
 * 点击进 /throne/brief/[id]
 */

import Link from 'next/link';
import type { Task } from '@/types/task';

interface Props {
  tasks: Task[];
  limit?: number;
}

export function TasksMini({ tasks, limit = 6 }: Props) {
  const running = tasks
    .filter(
      (t) =>
        t.status === 'running' ||
        t.status === 'planning' ||
        t.status === 'assigned' ||
        t.status === 'aggregating' ||
        t.status === 'report_ready',
    )
    .slice(0, limit);

  if (running.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/8 px-4 py-5 text-center">
        <div className="text-[12px] font-medium text-[#D2D7E8]">当前没有办理中的旨意</div>
        <div className="mt-2 text-[11px] leading-6 text-[#6A7299]">
          朝堂眼下没有正在流转的案件，可先下达新旨，或回看既有定稿与待批事项。
        </div>
        <Link
          href="/throne/compose"
          className="mt-3 inline-flex items-center text-[11px] text-[#F0C66A] underline-offset-2 hover:underline"
        >
          下达新旨 →
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {running.map((t) => {
        const dotColor = statusDot(t.status);
        const title = t.title || t.rawCommand || '未命名旨意';
        const brief = t.plan?.intent || t.description || t.rawCommand || '—';
        return (
          <li key={t.id}>
            <Link
              href={`/throne/brief/${t.id}`}
              className="flex items-start gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-2.5 transition hover:border-[#F0C66A]/30 hover:bg-white/[0.05]"
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: dotColor, boxShadow: `0 0 5px ${dotColor}` }}
              />
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-[12px] font-medium text-[#F5E9C9]">
                  {title}
                </div>
                <div className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-[#9AA3C4]">
                  {brief}
                </div>
              </div>
              <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-[#6A7299]">
                {statusLabel(t.status)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function statusDot(status: Task['status']): string {
  switch (status) {
    case 'running':
    case 'aggregating':
      return '#6BA0FF';
    case 'planning':
    case 'interpreting':
      return '#F0C66A';
    case 'report_ready':
      return '#10B981';
    case 'assigned':
      return '#A78BFA';
    default:
      return '#6A7299';
  }
}

function statusLabel(status: Task['status']): string {
  switch (status) {
    case 'running':
      return '办理';
    case 'aggregating':
      return '汇总';
    case 'planning':
      return '拟旨';
    case 'interpreting':
      return '解义';
    case 'report_ready':
      return '待批';
    case 'assigned':
      return '分派';
    case 'reviewed':
      return '已批';
    case 'archived':
      return '已档';
    default:
      return String(status);
  }
}

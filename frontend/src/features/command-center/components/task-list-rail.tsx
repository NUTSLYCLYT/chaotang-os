'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { AlertTriangle, Crown, Inbox, Search, ShieldCheck } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { Task, TaskStatus } from '@/types/task';

const TASK_STATUS_STYLE: Record<TaskStatus, { label: string; color: string; pulse: boolean }> = {
  draft:         { label: '草拟',   color: '#6A7299', pulse: false },
  submitted:     { label: '已呈',   color: '#6BA0FF', pulse: false },
  interpreting:  { label: '研判',   color: '#6BA0FF', pulse: true  },
  planning:      { label: '筹划',   color: '#F0C66A', pulse: true  },
  assigned:      { label: '分派',   color: '#4A82F0', pulse: false },
  running:       { label: '执行',   color: '#F0C66A', pulse: true  },
  aggregating:   { label: '汇总',   color: '#6BA0FF', pulse: true  },
  report_ready:  { label: '待批',   color: '#F5A524', pulse: false },
  reviewed:      { label: '已批',   color: '#3DD68C', pulse: false },
  archived:      { label: '归档',   color: '#484F72', pulse: false },
  failed:        { label: '失败',   color: '#F58B8B', pulse: false },
};

function TaskStatusBadge({ status }: { status: TaskStatus | string }) {
  const s = TASK_STATUS_STYLE[status as TaskStatus] ?? {
    label: status || '未知',
    color: '#8F835F',
    pulse: false,
  };
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
      style={{
        color: s.color,
        background: `${s.color}1a`,
        border: `1px solid ${s.color}40`,
      }}
    >
      <span
        className="inline-block h-1 w-1 rounded-full"
        style={{
          background: s.color,
          animation: s.pulse ? 'pulse 1.6s ease-in-out infinite' : undefined,
        }}
      />
      {s.label}
    </span>
  );
}

export interface TaskListRailProps {
  tasks: Task[];
  currentTaskId: string | null;
  spotlightTaskId?: string | null;
  onSelect: (id: string) => void;
}

const FILTERS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'planning', label: '筹划' },
  { value: 'running', label: '执行' },
  { value: 'report_ready', label: '待批' },
  { value: 'reviewed', label: '已批' },
];

export function TaskListRail({
  tasks,
  currentTaskId,
  spotlightTaskId = null,
  onSelect,
}: TaskListRailProps) {
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const currentTask = tasks.find((task) => task.id === currentTaskId) ?? null;

  const queuePulse = useMemo(() => {
    const pendingReview = tasks.filter((task) => task.status === 'report_ready').length;
    const executing = tasks.filter((task) => task.status === 'running' || task.status === 'aggregating').length;
    const fresh = tasks.filter(
      (task) => task.status === 'submitted' || task.status === 'interpreting' || task.status === 'planning',
    ).length;
    return { pendingReview, executing, fresh };
  }, [tasks]);

  const filtered = useMemo(() => {
    let items = [...tasks];
    if (filter !== 'all') items = items.filter((t) => t.status === filter);
    if (query) {
      const q = query.toLowerCase();
      items = items.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.rawCommand.toLowerCase().includes(q),
      );
    }
    return items;
  }, [tasks, filter, query]);

  // keyboard ↑↓ navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      if (filtered.length === 0) return;
      e.preventDefault();
      const idx = filtered.findIndex((t) => t.id === currentTaskId);
      const next =
        e.key === 'ArrowDown'
          ? Math.min(filtered.length - 1, idx + 1)
          : Math.max(0, idx - 1);
      if (next >= 0 && filtered[next]) onSelect(filtered[next].id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, currentTaskId, onSelect]);

  useEffect(() => {
    const targetId = spotlightTaskId ?? currentTaskId;
    if (!targetId) return;
    const target = itemRefs.current[targetId];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [spotlightTaskId, currentTaskId, filtered]);

  return (
    <GlassPanel tone="elevated" padding="none" className="flex h-full flex-col">
      <div className="space-y-3 border-b border-white/5 p-4">
        <div className="flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">
            近日案牍
          </div>
          <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-[#9AA3C4]">
            {tasks.length}
          </span>
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-[11px] leading-6 text-[#7E86A8]">
            当前还没有案卷。先在中枢下第一道密旨，案件队列会自动生成。
          </div>
        ) : (
          <>
        {currentTask ? (
          <div className="rounded-2xl border border-[#F0C66A]/16 bg-[#F0C66A]/[0.04] px-3 py-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">
              <Crown size={11} className="text-[#F0C66A]" />
              主案
            </div>
            <div className="mt-2 line-clamp-2 text-[12px] font-semibold leading-6 text-[#F5E9C9]">
              {currentTask.title}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <TaskStatusBadge status={currentTask.status} />
              <span className="text-[10px] text-[#9AA3C4]">{deriveQueueHint(currentTask.status)}</span>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <QueueMetric
            label="待批"
            value={queuePulse.pendingReview}
            tone={queuePulse.pendingReview > 0 ? 'warn' : 'neutral'}
            icon={<ShieldCheck size={11} />}
          />
          <QueueMetric
            label="推进中"
            value={queuePulse.executing}
            tone={queuePulse.executing > 0 ? 'active' : 'neutral'}
            icon={<Crown size={11} />}
          />
          <QueueMetric
            label="新案"
            value={queuePulse.fresh}
            tone={queuePulse.fresh > 0 ? 'danger' : 'neutral'}
            icon={<AlertTriangle size={11} />}
          />
        </div>

        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2.5 py-1.5 transition-colors focus-within:border-[#F0C66A]/40">
          <Search size={12} className="text-[#484F72]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索旨意..."
            className="flex-1 bg-transparent text-[11px] text-[#EAEEFB] outline-none placeholder:text-[#484F72]"
          />
        </label>

        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 text-[9px]">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
                className="shrink-0 rounded-full border px-2.5 py-0.5 transition-colors"
                style={{
                  borderColor: active ? '#F0C66A' : 'rgba(255,255,255,0.08)',
                  color: active ? '#F0C66A' : '#9AA3C4',
                  background: active ? 'rgba(240,198,106,0.08)' : 'transparent',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
          </>
        )}
      </div>

      <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-[#484F72]">
            <Inbox size={22} />
            <div className="text-[10px]">无匹配案卷</div>
          </div>
        ) : (
          filtered.map((t) => {
            const active = t.id === currentTaskId;
            const spotlight = t.id === spotlightTaskId;
            return (
              <button
                key={t.id}
                ref={(node) => {
                  itemRefs.current[t.id] = node;
                }}
                type="button"
                onClick={() => onSelect(t.id)}
                className="group block w-full rounded-md border p-2.5 text-left transition-all"
                style={{
                  borderColor: active
                    ? 'rgba(240,198,106,0.5)'
                    : spotlight
                      ? 'rgba(107,160,255,0.45)'
                      : 'rgba(255,255,255,0.04)',
                  background: active
                    ? 'linear-gradient(90deg, rgba(240,198,106,0.09), transparent)'
                    : spotlight
                      ? 'linear-gradient(90deg, rgba(107,160,255,0.12), transparent)'
                    : 'transparent',
                }}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div
                    className="line-clamp-1 text-[11px] font-medium"
                    style={{ color: active ? '#F0C66A' : spotlight ? '#8AA4FF' : '#EAEEFB' }}
                  >
                    {t.title}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {spotlight ? (
                      <span className="inline-flex shrink-0 items-center rounded-full border border-[#6BA0FF]/35 bg-[#6BA0FF]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#8AA4FF]">
                        刚立案
                      </span>
                    ) : null}
                    <TaskStatusBadge status={t.status} />
                  </div>
                </div>
                <div className="line-clamp-2 text-[9px] leading-relaxed text-[#6A7299] group-hover:text-[#9AA3C4]">
                  {t.rawCommand}
                </div>
                <div className="mt-1 font-mono text-[8px] text-[#484F72]">
                  {new Date(t.createdAt).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </button>
            );
          })
        )}
      </div>
    </GlassPanel>
  );
}

function QueueMetric({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: 'warn' | 'active' | 'danger' | 'neutral';
  icon: React.ReactNode;
}) {
  const toneMap = {
    warn: { border: 'rgba(245,165,36,0.25)', bg: 'rgba(245,165,36,0.08)', text: '#F5A524' },
    active: { border: 'rgba(240,198,106,0.25)', bg: 'rgba(240,198,106,0.08)', text: '#F0C66A' },
    danger: { border: 'rgba(245,139,139,0.25)', bg: 'rgba(245,139,139,0.08)', text: '#F58B8B' },
    neutral: { border: 'rgba(255,255,255,0.08)', bg: 'rgba(255,255,255,0.03)', text: '#9AA3C4' },
  } as const;
  const style = toneMap[tone];

  return (
    <div
      className="rounded-xl border px-2 py-2"
      style={{ borderColor: style.border, background: style.bg }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] uppercase tracking-[0.16em]" style={{ color: style.text }}>
          {label}
        </span>
        <span style={{ color: style.text }}>{icon}</span>
      </div>
      <div className="mt-1 text-[16px] font-semibold" style={{ color: style.text }}>
        {value}
      </div>
    </div>
  );
}

function deriveQueueHint(status: TaskStatus) {
  switch (status) {
    case 'report_ready':
      return '已够裁断';
    case 'running':
    case 'aggregating':
      return '盯推进';
    case 'reviewed':
    case 'archived':
      return '可离中枢';
    default:
      return '先压问题';
  }
}

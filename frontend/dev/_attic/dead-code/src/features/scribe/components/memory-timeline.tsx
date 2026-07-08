'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Search, Inbox, Filter, Clock } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import {
  deriveEntries,
  filterEntries,
  groupByDay,
  sourceLabel,
  type MemoryEntry,
  type MemorySource,
} from '../lib/derive-entries';
import type { Task } from '@/types/task';
import type { AgentRun } from '@/types/agent';

export interface MemoryTimelineProps {
  tasks: Task[];
  runs: AgentRun[];
}

const ALL_SOURCES: MemorySource[] = ['task', 'plan', 'agent', 'review', 'archive'];

export function MemoryTimeline({ tasks, runs }: MemoryTimelineProps) {
  const entries = useMemo(() => deriveEntries(tasks, runs), [tasks, runs]);
  const [query, setQuery] = useState('');
  const [activeSources, setActiveSources] = useState<Set<MemorySource>>(
    new Set(ALL_SOURCES),
  );
  const [cursor, setCursor] = useState<string | null>(null);

  const visible = useMemo(
    () => filterEntries(entries, query, activeSources),
    [entries, query, activeSources],
  );
  const groups = useMemo(() => groupByDay(visible), [visible]);

  // Persist scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const saved = sessionStorage.getItem('scribe:scroll');
    if (saved && scrollRef.current) {
      scrollRef.current.scrollTop = Number(saved);
    }
    return () => {
      if (scrollRef.current) {
        sessionStorage.setItem('scribe:scroll', String(scrollRef.current.scrollTop));
      }
    };
  }, []);

  // Keyboard ↑↓
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      if (visible.length === 0) return;
      e.preventDefault();
      const idx = visible.findIndex((x) => x.id === cursor);
      const next =
        e.key === 'ArrowDown'
          ? Math.min(visible.length - 1, idx + 1)
          : Math.max(0, idx - 1);
      const target = visible[next];
      if (target) setCursor(target.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, cursor]);

  const toggleSource = (s: MemorySource) => {
    const next = new Set(activeSources);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setActiveSources(next);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Left filter rail */}
      <aside className="lg:col-span-3">
        <GlassPanel tone="elevated" padding="lg">
          <div className="mb-3 flex items-center gap-2">
            <Filter size={11} className="text-[#F0C66A]" />
            <div className="text-[9px] uppercase tracking-wider text-[#6A7299]">
              来源 · Sources
            </div>
          </div>
          <div className="space-y-1">
            {ALL_SOURCES.map((s) => {
              const active = activeSources.has(s);
              const count = entries.filter((e) => e.source === s).length;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSource(s)}
                  className="flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-[11px] transition-colors"
                  style={{
                    borderColor: active ? 'rgba(240,198,106,0.4)' : 'rgba(255,255,255,0.05)',
                    color: active ? '#F0C66A' : '#9AA3C4',
                    background: active ? 'rgba(240,198,106,0.06)' : 'transparent',
                  }}
                >
                  <span>{sourceLabel(s)}</span>
                  <span className="font-mono text-[9px] opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 border-t border-white/5 pt-3 text-[9px] text-[#484F72]">
            ↑↓ 键盘导航 · 共 {entries.length} 条
          </div>
        </GlassPanel>
      </aside>

      {/* Center timeline */}
      <main className="lg:col-span-9">
        <GlassPanel tone="flat" padding="lg">
          {/* Search */}
          <label className="mb-4 flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 transition-colors focus-within:border-[#F0C66A]/40">
            <Search size={12} className="text-[#484F72]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索史馆记忆（支持模糊匹配）..."
              className="flex-1 bg-transparent text-[12px] text-[#EAEEFB] outline-none placeholder:text-[#484F72]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-[9px] text-[#6A7299] hover:text-[#EAEEFB]"
              >
                清除
              </button>
            )}
          </label>

          {visible.length === 0 ? (
            <EmptyState hasQuery={query.length > 0} />
          ) : (
            <div ref={scrollRef} className="max-h-[70vh] space-y-6 overflow-y-auto pr-2">
              {groups.map((group) => (
                <section key={group.dayKey}>
                  <div className="sticky top-0 z-10 mb-3 flex items-center gap-2 bg-gradient-to-b from-[#04060e] via-[#04060e] to-transparent pb-1.5 pt-1">
                    <div className="h-px flex-1 bg-gradient-to-r from-[#F0C66A]/30 to-transparent" />
                    <div className="font-serif text-[11px] tracking-wider text-[#F0C66A]">
                      {group.dayLabel}
                    </div>
                    <div className="h-px w-8 bg-gradient-to-l from-[#F0C66A]/30 to-transparent" />
                  </div>
                  <ul className="space-y-2">
                    {group.entries.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        active={entry.id === cursor}
                        onFocus={() => setCursor(entry.id)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </GlassPanel>
      </main>
    </div>
  );
}

function EntryRow({
  entry,
  active,
  onFocus,
}: {
  entry: MemoryEntry;
  active: boolean;
  onFocus: () => void;
}) {
  const accent = entry.accent ?? '#6A7299';
  return (
    <li>
      <Link
        href={`/scribe/${entry.taskId}`}
        onFocus={onFocus}
        onMouseEnter={onFocus}
        className="flex items-start gap-3 rounded-md border p-3 transition-all"
        style={{
          borderColor: active ? `${accent}66` : 'rgba(255,255,255,0.05)',
          background: active
            ? `linear-gradient(90deg, ${accent}12, transparent)`
            : 'transparent',
        }}
      >
        <div className="shrink-0 pt-0.5">
          <Clock size={11} style={{ color: accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[9px] text-[#484F72]">
              {new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[8px] uppercase tracking-wider"
              style={{
                background: `${accent}15`,
                color: accent,
                border: `1px solid ${accent}40`,
              }}
            >
              {sourceLabel(entry.source)}
            </span>
          </div>
          <div className="mt-1 text-[12px] font-medium text-[#EAEEFB]">
            {entry.headline}
          </div>
          {entry.body && (
            <div className="mt-0.5 line-clamp-1 text-[10px] text-[#9AA3C4]">
              {entry.body}
            </div>
          )}
          <div className="mt-1 text-[9px] text-[#484F72]">
            ← {entry.taskTitle}
          </div>
        </div>
      </Link>
    </li>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-[#484F72]">
      <Inbox size={28} />
      <div className="text-[12px]">
        {hasQuery ? '无匹配结果 — 尝试其他关键词' : '史馆尚无条目'}
      </div>
    </div>
  );
}

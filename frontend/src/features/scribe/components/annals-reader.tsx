/**
 * 朝堂 OS · 史馆 · 章回体阅读器
 *
 * 给陛下：
 *   - 一键生成本周/本月章回（调 /api/scribe/annals）
 *   - 历史章回列表（localStorage）
 *   - 阅读器
 */

'use client';

import { useState, useMemo } from 'react';
import { ScrollText, Loader2, Plus, Trash2, BookMarked } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { useAppStore } from '@/lib/store/app-store';
import { toast } from 'sonner';
import type { AnnalChapter, MemoryEvent } from '@/features/scribe/lib/memory-palace';

const STORAGE_KEY = 'courtos.scribe.annals.v1';

function loadChapters(): AnnalChapter[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveChapters(list: AnnalChapter[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function periodLabel(d: Date = new Date(), kind: 'week' | 'month' = 'week'): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (kind === 'month') return `${y}-${String(m).padStart(2, '0')}`;
  // 周 = 当月第几周
  const w = Math.ceil(d.getDate() / 7);
  return `${y}-${String(m).padStart(2, '0')}-W${w}`;
}

export function AnnalsReader() {
  const tasks = useAppStore((s) => s.tasks);
  const [chapters, setChapters] = useState<AnnalChapter[]>(() => loadChapters());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  // 用 tasks 拼出 events（生产应用真正的 event log）
  const eventsFromTasks: MemoryEvent[] = useMemo(() => {
    return tasks.slice(0, 50).map((t) => ({
      id: t.id,
      timestamp: t.createdAt ?? new Date().toISOString(),
      type:
        t.status === 'archived' || t.status === 'reviewed'
          ? 'verdict'
          : t.status === 'failed'
            ? 'anomaly'
            : 'decision',
      payload: { title: t.title, status: t.status },
      caseId: t.id,
      emotionalValence:
        t.status === 'failed' ? 'critical' : t.status === 'archived' ? 'positive' : 'neutral',
      entities: [t.title].filter(Boolean),
      summary: t.title || '（无题任务）',
    }));
  }, [tasks]);

  const active = chapters.find((c) => c.id === activeId) ?? null;

  async function generate() {
    if (eventsFromTasks.length === 0) {
      toast.error('本期还没有可入史的事件 · 先去王座或大殿推进几件要事');
      return;
    }
    setLoading(true);
    try {
      const p = periodLabel(new Date(), period);
      const res = await fetch('/api/scribe/annals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: p,
          events: eventsFromTasks,
          priorChapters: chapters.slice(-2),
        }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }
      const chapter = (await res.json()) as AnnalChapter;
      const next = [chapter, ...chapters].slice(0, 50);
      setChapters(next);
      saveChapters(next);
      setActiveId(chapter.id);
      const provider = res.headers.get('X-LLM-Provider') ?? 'unknown';
      toast.success('新章已成', {
        description: `${chapter.period} · ${chapter.chapterMd.length} 字 · ${provider}`,
        icon: '📜',
      });
    } catch (err) {
      toast.error('章回生成失败', {
        description: err instanceof Error ? err.message : 'unknown',
      });
    } finally {
      setLoading(false);
    }
  }

  function remove(id: string) {
    if (!confirm('删除本章?')) return;
    const next = chapters.filter((c) => c.id !== id);
    setChapters(next);
    saveChapters(next);
    if (activeId === id) setActiveId(null);
  }

  return (
    <GlassPanel variant="gold" tone="deep" padding="lg" hudCorners>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* 左 · 章回列表 */}
        <div className="lg:col-span-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F0C66A]">
            <span className="flex items-center gap-2">
              <BookMarked size={12} />
              纪传 · {chapters.length} 章
            </span>
          </div>

          {/* 生成按钮 */}
          <div className="mt-3 space-y-2 rounded-md border border-[#F0C66A]/25 bg-[#F0C66A]/[0.04] p-3">
            <div className="flex items-center gap-2">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as 'week' | 'month')}
                className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[11.5px] text-[#F5E9C9] focus:outline-none"
              >
                <option value="week">本周</option>
                <option value="month">本月</option>
              </select>
              <span className="text-[11px] text-[#8A92AC]">
                {periodLabel(new Date(), period)}
              </span>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={generate}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-[#F0C66A]/45 bg-[#F0C66A]/15 py-2 text-[12.5px] font-bold text-[#F0C66A] transition hover:bg-[#F0C66A]/22 disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  司马迁撰写中...
                </>
              ) : (
                <>
                  <Plus size={12} />
                  撰新章
                </>
              )}
            </button>
            <div className="text-[11px] leading-5 text-[#8A92AC]">
              基于本期 {eventsFromTasks.length} 件事件 · 章回体生成
            </div>
          </div>

          {/* 章回列表 */}
          {chapters.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 bg-white/[0.02] py-8 text-center">
              <ScrollText size={24} className="text-[#6A7299]" />
              <div className="text-[12px] text-[#9AA3C4]">史馆尚虚 · 撰下第一章</div>
            </div>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {chapters.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition"
                    style={{
                      borderColor:
                        activeId === c.id
                          ? 'rgba(240,198,106,0.5)'
                          : 'rgba(255,255,255,0.08)',
                      background:
                        activeId === c.id
                          ? 'rgba(240,198,106,0.08)'
                          : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div>
                      <div
                        className="text-[12.5px] font-semibold text-[#F5E9C9]"
                        style={{ fontFamily: '"Noto Serif SC", serif' }}
                      >
                        {c.period} 章
                      </div>
                      <div className="text-[11px] text-[#8A92AC]">
                        {new Date(c.generatedAt).toLocaleDateString('zh-CN')} ·
                        {c.chapterMd.length} 字
                      </div>
                    </div>
                    <span
                      className="text-[#9AA3C4] hover:text-[#F43F5E]"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(c.id);
                      }}
                    >
                      <Trash2 size={11} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 右 · 阅读器 */}
        <div className="lg:col-span-8">
          {!active ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 py-16 text-center">
              <ScrollText size={32} className="text-[#6A7299]" />
              <div className="text-[13px] text-[#9AA3C4]">
                选一章 · 或点击「撰新章」
              </div>
            </div>
          ) : (
            <ChapterView chapter={active} />
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

function ChapterView({ chapter }: { chapter: AnnalChapter }) {
  return (
    <article
      className="prose-court max-h-[640px] overflow-y-auto rounded-lg border px-6 py-5"
      style={{
        borderColor: 'rgba(240,198,106,0.25)',
        background:
          'linear-gradient(135deg, rgba(28,22,10,0.85) 0%, rgba(10,7,4,0.95) 60%, rgba(7,5,15,0.85) 100%)',
        color: '#F5E9C9',
        fontFamily: '"Noto Serif SC", serif',
      }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#F0C66A]">
        Annals · {chapter.period}
      </div>
      <pre
        className="mt-3 whitespace-pre-wrap text-[14px] leading-9 tracking-[0.04em]"
        style={{ fontFamily: '"Noto Serif SC", serif' }}
      >
        {chapter.chapterMd}
      </pre>
      <footer className="mt-6 border-t border-white/10 pt-3 text-[11px] text-[#8A92AC]">
        本章源自 {chapter.sourceEventIds.length} 件事 · 生成于
        {' '}
        {new Date(chapter.generatedAt).toLocaleString('zh-CN')}
      </footer>
    </article>
  );
}

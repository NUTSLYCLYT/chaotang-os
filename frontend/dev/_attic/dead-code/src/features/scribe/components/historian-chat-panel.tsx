/**
 * 史馆 · 史官对话面板（右侧常驻）
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  ScrollText,
  MessageSquareQuote,
  BookOpen,
  Sparkles,
  Award,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { HistorianPersona, type HistorianMood } from './historian-persona';
import { useScribeFocus, type ScribeFocus } from './scribe-focus-context';
import {
  ANNALS_ENTRIES,
  OUTCOME_META,
  type AnnalsEntry,
} from '../lib/annals-entries';
import { streamSseTokens } from '@/lib/sse-tokens';

const GOLD = '#F0C66A';

interface Message {
  role: 'historian' | 'user';
  text: string;
  time: string;
}

const QUICK = [
  '近期最值得回看一卷？',
  '过往失误都栽在哪个口子？',
  '相似的旧案可召回几例？',
  '今年成败比如何？',
  '把近 3 条成案要义抄送丞相',
];

export function HistorianChatPanel() {
  const { focus } = useScribeFocus();

  const moodFromFocus = (): HistorianMood => {
    if (focus.kind === 'entry') {
      const e = ANNALS_ENTRIES.find((x) => x.id === focus.entryId);
      if (e?.outcome === 'failure') return 'stern';
      if (e) return 'recalling';
    }
    return 'contemplative';
  };

  const archivedCount = ANNALS_ENTRIES.length;

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'historian',
      text: '陛下今日安。臣已整理近年十二卷宗 · 七成一败、三混两成。陛下欲阅何卷？',
      time: '刚刚',
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, thinking]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'user', text: trimmed, time: now }]);
    setInput('');
    setThinking(true);
    const agentTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'historian', text: '▋', time: agentTime }]);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error('upstream');

      let accumulated = '';
      for await (const token of streamSseTokens(res.body)) {
        accumulated += token;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'historian', text: accumulated + '▋', time: agentTime };
          return next;
        });
      }

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'historian',
          text: accumulated || '臣已收到旨意。',
          time: agentTime,
        };
        return next;
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'historian',
          text: '臣一时无对 · 请陛下再次下旨。',
          time: agentTime,
        };
        return next;
      });
    } finally {
      setThinking(false);
    }
  }, [thinking]);

  return (
    <div className="flex h-full flex-col gap-4">
      <GlassPanel variant="gold" tone="elevated" padding="md" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(240,198,106,0.16), transparent 60%)',
          }}
        />
        <div className="relative flex flex-col items-center text-center">
          <HistorianPersona mood={moodFromFocus()} size="md" archivedCount={archivedCount} />
          <div className="mt-3 text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">
            Imperial Historian · 史官
          </div>
          <h3 className="mt-1 text-[18px] font-semibold text-[#F5E9C9]">
            复盘台 · 秉笔司马迁
          </h3>
          <div className="mt-2 rounded-xl border border-[#F0C66A]/25 bg-black/20 px-3 py-2 text-[12px] leading-6 text-[#D6CCB0]">
            {messages[0]!.text}
          </div>
        </div>
      </GlassPanel>

      <div className="flex-1 overflow-hidden">
        <FocusResponse focus={focus} />
      </div>

      <GlassPanel tone="deep" padding="md" className="overflow-hidden">
        <div className="flex items-center gap-2">
          <MessageSquareQuote size={12} style={{ color: GOLD }} />
          <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
            与史官对话
          </div>
        </div>
        <div ref={scrollRef} className="mt-3 max-h-[180px] space-y-2 overflow-y-auto pr-1">
          {messages.slice(1).map((m, i) => (
            <MessageRow key={i} m={m} />
          ))}
          {thinking && (
            <div className="flex items-center gap-2 text-[11px] text-[#9AA3C4]">
              <span className="inline-flex gap-1">
                <Dot delay={0} />
                <Dot delay={150} />
                <Dot delay={300} />
              </span>
              史官正在翻卷...
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2 py-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend(input);
            }}
            placeholder="请陛下问史..."
            className="flex-1 bg-transparent px-2 py-1.5 text-[12px] text-[#F5E9C9] outline-none placeholder:text-[#6A7299]"
          />
          <button
            type="button"
            onClick={() => handleSend(input)}
            disabled={!input.trim()}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              borderColor: `${GOLD}66`,
              background: `${GOLD}18`,
              color: GOLD,
            }}
          >
            <Send size={11} />
            问史
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleSend(p)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-[#B8C0DA] transition hover:border-[#F0C66A]/40 hover:text-[#F5E9C9]"
            >
              {p}
            </button>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

/* ========================================================================== */

function MessageRow({ m }: { m: Message }) {
  const isUser = m.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{
          background: isUser ? '#6BA0FF22' : `${GOLD}22`,
          border: isUser ? '1px solid #6BA0FF55' : `1px solid ${GOLD}55`,
        }}
      >
        {isUser ? <span className="text-[9px] text-[#6BA0FF]">陛</span> : <ScrollText size={10} style={{ color: GOLD }} />}
      </div>
      <div
        className="max-w-[85%] rounded-xl border px-3 py-2 text-[11px] leading-6"
        style={{
          background: isUser ? 'rgba(107,160,255,0.08)' : 'rgba(240,198,106,0.08)',
          borderColor: isUser ? 'rgba(107,160,255,0.25)' : 'rgba(240,198,106,0.25)',
          color: '#D6CCB0',
        }}
      >
        {m.text}
        <div className="mt-1 text-right text-[9px] text-[#6A7299]">{m.time}</div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1 w-1 animate-pulse rounded-full"
      style={{ background: GOLD, animationDelay: `${delay}ms` }}
    />
  );
}

/* ========================================================================== */

function FocusResponse({ focus }: { focus: ScribeFocus }) {
  if (focus.kind === 'entry') {
    const entry = ANNALS_ENTRIES.find((e) => e.id === focus.entryId);
    return entry ? <EntryFocus entry={entry} /> : <HomeFocus />;
  }
  if (focus.kind === 'lesson') {
    return <LessonFocus lessonTag={focus.lessonTag} />;
  }
  return <HomeFocus />;
}

function HomeFocus() {
  const recent = ANNALS_ENTRIES.slice(0, 3);
  const items: { icon: LucideIcon; color: string; title: string; body: string }[] = [
    {
      icon: Award,
      color: '#3DD68C',
      title: '近期最值得回看',
      body: `"${recent[0]?.title ?? ''}" — ${recent[0]?.summary ?? ''}`,
    },
    {
      icon: AlertTriangle,
      color: '#F43F5E',
      title: '最该警醒一卷',
      body: (() => {
        const failure = ANNALS_ENTRIES.find((e) => e.outcome === 'failure');
        return failure ? `"${failure.title}" — ${failure.summary}` : '';
      })(),
    },
    {
      icon: Sparkles,
      color: GOLD,
      title: '可召回相似案',
      body: '当前任务匹配史馆 3 条相似卷宗，建议先阅再动。',
    },
  ];
  return (
    <GlassPanel tone="deep" padding="md" className="h-full overflow-auto">
      <div className="flex items-center gap-2">
        <BookOpen size={12} style={{ color: GOLD }} />
        <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
          Today From Archive · 今日引卷
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        {items.map((h, i) => {
          const Icon = h.icon;
          return (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-xl border p-3"
              style={{
                background: `linear-gradient(160deg, ${h.color}0c, rgba(20,22,30,0.4))`,
                borderColor: `${h.color}28`,
              }}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${h.color}1a`, border: `1px solid ${h.color}55` }}
              >
                <Icon size={12} style={{ color: h.color }} />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold" style={{ color: '#F5E9C9' }}>
                  {h.title}
                </div>
                <div className="mt-1 text-[11px] leading-6 text-[#9AA3C4]">{h.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

function EntryFocus({ entry }: { entry: AnnalsEntry }) {
  const meta = OUTCOME_META[entry.outcome];
  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      <div
        className="rounded-2xl border p-4"
        style={{
          borderColor: `${meta.color}55`,
          background: `linear-gradient(135deg, ${meta.color}14, transparent 70%)`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: meta.color }}>
            {entry.dateLabel} · {entry.category}
          </div>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-bold"
            style={{
              background: `radial-gradient(circle, ${meta.color}aa, ${meta.color}22)`,
              color: '#F5E9C9',
              border: `1px solid ${meta.color}`,
            }}
          >
            {meta.glyph}
          </div>
        </div>
        <div className="mt-1 text-[18px] font-semibold text-[#F5E9C9]">{entry.title}</div>
        <div className="mt-1 text-[11px] text-[#9AA3C4]">{entry.summary}</div>
      </div>

      <GlassPanel tone="deep" padding="md">
        <div className="text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">详述</div>
        <p className="mt-2 text-[12px] leading-7 text-[#C8CDD8]">{entry.detail}</p>
      </GlassPanel>

      <GlassPanel tone="deep" padding="md">
        <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
          Lessons · 教训（{entry.lessons.length}）
        </div>
        <ul className="mt-2 space-y-1.5 text-[11px] leading-6 text-[#D6CCB0]">
          {entry.lessons.map((l, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span
                className="mt-[6px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-mono"
                style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}55` }}
              >
                {i + 1}
              </span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </GlassPanel>

      <GlassPanel tone="deep" padding="md">
        <div className="text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">涉及部门</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {entry.relatedDepartments.map((d) => (
            <span
              key={d}
              className="rounded-full border border-[#F0C66A]/30 bg-[#F0C66A]/08 px-2 py-0.5 text-[10px]"
              style={{ color: '#F5E9C9' }}
            >
              {d}
            </span>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

function LessonFocus({ lessonTag }: { lessonTag: string }) {
  const matched = ANNALS_ENTRIES.filter((e) =>
    e.tags.some((t) => t.includes(lessonTag)) || e.lessons.some((l) => l.includes(lessonTag)),
  );
  return (
    <GlassPanel tone="deep" padding="md" className="h-full overflow-auto">
      <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
        Lesson Tag · {lessonTag}
      </div>
      <div className="mt-3 space-y-2">
        {matched.map((e) => {
          const meta = OUTCOME_META[e.outcome];
          return (
            <div
              key={e.id}
              className="rounded-xl border p-3"
              style={{ borderColor: `${meta.color}33`, background: `${meta.color}08` }}
            >
              <div className="text-[12px] font-semibold text-[#F5E9C9]">{e.title}</div>
              <div className="mt-1 text-[10px] text-[#9AA3C4]">{e.dateLabel} · {e.category}</div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}


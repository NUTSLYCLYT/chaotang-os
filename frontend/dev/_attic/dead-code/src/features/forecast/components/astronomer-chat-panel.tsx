/**
 * 观天台 · 钦天监正对话面板（右侧常驻）
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Telescope,
  Star,
  ShieldAlert,
  Target,
  Calendar,
  ArrowRight,
  Clock,
  Sparkles,
  MessageSquareQuote,
  Wind,
  Mountain,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { AstronomerPersona, moodFromConfidence } from './astronomer-persona';
import { useForecastFocus, type ForecastFocus } from './forecast-focus-context';
import type { ForecastScenario, ScenarioName } from '@/types/forecast';
import { streamSseTokens } from '@/lib/sse-tokens';

const ACCENT = '#B794F4';

const SCENARIO_COLOR: Record<ScenarioName, string> = {
  optimistic: '#3DD68C',
  base: '#F0C66A',
  pessimistic: '#F43F5E',
};
const SCENARIO_LABEL: Record<ScenarioName, string> = {
  optimistic: '上策',
  base: '中策',
  pessimistic: '下策',
};

interface Message {
  role: 'astronomer' | 'user';
  text: string;
  time: string;
}

export interface AstronomerChatPanelProps {
  scenarios: ForecastScenario[];
  /** 当前基准置信度 0-100 */
  confidence?: number;
}

const QUICK_PROMPTS = [
  '此策应否立即启？',
  '最临近的风口何时？',
  '若下策触发，当如何预备？',
  '何时再占？',
  '评一下钦天监置信',
];

export function AstronomerChatPanel({ scenarios, confidence }: AstronomerChatPanelProps) {
  const { focus } = useForecastFocus();
  const mood = moodFromConfidence(confidence);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'astronomer',
      text: '陛下吉安。臣已观过子时至辰时星象——紫微稳，太白略西，中策概率最高。陛下可议。',
      time: '刚刚',
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'user', text: trimmed, time: now }]);
    setInput('');
    setThinking(true);
    const agentTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'astronomer', text: '▋', time: agentTime }]);

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
          next[next.length - 1] = { role: 'astronomer', text: accumulated + '▋', time: agentTime };
          return next;
        });
      }

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'astronomer',
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
          role: 'astronomer',
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
      {/* Persona */}
      <GlassPanel variant="gold" tone="elevated" padding="md" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(183,148,244,0.14), transparent 60%)',
          }}
        />
        <div className="relative flex flex-col items-center text-center">
          <AstronomerPersona mood={mood} size="md" confidence={confidence} />
          <div className="mt-3 text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">
            Imperial Astronomer · 钦天监正
          </div>
          <h3 className="mt-1 text-[18px] font-semibold text-[#F5E9C9]">司天李淳风</h3>
          <div className="mt-2 rounded-xl border border-[#B794F4]/25 bg-black/20 px-3 py-2 text-[12px] leading-6 text-[#D6CCB0]">
            {messages[0]!.text}
          </div>
        </div>
      </GlassPanel>

      {/* Focus response */}
      <div className="flex-1 overflow-hidden">
        <FocusResponse focus={focus} scenarios={scenarios} />
      </div>

      {/* Chat */}
      <GlassPanel tone="deep" padding="md" className="overflow-hidden">
        <div className="flex items-center gap-2">
          <MessageSquareQuote size={12} style={{ color: ACCENT }} />
          <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
            与钦天监对话
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
              钦天监正在占验...
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
            placeholder="请陛下问占..."
            className="flex-1 bg-transparent px-2 py-1.5 text-[12px] text-[#F5E9C9] outline-none placeholder:text-[#6A7299]"
          />
          <button
            type="button"
            onClick={() => handleSend(input)}
            disabled={!input.trim()}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              borderColor: `${ACCENT}66`,
              background: `${ACCENT}18`,
              color: ACCENT,
            }}
          >
            <Send size={11} />
            占验
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleSend(p)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-[#B8C0DA] transition hover:border-[#B794F4]/40 hover:text-[#F5E9C9]"
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
          background: isUser ? '#6BA0FF22' : `${ACCENT}22`,
          border: isUser ? '1px solid #6BA0FF55' : `1px solid ${ACCENT}55`,
        }}
      >
        {isUser ? <span className="text-[9px] text-[#6BA0FF]">陛</span> : <Telescope size={10} style={{ color: ACCENT }} />}
      </div>
      <div
        className="max-w-[85%] rounded-xl border px-3 py-2 text-[11px] leading-6"
        style={{
          background: isUser ? 'rgba(107,160,255,0.08)' : 'rgba(183,148,244,0.08)',
          borderColor: isUser ? 'rgba(107,160,255,0.25)' : 'rgba(183,148,244,0.25)',
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
      style={{ background: ACCENT, animationDelay: `${delay}ms` }}
    />
  );
}

/* ========================================================================== */

function FocusResponse({ focus, scenarios }: { focus: ForecastFocus; scenarios: ForecastScenario[] }) {
  if (focus.kind === 'home') return <HomeFocus scenarios={scenarios} />;
  if (focus.kind === 'scenario') return <ScenarioFocus scenarioId={focus.scenarioId} scenarios={scenarios} />;
  if (focus.kind === 'riskWindow') {
    const sc = scenarios.find((s) => s.id === focus.scenarioId);
    const win = sc?.riskWindows.find((w) => w.id === focus.windowId);
    return win ? <RiskWindowFocus windowData={win} scenario={sc!} /> : null;
  }
  if (focus.kind === 'trigger') {
    const sc = scenarios.find((s) => s.id === focus.scenarioId);
    const tr = sc?.triggerConditions.find((t) => t.id === focus.triggerId);
    return tr ? <TriggerFocus trigger={tr} scenario={sc!} /> : null;
  }
  return null;
}

function HomeFocus({ scenarios }: { scenarios: ForecastScenario[] }) {
  const items: { icon: LucideIcon; color: string; title: string; body: string }[] = [
    {
      icon: Star,
      color: '#F0C66A',
      title: '星象概述',
      body: '紫微稳定，太白略西；中策概率 46%，高于上下两策。',
    },
    {
      icon: Wind,
      color: '#B794F4',
      title: '最近风口',
      body: '未来 14 日内有 3 个关键窗口，其中 1 个高优先级。',
    },
    {
      icon: ShieldAlert,
      color: '#F43F5E',
      title: '风险触发',
      body: '下策触发条件：地缘冲突升级 & 宏观流动性收紧同现。',
    },
    {
      icon: Target,
      color: '#3DD68C',
      title: '预备动作',
      body: '三策各有 3-4 项预备，最值得先做：对冲 + 储粮 + 训武。',
    },
  ];
  return (
    <GlassPanel tone="deep" padding="md" className="h-full overflow-auto">
      <div className="flex items-center gap-2">
        <Sparkles size={12} style={{ color: ACCENT }} />
        <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
          Today Reading · 今日占验
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        {items.map((h, i) => {
          const Icon = h.icon;
          return (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-xl border border-white/8 p-3"
              style={{
                background: `linear-gradient(160deg, ${h.color}0a, rgba(20,22,30,0.4))`,
                borderColor: `${h.color}22`,
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

function ScenarioFocus({
  scenarioId,
  scenarios,
}: {
  scenarioId: string;
  scenarios: ForecastScenario[];
}) {
  const sc = scenarios.find((s) => s.id === scenarioId);
  if (!sc) return null;
  const color = SCENARIO_COLOR[sc.name];
  const pct = Math.round(sc.probability * 100);
  const conf = Math.round(sc.confidence * 100);
  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      <div
        className="rounded-2xl border p-4"
        style={{
          borderColor: `${color}55`,
          background: `linear-gradient(135deg, ${color}14, transparent 70%)`,
        }}
      >
        <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color }}>
          {SCENARIO_LABEL[sc.name]} · {sc.name}
        </div>
        <div className="mt-1 text-[20px] font-semibold text-[#F5E9C9]">{sc.label}</div>
        <div className="mt-2 text-[11px] leading-6 text-[#C8CDD8]">{sc.payoffDescription}</div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="概率" value={`${pct}%`} color={color} />
          <Stat label="置信" value={`${conf}%`} color={color} />
          <Stat label="风口" value={`${sc.riskWindows.length}`} color={color} />
        </div>
      </div>

      {/* 触发条件 */}
      <GlassPanel tone="deep" padding="md">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">
          <ShieldAlert size={11} style={{ color }} />
          触发条件（共 {sc.triggerConditions.length}）
        </div>
        <ul className="mt-2 space-y-1.5 text-[11px] leading-6 text-[#C8CDD8]">
          {sc.triggerConditions.slice(0, 4).map((t) => (
            <li key={t.id} className="flex items-start gap-1.5">
              <span className="mt-[7px] inline-block h-1 w-1 shrink-0 rounded-full" style={{ background: color }} />
              <span>
                {t.description}{' '}
                <span className="text-[10px] text-[#9AA3C4]">· {Math.round(t.probability * 100)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </GlassPanel>

      {/* 预备 */}
      <GlassPanel tone="deep" padding="md">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">
          <Target size={11} style={{ color: '#3DD68C' }} />
          预备动作（共 {sc.preActions.length}）
        </div>
        <ul className="mt-2 space-y-1.5 text-[11px] leading-6 text-[#D6CCB0]">
          {sc.preActions.slice(0, 4).map((p) => (
            <li key={p} className="flex items-start gap-1.5">
              <ArrowRight size={10} className="mt-[6px]" style={{ color: '#3DD68C' }} />
              {p}
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}

function RiskWindowFocus({ windowData, scenario }: { windowData: { id: string; period: string; opportunity: string; urgency: string }; scenario: ForecastScenario }) {
  const color = SCENARIO_COLOR[scenario.name];
  return (
    <GlassPanel tone="deep" padding="md" className="h-full">
      <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color }}>
        Risk Window · 风口
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Calendar size={13} style={{ color }} />
        <div className="text-[14px] font-semibold text-[#F5E9C9]">{windowData.period}</div>
      </div>
      <div className="mt-2 text-[12px] leading-6 text-[#C8CDD8]">{windowData.opportunity}</div>
    </GlassPanel>
  );
}

function TriggerFocus({ trigger, scenario }: { trigger: { id: string; description: string; probability: number; source: string }; scenario: ForecastScenario }) {
  const color = SCENARIO_COLOR[scenario.name];
  return (
    <GlassPanel tone="deep" padding="md" className="h-full">
      <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color }}>
        Trigger · 触发条件
      </div>
      <div className="mt-2 text-[13px] leading-7 text-[#F5E9C9]">{trigger.description}</div>
      <div className="mt-2 flex items-center gap-2 text-[10px]">
        <span className="font-mono" style={{ color }}>
          {Math.round(trigger.probability * 100)}%
        </span>
        <span className="text-[#9AA3C4]">· 源：{trigger.source}</span>
      </div>
    </GlassPanel>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2 text-center">
      <div className="text-[9px] uppercase tracking-[0.18em] text-[#6A7299]">{label}</div>
      <div className="mt-0.5 font-mono text-[14px] font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}


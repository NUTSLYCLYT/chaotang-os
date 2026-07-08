/**
 * 太医院 · 太医对话面板（右侧常驻）
 *
 * 上：太医人像 + 今日脉象评语
 * 中：动态响应区（根据 HealthFocus 切换：home/organ/meridian/news）
 *     - home: 今日 3 条亮点钩子
 *     - organ/meridian: 显示相关专家 & 城市医院 + 中西医解读
 *     - news: 相关专家 + 收藏
 * 下：对话输入 + 快选问诊条
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Sparkles,
  Stethoscope,
  Hospital,
  CalendarCheck,
  Star,
  MessageSquareQuote,
  Video,
  PhoneCall,
  ArrowUpRight,
  Activity,
  Flame,
  Moon,
  Heart as HeartIcon,
  Siren,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { colors } from '@/config/design-tokens';
import { PhysicianPersona, moodFromScore } from './physician-persona';
import { useHealthFocus, type HealthFocus } from './health-focus-context';
import { ORGAN_ATLAS, STATUS_META } from '../lib/organs';
import { MERIDIANS } from '../lib/meridians';
import {
  expertsForOrgan,
  expertsForMeridian,
  EXPERTS,
  type Expert,
} from '../lib/experts';
import { streamSseTokens } from '@/lib/sse-tokens';

const HEALTH_ACCENT = colors.success;

interface Message {
  role: 'physician' | 'user';
  text: string;
  time: string;
}

interface PhysicianChatPanelProps {
  /** 当前整体评分 */
  totalScore?: number;
  /** 今日概览（hub 模式用） */
  todayHooks?: { icon: LucideIcon; color: string; title: string; body: string }[];
}

const DEFAULT_QUICK_PROMPTS = [
  '今日血压如何？',
  '看最近睡眠',
  '推荐今日运动',
  '脾经虚该怎么调',
  '生化指标有异常吗',
];

export function PhysicianChatPanel({
  totalScore,
  todayHooks,
}: PhysicianChatPanelProps) {
  const { focus } = useHealthFocus();
  const mood = moodFromScore(totalScore);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'physician',
      text: '陛下晨安，臣太医已阅昨日脉案。心率平稳、血压尚佳，唯脾经活力略低。今日可议。',
      time: '刚刚',
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto scroll to bottom on new message
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
    setMessages((prev) => [...prev, { role: 'physician', text: '▋', time: agentTime }]);

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
          next[next.length - 1] = { role: 'physician', text: accumulated + '▋', time: agentTime };
          return next;
        });
      }

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'physician',
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
          role: 'physician',
          text: '臣一时无对 · 请陛下再次问诊。',
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
      {/* 1 · 太医人像 + 今日脉象 */}
      <GlassPanel
        variant="gold"
        tone="elevated"
        padding="md"
        className="relative overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 0%, rgba(240,198,106,0.14), transparent 60%)',
          }}
        />
        <div className="relative flex flex-col items-center text-center">
          <PhysicianPersona mood={mood} score={totalScore} size="md" />
          <div className="mt-3 text-[11px] uppercase tracking-[0.22em]" style={{ color: colors.goldDeep }}>
            Imperial Physician · 太医
          </div>
          <h3 className="mt-1 text-[18px] font-semibold" style={{ color: colors.text }}>
            太医 · 孙思邈堂
          </h3>
          <div className="mt-2 rounded-xl border px-3 py-2 text-[12px] leading-6" style={{ borderColor: `${colors.goldBright}33`, background: 'rgba(0,0,0,0.2)', color: colors.text }}>
            {messages[0]!.text}
          </div>
        </div>
      </GlassPanel>

      {/* 2 · 动态响应区 */}
      <div className="flex-1 overflow-hidden">
        <FocusResponsePanel focus={focus} todayHooks={todayHooks} />
      </div>

      {/* 3 · 对话区 */}
      <GlassPanel tone="deep" padding="md" className="overflow-hidden">
        <div className="flex items-center gap-2">
          <MessageSquareQuote size={12} style={{ color: HEALTH_ACCENT }} />
          <div
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: HEALTH_ACCENT }}
          >
            与太医对话 · Consult
          </div>
        </div>

        {/* Conversation scroll */}
        <div
          ref={scrollRef}
          className="mt-3 max-h-[180px] space-y-2 overflow-y-auto pr-1"
        >
          {messages.slice(1).map((m, i) => (
            <MessageRow key={i} m={m} />
          ))}
          {thinking && (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: colors.textDim }}>
              <span className="inline-flex gap-1">
                <Dot delay={0} />
                <Dot delay={150} />
                <Dot delay={300} />
              </span>
              太医正在查脉案...
            </div>
          )}
        </div>

        {/* Input */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2 py-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend(input);
            }}
            placeholder="请陛下问诊..."
            className="flex-1 bg-transparent px-2 py-1.5 text-[12px] outline-none"
            style={{ color: colors.text }}
          />
          <button
            type="button"
            onClick={() => handleSend(input)}
            disabled={!input.trim()}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              borderColor: `${HEALTH_ACCENT}66`,
              background: `${HEALTH_ACCENT}18`,
              color: HEALTH_ACCENT,
            }}
          >
            <Send size={11} />
            问诊
          </button>
        </div>

        {/* Quick prompts */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DEFAULT_QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleSend(p)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] transition hover:text-white"
              style={{ color: colors.textDim, borderColor: 'rgba(255,255,255,0.1)' }}
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
    <div
      className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{
          background: isUser ? `${colors.blueBright}22` : `${HEALTH_ACCENT}22`,
          border: isUser ? `1px solid ${colors.blueBright}55` : `1px solid ${HEALTH_ACCENT}55`,
        }}
      >
        {isUser ? (
          <span className="text-[11px]" style={{ color: colors.blueBright }}>陛</span>
        ) : (
          <Stethoscope size={10} style={{ color: HEALTH_ACCENT }} />
        )}
      </div>
      <div
        className="max-w-[85%] rounded-xl border px-3 py-2 text-[11px] leading-6"
        style={{
          background: isUser ? 'rgba(107,160,255,0.08)' : 'rgba(52,211,153,0.06)',
          borderColor: isUser ? 'rgba(107,160,255,0.25)' : 'rgba(52,211,153,0.25)',
          color: colors.text,
        }}
      >
        {m.text}
        <div className="mt-1 text-right text-[11px]" style={{ color: colors.textMuted }}>{m.time}</div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1 w-1 animate-pulse rounded-full"
      style={{ background: HEALTH_ACCENT, animationDelay: `${delay}ms` }}
    />
  );
}

/* ========================================================================== */

function FocusResponsePanel({
  focus,
  todayHooks,
}: {
  focus: HealthFocus;
  todayHooks?: { icon: LucideIcon; color: string; title: string; body: string }[];
}) {
  if (focus.kind === 'home') return <HomeFocus todayHooks={todayHooks} />;
  if (focus.kind === 'organ') return <OrganFocus organId={focus.organId} />;
  if (focus.kind === 'meridian')
    return <MeridianFocus meridianId={focus.meridianId} pointId={focus.pointId} />;
  if (focus.kind === 'news') return <NewsFocus />;
  if (focus.kind === 'expert') return <ExpertDetailFocus expertId={focus.expertId} />;
  return null;
}

/* ==== Home ==== */

function HomeFocus({
  todayHooks,
}: {
  todayHooks?: { icon: LucideIcon; color: string; title: string; body: string }[];
}) {
  const defaults = todayHooks ?? [
    { icon: HeartIcon, color: colors.success, title: '今日脉象', body: '心率 62 稳 · 血压 118/76 · 血氧 97%' },
    { icon: Moon, color: colors.blueBright, title: '昨夜睡眠', body: '7h 12m · 深睡占 22% · 节律前移 18 分钟' },
    { icon: Flame, color: colors.warning, title: '本周要事', body: '3 项复诊提醒 · 1 次一键体检待发起' },
    { icon: Siren, color: colors.danger, title: '风险告警', body: '脾经活力下降 · 建议观察饮食与情绪' },
  ];
  return (
    <GlassPanel tone="deep" padding="md" className="h-full overflow-auto">
      <div className="flex items-center gap-2">
        <Sparkles size={12} style={{ color: HEALTH_ACCENT }} />
        <div
          className="text-[11px] uppercase tracking-[0.22em]"
          style={{ color: HEALTH_ACCENT }}
        >
          Today Highlights · 今日亮点
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        {defaults.map((h, i) => {
          const Icon = h.icon;
          return (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-3"
              style={{
                background: `linear-gradient(160deg, ${h.color}0a, rgba(20,22,30,0.4))`,
              }}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: `${h.color}1a`,
                  border: `1px solid ${h.color}55`,
                }}
              >
                <Icon size={12} style={{ color: h.color }} />
              </div>
              <div className="min-w-0">
                <div
                  className="text-[12px] font-semibold"
                  style={{ color: colors.text }}
                >
                  {h.title}
                </div>
                <div className="mt-1 text-[11px] leading-6" style={{ color: colors.textDim }}>
                  {h.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

/* ==== Organ ==== */

function OrganFocus({ organId }: { organId: string }) {
  const organ = ORGAN_ATLAS.find((o) => o.id === organId);
  const experts = expertsForOrgan(organId);
  if (!organ) return null;
  const meta = STATUS_META[organ.status];

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      {/* Header */}
      <div
        className="rounded-2xl border p-3"
        style={{
          borderColor: `${meta.color}55`,
          background: `linear-gradient(135deg, ${meta.color}14, transparent 70%)`,
        }}
      >
        <div
          className="text-[11px] uppercase tracking-[0.22em]"
          style={{ color: meta.color }}
        >
          Focus · {organ.nameEn}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="text-[22px] font-semibold" style={{ color: colors.text }}>{organ.nameCn}</div>
          <div
            className="rounded-full px-2 py-0.5 text-[11px]"
            style={{
              background: `${meta.color}18`,
              color: meta.color,
              border: `1px solid ${meta.color}55`,
            }}
          >
            {meta.label} · {organ.score}
          </div>
        </div>
      </div>

      {/* 推荐专家 */}
      <ExpertList title="相关专家与城市医院" experts={experts} />

      {/* 调养 */}
      <GlassPanel tone="deep" padding="md">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em]" style={{ color: colors.goldDeep }}>
          <Activity size={11} style={{ color: HEALTH_ACCENT }} />
          调养建议
        </div>
        <ul className="mt-2 space-y-1.5">
          {organ.recommendations.map((r) => (
            <li
              key={r}
              className="flex items-start gap-1.5 text-[11px] leading-6"
              style={{ color: colors.text }}
            >
              <span
                className="mt-[7px] inline-block h-1 w-1 shrink-0 rounded-full"
                style={{ background: HEALTH_ACCENT }}
              />
              {r}
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}

/* ==== Meridian ==== */

function MeridianFocus({ meridianId, pointId }: { meridianId: string; pointId?: string }) {
  const meridian = MERIDIANS.find((m) => m.id === meridianId);
  const point = meridian?.points.find((p) => p.id === pointId) ?? meridian?.points[0];
  const experts = expertsForMeridian(meridianId);
  if (!meridian) return null;

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      <div
        className="rounded-2xl border p-3"
        style={{
          borderColor: `${meridian.color}55`,
          background: `linear-gradient(135deg, ${meridian.color}14, transparent 70%)`,
        }}
      >
        <div
          className="text-[11px] uppercase tracking-[0.22em]"
          style={{ color: meridian.color }}
        >
          Meridian · {meridian.element} 行
        </div>
        <div className="mt-1 text-[18px] font-semibold" style={{ color: colors.text }}>
          {meridian.nameCn}
        </div>
        <div className="mt-1 text-[11px]" style={{ color: colors.textDim }}>{meridian.summary}</div>
      </div>

      {point && (
        <GlassPanel tone="deep" padding="md">
          <div className="flex items-center gap-2">
            <div
              className="rounded-full px-2 py-0.5 font-mono text-[11px]"
              style={{
                background: `${meridian.color}18`,
                color: meridian.color,
                border: `1px solid ${meridian.color}55`,
              }}
            >
              {point.code}
            </div>
            <div className="text-[16px] font-semibold" style={{ color: colors.text }}>
              {point.nameCn}
            </div>
          </div>
          <div className="mt-2 text-[11px]" style={{ color: colors.text }}>
            <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: colors.goldDeep }}>主治：</span>{' '}
            {point.function}
          </div>
          <div className="mt-2 rounded-xl border px-3 py-2 text-[11px] leading-6" style={{ borderColor: `${HEALTH_ACCENT}66`, background: `${HEALTH_ACCENT}14`, color: colors.text }}>
            <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: HEALTH_ACCENT }}>按摩：</span>{' '}
            {point.massage}
          </div>
        </GlassPanel>
      )}

      <ExpertList title="推荐中医与针灸师" experts={experts} />
    </div>
  );
}

/* ==== News ==== */

function NewsFocus() {
  const experts = EXPERTS.slice(0, 3);
  return (
    <GlassPanel tone="deep" padding="md" className="h-full">
      <div
        className="text-[11px] uppercase tracking-[0.22em]"
        style={{ color: colors.blueBright }}
      >
        News Context · 相关专家
      </div>
      <ExpertList experts={experts} compact />
    </GlassPanel>
  );
}

/* ==== Expert detail ==== */

function ExpertDetailFocus({ expertId }: { expertId: string }) {
  const e = EXPERTS.find((x) => x.id === expertId);
  if (!e) return null;
  return (
    <GlassPanel tone="deep" padding="md" className="h-full">
      <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: colors.goldDeep }}>
        Expert Detail
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full text-[20px] font-bold"
          style={{
            background: 'linear-gradient(135deg, rgba(240,198,106,0.28), rgba(240,198,106,0.05))',
            border: '1px solid rgba(240,198,106,0.6)',
            color: colors.text,
          }}
        >
          {e.name.charAt(0)}
        </div>
        <div>
          <div className="text-[16px] font-semibold" style={{ color: colors.text }}>{e.name}</div>
          <div className="text-[11px]" style={{ color: colors.textDim }}>{e.title}</div>
          <div className="text-[11px]" style={{ color: HEALTH_ACCENT }}>
            {e.specialty}
          </div>
        </div>
      </div>
      <div className="mt-3 text-[11px]" style={{ color: colors.text }}>
        {e.hospital} · {e.city}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ActionBtn icon={CalendarCheck} label={`挂号 ${e.fee}`} primary />
        <ActionBtn icon={e.online ? Video : PhoneCall} label={e.online ? '视频问诊' : '联系助理'} />
      </div>
    </GlassPanel>
  );
}

/* ========================================================================== */

function ExpertList({
  title,
  experts,
  compact,
}: {
  title?: string;
  experts: Expert[];
  compact?: boolean;
}) {
  if (experts.length === 0) {
    return (
      <GlassPanel tone="deep" padding="md">
        {title && (
          <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: colors.goldDeep }}>
            {title}
          </div>
        )}
        <div className="mt-2 text-[11px] leading-6" style={{ color: colors.textDim }}>
          当前没有直接匹配的专家，可先改写症状关键词，或从相关科室继续筛选。
        </div>
      </GlassPanel>
    );
  }
  return (
    <GlassPanel tone="deep" padding="md">
      {title && (
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em]" style={{ color: colors.goldDeep }}>
          <Hospital size={11} style={{ color: HEALTH_ACCENT }} />
          {title}
        </div>
      )}
      <div className={`mt-2 space-y-2 ${compact ? 'max-h-[200px] overflow-auto' : ''}`}>
        {experts.map((e) => (
          <ExpertMini key={e.id} expert={e} />
        ))}
      </div>
    </GlassPanel>
  );
}

function ExpertMini({ expert: e }: { expert: Expert }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-2.5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-bold"
        style={{
          background: 'linear-gradient(135deg, rgba(240,198,106,0.25), rgba(240,198,106,0.05))',
          border: '1px solid rgba(240,198,106,0.5)',
          color: colors.text,
        }}
      >
        {e.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold" style={{ color: colors.text }}>{e.name}</span>
          {e.online && (
            <span className="rounded-full border px-1 text-[11px]" style={{ borderColor: `${HEALTH_ACCENT}80`, background: `${HEALTH_ACCENT}1a`, color: HEALTH_ACCENT }}>
              线上
            </span>
          )}
        </div>
        <div className="text-[11px]" style={{ color: colors.textDim }}>
          {e.hospital} · {e.city}
        </div>
        <div className="text-[11px]" style={{ color: HEALTH_ACCENT }}>
          {e.specialty}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-0.5">
            <Star size={9} style={{ color: colors.goldBright }} fill="currentColor" />
            <span className="font-mono" style={{ color: colors.text }}>{e.rating}</span>
          </span>
          <span style={{ color: colors.textDim }}>·</span>
          <span style={{ color: HEALTH_ACCENT }}>{e.next_slot}</span>
        </div>
      </div>
      <button
        type="button"
        className="flex items-center gap-0.5 rounded-md border px-2 py-1 text-[11px] transition hover:brightness-110"
        style={{
          borderColor: `${HEALTH_ACCENT}55`,
          background: `${HEALTH_ACCENT}14`,
          color: HEALTH_ACCENT,
        }}
      >
        挂号
        <ArrowUpRight size={9} />
      </button>
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  primary,
}: {
  icon: LucideIcon;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className="flex items-center justify-center gap-1 rounded-lg border py-2 text-[11px] font-semibold transition hover:brightness-110"
      style={{
        borderColor: primary ? `${HEALTH_ACCENT}66` : 'rgba(255,255,255,0.12)',
        background: primary ? `${HEALTH_ACCENT}14` : 'rgba(255,255,255,0.04)',
        color: primary ? HEALTH_ACCENT : colors.text,
      }}
    >
      <Icon size={11} />
      {label}
    </button>
  );
}


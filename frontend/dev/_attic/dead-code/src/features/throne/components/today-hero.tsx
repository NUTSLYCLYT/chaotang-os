'use client';

/**
 * 今日焦点 · Hero card
 *
 * 决策者进入系统的第一屏。一件事，一句话，一个动作。
 * 其余都是装饰。
 */

import Link from 'next/link';
import { ArrowRight, Clock, ScrollText, Flame, Eye, Telescope, Inbox } from 'lucide-react';
import type { TodayFocus } from '../lib/today-picker';
import { signalLevelColor } from '../lib/plain-language';
import { colors } from '@/config/design-tokens';

export interface TodayHeroProps {
  focus: TodayFocus;
}

export function TodayHero({ focus }: TodayHeroProps) {
  const { tint, icon, kicker, footnote } = visualsFor(focus);

  return (
    <section
      aria-labelledby="today-hero-title"
      className="relative overflow-hidden rounded-2xl border"
      style={{
        borderColor: `${tint}44`,
        background: `
          radial-gradient(ellipse 120% 60% at 50% 0%, ${tint}18, transparent 65%),
          linear-gradient(180deg, rgba(10, 8, 4, 0.95), rgba(4, 6, 14, 0.92))
        `,
        boxShadow: `
          0 30px 80px rgba(0,0,0,0.5),
          inset 0 1px 0 rgba(255,255,255,0.05),
          inset 0 0 0 1px ${tint}22
        `,
      }}
    >
      {/* Background ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: tint }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${tint}cc, transparent)`,
        }}
      />

      <div className="relative px-8 py-10 md:px-12 md:py-14">
        {/* Kicker */}
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em]" style={{ color: tint }}>
          {icon}
          <span>{kicker}</span>
        </div>

        {/* Headline — huge, readable */}
        <h1
          id="today-hero-title"
          className="display-serif mt-3 text-[28px] font-bold leading-[1.25] md:text-[38px]"
          style={{ color: colors.textWarm }}
        >
          {focus.headline}
        </h1>

        {/* Reason — the why */}
        <p
          className="display-serif mt-5 max-w-[720px] text-[15px] leading-[1.75] md:text-[16px]"
          style={{ color: colors.textSecondary }}
        >
          <span style={{ color: tint }}>臣以为 — </span>
          {focus.reason}
        </p>

        {/* CTAs */}
        {'cta' in focus && (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={focus.cta.href}
              className="group inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[14px] font-semibold transition-all"
              style={{
                background: `linear-gradient(135deg, ${tint}, ${darken(tint)})`,
                color: colors.bg,
                boxShadow: `0 10px 30px ${tint}55`,
              }}
            >
              {focus.cta.label}
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </Link>
            {'secondaryCta' in focus && focus.secondaryCta && (
              <Link
                href={focus.secondaryCta.href}
                className="rounded-lg border border-white/15 px-5 py-3 text-[13px] font-medium transition-colors hover:bg-white/5 hover:text-white"
                style={{ color: colors.textSecondary }}
              >
                {focus.secondaryCta.label}
              </Link>
            )}
          </div>
        )}

        {/* Footnote */}
        {footnote && (
          <div className="mt-6 flex items-center gap-1.5 text-[11px]" style={{ color: colors.textMuted }}>
            <Clock size={11} />
            {footnote}
          </div>
        )}
      </div>

      {/* Bottom gold hairline */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${tint}66, transparent)`,
        }}
      />
    </section>
  );
}

/* ==========================================================================
   Visual mapping per focus kind
   ========================================================================== */

function visualsFor(focus: TodayFocus): {
  tint: string;
  icon: React.ReactNode;
  kicker: string;
  footnote?: string;
} {
  switch (focus.kind) {
    case 'review_task':
      return {
        tint: colors.goldBright,
        icon: <ScrollText size={11} />,
        kicker: 'Pending Imperial Review · 待御批',
        footnote: `呈报已于 ${shortTime(focus.task.updatedAt)} 备好`,
      };
    case 'critical_signal':
      return {
        tint: signalLevelColor('critical'),
        icon: <Flame size={11} />,
        kicker: 'Critical Intel · 急报',
        footnote: `来自 ${focus.signal.regionLabel} · ${focus.signal.industry}`,
      };
    case 'warning_signal':
      return {
        tint: signalLevelColor('warning'),
        icon: <Eye size={11} />,
        kicker: 'Watch · 警讯',
        footnote: `影响指数 ${focus.signal.impactScore ?? '—'}/100`,
      };
    case 'running_task':
      return {
        tint: colors.blueBright,
        icon: <Clock size={11} />,
        kicker: 'In Progress · 正在办理',
        footnote: `${executionModeTr(focus.task.mode)} · 发起于 ${shortTime(focus.task.createdAt)}`,
      };
    case 'forecast_trigger':
      return {
        tint: colors.goldBright,
        icon: <Telescope size={11} />,
        kicker: 'Forecast · 钦天监推演',
        footnote: `${focus.scenario.timeframe.start} — ${focus.scenario.timeframe.end}`,
      };
    case 'empty':
      return {
        tint: colors.blueBright,
        icon: <Inbox size={11} />,
        kicker: 'Tranquility · 朝堂清明',
      };
  }
}

function executionModeTr(m: string): string {
  if (m === 'scripted') return '照本宣科';
  if (m === 'live') return '随机应变';
  return '规矩+变通';
}

function shortTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function darken(hex: string): string {
  // shallow darken, sufficient for gradient end stops
  if (hex.startsWith('#') && hex.length === 7) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return hex;
}

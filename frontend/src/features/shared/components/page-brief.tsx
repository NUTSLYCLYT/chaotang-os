'use client';

import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

export interface PageBriefAction {
  label: string;
  href: string;
  tone?: 'primary' | 'secondary' | 'ghost';
}

export interface PageBriefProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  hook: string;
  brief: string;
  philosophy?: string;
  stats?: Array<{ label: string; value: string }>;
  primaryAction?: PageBriefAction;
  secondaryAction?: PageBriefAction;
}

export function PageBrief({
  eyebrow,
  title,
  subtitle,
  hook,
  brief,
  philosophy,
  stats = [],
  primaryAction,
  secondaryAction,
}: PageBriefProps) {
  return (
    <GlassPanel variant="gold" tone="deep" padding="lg" hudCorners glow className="overflow-hidden">
      <div className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B6AB8C]">{eyebrow}</div>
          <h1
            className="mt-3 max-w-[860px] text-[30px] font-semibold leading-[1.16] text-[#F6EFD8] md:text-[38px]"
            style={{ fontFamily: 'var(--font-serif)', letterSpacing: '0.01em' }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 max-w-[720px] text-[14px] leading-8 text-[#C8CFDF]">{subtitle}</p>
          ) : null}

          <div className="mt-5 rounded-xl border border-[#F0C66A]/18 bg-[#080A12]/80 px-5 py-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B6AB8C]">Page Hook · 页面钩子</div>
            <div className="mt-2 text-[20px] font-semibold leading-8 text-[#F4E8C3]">{hook}</div>
            <div className="mt-3 text-[13px] leading-7 text-[#BCC4D8]">{brief}</div>
            {philosophy ? (
              <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B6AB8C]">
                  <Sparkles size={12} className="text-[#F0C66A]" />
                  Briefing · 简讯
                </div>
                <div className="mt-2 text-[12px] leading-6 text-[#D9CFB4]">{philosophy}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-white/8 bg-black/20 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B6AB8C]">Primary Action · 当前主动作</div>
            {primaryAction ? (
              <>
                <Link
                  href={primaryAction.href}
                  className={actionClass(primaryAction.tone ?? 'primary')}
                >
                  <span>{primaryAction.label}</span>
                  <ChevronRight size={14} />
                </Link>
                <div className="mt-3 text-[12px] leading-6 text-[#B9C1D5]">
                  第一屏只保留一个强动作，避免用户在进入页面时同时面对多个“都重要”的入口。
                </div>
              </>
            ) : (
              <div className="mt-3 text-[12px] leading-6 text-[#B9C1D5]">当前没有主动作。</div>
            )}

            {secondaryAction ? (
              <Link href={secondaryAction.href} className={`${actionClass(secondaryAction.tone ?? 'secondary')} mt-3`}>
                <span>{secondaryAction.label}</span>
                <ChevronRight size={14} />
              </Link>
            ) : null}
          </div>

          {stats.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {stats.map((item) => (
                <div key={item.label} className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B6AB8C]">{item.label}</div>
                  <div className="mt-2 text-[20px] font-semibold text-[#F5E9C9]">{item.value}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </GlassPanel>
  );
}

function actionClass(tone: PageBriefAction['tone']) {
  if (tone === 'ghost') {
    return 'inline-flex items-center justify-between rounded-lg border border-white/10 px-4 py-2 text-[11px] font-medium text-[#EAEEFB] transition hover:bg-white/5';
  }

  if (tone === 'secondary') {
    return 'inline-flex items-center justify-between rounded-lg border border-[#6BA0FF]/25 bg-[#6BA0FF]/10 px-4 py-2 text-[11px] font-medium text-[#9EC2FF] transition hover:bg-[#6BA0FF]/16';
  }

  return 'mt-4 inline-flex items-center justify-between rounded-lg border border-[#F0C66A]/30 bg-[#F0C66A]/12 px-4 py-2 text-[11px] font-medium text-[#F0C66A] transition hover:bg-[#F0C66A]/18';
}

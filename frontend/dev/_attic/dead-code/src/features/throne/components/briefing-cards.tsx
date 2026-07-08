'use client';

/**
 * 次要简报 · Passive info acquisition
 *
 * Hero 之下的三张牌。允许决策者被动地扫到 — 不强求动作，
 * 但点击可立即深入。
 */

import Link from 'next/link';
import { Eye, Telescope, Layers, ArrowUpRight } from 'lucide-react';
import type { SecondaryBriefing } from '../lib/today-picker';

export interface BriefingCardsProps {
  briefings: SecondaryBriefing[];
}

export function BriefingCards({ briefings }: BriefingCardsProps) {
  if (briefings.length === 0) return null;

  return (
    <section aria-labelledby="briefings-title">
      <div className="mb-4 flex items-baseline gap-2">
        <h2
          id="briefings-title"
          className="section-title text-[16px]"
        >
          今日其余要闻
        </h2>
        <span className="text-[10px] text-[#6A7299]">
          · 供陛下参详，不强求即决
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {briefings.map((b) => (
          <BriefingCard key={b.id} briefing={b} />
        ))}
      </div>
    </section>
  );
}

function BriefingCard({ briefing }: { briefing: SecondaryBriefing }) {
  const icon =
    briefing.kind === 'signal' ? (
      <Eye size={12} />
    ) : briefing.kind === 'forecast' ? (
      <Telescope size={12} />
    ) : (
      <Layers size={12} />
    );

  return (
    <Link
      href={briefing.href}
      className="group relative block overflow-hidden rounded-xl border p-5 transition-all hover:-translate-y-0.5"
      style={{
        borderColor: 'rgba(255,255,255,0.08)',
        background:
          'linear-gradient(180deg, rgba(20, 16, 8, 0.6), rgba(10, 8, 4, 0.9))',
      }}
    >
      {/* Hover accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background: `radial-gradient(ellipse at top right, ${briefing.tint}18, transparent 60%)`,
        }}
      />

      <div className="relative">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-wider"
          style={{
            borderColor: `${briefing.tint}55`,
            color: briefing.tint,
            background: `${briefing.tint}10`,
          }}
        >
          {icon}
          {briefing.badge}
        </div>

        {/* Title */}
        <h3 className="display-serif mt-3 line-clamp-2 text-[16px] font-medium leading-snug text-[#f5e9c9] transition-colors group-hover:text-white">
          {briefing.title}
        </h3>

        {/* Summary */}
        <p className="body-copy mt-2 line-clamp-3 text-[12px]">
          {briefing.summary}
        </p>

        {/* Arrow */}
        <div
          className="mt-4 flex items-center gap-1 text-[10px] opacity-50 transition-opacity group-hover:opacity-100"
          style={{ color: briefing.tint }}
        >
          展开细节
          <ArrowUpRight
            size={11}
            className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </div>
      </div>
    </Link>
  );
}

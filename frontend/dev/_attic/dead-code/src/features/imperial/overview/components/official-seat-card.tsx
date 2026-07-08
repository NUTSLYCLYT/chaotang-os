'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { OfficialSeat } from '../lib/official-seats';

export interface OfficialSeatCardProps extends OfficialSeat {
  active?: boolean;
}

const DEPTH_Y: Record<NonNullable<OfficialSeat['depth']>, string> = {
  front: '-translate-y-4',
  mid: '-translate-y-2',
  rear: 'translate-y-0',
};

const URGENCY_DOT: Record<NonNullable<OfficialSeat['urgency']>, string | null> = {
  none: null,
  watch: 'bg-[#F0C66A] shadow-[0_0_16px_rgba(240,198,106,0.75)]',
  urgent: 'bg-[#F43F5E] shadow-[0_0_16px_rgba(244,63,94,0.9)]',
};

export function OfficialSeatCard({
  name,
  office,
  avatar,
  summary,
  badge,
  href,
  urgency = 'none',
  depth = 'rear',
  active,
}: OfficialSeatCardProps) {
  const dotClass = URGENCY_DOT[urgency];

  return (
    <Link
      href={href}
      className={`group relative rounded-[28px] border border-white/6 bg-white/[0.03] px-4 pb-4 pt-5 text-center transition hover:-translate-y-1 hover:border-[#F0C66A]/28 hover:bg-white/[0.045] xl:min-h-[248px] ${DEPTH_Y[depth]} ${active ? 'border-[#F0C66A]/24 bg-[#F0C66A]/[0.06]' : ''}`}
    >
      <div className="mx-auto flex w-full flex-col items-center">
        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-full text-[20px] font-bold"
          style={{
            background: 'linear-gradient(135deg, rgba(240,198,106,0.18), rgba(240,198,106,0.05))',
            border: '1px solid rgba(240,198,106,0.32)',
            color: '#F0C66A',
            boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
          }}
        >
          {avatar}
          {dotClass ? (
            <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full animate-pulse ${dotClass}`} />
          ) : null}
        </div>
        <div className="mt-4 text-[13px] font-semibold text-[#F5E9C9]">{name}</div>
        <div className="mt-1 text-[11px] text-[#8F835F]">{office}</div>
        {badge ? (
          <span className="mt-3 rounded-full border border-[#F0C66A]/20 bg-[#F0C66A]/8 px-2 py-1 text-[11px] text-[#F0C66A]">
            {badge}
          </span>
        ) : null}
        <p className="mt-4 text-[12px] leading-6 text-[#B8AE91]">{summary}</p>
      </div>
      <div className="mt-4 flex items-center justify-center gap-1 border-t border-white/6 pt-3 text-[11px] text-[#9AA3C4]">
        <span>召入上书房</span>
        <ChevronRight size={13} className="text-[#F0C66A] transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

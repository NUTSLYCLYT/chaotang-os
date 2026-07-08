'use client';

import Link from 'next/link';
import { Crown, Sparkles } from 'lucide-react';
import { OfficialSeatCard } from './official-seat-card';
import type { OfficialSeat } from '../lib/official-seats';

export interface OfficialSeatRingProps {
  officials: OfficialSeat[];
}

export function OfficialSeatRing({ officials }: OfficialSeatRingProps) {
  const centerIndex = Math.floor(officials.length / 2);
  const centerOfficial = officials[centerIndex];
  const leftWing = officials.slice(0, centerIndex);
  const rightWing = officials.slice(centerIndex + 1);

  if (!centerOfficial) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-[36px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(240,198,106,0.09),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="section-eyebrow text-[#8e7a4b]">Court Assembly · 半环朝会</div>
            <div className="section-title mt-2">丞相居中，六部与专署两翼待命。</div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#F0C66A]/15 bg-[#F0C66A]/[0.045] px-3 py-2 text-[11px] text-[#DCCEAA]">
            <Sparkles size={12} className="text-[#F0C66A]" />
            点击任一席位，直接召入上书房
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px_1fr] xl:items-end">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-end">
            {leftWing.map((official) => (
              <OfficialSeatCard key={official.code} {...official} />
            ))}
          </div>

          <div className="relative mx-auto flex w-full max-w-[320px] flex-col items-center">
            <div className="absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-transparent via-[#F0C66A]/35 to-transparent" />
            <div className="absolute inset-x-10 top-[58%] h-20 rounded-full bg-[#F0C66A]/[0.05] blur-3xl" />
            <div className="relative z-10 w-full rounded-[32px] border border-[#F0C66A]/22 bg-[radial-gradient(circle_at_top,rgba(240,198,106,0.18),transparent_55%),linear-gradient(180deg,rgba(240,198,106,0.09),rgba(255,255,255,0.02))] px-6 pb-6 pt-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#F0C66A]/32 bg-[#F0C66A]/[0.12] text-[#F0C66A] shadow-[0_0_32px_rgba(240,198,106,0.16)]">
                <Crown size={28} />
              </div>
              <div className="mt-4 text-[11px] uppercase tracking-[0.26em] text-[#8F835F]">Prime Minister Seat</div>
              <div className="display-serif mt-2 text-[28px] font-semibold text-[#F7EDD1]">{centerOfficial.name}</div>
              <div className="mt-1 text-[12px] text-[#CDBE95]">{centerOfficial.office}</div>
              <p className="body-copy mt-4 text-[13px] leading-7 text-[#D5C8A8]">
                {centerOfficial.summary}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {centerOfficial.badge ? (
                  <span className="rounded-full border border-[#F0C66A]/20 bg-[#F0C66A]/8 px-2 py-1 text-[11px] text-[#F0C66A]">
                    {centerOfficial.badge}
                  </span>
                ) : null}
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[11px] text-[#9AA3C4]">
                  朝会主位
                </span>
              </div>
              <Link
                href={centerOfficial.href}
                className="mt-5 inline-flex items-center justify-center rounded-full border border-[#F0C66A]/30 bg-[#F0C66A]/12 px-4 py-2 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16"
              >
                先请丞相入上书房
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-end">
            {rightWing.map((official) => (
              <OfficialSeatCard key={official.code} {...official} />
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[#F0C66A]/12 bg-[#F0C66A]/[0.035] px-4 py-3 text-[12px] leading-6 text-[#D9CFB4]">
          朝会规则：先看中央主位是否已有收敛判断，再决定召哪位尚书入上书房做深问。
        </div>
      </div>
    </div>
  );
}

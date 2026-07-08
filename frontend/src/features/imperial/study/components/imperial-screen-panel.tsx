'use client';

import Link from 'next/link';
import { Monitor } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

export interface ImperialScreenPanelProps {
  internalLinks: Array<{ label: string; href: string }>;
  secondaryCards: Array<{ title: string; lines: string[] }>;
  editor: React.ReactNode;
  footerHint?: string;
}

export function ImperialScreenPanel({
  internalLinks,
  secondaryCards,
  editor,
  footerHint = '可直接改写奏章草稿，批示后再送丞相台',
}: ImperialScreenPanelProps) {
  return (
    <GlassPanel variant="gold" tone="deep" padding="none" hudCorners className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#1A2142] px-4 py-3">
        <div>
          <div className="section-eyebrow">Imperial Screen</div>
          <div className="section-title">上书房大屏</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {internalLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-[#9AA3C4] transition hover:border-[#F0C66A]/40 hover:text-[#F0C66A]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div
        className="grid min-h-[520px] place-items-center"
        style={{
          background:
            'radial-gradient(circle at top, rgba(240,198,106,0.08), transparent 42%), linear-gradient(180deg, #060913 0%, #090D18 100%)',
        }}
      >
        <div className="w-[92%] rounded-2xl border border-[#F0C66A]/15 bg-[#0A0E1E]/90 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Monitor size={14} className="text-[#F0C66A]" />
              <span className="text-[12px] text-[#EAEEFB]">上书房查阅屏</span>
            </div>
            <span className="text-[11px] text-[#6A7299]">{footerHint}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            {editor}
            <div className="space-y-4">
              {secondaryCards.map((card) => (
                <div key={card.title} className="rounded-xl border border-white/6 bg-white/[0.03] p-4">
                  <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">{card.title}</div>
                  <div className="space-y-2">
                    {card.lines.map((line) => (
                      <div
                        key={line}
                        className="rounded-lg border border-white/5 bg-[#0F1428] px-3 py-2 text-[12px] text-[#9AA3C4]"
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

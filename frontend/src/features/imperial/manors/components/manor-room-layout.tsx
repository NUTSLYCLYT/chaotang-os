'use client';

import { GlassPanel } from '@/components/ui/glass-panel';

export interface ManorRoomLayoutProps {
  eyebrow: string;
  title: string;
  summary: string;
  leftRail: React.ReactNode;
  main: React.ReactNode;
  rightRail: React.ReactNode;
}

export function ManorRoomLayout({
  eyebrow,
  title,
  summary,
  leftRail,
  main,
  rightRail,
}: ManorRoomLayoutProps) {
  return (
    <GlassPanel variant="gold" tone="deep" padding="lg" hudCorners className="overflow-hidden">
      <div className="mb-5 grid gap-4 xl:grid-cols-[1.35fr_0.65fr] xl:items-end">
        <div>
          <div className="section-eyebrow">{eyebrow}</div>
          <h2 className="section-title mt-1">{title}</h2>
          <p className="body-copy mt-2 text-[12px] leading-6 text-[#B8C0DA]">{summary}</p>
        </div>
        <div className="rounded-2xl border border-[#F0C66A]/12 bg-[#F0C66A]/[0.04] p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">Room Rule</div>
          <div className="mt-2 text-[12px] leading-6 text-[#D9CFB4]">
            先看当前判断与主战场，再进入关系网、渠道或交互细节。不把庄园房间做成传统 CRM 或电商后台。
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.72fr_1.28fr_0.82fr]">
        <div className="space-y-4">{leftRail}</div>
        <div className="space-y-4">{main}</div>
        <div className="space-y-4">{rightRail}</div>
      </div>
    </GlassPanel>
  );
}

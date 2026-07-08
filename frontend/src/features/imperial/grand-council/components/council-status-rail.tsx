'use client';

import { CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { CouncilStatusItem } from '@/features/imperial/grand-council/lib/council-source';

export interface CouncilStatusRailProps {
  items: CouncilStatusItem[];
}

export function CouncilStatusRail({ items }: CouncilStatusRailProps) {
  const iconByTone = {
    danger: <ShieldAlert size={14} className="text-[#F43F5E]" />,
    gold: <Clock3 size={14} className="text-[#F0C66A]" />,
    success: <CheckCircle2 size={14} className="text-[#3DD68C]" />,
  } as const;

  return (
    <GlassPanel variant="gold" tone="elevated" padding="md">
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-xl border border-white/6 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2">
              {iconByTone[item.tone]}
              <div className="text-[12px] font-semibold text-[#F5E9C9]">{item.title}</div>
            </div>
            <div className="body-copy mt-2 text-[12px] leading-6 text-[#B8C0DA]">{item.body}</div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

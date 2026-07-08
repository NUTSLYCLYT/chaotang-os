'use client';

import { Hourglass } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

export interface WaitChainPanelProps {
  steps: string[];
}

export function WaitChainPanel({ steps }: WaitChainPanelProps) {
  return (
    <GlassPanel padding="md">
      <div className="mb-3 flex items-center gap-2">
        <Hourglass size={14} className="text-[#F0C66A]" />
        <h2 className="section-title">等待链</h2>
      </div>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step} className="relative rounded-xl border border-white/6 bg-black/15 px-3 py-3">
            {index < steps.length - 1 ? (
              <div className="absolute left-[15px] top-full h-3 w-px bg-gradient-to-b from-[#F0C66A]/35 to-transparent" />
            ) : null}
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-[#F0C66A] shadow-[0_0_12px_rgba(240,198,106,0.55)]" />
              <div className="body-copy text-[12px] leading-6 text-[#C9D0E3]">{step}</div>
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

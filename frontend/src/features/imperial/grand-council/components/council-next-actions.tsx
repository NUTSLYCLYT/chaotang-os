'use client';

import Link from 'next/link';
import { ArrowRight, Workflow } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

export interface CouncilNextActionsProps {
  actions: string[];
  primaryHref?: string;
  primaryLabel?: string;
}

export function CouncilNextActions({
  actions,
  primaryHref = '/command-center',
  primaryLabel = '将当前议题送回丞相台',
}: CouncilNextActionsProps) {
  return (
    <GlassPanel padding="md">
      <div className="mb-3 flex items-center gap-2">
        <Workflow size={14} className="text-[#6BA0FF]" />
        <h2 className="section-title">下一步动作</h2>
      </div>
      <div className="space-y-3">
        {actions.map((action) => (
          <div key={action} className="rounded-xl border border-white/6 bg-white/[0.03] p-3">
            <div className="body-copy text-[12px] leading-6 text-[#C9D0E3]">{action}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-white/6 pt-4">
        <Link
          href={primaryHref}
          className="inline-flex items-center gap-1.5 text-[12px] text-[#F0C66A] transition hover:opacity-85"
        >
          {primaryLabel}
          <ArrowRight size={12} />
        </Link>
      </div>
    </GlassPanel>
  );
}

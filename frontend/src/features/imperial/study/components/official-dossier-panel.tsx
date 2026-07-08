'use client';

import { BookOpenText } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

export interface OfficialDossierPanelProps {
  title?: string;
  iconLabel?: string;
  items: string[];
}

export function OfficialDossierPanel({
  title = '随召 dossier',
  iconLabel = '查阅',
  items,
}: OfficialDossierPanelProps) {
  return (
    <GlassPanel padding="md">
      <div className="mb-3 flex items-center gap-2">
        <BookOpenText size={14} className="text-[#F0C66A]" />
        <h2 className="section-title">{title}</h2>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-xl border border-white/6 bg-white/[0.03] p-3 text-[12px] leading-6 text-[#C6BB9D]"
          >
            {item}
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-white/6 pt-3 text-[11px] text-[#9AA3C4]">
        {iconLabel}
      </div>
    </GlassPanel>
  );
}

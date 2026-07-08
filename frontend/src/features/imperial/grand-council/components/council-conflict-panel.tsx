'use client';

import { ShieldAlert } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

export interface CouncilConflictItem {
  title: string;
  body: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface CouncilConflictPanelProps {
  conflicts: CouncilConflictItem[];
}

const SEVERITY_COLOR = {
  low: '#6BA0FF',
  medium: '#F0C66A',
  high: '#F43F5E',
} as const;

export function CouncilConflictPanel({ conflicts }: CouncilConflictPanelProps) {
  return (
    <GlassPanel padding="md">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert size={14} className="text-[#F43F5E]" />
        <h2 className="section-title">会签争议</h2>
      </div>
      <div className="space-y-3">
        {conflicts.map((conflict) => (
          <div key={conflict.title} className="rounded-xl border border-white/6 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="section-eyebrow">{conflict.title}</div>
              <span
                className="rounded-full px-2 py-1 text-[11px]"
                style={{
                  color: SEVERITY_COLOR[conflict.severity ?? 'medium'],
                  border: `1px solid ${SEVERITY_COLOR[conflict.severity ?? 'medium']}33`,
                  background: `${SEVERITY_COLOR[conflict.severity ?? 'medium']}12`,
                }}
              >
                {conflict.severity === 'high' ? '高压' : conflict.severity === 'low' ? '观察' : '待决'}
              </span>
            </div>
            <div className="body-copy mt-2 text-[12px] leading-6 text-[#C9D0E3]">{conflict.body}</div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

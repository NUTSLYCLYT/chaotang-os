'use client';

import { History } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { StudyDraftSnapshot } from '@/features/imperial/study/lib/study-drafts';

export interface DraftVersionPanelProps {
  history: StudyDraftSnapshot[];
  activeVersion?: number;
  compareVersion?: number | null;
  onRestore?: (version: number) => void;
  onCompare?: (version: number) => void;
}

export function DraftVersionPanel({ history, activeVersion, compareVersion, onRestore, onCompare }: DraftVersionPanelProps) {
  return (
    <GlassPanel padding="md">
      <div className="mb-3 flex items-center gap-2">
        <History size={14} className="text-[#F0C66A]" />
        <h2 className="section-title">草稿版本</h2>
      </div>
      <div className="space-y-3">
        {history.map((item) => (
          <div key={`${item.version}-${item.updatedAt}`} className="rounded-xl border border-white/6 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="text-[12px] font-semibold text-[#F5E9C9]">v{item.version}</div>
                {activeVersion === item.version && (
                  <span className="rounded-full border border-[#F0C66A]/25 bg-[#F0C66A]/10 px-2 py-0.5 text-[11px] text-[#F0C66A]">
                    当前
                  </span>
                )}
              </div>
              <div className="font-mono text-[11px] text-[#8F835F]">{item.updatedAt}</div>
            </div>
            {item.label && (
              <div className="mt-2 text-[11px] font-semibold text-[#F5E9C9]">{item.label}</div>
            )}
            {item.note && (
              <div className="mt-1 text-[11px] leading-5 text-[#8FA0C8]">{item.note}</div>
            )}
            <div className="mt-2 text-[11px] leading-6 text-[#9AA3C4]">{summarize(item.content)}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {onCompare && activeVersion !== item.version && (
                <button
                  type="button"
                  onClick={() => onCompare(item.version)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] transition ${
                    compareVersion === item.version
                      ? 'border-[#6BA0FF]/25 bg-[#6BA0FF]/10 text-[#6BA0FF]'
                      : 'border-white/10 text-[#9AA3C4] hover:bg-white/5'
                  }`}
                >
                  {compareVersion === item.version ? '对比中' : '对比此版本'}
                </button>
              )}
              {onRestore && activeVersion !== item.version && (
                <button
                  type="button"
                  onClick={() => onRestore(item.version)}
                  className="rounded-md border border-[#F0C66A]/20 px-2.5 py-1 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/10"
                >
                  回滚到此版本
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

function summarize(content: string) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 72) || '空白草稿';
}

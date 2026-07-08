'use client';

import { BookOpen } from 'lucide-react';
import { EmptyState } from '@/features/shared/components/imperial/empty-state';
import type { LegalCitation } from '@/types/manor';

interface CitationListProps {
  citations: LegalCitation[];
}

export function CitationList({ citations }: CitationListProps) {
  if (citations.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="当前没有引用法条"
        body="这份结论暂时未附具体条文依据，可先看复盘与相似案例，必要时回军机处补强依据。"
      />
    );
  }

  return (
    <div className="space-y-3">
      {citations.map((cit) => (
        <details
          key={cit.id}
          className="group rounded-xl border border-white/8 bg-white/[0.025] transition-colors open:border-[#F0C66A]/15 open:bg-[#F0C66A]/[0.025]"
        >
          <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 list-none">
            <BookOpen size={13} className="shrink-0 text-[#F0C66A] opacity-70 group-open:opacity-100" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-mono text-[#F0C66A]">{cit.code}</div>
              <div className="mt-0.5 text-[13px] font-semibold text-[#F5E9C9]">{cit.title}</div>
            </div>
            <span className="shrink-0 text-[11px] text-[#6A7299] group-open:hidden">展开原文</span>
            <span className="shrink-0 text-[11px] text-[#6A7299] hidden group-open:inline">收起</span>
          </summary>
          <div className="border-t border-white/5 px-4 pb-4 pt-3">
            <p className="text-[12px] leading-[1.8] text-[#B8C0DA]">{cit.fullText}</p>
          </div>
        </details>
      ))}
    </div>
  );
}

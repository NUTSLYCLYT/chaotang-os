'use client';

import { Sparkles, Loader2, BookOpen } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { SectionHeader } from '@/features/shared/components/imperial';
import type { ShiguanAnalysis } from '@/lib/contracts/archive';

export function AnalysisPanel({
  result,
  analyzing,
  onGenerate,
}: {
  /** 完整分析结果（含 citations），null 表示尚未生成 */
  result: ShiguanAnalysis | null;
  analyzing: boolean;
  onGenerate: () => void;
}) {
  return (
    <GlassPanel variant="gold" tone="elevated" padding="lg" hudCorners>
      <SectionHeader label="太史令智能总结" sub="Pattern Analysis · 太史馆规律" />
      <div className="mt-4">
        {result === null && !analyzing && (
          <button
            type="button"
            onClick={onGenerate}
            className="inline-flex items-center gap-2 rounded-xl border border-[#F0C66A]/30 bg-[#F0C66A]/8 px-4 py-2.5 text-[12px] font-medium text-[#F0C66A] transition hover:bg-[#F0C66A]/14"
          >
            <Sparkles size={13} />
            生成规律分析
          </button>
        )}

        {analyzing && (
          <div className="flex items-center gap-3 py-6 text-[13px] text-[#9AA3C4]">
            <Loader2 size={16} className="animate-spin text-[#F0C66A]" />
            太史令正在翻阅历史档案…
          </div>
        )}

        {result !== null && !analyzing && (
          <div className="space-y-4">
            {/* 分析正文 */}
            <div
              className="rounded-xl p-5 text-[13px] leading-8 text-[#D9CFB4] whitespace-pre-wrap"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {result.analysis}
            </div>

            {/* 引用 citations */}
            {result.citations.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">
                  <BookOpen size={10} />
                  引用档案 · Citations
                </div>
                <ul className="space-y-1.5">
                  {result.citations.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-start gap-2 rounded-lg border border-[#F0C66A]/12 bg-[#F0C66A]/[0.04] px-3 py-2 text-[11px]"
                    >
                      <span className="mt-[1px] shrink-0 rounded border border-[#F0C66A]/30 bg-[#F0C66A]/10 px-1 py-0.5 font-mono text-[9px] text-[#F0C66A]">
                        {c.id.slice(0, 8)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[#F5E9C9]">{c.title}</div>
                        <div className="text-[#9AA3C4]">{c.relevance}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 生成时间 */}
            <div className="text-right text-[10px] text-[#6A7299]">
              生成于 {new Date(result.generatedAt).toLocaleString('zh-CN')}
            </div>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

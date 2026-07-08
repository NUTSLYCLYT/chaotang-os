'use client';

import type { AiReview } from '@/features/hanlin/types';

export function AiReviewSummary({ review }: { review: AiReview }) {
  return (
    <div className="rounded-2xl border border-[#F0C66A]/14 bg-[#F0C66A]/[0.05] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">AI 评估摘要</div>
          <div className="mt-1 text-[13px] font-semibold text-[#F5E9C9]">{review.awardBandSuggestion}</div>
        </div>
        <div className="rounded-full border border-[#F0C66A]/22 bg-[#F0C66A]/10 px-3 py-1 text-[11px] text-[#F0C66A]">
          建议 ¥{review.priceSuggestionMin} - ¥{review.priceSuggestionMax}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <Metric label="原创度" value={review.originalityScore} />
        <Metric label="质量" value={review.qualityScore} />
        <Metric label="价值" value={review.valueScore} />
        <Metric label="风险" value={review.riskScore} inverse />
        <Metric label="置信度" value={review.confidenceScore} />
      </div>

      <p className="mt-4 text-[12px] leading-6 text-[#D7CCA9]">{review.explanation}</p>
    </div>
  );
}

function Metric({ label, value, inverse = false }: { label: string; value: number; inverse?: boolean }) {
  const tone =
    inverse ? (value <= 30 ? 'text-[#7AD3A1]' : 'text-[#F0C66A]') : value >= 80 ? 'text-[#7AD3A1]' : 'text-[#F0C66A]';
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">{label}</div>
      <div className={`mt-2 text-[18px] font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

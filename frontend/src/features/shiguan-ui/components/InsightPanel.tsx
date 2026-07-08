"use client";

import GlassPanel from "./GlassPanel";
import { feedbackStats, feedbackDesc } from "@/features/shiguan-ui/lib/shiguan-data";

interface InsightPanelProps {
  id?: string;
  onGenerate?: () => void;
  highlight?: boolean;
  className?: string;
}

export default function InsightPanel({
  id,
  onGenerate,
  highlight,
  className = "",
}: InsightPanelProps) {
  return (
    <GlassPanel
      id={id}
      title="反哺定制"
      eyebrow="AI 史官 · 丞相建议"
      className={`${className} ${highlight ? "shiguan-pulse-gold" : ""}`}
    >
      <p className="mb-4 text-[12px] leading-relaxed text-slatey-300">
        {feedbackDesc}
      </p>

      <div className="flex items-center justify-between gap-3">
        <Stat {...feedbackStats[0]} />

        {/* 生成建议 圆形主按钮 */}
        <button
          type="button"
          onClick={onGenerate}
          className="group relative flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center rounded-full border border-gold-300/45 bg-[radial-gradient(circle_at_50%_35%,rgba(243,227,176,0.22),rgba(143,102,32,0.12))] text-center transition-all duration-200 hover:border-gold-200/70 hover:shadow-gold-glow"
        >
          <span className="absolute inset-1 rounded-full border border-gold-300/15" />
          <span className="font-serif text-[13px] font-semibold leading-tight text-gold-100">
            生成
            <br />
            建议
          </span>
        </button>

        <Stat {...feedbackStats[1]} align="right" />
      </div>

      <div className="mt-4 border-t border-gold-300/12 pt-2.5 text-center">
        <button
          type="button"
          className="text-[12px] text-gold-200/90 transition-colors hover:text-gold-100"
        >
          查看反哺记录 ›
        </button>
      </div>
    </GlassPanel>
  );
}

function Stat({
  label,
  value,
  unit,
  align = "left",
}: {
  label: string;
  value: string;
  unit: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex-1 ${align === "right" ? "text-right" : "text-left"}`}>
      <div className="flex items-baseline gap-1" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
        <span className="font-serif text-[24px] font-semibold leading-none text-gold-gradient">
          {value}
        </span>
        <span className="text-[11px] text-slatey-300">{unit}</span>
      </div>
      <p className="mt-1 text-[11.5px] text-slatey-400">{label}</p>
    </div>
  );
}

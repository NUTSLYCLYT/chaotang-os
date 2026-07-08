"use client";

import { ReactNode, useState } from "react";
import GlassPanel from "./GlassPanel";
import type { ReviewRecord, VersionRecord, ReviewGrade } from "@/features/shiguan-ui/lib/shiguan-data";

const gradeTone: Record<ReviewGrade, string> = {
  优: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
  良: "border-gold-300/35 bg-gold-300/10 text-gold-200",
  中: "border-slatey-400/30 bg-slatey-400/10 text-slatey-300",
};

type ArchiveData =
  | { variant: "review"; rows: ReviewRecord[] }
  | { variant: "version"; rows: VersionRecord[] };

type ArchivePanelProps = ArchiveData & {
  id?: string;
  title: string;
  filters: readonly string[];
  footer: ReactNode;
  highlight?: boolean;
  className?: string;
};

export default function ArchivePanel(props: ArchivePanelProps) {
  const { id, title, filters, footer, highlight, className = "" } = props;
  const [active, setActive] = useState<string>(filters[0]);

  return (
    <GlassPanel
      id={id}
      title={title}
      className={`${className} ${highlight ? "shiguan-pulse-gold" : ""}`}
    >
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActive(f)}
            className={
              active === f
                ? "rounded-md border border-gold-300/40 bg-gold-300/12 px-2.5 py-1 text-[12px] text-gold-100"
                : "rounded-md border border-transparent px-2.5 py-1 text-[12px] text-slatey-300 transition-colors hover:text-gold-100"
            }
          >
            {f}
          </button>
        ))}
      </div>

      <ul className="space-y-1">
        {props.variant === "review"
          ? props.rows.map((r, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
              >
                <span className="flex-1 truncate text-[12.5px] text-jade-100/90">
                  {r.title}
                </span>
                <span className="shrink-0 text-[11.5px] tabular-nums text-slatey-400">
                  {r.date}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-gold-200">
                  {r.score} 分
                </span>
                <span
                  className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10.5px] leading-none ${gradeTone[r.grade]}`}
                >
                  {r.grade}
                </span>
              </li>
            ))
          : props.rows.map((r, i) => (
              <li
                key={i}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
              >
                <span className="truncate text-[12.5px] text-jade-100/90">
                  {r.title}
                </span>
                <span className="shrink-0 rounded-md border border-gold-300/30 bg-gold-300/10 px-1.5 py-0.5 text-[10.5px] leading-none text-gold-200">
                  {r.version}
                </span>
                <span className="flex-1" />
                <span className="shrink-0 text-[11.5px] tabular-nums text-slatey-400">
                  {r.date}
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-gold-300/20 px-2 py-0.5 text-[11px] text-gold-200/90 transition-colors hover:border-gold-300/50 hover:text-gold-100"
                >
                  对比
                </button>
              </li>
            ))}
      </ul>

      <div className="mt-3 border-t border-gold-300/12 pt-2.5">{footer}</div>
    </GlassPanel>
  );
}

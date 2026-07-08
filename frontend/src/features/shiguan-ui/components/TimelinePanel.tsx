"use client";

import { ReactNode, useState } from "react";
import GlassPanel from "./GlassPanel";
import { RetrospectiveControl } from "./RetrospectiveControl";

export type BadgeTone =
  | "decision"
  | "memorial"
  | "task"
  | "event"
  | "running"
  | "done";

const toneClass: Record<BadgeTone, string> = {
  decision: "border-gold-300/35 bg-gold-300/10 text-gold-200",
  memorial: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  task: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  event: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  running: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200",
  done: "border-slatey-400/30 bg-slatey-400/10 text-slatey-300",
};

export interface TimelineRow {
  date: string;
  title: string;
  badge?: { text: string; tone: BadgeTone };
  today?: boolean;
  archiveId?: string;
  retrospectiveStatus?: string;
  onRetroUpdate?: (archiveId: string, status: string) => Promise<void>;
}

interface TimelinePanelProps {
  id?: string;
  title: string;
  filters: readonly string[];
  rows: TimelineRow[];
  variant: "chronicle" | "decision";
  footer: ReactNode;
  className?: string;
  highlight?: boolean;
}

export default function TimelinePanel({
  id,
  title,
  filters,
  rows,
  variant,
  footer,
  className = "",
  highlight,
}: TimelinePanelProps) {
  const [active, setActive] = useState<string>(filters[0]);

  const matched = rows.filter(
    (r) => active === filters[0] || r.badge?.text === active
  );
  const shown = matched.length ? matched : rows;

  return (
    <GlassPanel
      id={id}
      title={title}
      action={variant === "decision" ? <span className="text-base">›</span> : undefined}
      className={`${className} ${highlight ? "shiguan-pulse-gold" : ""}`}
    >
      {/* filter tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
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

      {variant === "chronicle" ? (
        <ChronicleList rows={shown} />
      ) : (
        <DecisionList rows={shown} />
      )}

      <div className="mt-3 border-t border-gold-300/12 pt-2.5">{footer}</div>
    </GlassPanel>
  );
}

function Badge({ text, tone }: { text: string; tone: BadgeTone }) {
  return (
    <span
      className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10.5px] leading-none ${toneClass[tone]}`}
    >
      {text}
    </span>
  );
}

function ChronicleList({ rows }: { rows: TimelineRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={i} className="py-0.5">
          <div className="flex items-center gap-2.5">
            <span className="w-[52px] shrink-0 text-[12px] text-slatey-400">
              {r.date}
            </span>
            {r.today && (
              <span className="shrink-0 rounded bg-gold-300/15 px-1 text-[10px] text-gold-200">
                今日
              </span>
            )}
            <span className="flex-1 truncate text-[12.5px] text-jade-100/90">
              {r.title}
            </span>
            {r.badge && <Badge {...r.badge} />}
          </div>
          {r.archiveId && r.onRetroUpdate && (
            <div className="pl-[60px]">
              <RetrospectiveControl
                archiveId={r.archiveId}
                status={r.retrospectiveStatus}
                onUpdate={r.onRetroUpdate}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function DecisionList({ rows }: { rows: TimelineRow[] }) {
  return (
    <ul className="relative space-y-3 pl-4">
      <span className="absolute left-[5px] top-1 bottom-1 w-px bg-gradient-to-b from-gold-300/40 via-gold-300/15 to-transparent" />
      {rows.map((r, i) => (
        <li key={i} className="relative py-0.5">
          <span className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full border border-gold-300/60 bg-ink-900 shadow-[0_0_8px_rgba(220,180,86,0.4)]" />
          <div className="flex items-center gap-3">
            <span className="w-[74px] shrink-0 text-[12px] tabular-nums text-slatey-400">
              {r.date}
            </span>
            <span className="flex-1 truncate text-[13px] text-jade-100/90">
              {r.title}
            </span>
            {r.badge && <Badge {...r.badge} />}
          </div>
          {r.archiveId && r.onRetroUpdate && (
            <div className="pl-[86px]">
              <RetrospectiveControl
                archiveId={r.archiveId}
                status={r.retrospectiveStatus}
                onUpdate={r.onRetroUpdate}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

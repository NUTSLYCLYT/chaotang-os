import type { DadianFeedItem } from "@/lib/contracts/dadian";
import StatusBadge from "./StatusBadge";

const STATUS_KIND = {
  执行中: "executing",
  待审: "pending",
  已结: "running",
} as const;

export default function MinisterCard({ item }: { item: DadianFeedItem }) {
  return (
    <article className="flex items-center gap-2.5 rounded border border-gold-400/10 bg-ink-800/40 px-2.5 py-2 transition hover:border-gold-400/30 hover:bg-ink-700/45">
      {/* 官署印记 */}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold-400/40 bg-ink-700/60 text-[12px] font-medium text-gold-200">
        {item.depts[0].slice(0, 1)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {item.depts.map((d) => (
            <span
              key={d}
              className="rounded-sm border border-gold-400/25 px-1 py-px text-[10px] leading-none text-gold-200/90"
            >
              {d}
            </span>
          ))}
        </div>
        <p className="mt-1 truncate text-micro text-parchment-50">
          {item.title}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge kind={STATUS_KIND[item.status]} />
        <span className="text-[10px] text-parchment-200/50">{item.time}</span>
      </div>
    </article>
  );
}

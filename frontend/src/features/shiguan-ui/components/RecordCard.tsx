"use client";

import { StatCard } from "@/features/shiguan-ui/lib/shiguan-data";
import { assetUrl } from "@/lib/asset";

interface RecordCardProps {
  card: StatCard;
  onClick?: (key: string) => void;
}

export default function RecordCard({ card, onClick }: RecordCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(card.key)}
      className="glass group relative flex flex-col overflow-hidden rounded-2xl text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-300/45 hover:shadow-gold-glow"
    >
      <div className="gold-hairline absolute inset-x-0 top-0 opacity-60" />
      <div className="flex items-center justify-between px-3.5 pt-3">
        <h3 className="font-serif text-[15px] font-semibold tracking-wide text-jade-50">
          {card.title}
        </h3>
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-gold-300/30 bg-gold-300/10 font-serif text-[12px] text-gold-200">
          {card.glyph}
        </span>
      </div>

      {/* 史料图像 */}
      <div className="relative mx-3.5 mt-2.5 h-[68px] overflow-hidden rounded-lg ring-1 ring-gold-300/15">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assetUrl(card.image)}
          alt={card.title}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          style={{ height: "100%", width: "100%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 to-transparent" />
      </div>

      <div className="flex items-end justify-between px-3.5 pb-3 pt-2.5">
        <div className="flex items-baseline gap-1">
          <span className="font-serif text-[22px] font-semibold leading-none text-gold-gradient">
            {card.count}
          </span>
          <span className="text-[11px] text-slatey-300">件</span>
        </div>
        <span className="text-[11px] text-slatey-400">{card.delta}</span>
      </div>
    </button>
  );
}

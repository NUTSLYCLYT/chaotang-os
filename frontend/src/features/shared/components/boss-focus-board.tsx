'use client';

import type { ComponentType } from 'react';
import { ChevronRight, TrendingUp } from 'lucide-react';

type BoardIcon = ComponentType<{ size?: number; className?: string }>;

export interface BossFocusTile {
  id: string;
  title: string;
  body: string;
  icon: BoardIcon;
  color: string;
  onClick?: () => void;
}

export interface BossFocusSignal {
  label: string;
  value: string;
  note: string;
  color: string;
}

export interface BossFocusBoardProps {
  eyebrow: string;
  title: string;
  scoreLabel: string;
  score: string | number;
  scoreColor: string;
  accent: string;
  tiles: BossFocusTile[];
  signals: BossFocusSignal[];
}

export function BossFocusBoard({
  eyebrow,
  title,
  scoreLabel,
  score,
  scoreColor,
  accent,
  tiles,
  signals,
}: BossFocusBoardProps) {
  return (
    <div
      className="rounded-md border p-3"
      style={{
        borderColor: `${accent}22`,
        background: `linear-gradient(180deg, ${accent}0c, rgba(0,0,0,0.14))`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">{eyebrow}</div>
          <div className="mt-2 font-serif text-[16px] font-semibold leading-6 text-[#F5E9C9]">{title}</div>
        </div>
        <div
          className="shrink-0 rounded-md border px-2.5 py-2 text-right"
          style={{ borderColor: `${scoreColor}44`, background: `${scoreColor}0d` }}
        >
          <div className="text-[9px] text-[#8F835F]">{scoreLabel}</div>
          <div className="font-mono text-[18px] font-semibold" style={{ color: scoreColor }}>
            {score}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const interactive = Boolean(tile.onClick);
          const className = 'rounded-md border p-2.5 text-left transition';
          const style = { borderColor: `${tile.color}22`, background: `${tile.color}06` };
          const content = (
            <>
              <div className="flex items-center justify-between gap-1.5">
                <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold" style={{ color: tile.color }}>
                  <Icon size={12} />
                  <span className="truncate">{tile.title}</span>
                </span>
                {interactive ? <ChevronRight size={11} className="text-[#6A7299]" /> : null}
              </div>
              <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#8F9AB8]">{tile.body}</div>
            </>
          );

          return interactive ? (
            <button key={tile.id} type="button" onClick={tile.onClick} className={`${className} hover:bg-white/[0.03]`} style={style}>
              {content}
            </button>
          ) : (
            <div key={tile.id} className={className} style={style}>
              {content}
            </div>
          );
        })}
      </div>

      <div className="mt-3 space-y-1.5">
        {signals.map((item) => (
          <div key={item.label} className="rounded border px-2.5 py-2" style={{ borderColor: `${item.color}1f`, background: `${item.color}06` }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] tracking-[0.12em] text-[#6A7299]">{item.label}</span>
              <TrendingUp size={11} style={{ color: item.color }} />
            </div>
            <div className="mt-1 line-clamp-1 text-[11px] font-semibold text-[#F5E9C9]">{item.value}</div>
            <div className="mt-0.5 line-clamp-1 text-[9px] text-[#8F9AB8]">{item.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

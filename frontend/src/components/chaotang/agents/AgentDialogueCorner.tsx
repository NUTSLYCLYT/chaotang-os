'use client';

import { Maximize2, MessageSquare } from 'lucide-react';
import { assetUrl } from '@/lib/asset';

export type AgentDialogueCornerProps = {
  side: 'left' | 'right';
  name: string;
  duty: string;
  line: string;
  portrait: string;
  accent: string;
  actionLabel: string;
  onAction: () => void;
  bottomClassName?: string;
};

export function AgentDialogueCorner({
  side,
  name,
  duty,
  line,
  portrait,
  accent,
  actionLabel,
  onAction,
  bottomClassName = 'bottom-[94px]',
}: AgentDialogueCornerProps) {
  return (
    <aside
      data-three-axis-agent={side}
      className={`fixed ${bottomClassName} z-[71] hidden xl:block xl:w-[280px] 2xl:w-[320px] min-[1960px]:w-[350px] ${
        side === 'left' ? 'left-3 xl:left-4' : 'right-3 xl:right-4'
      }`}
      aria-label={`${name}对话框`}
    >
      <button
        type="button"
        onClick={onAction}
        data-three-axis-ornament="agent-report"
        className="group relative flex w-full items-end gap-2.5 overflow-hidden rounded-[8px] border p-2.5 text-left transition hover:-translate-y-0.5 min-[1960px]:gap-3 min-[1960px]:p-3"
        style={{
          borderColor: `${accent}3D`,
          background:
            'linear-gradient(135deg, rgba(6,8,16,0.93), rgba(13,18,32,0.80) 56%, rgba(38,27,12,0.74)), radial-gradient(circle at 20% 0%, rgba(240,198,106,0.10), transparent 42%)',
          boxShadow: `0 24px 74px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 34px ${accent}12`,
          backdropFilter: 'blur(18px)',
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            background:
              'repeating-linear-gradient(90deg, rgba(255,255,255,0.055) 0 1px, transparent 1px 18px), repeating-linear-gradient(0deg, rgba(240,198,106,0.05) 0 1px, transparent 1px 24px)',
            maskImage: 'linear-gradient(180deg, transparent, black 16%, black 84%, transparent)',
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-4 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}AA, transparent)` }}
        />
        <span aria-hidden className="pointer-events-none absolute left-2 top-3 bottom-3 w-px" style={{ background: `linear-gradient(180deg, transparent, ${accent}55, transparent)` }} />
        <span aria-hidden className="pointer-events-none absolute right-2 top-3 bottom-3 w-px" style={{ background: `linear-gradient(180deg, transparent, ${accent}35, transparent)` }} />
        <span
          className="relative z-10 h-[68px] w-[54px] shrink-0 overflow-hidden rounded-lg border bg-black/30 min-[1960px]:h-[82px] min-[1960px]:w-[66px] min-[1960px]:rounded-xl"
          style={{ borderColor: `${accent}2E` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetUrl(portrait)}
            alt=""
            draggable={false}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        </span>
        <span className="relative z-10 min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
            <MessageSquare size={12} />
            {duty}
          </span>
          <span className="mt-1 block font-serif text-[16px] font-black text-[#F5E9C9] min-[1960px]:text-[18px]">{name}</span>
          <span className="mt-1 block line-clamp-2 text-[11px] leading-[1.55] text-[#C6BB9D] min-[1960px]:text-[12px] min-[1960px]:leading-5">{line}</span>
          <span
            data-testid={`agent-dialogue-action-${side}`}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            style={{ borderColor: `${accent}44`, color: accent, background: `${accent}12` }}
            onClick={(event) => {
              event.stopPropagation();
              onAction();
            }}
          >
            {actionLabel}
            <Maximize2 data-testid={`agent-dialogue-action-icon-${side}`} size={11} className="pointer-events-none shrink-0" />
          </span>
        </span>
      </button>
    </aside>
  );
}

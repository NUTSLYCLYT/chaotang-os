'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ManorActionCard } from '@/types/manor';

const LIGHT_CONFIG = {
  green:  { label: '立即行动', color: '#3DD68C', bg: 'rgba(61,214,140,0.06)', border: 'rgba(61,214,140,0.2)' },
  yellow: { label: '本周处理', color: '#F0C66A', bg: 'rgba(240,198,106,0.06)', border: 'rgba(240,198,106,0.2)' },
  red:    { label: '紧急处置', color: '#F58B8B', bg: 'rgba(245,139,139,0.06)', border: 'rgba(245,139,139,0.2)' },
} as const;

interface ActionCardsProps {
  cards: ManorActionCard[];
}

export function ActionCards({ cards }: ActionCardsProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {cards.map((card, i) => {
        const cfg = LIGHT_CONFIG[card.light];
        const isOpen = expanded.has(i);
        return (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className="group rounded-xl p-4 text-left transition-all"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
          >
            <div className="flex items-start gap-2">
              <div
                className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: cfg.color, boxShadow: `0 0 8px ${cfg.color}60` }}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#F5E9C9]">{card.title}</span>
                  {isOpen
                    ? <ChevronDown size={12} className="text-[#6A7299]" />
                    : <ChevronRight size={12} className="text-[#6A7299]" />
                  }
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px]"
                    style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}25` }}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-[11px] text-[#6A7299]">{card.when}</span>
                </div>
                {isOpen && card.why && (
                  <p className="mt-2.5 text-[12px] leading-relaxed text-[#9AA3C4]">{card.why}</p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

'use client';

import type { LucideIcon } from 'lucide-react';
import { colors } from '@/config/design-tokens';

export interface TopDigestItem {
  label: string;
  value: string;
  note?: string;
  icon?: LucideIcon;
}

export interface TopDigestBarProps {
  accent: string;
  title: string;
  items: TopDigestItem[];
}

export function TopDigestBar({ accent, title, items }: TopDigestBarProps) {
  return (
    <div
      className="mt-4 overflow-x-auto rounded-xl border px-4 py-3"
      style={{
        borderColor: `${accent}33`,
        background:
          `linear-gradient(135deg, ${accent}0f, rgba(10,14,30,0.84))`,
        boxShadow: `0 8px 30px ${accent}12`,
      }}
    >
      <div className="grid gap-3 md:flex md:min-w-max md:items-start md:gap-4">
        <div className="pr-2 md:min-w-[180px]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: accent }}>
            {title}
          </div>
          <div className="mt-1 text-[12px]" style={{ color: colors.textDim }}>
            第一眼先看这几项
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:contents">
          {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={`${item.label}-${item.value}`}
              className="min-w-0 rounded-lg border px-3 py-3 md:min-w-[180px]"
              style={{
                borderColor: `${accent}22`,
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <div className="flex items-center gap-2">
                {Icon ? <Icon size={13} style={{ color: accent }} /> : null}
                <div className="text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: colors.textMuted }}>
                  {item.label}
                </div>
              </div>
              <div className="mt-2 font-mono text-[14px] font-bold" style={{ color: colors.text }}>
                {item.value}
              </div>
              {item.note ? (
                <div className="mt-1 text-[11px]" style={{ color: colors.textDim }}>
                  {item.note}
                </div>
              ) : null}
            </div>
          );
          })}
        </div>
      </div>
    </div>
  );
}

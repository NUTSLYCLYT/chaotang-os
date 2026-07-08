'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

const CARD_BASE =
  'linear-gradient(180deg, rgba(21,18,10,0.96) 0%, rgba(10,7,4,0.97) 100%)';

function cardBackground(accent: string, selected = false): string {
  return [
    `radial-gradient(circle at 22% 0%, ${accent}${selected ? '28' : '1c'}, transparent 56%)`,
    'linear-gradient(180deg, rgba(240,198,106,0.08) 0%, transparent 34%)',
    CARD_BASE,
  ].join(', ');
}

export interface DepartmentModuleCardProps {
  href: string;
  title: string;
  subtitle?: string;
  body?: string;
  accent: string;
  icon?: ReactNode;
  meta?: string;
  status?: string;
  statusColor?: string;
  titleColor?: string;
  selected?: boolean;
  variant?: 'default' | 'compact';
  className?: string;
}

export function DepartmentModuleCard({
  href,
  title,
  subtitle,
  body,
  accent,
  icon,
  meta,
  status,
  statusColor,
  titleColor,
  selected = false,
  variant = 'default',
  className = '',
}: DepartmentModuleCardProps) {
  const lamp = statusColor ?? accent;
  const compact = variant === 'compact';

  return (
    <Link
      href={href}
      className={`group relative flex min-h-[96px] overflow-hidden rounded-2xl border text-left shadow-[0_14px_38px_rgba(0,0,0,0.42)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(0,0,0,0.56)] ${
        compact ? 'flex-col px-3 py-2.5' : 'px-4 py-3.5'
      } ${className}`}
      style={{
        background: cardBackground(accent, selected),
        borderColor: selected ? `${accent}78` : `${accent}44`,
        boxShadow: selected
          ? `0 0 0 1px ${accent}22 inset, 0 0 24px ${accent}18, 0 18px 44px rgba(0,0,0,0.52)`
          : undefined,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}aa, transparent)` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full"
        style={{ background: `linear-gradient(180deg, ${accent}, ${accent}44)` }}
      />

      <div className={`relative z-10 flex min-w-0 flex-1 ${compact ? 'flex-col gap-2' : 'gap-3'}`}>
        {icon ? (
          <span
            className={`grid shrink-0 place-items-center overflow-hidden rounded-full text-[17px] transition-transform group-hover:scale-[1.07] ${
              compact ? 'h-8 w-8' : 'h-10 w-10'
            }`}
            style={{
              background: `radial-gradient(circle at 30% 30%, ${accent}, ${accent}88)`,
              boxShadow: `0 0 14px ${accent}44, inset 0 0 0 1px ${accent}88`,
            }}
          >
            <span className="relative">{icon}</span>
          </span>
        ) : null}

        <span className="min-w-0 flex-1">
          <span className={`flex gap-2 ${compact ? 'items-start justify-between' : 'items-center'}`}>
            <span
              className={`display-serif min-w-0 truncate font-semibold text-[#F5E9C9] ${compact ? 'text-[13px]' : 'text-[14px]'}`}
              style={titleColor ? { color: titleColor } : undefined}
            >
              {title}
            </span>
            {status ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px]" style={{ color: lamp }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: lamp, boxShadow: `0 0 6px ${lamp}` }} />
                {status}
              </span>
            ) : null}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-[9px] uppercase tracking-[0.18em] text-[#6A7299]">
              {subtitle}
            </span>
          ) : null}
          {body ? (
            <span className={`mt-2 block text-[11px] leading-5 text-[#C8CDD8] ${compact ? 'line-clamp-2 break-normal' : 'line-clamp-2'}`}>
              {body}
            </span>
          ) : null}
          {meta ? (
            <span className="mt-2 block text-[9px] text-[#8F835F]">{meta}</span>
          ) : null}
        </span>
      </div>

      {!compact && (
        <ChevronRight
          size={14}
          className="relative z-10 mt-1 shrink-0 text-[#484F72] transition group-hover:translate-x-0.5 group-hover:text-[#F0C66A]"
        />
      )}
    </Link>
  );
}

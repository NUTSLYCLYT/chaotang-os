import Link from 'next/link';
import type { ReactNode } from 'react';

export type CourtSourceMode = 'LIVE' | 'MIXED' | 'FALLBACK' | 'DEMO';

const SOURCE_MODE_STYLE: Record<CourtSourceMode, { label: string; color: string; bg: string }> = {
  LIVE: { label: 'LIVE', color: '#3DD68C', bg: 'rgba(61,214,140,0.14)' },
  MIXED: { label: 'MIXED', color: '#F5A524', bg: 'rgba(245,165,36,0.15)' },
  FALLBACK: { label: 'FALLBACK', color: '#F43F5E', bg: 'rgba(244,63,94,0.14)' },
  DEMO: { label: 'DEMO', color: '#9AA3C4', bg: 'rgba(154,163,196,0.14)' },
};

export function CourtStatusBadge({
  mode,
  label,
  className = '',
}: {
  mode: CourtSourceMode;
  label?: string;
  className?: string;
}) {
  const style = SOURCE_MODE_STYLE[mode];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-[0.08em] ${className}`}
      style={{
        border: `1px solid ${style.color}55`,
        background: style.bg,
        color: style.color,
      }}
    >
      {label ?? style.label}
    </span>
  );
}

export interface CourtEvidenceItem {
  label: string;
  value: ReactNode;
  tone?: CourtSourceMode;
}

export function CourtEvidencePanel({
  eyebrow = 'Evidence Boundary · 证据边界',
  title,
  description,
  mode,
  items,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  mode: CourtSourceMode;
  items: CourtEvidenceItem[];
}) {
  return (
    <section className="rounded-lg border border-[#F0C66A]/20 bg-[#090D18]/80 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.34)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A92AC]">{eyebrow}</div>
          <h2 className="mt-1 text-[15px] font-semibold text-[#F5E9C9]">{title}</h2>
        </div>
        <CourtStatusBadge mode={mode} />
      </div>
      <p className="mt-2 text-[12px] leading-6 text-[#B6BDD5]">{description}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-md border border-white/5 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-[#6A7299]">{item.label}</span>
              {item.tone && <CourtStatusBadge mode={item.tone} />}
            </div>
            <div className="mt-1 break-words text-[12px] font-medium text-[#EAEEFB]">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export interface CourtNextAction {
  label: string;
  href: string;
  tone?: 'primary' | 'secondary';
}

export function CourtNextActionBar({
  title = '下一步',
  description,
  actions,
}: {
  title?: string;
  description: string;
  actions: CourtNextAction[];
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#6BA0FF]/20 bg-[#6BA0FF]/[0.055] px-4 py-3">
      <div>
        <div className="text-[11px] font-semibold text-[#EAF1FF]">{title}</div>
        <div className="mt-1 text-[11px] leading-5 text-[#9AA3C4]">{description}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Link
            key={`${action.href}-${action.label}`}
            href={action.href}
            className="rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors"
            style={{
              borderColor: action.tone === 'primary' ? 'rgba(240,198,106,0.42)' : 'rgba(255,255,255,0.12)',
              background: action.tone === 'primary' ? 'rgba(240,198,106,0.12)' : 'rgba(255,255,255,0.035)',
              color: action.tone === 'primary' ? '#F0C66A' : '#C8CDD8',
            }}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

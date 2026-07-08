'use client';

import type { ReactNode } from 'react';

export type CapabilityStatus = 'LIVE' | 'BFF_LOCAL' | 'FALLBACK' | 'DEMO';

export type CapabilityEvidenceRow = {
  label: string;
  value: string;
};

export type CapabilityEvidenceItem = {
  id: string;
  name: string;
  status: CapabilityStatus;
  endpoint: string;
  detail: string;
  evidence: CapabilityEvidenceRow[];
};

const CAPABILITY_STATUS_STYLE: Record<CapabilityStatus, { label: string; color: string; bg: string; border: string }> = {
  LIVE: { label: 'LIVE', color: '#B9F6D2', bg: 'rgba(61,214,140,0.09)', border: 'rgba(61,214,140,0.32)' },
  BFF_LOCAL: { label: 'BFF_LOCAL', color: '#B8CCFF', bg: 'rgba(107,160,255,0.09)', border: 'rgba(107,160,255,0.30)' },
  FALLBACK: { label: 'FALLBACK', color: '#F5D28B', bg: 'rgba(240,198,106,0.10)', border: 'rgba(240,198,106,0.34)' },
  DEMO: { label: 'DEMO', color: '#D6B7FF', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.30)' },
};

function CapabilityBadge({ status }: { status: CapabilityStatus }) {
  const style = CAPABILITY_STATUS_STYLE[status];
  return (
    <span
      className="inline-flex shrink-0 rounded border px-1.5 py-[1px] font-mono text-[9px] leading-4"
      style={{ color: style.color, background: style.bg, borderColor: style.border }}
    >
      {style.label}
    </span>
  );
}

export function CapabilityEvidenceMatrix({
  items,
  trace,
  icon,
  label = '真能力矩阵',
}: {
  items: CapabilityEvidenceItem[];
  trace: string;
  icon?: ReactNode;
  label?: string;
}) {
  return (
    <div
      aria-label={label}
      data-testid="capability-matrix"
      className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] tracking-[0.16em] text-[#8F835F]">
          {icon}
          {label}
        </div>
        <div className="font-mono text-[10px] text-[#6A7299]">TRACE {trace}</div>
      </div>
      <div className="grid gap-1.5 md:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.id}
            className="min-w-0 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5"
            data-testid={`capability-${item.id}`}
            title={`${item.endpoint} · ${item.detail}`}
          >
            <div className="flex min-w-0 items-center justify-between gap-1.5">
              <span className="truncate text-[11px] font-semibold text-[#EAEEFB]">{item.name}</span>
              <CapabilityBadge status={item.status} />
            </div>
            <div className="mt-1 truncate font-mono text-[9.5px] text-[#6A7299]">{item.endpoint}</div>
            <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-[#AEB7D4]">{item.detail}</div>
            <details className="group mt-1.5 border-t border-white/10 pt-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[10px] text-[#8F98B8] marker:hidden">
                <span>证据</span>
                <span className="font-mono text-[9px] text-[#6A7299] group-open:hidden">+</span>
                <span className="hidden font-mono text-[9px] text-[#6A7299] group-open:inline">-</span>
              </summary>
              <dl className="mt-1 grid gap-0.5 font-mono text-[9px] leading-4" data-testid={`capability-${item.id}-evidence`}>
                {item.evidence.map((row) => (
                  <div key={`${item.id}-${row.label}`} className="grid grid-cols-[72px_minmax(0,1fr)] gap-1">
                    <dt className="truncate text-[#6A7299]">{row.label}</dt>
                    <dd className="truncate text-[#B7C0DD]" title={row.value}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}

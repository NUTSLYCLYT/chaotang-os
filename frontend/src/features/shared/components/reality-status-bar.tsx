'use client';

import { Activity, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import type { RealitySignal } from '@/lib/reality/reality-state';
import { REALITY_LABEL, REALITY_TONE } from '@/lib/reality/reality-state';

const TONE_COLOR = {
  success: '#3DD68C',
  warn: '#F0C66A',
  danger: '#F43F5E',
  neutral: '#9AA3C4',
} as const;

function statusIcon(tone: keyof typeof TONE_COLOR) {
  if (tone === 'success') return <CheckCircle2 size={12} />;
  if (tone === 'danger') return <AlertTriangle size={12} />;
  if (tone === 'warn') return <Activity size={12} />;
  return <HelpCircle size={12} />;
}

export function RealityStatusBar({
  signal,
  compact = false,
}: {
  signal: RealitySignal;
  compact?: boolean;
}) {
  const tone = REALITY_TONE[signal.state];
  const color = TONE_COLOR[tone];

  return (
    <div
      className={[
        'flex items-center justify-between gap-3 border-b px-4 text-[11px]',
        compact ? 'min-h-9 py-2' : 'min-h-10 py-2.5',
      ].join(' ')}
      style={{
        borderColor: `${color}33`,
        background: `linear-gradient(90deg, ${color}14, rgba(7,11,22,0.92))`,
      }}
      data-reality-state={signal.state}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 font-mono font-semibold"
          style={{ color, borderColor: `${color}55`, background: `${color}12` }}
        >
          {statusIcon(tone)}
          {REALITY_LABEL[signal.state]}
        </span>
        <span className="truncate font-semibold text-[#EAEEFB]">{signal.label}</span>
        <span className="hidden truncate text-[#9AA3C4] md:inline">{signal.detail}</span>
      </div>
      <div className="hidden shrink-0 items-center gap-2 font-mono text-[#6A7299] sm:flex">
        {signal.updatedAt && <span>{signal.updatedAt}</span>}
        {signal.evidencePath && <span className="max-w-[260px] truncate">{signal.evidencePath}</span>}
      </div>
    </div>
  );
}

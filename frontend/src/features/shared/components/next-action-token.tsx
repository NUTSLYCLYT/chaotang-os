'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, BadgeCheck, FileClock, GitBranch, ShieldCheck } from 'lucide-react';

type TokenTone = 'gold' | 'blue' | 'green' | 'red' | 'violet';

const TONE: Record<TokenTone, { border: string; bg: string; text: string; soft: string }> = {
  gold: { border: 'border-[#F0C66A]/30', bg: 'bg-[#F0C66A]/10', text: 'text-[#F0C66A]', soft: 'text-[#D9C48D]' },
  blue: { border: 'border-[#6BA0FF]/30', bg: 'bg-[#6BA0FF]/10', text: 'text-[#9FC1FF]', soft: 'text-[#B8CBEF]' },
  green: { border: 'border-[#3DD68C]/30', bg: 'bg-[#3DD68C]/10', text: 'text-[#B9F6D2]', soft: 'text-[#B8DCC8]' },
  red: { border: 'border-[#F43F5E]/30', bg: 'bg-[#F43F5E]/10', text: 'text-[#FFB0BF]', soft: 'text-[#E7B3BB]' },
  violet: { border: 'border-[#B794F4]/30', bg: 'bg-[#B794F4]/10', text: 'text-[#D9C5FF]', soft: 'text-[#CDBEEB]' },
};

export interface NextActionTokenProps {
  title: string;
  description: string;
  targetLabel: string;
  targetHref: string;
  owner: string;
  status: string;
  confidence?: string;
  evidence?: string[];
  tone?: TokenTone;
}

export function NextActionToken({
  title,
  description,
  targetLabel,
  targetHref,
  owner,
  status,
  confidence,
  evidence = [],
  tone = 'gold',
}: NextActionTokenProps) {
  const style = TONE[tone];

  return (
    <aside className={`rounded-lg border ${style.border} ${style.bg} p-3 shadow-[0_14px_44px_rgba(0,0,0,0.28)] backdrop-blur-md`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${style.text}`}>Next Action Target</div>
          <h3 className="mt-1 text-[15px] font-semibold leading-6 text-[#F5E9C9]">{title}</h3>
        </div>
        <span className={`shrink-0 rounded border ${style.border} bg-black/15 px-2 py-1 text-[10px] ${style.text}`}>
          {status}
        </span>
      </div>
      <p className="mt-2 text-[11.5px] leading-5 text-[#AEB8CE]">{description}</p>
      <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
        <InfoPill icon={<ShieldCheck size={12} />} label="责任" value={owner} tone={style.soft} />
        <InfoPill icon={<BadgeCheck size={12} />} label="置信" value={confidence ?? '待证据回写'} tone={style.soft} />
      </div>
      {evidence.length > 0 && (
        <div className="mt-3 rounded-md border border-white/[0.07] bg-black/15 p-2">
          <div className="mb-1 flex items-center gap-1.5 text-[10.5px] text-[#8F9AB8]">
            <FileClock size={12} />
            证据
          </div>
          <div className="grid gap-1">
            {evidence.slice(0, 3).map((item) => (
              <div key={item} className="text-[10.5px] leading-4 text-[#C4CCDA]">
                · {item}
              </div>
            ))}
          </div>
        </div>
      )}
      <Link
        href={targetHref}
        className={`mt-3 inline-flex w-full items-center justify-between rounded-md border ${style.border} bg-black/20 px-3 py-2 text-[11.5px] font-medium ${style.text} transition hover:bg-white/[0.05]`}
      >
        <span>{targetLabel}</span>
        <ArrowRight size={13} />
      </Link>
    </aside>
  );
}

export function ActionProtocolRow({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: TokenTone }>;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      {items.map((item) => {
        const style = TONE[item.tone ?? 'gold'];
        return (
          <div key={item.label} className={`rounded-md border ${style.border} bg-black/20 px-3 py-2`}>
            <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${style.text}`}>
              <GitBranch size={11} />
              {item.label}
            </div>
            <div className="mt-1 text-[12px] font-semibold leading-5 text-[#F5E9C9]">{item.value}</div>
          </div>
        );
      })}
    </div>
  );
}

function InfoPill({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-white/[0.07] bg-black/15 px-2 py-1.5">
      <span className={tone}>{icon}</span>
      <span className="shrink-0 text-[#7F8AA3]">{label}</span>
      <span className="min-w-0 truncate text-[#DCE6F8]">{value}</span>
    </div>
  );
}

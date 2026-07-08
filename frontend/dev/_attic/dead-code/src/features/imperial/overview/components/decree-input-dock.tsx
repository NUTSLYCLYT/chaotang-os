'use client';

import Link from 'next/link';
import { PauseCircle, Send, SlidersHorizontal } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

export function DecreeInputDock() {
  return (
    <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr] xl:items-end">
        <div>
          <div className="section-eyebrow">Decree Dock · 诏令输入区</div>
          <h2 className="section-title mt-2">在大殿即可下达新旨，不必先进入子页面。</h2>
          <div className="mt-3 text-[11px] leading-6 text-[#9AA3C4]">
            若要使用完整的御批体验，可直接进入<Link href="/throne/compose" className="mx-1 text-[#F0C66A] hover:text-[#F5E9C9]">圣旨页</Link>亲笔下达新旨。
          </div>
          <textarea
            defaultValue="命丞相先压缩当前高风险议题，只呈上最该先处理的一件事。"
            className="mt-4 min-h-[132px] w-full resize-none rounded-2xl border border-[#F0C66A]/16 bg-[#070B15] px-4 py-4 text-[13px] leading-7 text-[#E7DDBF] outline-none transition focus:border-[#F0C66A]/32"
            spellCheck={false}
          />
        </div>
        <div className="grid gap-3">
          <ActionLink href="/throne/compose" icon={<Send size={14} />} label="前往圣旨页" primary />
          <ActionButton icon={<SlidersHorizontal size={14} />} label="调整策略" />
          <ActionButton icon={<PauseCircle size={14} />} label="中止执行" danger />
        </div>
      </div>
    </GlassPanel>
  );
}

function ActionButton({
  icon,
  label,
  primary,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  danger?: boolean;
}) {
  const className = danger
    ? 'border-[#7A2A2A]/40 bg-[#4E1919]/40 text-[#F6B8B8] hover:bg-[#5A1D1D]/48'
    : primary
      ? 'border-[#F0C66A]/30 bg-[#F0C66A]/12 text-[#F0C66A] hover:bg-[#F0C66A]/18'
      : 'border-white/8 bg-white/[0.03] text-[#EAEEFB] hover:bg-white/[0.05]';

  return (
    <button type="button" className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-[12px] transition ${className}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ActionLink({
  href,
  icon,
  label,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  const className = primary
    ? 'border-[#F0C66A]/30 bg-[#F0C66A]/12 text-[#F0C66A] hover:bg-[#F0C66A]/18'
    : 'border-white/8 bg-white/[0.03] text-[#EAEEFB] hover:bg-white/[0.05]';

  return (
    <Link href={href} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-[12px] transition ${className}`}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

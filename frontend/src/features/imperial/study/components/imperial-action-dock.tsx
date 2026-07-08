'use client';

import Link from 'next/link';
import { CheckCheck, FilePenLine, Send } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

export interface ImperialActionDockProps {
  officialName: string;
  draftVersion?: number;
  draftUpdatedAt?: string;
  draftLabel?: string;
  draftNote?: string;
}

export function ImperialActionDock({
  officialName,
  draftVersion,
  draftUpdatedAt,
  draftLabel,
  draftNote,
}: ImperialActionDockProps) {
  return (
    <GlassPanel variant="gold" tone="elevated" padding="md">
      <div className="section-eyebrow">Imperial Actions</div>
      <h2 className="section-title mt-1">批示动作区</h2>
      <p className="body-copy mt-3 text-[12px] leading-6 text-[#C9D0E3]">
        对 {officialName} 的奏章，先定是否继续改稿，再决定送丞相收束，还是直接转入军机处会签。
      </p>
      <div className="mt-3 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-3 text-[11px] leading-6 text-[#B8C0DA]">
        <div>
          当前草稿：v{draftVersion ?? 1}
          <span className="mx-2 text-[#6A7299]">·</span>
          {draftUpdatedAt ?? '未保存'}
        </div>
        {draftLabel && <div className="mt-1 text-[#F5E9C9]">已命名：{draftLabel}</div>}
        {draftNote && <div className="mt-1 text-[#8FA0C8]">备注：{draftNote}</div>}
      </div>
      <div className="mt-3 rounded-xl border border-[#F0C66A]/12 bg-[#F0C66A]/[0.04] px-3 py-3 text-[11px] leading-6 text-[#D9CFB4]">
        命名存档后，可直接把当前稿作为“御前提交版本”送去丞相台收束判断，再由军机处会签落地。
      </div>
      <div className="mt-4 grid gap-3">
        <ActionButton icon={<FilePenLine size={14} />} label="继续改写奏章草稿" subtle />
        <LinkButton href="/command-center" icon={<Send size={14} />} label="送丞相台收束判断" primary />
        <LinkButton href="/command-center?view=council" icon={<CheckCheck size={14} />} label="送军机处进入会签" />
      </div>
    </GlassPanel>
  );
}

function ActionButton({
  icon,
  label,
  subtle,
}: {
  icon: React.ReactNode;
  label: string;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-[12px] transition ${
        subtle
          ? 'border-white/8 bg-white/[0.03] text-[#EAEEFB] hover:bg-white/[0.05]'
          : 'border-[#F0C66A]/25 bg-[#F0C66A]/10 text-[#F0C66A] hover:bg-[#F0C66A]/16'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function LinkButton({
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
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-[12px] transition ${
        primary
          ? 'border-[#F0C66A]/25 bg-[#F0C66A]/10 text-[#F0C66A] hover:bg-[#F0C66A]/16'
          : 'border-white/8 bg-white/[0.03] text-[#EAEEFB] hover:bg-white/[0.05]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

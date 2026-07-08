'use client';

import { ArrowRight } from 'lucide-react';
import type { DemoIdentity } from '../data/demo-identities';

interface IdentityCardProps {
  identity: DemoIdentity;
  active: boolean;
  onSelect: (userId: string) => void;
}

export function IdentityCard({ identity, active, onSelect }: IdentityCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(identity.userId)}
      className="group w-full rounded-2xl border p-5 text-left transition-all"
      style={{
        borderColor: active ? 'rgba(240,198,106,0.4)' : 'rgba(255,255,255,0.08)',
        background: active ? 'rgba(240,198,106,0.06)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[22px]"
          style={{
            background: active ? 'rgba(240,198,106,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${active ? 'rgba(240,198,106,0.25)' : 'rgba(255,255,255,0.06)'}`,
          }}
        >
          {identity.avatar}
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-[#F5E9C9]">{identity.name}</div>
          <div className="mt-0.5 text-[12px] text-[#9AA3C4]">{identity.department} · {identity.role}</div>
          <div
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] transition-all"
            style={{ color: active ? '#F0C66A' : '#6A7299' }}
          >
            {active ? '当前身份' : '以此身份登录'}
            {!active && <ArrowRight size={11} className="transition group-hover:translate-x-0.5" />}
          </div>
        </div>
      </div>
    </button>
  );
}

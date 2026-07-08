'use client';

/**
 * 庄园速览 · 10 小卡
 *
 * 每庄：emoji · 庄名 · 蜂群活跃点 · 一行状态
 * 点击回庄园总览 /manors
 */

import Link from 'next/link';

const MANORS: Array<{
  domain: string;
  nameCn: string;
  emoji: string;
  price: string;
}> = [
  { domain: 'legal', nameCn: '律师庄', emoji: '⚖️', price: '19.9' },
  { domain: 'hr', nameCn: 'HR 庄', emoji: '👥', price: '14.9' },
  { domain: 'finance', nameCn: '财务庄', emoji: '💰', price: '24.9' },
  { domain: 'ecommerce', nameCn: '电商庄', emoji: '🛒', price: '9.9' },
  { domain: 'ops', nameCn: '运维庄', emoji: '🛠', price: '29.9' },
  { domain: 'compliance', nameCn: '合规庄', emoji: '🛡', price: '29.9' },
  { domain: 'sales', nameCn: '销售庄', emoji: '📞', price: '12.9' },
  { domain: 'marketing', nameCn: '营销庄', emoji: '📣', price: '15.9' },
  { domain: 'packaging', nameCn: '包装庄', emoji: '📦', price: '16.9' },
  { domain: 'supply-chain', nameCn: '供应链', emoji: '🚚', price: '22.9' },
];

interface Props {
  activeDomains?: Set<string>;
  blockedDomains?: Set<string>;
}

export function ManorsMini({ activeDomains, blockedDomains }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      {MANORS.map((m) => {
        const isActive = activeDomains?.has(m.domain);
        const isBlocked = blockedDomains?.has(m.domain);
        const dotColor = isBlocked
          ? '#F97316'
          : isActive
            ? '#6BA0FF'
            : '#3F466A';
        const status = isBlocked ? '阻塞' : isActive ? '办理中' : '待命';

        return (
          <Link
            key={m.domain}
            href="/manors"
            className="group rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-[#F0C66A]/30 hover:bg-white/[0.05]"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[14px]">{m.emoji}</span>
              <span className="text-[11px] font-semibold leading-tight text-[#F5E9C9]">
                {m.nameCn}
              </span>
              <span
                className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: dotColor, boxShadow: `0 0 5px ${dotColor}` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[9px] text-[#6A7299]">
              <span>{status}</span>
              <span className="text-[#8F835F]">¥{m.price}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

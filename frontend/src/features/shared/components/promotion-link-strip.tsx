/**
 * 朝堂 OS · 人才晋升链 · 翰林院 ↔ 上书房 跨页导航
 *
 * 职责边界：
 *   - 翰林院（/hanlin）= 文才研判、长文咨询、无时效压力
 *   - 上书房（/study）= 六部尚书召见、具体决策、有时效
 *
 * 链路：翰林学士 · 出主意 → 上书房 · 拍板 → 复盘台 · 归档
 */

'use client';

import Link from 'next/link';
import { Feather, Crown, Archive, ArrowRight } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function PromotionLinkStrip() {
  const pathname = usePathname();
  const currentIdx = pathname.startsWith('/hanlin')
    ? 0
    : pathname.startsWith('/study')
      ? 1
      : pathname.startsWith('/scribe')
        ? 2
        : -1;
  if (currentIdx === -1) return null;

  const steps = [
    {
      key: 'hanlin',
      label: '翰林院',
      sub: '出主意 · 研判',
      icon: Feather,
      href: '/hanlin',
      accent: '#60A5FA',
    },
    {
      key: 'study',
      label: '上书房',
      sub: '拍板 · 决策',
      icon: Crown,
      href: '/study',
      accent: '#F0C66A',
    },
    {
      key: 'scribe',
      label: '复盘台',
      sub: '归档 · 传世',
      icon: Archive,
      href: '/scribe',
      accent: '#3DD68C',
    },
  ];

  return (
    <div
      className="relative flex items-center gap-2 overflow-x-auto rounded-xl border px-4 py-3"
      style={{
        borderColor: 'rgba(240,198,106,0.22)',
        background:
          'linear-gradient(135deg, rgba(21,18,10,0.6) 0%, rgba(10,7,4,0.85) 60%, rgba(7,5,15,0.6) 100%)',
      }}
    >
      <div className="mr-2 shrink-0 text-[11px] font-semibold tracking-[0.32em] text-[#F0C66A]">
        人才晋升链
      </div>
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isCurrent = i === currentIdx;
        return (
          <div key={step.key} className="flex shrink-0 items-center gap-2">
            <Link
              href={step.href}
              className="group flex items-center gap-2 rounded-md border px-3 py-1.5 transition-all hover:-translate-y-0.5"
              style={{
                borderColor: isCurrent
                  ? `${step.accent}aa`
                  : `${step.accent}33`,
                background: isCurrent
                  ? `${step.accent}18`
                  : 'rgba(255,255,255,0.02)',
                boxShadow: isCurrent
                  ? `0 0 12px ${step.accent}55, inset 0 0 0 1px ${step.accent}66`
                  : undefined,
              }}
            >
              <Icon size={12} style={{ color: step.accent }} />
              <div className="leading-tight">
                <div
                  className="text-[11.5px] font-bold tracking-[0.08em]"
                  style={{
                    color: isCurrent ? step.accent : '#F5E9C9',
                    fontFamily: '"Noto Serif SC", serif',
                  }}
                >
                  {step.label}
                  {isCurrent ? ' · 当前' : ''}
                </div>
                <div className="text-[11px] tracking-[0.16em] text-[#8A92AC]">
                  {step.sub}
                </div>
              </div>
            </Link>
            {i < steps.length - 1 && (
              <ArrowRight
                size={12}
                className="shrink-0"
                style={{ color: 'rgba(240,198,106,0.45)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

'use client';

/**
 * WangGonggongStudyPanel — 钦天监即时汇报（右栏）
 * 按钮：立即处理 / 查看待裁决 / 进入朝廷大殿 / 进入军机处 / 查看全部引导
 */

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { assetUrl } from '@/lib/asset';
import { wangGonggongStudyGuideMock as W } from '@/features/chaotang/mock/study.mock';
import { ActionButton } from './scroll-primitives';

export function WangGonggongStudyPanel({ onScrollToVerdicts }: { onScrollToVerdicts?: () => void }) {
  const router = useRouter();

  return (
    <aside
      className="relative flex flex-col overflow-hidden rounded-2xl border"
      style={{
        borderColor: 'rgba(240,198,106,0.28)',
        background: 'linear-gradient(165deg, rgba(240,198,106,0.08), transparent 55%), rgba(5,16,27,0.86)',
        boxShadow: 'inset 0 1px 0 rgba(240,198,106,0.14)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, #F0C66A99, transparent)' }}
      />
      {/* 画像 + 名讳 */}
      <div className="flex items-center gap-3 px-5 pt-5">
        <div
          className="h-[60px] w-[52px] shrink-0 overflow-hidden rounded-lg"
          style={{ border: '1.5px solid rgba(240,198,106,0.55)', boxShadow: '0 0 14px rgba(240,198,106,0.22)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetUrl('/heroes/6-ouyang.webp')} alt="钦天监" className="h-full w-full object-cover" style={{ objectPosition: '55% 30%' }} />
        </div>
        <div className="min-w-0">
          <div className="display-serif text-[16px] font-bold text-[#F0C66A]">{W.name}</div>
          <div className="mt-0.5 text-[11px] text-[#8A7A52]">{W.role}</div>
        </div>
      </div>

      <div className="px-5 py-4">
        <p
          className="rounded-lg border px-3 py-2 text-[13px] leading-relaxed text-[#CDB98A]"
          style={{ borderColor: 'rgba(240,198,106,0.18)', background: 'rgba(240,198,106,0.04)' }}
        >
          <span className="text-[#F0C66A]">「</span>
          {W.greeting}
          <span className="text-[#F0C66A]">」</span>
        </p>

        {/* 为您推荐 */}
        <div className="mt-3 text-[11px] font-semibold tracking-[0.16em] text-[#6A7299]">为您推荐</div>
        <ul className="mt-2 space-y-2">
          {W.briefs.map((b) => (
            <li
              key={b.id}
              className="flex items-start gap-2.5 rounded-lg p-2 transition hover:bg-white/[0.03]"
            >
              <span className="text-[16px] leading-none">{b.icon}</span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-[#EAEEFB]">{b.title}</div>
                <div className="text-[11px] text-[#6A7299]">{b.desc}</div>
              </div>
            </li>
          ))}
        </ul>

        {/* 每日一课 */}
        <div
          className="mt-3 rounded-lg border px-3 py-2.5"
          style={{ borderColor: 'rgba(240,198,106,0.16)', background: 'rgba(240,198,106,0.03)' }}
        >
          <div className="text-[11px] font-semibold text-[#F0C66A]">{W.lesson.title}</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#9AA3C4]">{W.lesson.body}</p>
        </div>
      </div>

      {/* 按钮 */}
      <div className="mt-auto grid grid-cols-2 gap-2 border-t px-5 py-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <ActionButton variant="gold" onClick={() => { onScrollToVerdicts?.(); toast('钦天监已为您展开待裁决奏折'); }}>
          立即处理
        </ActionButton>
        <ActionButton variant="soft" onClick={() => onScrollToVerdicts?.()}>
          查看待裁决
        </ActionButton>
        <ActionButton variant="ghost" onClick={() => router.push('/overview')}>
          进入朝廷大殿
        </ActionButton>
        <ActionButton variant="ghost" onClick={() => router.push('/grand-council')}>
          进入军机处
        </ActionButton>
        <button
          type="button"
          onClick={() => toast('钦天监引导', { description: '更多上书房使用引导，敬请期待。' })}
          className="col-span-2 rounded-lg border py-1.5 text-[12px] text-[#9AA3C4] transition hover:text-[#F0C66A]"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          查看全部引导 →
        </button>
      </div>
    </aside>
  );
}

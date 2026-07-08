'use client';

/**
 * ChancellorJudgementPanel — 丞相今日判断（左栏）
 * 按钮：采纳建议 / 让丞相拆解 / 召集群臣 / 查看完整简报
 */

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { assetUrl } from '@/lib/asset';
import { chancellorDailyJudgementMock as J } from '@/features/chaotang/mock/study.mock';
import { ActionButton } from './scroll-primitives';

const TONE: Record<string, string> = { normal: '#3DD68C', warning: '#F5A524', critical: '#F43F5E' };

export function ChancellorJudgementPanel() {
  const router = useRouter();
  const tone = TONE[J.statusTone] ?? '#3DD68C';

  return (
    <aside
      className="relative flex flex-col overflow-hidden rounded-2xl border"
      style={{
        borderColor: 'rgba(107,160,255,0.28)',
        background: 'linear-gradient(165deg, rgba(107,160,255,0.08), transparent 55%), rgba(5,16,27,0.86)',
        boxShadow: 'inset 0 1px 0 rgba(107,160,255,0.14)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, #6BA0FF88, transparent)' }}
      />
      {/* 画像 + 名讳 */}
      <div className="flex items-center gap-3 px-5 pt-5">
        <div
          className="h-[60px] w-[52px] shrink-0 overflow-hidden rounded-lg"
          style={{ border: '1.5px solid rgba(107,160,255,0.5)', boxShadow: '0 0 14px rgba(107,160,255,0.22)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetUrl('/heroes/1-zhuge.webp')} alt="丞相" className="h-full w-full object-cover" style={{ objectPosition: '62% 22%' }} />
        </div>
        <div className="min-w-0">
          <div className="display-serif text-[16px] font-bold text-[#EAEEFB]">{J.name}</div>
          <div className="mt-0.5 text-[11px] text-[#6A7299]">{J.role}</div>
          <span
            className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ color: tone, background: `${tone}1a`, border: `1px solid ${tone}55` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
            {J.statusTag}
          </span>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="display-serif text-[15px] font-bold leading-snug text-[#F5E9C9]">{J.headline}</div>
        <p className="mt-2 text-[13px] leading-[1.75] text-[#9AA3C4]">{J.analysis}</p>

        <ul className="mt-3 space-y-2">
          {J.points.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-[#C6CEE6]">
              <span
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ color: '#6BA0FF', background: 'rgba(107,160,255,0.14)', border: '1px solid rgba(107,160,255,0.4)' }}
              >
                {i + 1}
              </span>
              {p}
            </li>
          ))}
        </ul>

        <div
          className="mt-3 rounded-lg border px-3 py-2 text-[12px] leading-relaxed"
          style={{ borderColor: 'rgba(240,198,106,0.22)', background: 'rgba(240,198,106,0.05)', color: '#CDB98A' }}
        >
          <span className="font-semibold text-[#F0C66A]">丞相建言：</span>
          {J.recommendation}
        </div>
      </div>

      {/* 按钮 */}
      <div className="mt-auto flex flex-wrap gap-2 border-t px-5 py-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <ActionButton variant="gold" onClick={() => toast.success('已采纳丞相建议', { description: '将按建言优先处理今日要务。' })}>
          采纳建议
        </ActionButton>
        <ActionButton variant="soft" onClick={() => router.push('/command-center')}>
          让丞相拆解
        </ActionButton>
        <ActionButton variant="ghost" onClick={() => router.push('/grand-council')}>
          召集群臣
        </ActionButton>
        <ActionButton variant="ghost" onClick={() => router.push('/reports')}>
          查看完整简报
        </ActionButton>
      </div>
    </aside>
  );
}

/**
 * 锦衣卫 · 「今日就一件事」聚焦卡（2026-07-05）
 *
 * 只在有「又早又真」的够格头条时渲染；否则返回 null（live 页面零占位，诚实纪律）。
 * 领先度一律由 computeLead 从仙狐双时间戳算出，缺则不显示——绝不写死演示数字（铁律4，见 nodetest）。
 */
import { useMemo } from 'react';
import { Clock3, Send, ShieldCheck } from 'lucide-react';

import type { IntelSignal } from '@/lib/contracts/intel';
import { computeLead, pickTodayOneThing } from '@/features/intel/lib/today-one-thing';

const CRED_STARS: Record<IntelSignal['credibility'], number> = { low: 1, medium: 2, high: 3, verified: 4 };

export function TodayOneThing({ signals, onOpen }: { signals: IntelSignal[]; onOpen?: (id: string) => void }) {
  const now = Date.now();
  const pick = useMemo(() => pickTodayOneThing(signals, now), [signals, now]);
  const lead = useMemo(() => (pick ? computeLead(pick, now) : null), [pick, now]);

  // 无够格头条（又早又真）→ 不渲染，绝不硬凑（铁律5：没真数据不装样子）。
  if (!pick || !lead) return null;

  const independentSources = pick.sources.filter((s) => Boolean(s.url)).length;
  const stars = CRED_STARS[pick.credibility];

  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#F0C66A]/28 bg-gradient-to-b from-[#0E0B04]/72 to-[#05070D]/88 px-6 py-5 shadow-[0_36px_110px_rgba(0,0,0,0.56)] backdrop-blur-xl">
      <div className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 border-l border-t border-[#8A6A2A]" />
      <div className="pointer-events-none absolute bottom-3 right-3 h-3.5 w-3.5 border-b border-r border-[#8A6A2A]" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8A6A2A]">
            若今日只看一条 · <span className="text-[#F0C66A]">就是这条</span>
          </div>
          {/* 领先度：唯一由真时间戳算出的大数字 */}
          <div className="mt-3 flex items-baseline gap-3">
            <Clock3 size={16} className="text-[#F0C66A]/80" />
            <span
              className="font-serif text-[clamp(30px,5vw,52px)] font-black leading-none"
              style={{
                background: 'linear-gradient(135deg,#F6D98A,#F0C66A 44%,#D4A84B)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
              data-testid="today-one-thing-lead"
            >
              早 {formatLead(lead.leadHours)}
            </span>
          </div>
          <div className="mt-1.5 text-[11px] text-[#7E86A8]">
            {lead.stillLeading ? '主流尚未跟进 · 领先窗口开启中' : '主流已跟进 · 领先窗口已关闭'}
          </div>
        </div>

        {/* 二维守卫徽：能渲染即已在 gold 象限（又早又真） */}
        <div className="flex flex-none items-center gap-1.5 rounded-full border border-[#3DD68C]/40 bg-[#3DD68C]/10 px-3 py-1.5 text-[10px] font-bold text-[#3DD68C]">
          <ShieldCheck size={12} /> 又早又真
        </div>
      </div>

      <h1 className="mt-5 max-w-[30ch] text-balance font-serif text-[clamp(20px,3vw,28px)] font-black leading-snug text-[#F5E9C9]">
        {pick.title}
      </h1>

      {/* 所以呢：有则显示，无则隐藏，不臆造 */}
      {pick.soWhat && (
        <div className="mt-4 rounded-r-lg border-l-[3px] border-[#E0553A] bg-gradient-to-r from-[#E0553A]/8 to-transparent py-2.5 pl-4">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#E0553A]">所以呢 · 对我们</div>
          <div className="mt-1 text-[14px] font-semibold leading-relaxed text-[#F5E9C9]">{pick.soWhat}</div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[16px] tracking-[2px] text-[#3DD68C]" aria-label={`可信度 ${stars} / 4`}>
            {'★'.repeat(stars)}
            <span className="text-[#3DD68C]/25">{'★'.repeat(4 - stars)}</span>
          </span>
          <span className="text-[11px] text-[#9AA3C4]">
            {independentSources > 0 ? `${independentSources} 个独立公开源交叉` : '公开来源核验中'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpen?.(pick.id)}
            className="rounded-full border border-[#F0C66A]/45 bg-[#F0C66A]/12 px-4 py-2 text-[12px] font-bold text-[#F0C66A] transition hover:bg-[#F0C66A]/20"
          >
            看证据链
          </button>
          <button
            type="button"
            onClick={() => onOpen?.(pick.id)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E0553A]/50 bg-[#E0553A]/14 px-4 py-2 text-[12px] font-bold text-[#E0553A] transition hover:bg-[#E0553A]/24"
          >
            <Send size={12} /> 派发六部
          </button>
        </div>
      </div>
    </article>
  );
}

function formatLead(hours: number): string {
  if (hours < 24) return `${hours} 小时`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return h > 0 ? `${d} 天 ${h} 小时` : `${d} 天`;
}

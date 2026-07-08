/**
 * 锦衣卫 · 密报卷轴（2026-07-06 · v6 实现）
 *
 * 上书房风的圣旨器物：金纸 + 玉轴 + 朱砂「锦」封印，唯一主角。
 * 消费 pickHeadline —— urgent（又早又真）呈「八百里加急」+ 领先度大字；
 * brief（无领先度真数据）呈「今日要情」，领先度整行**不渲染**（Rams：仪式重量=数据重量，见 nodetest）。
 * 空 → 不渲染（诚实纪律）。
 *
 * ponytail: 卷轴视觉自绘（金纸/玉轴/封印），未接冻结 MemorialScroll 舞台 —— 那是 2160 行、耦合 shangshufang
 * 类型的展卷/落墨仪式平台；本组件只做静态呈现，接入 MemorialScroll 展卷动画留作后续（intel→EdictView 适配器）。
 */
import { useMemo } from 'react';
import { pickHeadline } from '@/features/intel/lib/today-one-thing';
import type { IntelSignal } from '@/lib/contracts/intel';

const CRED_STARS: Record<IntelSignal['credibility'], number> = { low: 1, medium: 2, high: 3, verified: 4 };

export function JinyiweiScroll({ signals, onOpen }: { signals: IntelSignal[]; onOpen?: (id: string) => void }) {
  const now = Date.now();
  const headline = useMemo(() => pickHeadline(signals, now), [signals, now]);
  if (!headline) return null;

  const { signal, ceremony, lead } = headline;
  const urgent = ceremony === 'urgent';
  const stars = CRED_STARS[signal.credibility];
  const urls = signal.sources.filter((s) => s.url).length;

  return (
    <section className="relative flex justify-center px-2 py-3" data-testid="jinyiwei-scroll" aria-label="锦衣卫密报卷轴">
      <article className="relative w-full max-w-[720px]">
        {/* 卷轴两侧金轴 */}
        <span className="absolute -left-3 -top-1.5 -bottom-1.5 w-[22px] rounded-full" style={{ background: 'linear-gradient(90deg,#6E4F1C,#B98E3E 45%,#E7C877 55%,#7A5A22)', boxShadow: '0 8px 24px rgba(0,0,0,0.5),inset 0 0 6px rgba(0,0,0,0.4)' }} />
        <span className="absolute -right-3 -top-1.5 -bottom-1.5 w-[22px] rounded-full" style={{ background: 'linear-gradient(90deg,#6E4F1C,#B98E3E 45%,#E7C877 55%,#7A5A22)', boxShadow: '0 8px 24px rgba(0,0,0,0.5),inset 0 0 6px rgba(0,0,0,0.4)' }} />
        {/* 玉轴头 */}
        {['-top-4', '-bottom-4'].map((pos) => (
          <span key={pos} className={`absolute left-1/2 h-9 w-9 -translate-x-1/2 rounded-full ${pos}`} style={{ background: 'radial-gradient(circle at 36% 30%,#CFE7D8,#8DBBA6 55%,#4E7A66)', boxShadow: '0 6px 16px rgba(0,0,0,0.55),inset 0 -3px 6px rgba(20,50,40,0.5),inset 0 3px 5px rgba(255,255,255,0.5)' }} />
        ))}

        {/* 卷纸 */}
        <div
          className="relative overflow-hidden rounded-lg px-8 py-7 text-center sm:px-14"
          style={{
            background: 'linear-gradient(180deg,#F4E9CC,#E9D6AA)',
            borderTop: '3px solid #D8BE86',
            borderBottom: '3px solid #D8BE86',
            boxShadow: '0 30px 80px rgba(0,0,0,0.6),inset 0 0 60px rgba(155,58,77,0.06),inset 0 1px 0 rgba(255,255,255,0.5)',
          }}
        >
          {/* 云龙织锦金边 */}
          <span className="absolute inset-x-0 top-[3px] h-1.5" style={{ background: 'repeating-linear-gradient(90deg,rgba(155,58,77,0.5) 0 8px,rgba(212,168,75,0.55) 8px 16px)' }} />
          <span className="absolute inset-x-0 bottom-[3px] h-1.5" style={{ background: 'repeating-linear-gradient(90deg,rgba(155,58,77,0.5) 0 8px,rgba(212,168,75,0.55) 8px 16px)' }} />

          <div className="font-serif text-[12px] font-bold tracking-[0.4em] text-[#7A2233]/85">
            {urgent ? '八 百 里 加 急' : '今 日 要 情'}
          </div>
          <h1 className="mx-auto mt-3 max-w-[22ch] text-balance font-serif text-[clamp(22px,3.6vw,38px)] font-black leading-snug tracking-[0.03em] text-[#241206]">
            {signal.title}
          </h1>
          <div className="mt-2 font-serif text-[13px] tracking-[0.14em] text-[#7A2233]">锦衣卫呈报 · 展卷听裁</div>

          {/* 领先度：仅 urgent 且有真 lead 才渲染整行（brief 恒不渲染，不显“—”） */}
          {urgent && lead && (
            <div className="mt-3 inline-flex items-baseline gap-2 font-serif text-[#5a1f2b]">
              🕐 你比市场早 <span className="text-[25px] font-black text-[#7A2233]">{formatLead(lead.leadHours)}</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <span className="text-[15px] tracking-[2px] text-[#7A2233]" aria-label={`可信度 ${stars}/4`}>
              {'●'.repeat(stars)}
              <span className="text-[#7A2233]/25">{'●'.repeat(4 - stars)}</span>
            </span>
            <span className="font-serif text-[12px] text-[#7A2233]/80">
              {urls > 0 ? `${urls} 个公开源` : '来源核验中'}
            </span>
            <button
              type="button"
              onClick={() => onOpen?.(signal.id)}
              className="rounded-full border border-[#7A2233]/40 bg-white/25 px-5 py-2 font-serif text-[14px] text-[#7A2233] transition hover:bg-white/40"
            >
              展卷 · 阅全文
            </button>
          </div>

          {/* 朱砂封印 */}
          <div
            className="absolute right-5 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-lg font-serif text-[24px] font-black"
            style={{ transform: 'translateY(-50%) rotate(-7deg)', border: '2.5px solid #B02A2A', color: '#B02A2A', background: 'rgba(176,42,42,0.06)', boxShadow: '0 2px 8px rgba(176,42,42,0.25)' }}
          >
            锦
          </div>
        </div>
      </article>
    </section>
  );
}

function formatLead(hours: number): string {
  if (hours < 24) return `${hours} 小时`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return h > 0 ? `${d} 天 ${h} 时` : `${d} 天`;
}

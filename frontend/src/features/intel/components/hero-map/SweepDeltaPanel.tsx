import { Zap } from 'lucide-react';
import type { SweepDelta } from '../../lib/hero-map-view-model';

export function SweepDeltaPanel({ delta, source }: { delta: SweepDelta; source: 'turso' | 'fallback' }) {
  const items = [
    { label: '本轮新增', value: `+${delta.fresh}`, tone: '#F0C66A' },
    { label: '热信号', value: delta.hot, tone: '#F43F5E' },
    { label: '已核', value: delta.verified, tone: '#3DD68C' },
    { label: '区域', value: delta.regions, tone: '#6BA0FF' },
  ];

  return (
    <section
      data-testid="intel-sweep-delta"
      className="pointer-events-none absolute left-4 top-[54px] z-20 hidden w-[212px] rounded-lg border border-[#F0C66A]/16 bg-[#05070D]/72 p-3 font-mono shadow-[0_16px_48px_rgba(0,0,0,0.28)] backdrop-blur lg:block"
    >
      <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.18em] text-[#8F835F]">
        <span className="inline-flex items-center gap-1.5">
          <Zap size={11} />
          巡检变化
        </span>
        <span style={{ color: source === 'turso' ? '#3DD68C' : '#8A6A2A' }}>{delta.latestAtLabel}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {items.map((item) => (
          <div key={item.label} className="rounded border border-white/[0.07] bg-white/[0.025] px-2 py-1.5">
            <div className="text-[8px] uppercase tracking-[0.12em] text-[#5D668C]">{item.label}</div>
            <div className="mt-0.5 text-[14px] font-semibold" style={{ color: item.tone }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded border border-white/[0.07] bg-black/15 px-2 py-1.5">
        <div className="flex items-center justify-between gap-2 text-[8px] uppercase tracking-[0.14em] text-[#5D668C]">
          <span>来源</span>
          <span>{delta.sourceEdges}</span>
        </div>
        <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#BFC7DD]">
          {delta.topSignal?.title ?? '等待新情报信号接入。'}
        </div>
      </div>
    </section>
  );
}

import { Archive, BatteryCharging, Globe2, ScrollText } from 'lucide-react';

import type { IntelSignal } from '@/types/intel';

import type { JinyiweiAuxView } from '../lib/jinyiwei-brief-contract';
import { IndustryBoard } from './IndustryBoard';
import { IntelHeroMap } from './intel-hero-map';

const VIEW_OPTIONS: Array<{ id: JinyiweiAuxView; label: string; icon: typeof ScrollText }> = [
  { id: 'scroll', label: '密报卷轴', icon: ScrollText },
  { id: 'industry', label: '本产业情报', icon: BatteryCharging },
  { id: 'map', label: '世界地图', icon: Globe2 },
  { id: 'queue', label: '情报队列', icon: Archive },
];

export function JinyiweiViewTabs({ active, onChange }: { active: JinyiweiAuxView; onChange: (view: JinyiweiAuxView) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4" role="tablist" aria-label="锦衣卫中栏视图">
      {VIEW_OPTIONS.map(({ id, label, icon: Icon }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[10px] font-semibold transition"
            style={{
              borderColor: selected ? '#E0553A66' : 'rgba(255,255,255,0.08)',
              background: selected ? '#E0553A16' : 'rgba(255,255,255,0.025)',
              color: selected ? '#E88973' : '#7E86A8',
            }}
          >
            <Icon size={11} />{label}
          </button>
        );
      })}
    </div>
  );
}

function Queue({ signals, source, onSelect }: { signals: IntelSignal[]; source: 'turso' | 'fallback'; onSelect: (id: string) => void }) {
  return (
    <div className="h-full min-h-[520px] overflow-y-auto p-4" data-testid="jinyiwei-intel-queue">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">已采集情报队列</div>
        <span className="font-mono text-[9px] text-[#6A7299]">{signals.length} 条 · {source === 'turso' ? 'TURSO' : 'FALLBACK'}</span>
      </div>
      {source === 'fallback' && <div className="mb-3 rounded-lg border border-[#8A6A2A]/35 bg-[#8A6A2A]/10 px-3 py-2 text-[9px] leading-4 text-[#C8A85A]">当前队列为兜底样例，只供浏览，不代表真实情报库存。</div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {signals.map((signal) => (
          <button key={signal.id} type="button" onClick={() => onSelect(signal.id)} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-left transition hover:border-[#E0553A]/35">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[8px] text-[#E88973]">{signal.level.toUpperCase()}</span>
              <span className="text-[8px] text-[#6A7299]">{signal.regionLabel}</span>
            </div>
            <div className="mt-2 line-clamp-2 text-[11px] font-semibold leading-5 text-[#D9DDEB]">{signal.title}</div>
            <div className="mt-2 text-[8px] text-[#747D9B]">来源 URL：{signal.sources.filter((item) => Boolean(item.url)).length}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function JinyiweiAuxViews({
  view,
  signals,
  source,
  selectedId,
  onSelect,
}: {
  view: Exclude<JinyiweiAuxView, 'scroll'>;
  signals: IntelSignal[];
  source: 'turso' | 'fallback';
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (view === 'industry') return <IndustryBoard signals={signals} selectedId={selectedId} onSelect={(id) => id && onSelect(id)} />;
  if (view === 'map') return <IntelHeroMap signals={signals} source={source} height={560} />;
  return <Queue signals={signals} source={source} onSelect={onSelect} />;
}

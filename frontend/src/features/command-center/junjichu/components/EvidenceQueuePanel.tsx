import { JUNJICHU_PANEL_CLASS } from './panel-style';
import type { JunjichuPageView } from '../model/types';

export function EvidenceQueuePanel({ view }: { view: JunjichuPageView }) {
  const missing = view.evidence.missing.slice(0, 5);
  const border = view.evidence.blocking ? 'border-[#F58B8B]/42 bg-[#F58B8B]/[0.08]' : '';
  return (
    <section className={`${JUNJICHU_PANEL_CLASS} ${border}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F58B8B]">缺证队列</div>
        <span className="text-[10px] text-[#C6CEE6]">{missing.length} 项</span>
      </div>
      {missing.length ? (
        <div className="mt-2 space-y-1.5">
          {missing.map((item) => (
            <div key={item} className="rounded border border-[#F58B8B]/24 bg-black/20 px-2 py-1.5 text-[11px] leading-5 text-[#F5C0B8]">
              {item}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11.5px] leading-5 text-[#9AA3C4]">当前没有已上屏的阻断缺证；若质量门阻断，会在这里置顶。</p>
      )}
      {view.evidence.rerunScope && <p className="mt-2 text-[10.5px] text-[#B9F6D2]">补证后重跑：{view.evidence.rerunScope}</p>}
    </section>
  );
}

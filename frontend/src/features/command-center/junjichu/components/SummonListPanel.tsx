import { SourceLabelBadge } from './SourceLabelBadge';
import { JUNJICHU_PANEL_CLASS } from './panel-style';
import type { JunjichuPageView } from '../model/types';

const statusLabel = {
  summoned: '已表态',
  waiting: '等待',
  abstained: '弃权',
  not_applicable: '不适用',
};

export function SummonListPanel({ view }: { view: JunjichuPageView }) {
  const summons = view.summons.slice(0, 6);
  return (
    <section className={JUNJICHU_PANEL_CLASS}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F0C66A]">召集名单</div>
      <div className="mt-2 space-y-2">
        {summons.length ? summons.map((item) => (
          <div key={item.id} className="rounded border border-white/10 bg-white/[0.035] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-[#F5E9C9]">{item.name}</span>
              <span className="flex items-center gap-1.5">
                <span className="text-[9px] text-[#8F9BB2]">{statusLabel[item.status]}</span>
                <SourceLabelBadge label={item.sourceLabel} />
              </span>
            </div>
            {item.thesis && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#C6CEE6]">{item.thesis}</p>}
          </div>
        )) : (
          <p className="text-[11.5px] leading-5 text-[#9AA3C4]">待接案后显示六部、锦衣卫、钦天监或史馆参与状态。</p>
        )}
      </div>
    </section>
  );
}

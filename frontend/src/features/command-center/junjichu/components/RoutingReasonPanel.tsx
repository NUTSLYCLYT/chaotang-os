import { SourceLabelBadge } from './SourceLabelBadge';
import { JUNJICHU_PANEL_CLASS } from './panel-style';
import type { JunjichuPageView } from '../model/types';

export function RoutingReasonPanel({ view }: { view: JunjichuPageView }) {
  return (
    <section className={JUNJICHU_PANEL_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#AFC0FF]">丞相路由</div>
        <SourceLabelBadge label={view.routing.sourceLabel} />
      </div>
      <p className="mt-2 text-[11.5px] leading-5 text-[#D7DFF2]">{view.routing.reason}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(view.routing.recommendedDepartments.length ? view.routing.recommendedDepartments : ['待召集']).slice(0, 8).map((item) => (
          <span key={item} className="rounded-full border border-[#8AA4FF]/28 bg-[#8AA4FF]/[0.06] px-2 py-1 text-[10px] text-[#AFC0FF]">
            {item}
          </span>
        ))}
      </div>
      {view.routing.abstainedDepartments.length > 0 && (
        <div className="mt-2 text-[10.5px] leading-5 text-[#8F9BB2]">弃权：{view.routing.abstainedDepartments.join('、')}</div>
      )}
    </section>
  );
}

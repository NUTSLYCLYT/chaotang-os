import { ShangshufangRailPanel } from '@/features/shared/components/shangshufang-layout-shell';
import { ArchiveFlywheelPanel } from './ArchiveFlywheelPanel';
import { SourceLabelBadge } from './SourceLabelBadge';
import { SwarmRunPanel } from './SwarmRunPanel';
import { JUNJICHU_CARD_CLASS, JUNJICHU_PANEL_CLASS } from './panel-style';
import type { JunjichuPageView, SwarmRunMode } from '../model/types';

export function JunjichuRightRail({
  view,
  onStartSwarm,
  onRetrySwarm,
  onSearchSimilar,
}: {
  view: JunjichuPageView;
  onStartSwarm?: (mode: SwarmRunMode) => Promise<void> | void;
  onRetrySwarm?: () => Promise<void> | void;
  onSearchSimilar?: () => void;
}) {
  return (
    <ShangshufangRailPanel title="军机处审出了什么" subtitle={`大臣 ${view.stream.ministersCount} · 蜂群 ${view.stream.groupsCount} · 风险 ${view.stream.risksCount}`} accent="#F0C66A">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            ['大臣', view.stream.ministersCount],
            ['蜂群', view.stream.groupsCount],
            ['风险', view.stream.risksCount],
          ].map(([label, value]) => (
            <div key={label} className={`${JUNJICHU_CARD_CLASS} px-2 py-2`}>
              <div className="text-[9px] uppercase tracking-[0.16em] text-[#7C86A6]">{label}</div>
              <div className="mt-1 text-[18px] font-semibold text-[#F5E9C9]">{value}</div>
            </div>
          ))}
        </div>

        <section className={JUNJICHU_PANEL_CLASS}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F0C66A]">六部表态</div>
          <div className="mt-2 space-y-2">
            {view.council.ministers.length ? view.council.ministers.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded border border-[#F0C66A]/20 bg-black/24 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[#F5E9C9]">{item.name}</span>
                  <SourceLabelBadge label={item.sourceLabel} />
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#C6CEE6]">{item.thesis ?? '等待表态'}</p>
              </div>
            )) : (
              <p className="text-[11.5px] leading-6 text-[#9AA3C4]">待接案后显示六部意见。</p>
            )}
          </div>
        </section>

        <section className={JUNJICHU_PANEL_CLASS}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F58B8B]">冲突与风险</div>
          <div className="mt-2 space-y-2">
            {[...view.council.conflicts, ...view.council.risks].slice(0, 5).map((item) => (
              <div key={item} className="rounded border border-[#F58B8B]/24 bg-[#F58B8B]/[0.055] px-2.5 py-2 text-[11px] leading-5 text-[#F5C0B8]">
                {item}
              </div>
            ))}
            {!view.council.conflicts.length && !view.council.risks.length && (
              <p className="text-[11.5px] leading-6 text-[#9AA3C4]">暂无真实风险回写。</p>
            )}
          </div>
        </section>

        <SwarmRunPanel view={view} onStart={onStartSwarm} onRetry={onRetrySwarm} />
        <ArchiveFlywheelPanel view={view} onSearchSimilar={onSearchSimilar} />
      </div>
    </ShangshufangRailPanel>
  );
}

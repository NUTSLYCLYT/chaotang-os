import { JUNJICHU_PANEL_CLASS } from './panel-style';
import type { JunjichuPageView } from '../model/types';

export function ArchiveFlywheelPanel({
  view,
  onSearchSimilar,
}: {
  view: JunjichuPageView;
  onSearchSimilar?: () => void;
}) {
  const available = view.actions.archive.enabled;
  return (
    <section className={`${JUNJICHU_PANEL_CLASS} ${available ? '' : 'opacity-70'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F0C66A]">史馆飞轮</div>
        <span className="text-[9px] text-[#8F9BB2]">{view.archive.archived ? '已归档' : '未归档'}</span>
      </div>
      <div className="mt-2 grid gap-1.5 text-[11.5px] leading-5 text-[#C6CEE6]">
        <div>归档：{available ? view.actions.archive.label : '裁决后开放'}</div>
        <div>复盘：{view.archive.retrospectiveStatus === 'hidden' ? '待裁决' : view.archive.retrospectiveStatus}</div>
        <div>知识回流：{view.archive.knowledgeFeedbackStatus === 'hidden' ? '待裁决' : view.archive.knowledgeFeedbackStatus}</div>
      </div>
      {view.archive.similarCases.length > 0 && (
        <div className="mt-2 space-y-1">
          {view.archive.similarCases.slice(0, 3).map((item) => (
            <div key={item} className="rounded border border-white/10 bg-white/[0.035] px-2 py-1.5 text-[10.5px] text-[#9AA3C4]">
              {item}
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={!view.caseIdentity.taskId}
        onClick={onSearchSimilar}
        className="mt-3 w-full rounded-md border border-[#F0C66A]/30 px-2 py-1.5 text-[10.5px] text-[#F0C66A] disabled:cursor-not-allowed disabled:opacity-45"
      >
        搜相似旧案
      </button>
    </section>
  );
}

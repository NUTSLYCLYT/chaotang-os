import { SourceLabelBadge } from './SourceLabelBadge';
import { JUNJICHU_PANEL_CLASS } from './panel-style';
import type { JunjichuPageView } from '../model/types';

export function CaseIdentityPanel({ view }: { view: JunjichuPageView }) {
  const { caseIdentity } = view;
  return (
    <section className={JUNJICHU_PANEL_CLASS}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F0C66A]">接案</div>
          <div className="mt-1 line-clamp-2 text-[15px] font-semibold text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>
            {caseIdentity.title}
          </div>
        </div>
        <SourceLabelBadge label={view.sourceLabel} />
      </div>
      <div className="mt-3 grid gap-2 text-[11px] leading-5 text-[#C6CEE6]">
        <div className="flex justify-between gap-2">
          <span className="text-[#7C86A6]">taskId</span>
          <span className="truncate text-right text-[#D7DFF2]">{caseIdentity.taskId ?? '待接案'}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[#7C86A6]">阶段</span>
          <span className="text-[#F0C66A]">{view.stage}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[#7C86A6]">状态</span>
          <span>{caseIdentity.status ?? (caseIdentity.taskId ? '会审中' : '未立案')}</span>
        </div>
      </div>
      {caseIdentity.rawCommand && (
        <p className="mt-3 line-clamp-3 text-[11.5px] leading-5 text-[#9AA3C4]">{caseIdentity.rawCommand}</p>
      )}
    </section>
  );
}

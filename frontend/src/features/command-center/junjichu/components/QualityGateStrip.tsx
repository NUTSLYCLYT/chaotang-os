import { SourceLabelBadge } from './SourceLabelBadge';
import { JUNJICHU_PANEL_CLASS } from './panel-style';
import type { JunjichuPageView } from '../model/types';

const gateCopy = {
  idle: { label: '待质量门', tone: '#8F9BB2' },
  passed: { label: '质量门通过', tone: '#3DD68C' },
  warning: { label: '带警告可裁', tone: '#F0C66A' },
  blocked: { label: '质量门阻断', tone: '#F58B8B' },
};

export function QualityGateStrip({ view }: { view: JunjichuPageView }) {
  const copy = gateCopy[view.gate.status];
  const reasons = view.gate.status === 'blocked' ? view.gate.blockingReasons : view.gate.warnings;
  return (
    <section className={JUNJICHU_PANEL_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: copy.tone }}>
            {copy.label}
          </span>
          <SourceLabelBadge label={view.gate.sourceLabel} />
        </div>
        <span className="text-[10px] text-[#9AA3C4]">{view.gate.canAdopt ? '允许进入裁决' : '不可采纳'}</span>
      </div>
      <div className="mt-2 grid gap-1.5 text-[11.5px] leading-5 text-[#C6CEE6]">
        {reasons.length ? reasons.slice(0, 4).map((item) => <div key={item}>- {item}</div>) : (
          <div>{view.gate.status === 'passed' ? '证据链、来源和风险均满足当前裁决条件。' : '等待真实质量结果或会审输出。'}</div>
        )}
      </div>
      {view.gate.requiresHumanConfirmation && (
        <div className="mt-2 rounded border border-[#F0C66A]/28 bg-[#F0C66A]/[0.06] px-2 py-1.5 text-[10.5px] text-[#F0C66A]">
          需要人工确认后才能采纳。
        </div>
      )}
    </section>
  );
}

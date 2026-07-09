import { JUNJICHU_PANEL_CLASS } from './panel-style';
import type { JunjichuPageView } from '../model/types';

export function GovernanceGatePanel({
  view,
  onProceed,
}: {
  view: JunjichuPageView;
  onProceed?: () => void;
}) {
  const waiting = view.governance.waiting;
  return (
    <section className={`${JUNJICHU_PANEL_CLASS} ${waiting ? 'border-[#F0C66A]/45 bg-[#F0C66A]/[0.07]' : ''}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F0C66A]">人工门</div>
      <p className="mt-2 text-[11.5px] leading-5 text-[#C6CEE6]">
        {waiting ? (view.governance.reason ?? '后端正在等待圣裁放行。') : '当前没有治理门、approval 或 OpenClaw 等待态。'}
      </p>
      <p className="mt-1 text-[10.5px] leading-5 text-[#9AA3C4]">
        {waiting ? (view.governance.nextAfterProceed ?? '放行后继续军机处会审。') : '若后端进入等待态，这里会明确显示为什么卡住。'}
      </p>
      <button
        type="button"
        disabled={!view.actions.proceed.enabled}
        onClick={onProceed}
        className="mt-3 w-full rounded-md border border-[#F0C66A]/40 bg-[#F0C66A]/[0.08] px-3 py-1.5 text-[11px] font-semibold text-[#F0C66A] disabled:cursor-not-allowed disabled:opacity-45"
        title={view.actions.proceed.disabledReason}
      >
        {view.actions.proceed.label}
      </button>
    </section>
  );
}

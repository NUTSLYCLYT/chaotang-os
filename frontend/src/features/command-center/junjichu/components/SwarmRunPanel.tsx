'use client';

import { useState } from 'react';
import { SourceLabelBadge } from './SourceLabelBadge';
import { JUNJICHU_PANEL_CLASS } from './panel-style';
import type { JunjichuPageView, SwarmRunMode } from '../model/types';

export function SwarmRunPanel({
  view,
  onStart,
  onRetry,
}: {
  view: JunjichuPageView;
  onStart?: (mode: SwarmRunMode) => Promise<void> | void;
  onRetry?: () => Promise<void> | void;
}) {
  const [pending, setPending] = useState(false);
  const run = view.swarmRun;

  async function start(mode: SwarmRunMode) {
    if (!onStart) return;
    setPending(true);
    try {
      await onStart(mode);
    } finally {
      setPending(false);
    }
  }

  async function retry() {
    if (!onRetry) return;
    setPending(true);
    try {
      await onRetry();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={JUNJICHU_PANEL_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8BE4B4]">蜂群产线</div>
        {run ? <SourceLabelBadge label={run.sourceLabel} /> : <span className="text-[9px] text-[#8F9BB2]">未启动</span>}
      </div>
      {run ? (
        <div className="mt-2 space-y-2">
          <div className="rounded border border-[#3DD68C]/24 bg-[#3DD68C]/[0.05] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-[#D7DFF2]">{run.id}</span>
              <span className="text-[#8AE4B4]">{run.status}</span>
            </div>
            <div className="mt-1 text-[10px] text-[#9AA3C4]">mode: {run.mode}</div>
          </div>
          {run.taskRuns.slice(0, 4).map((task) => (
            <div key={task.id} className="rounded border border-white/10 bg-white/[0.035] px-2 py-1.5 text-[11px]">
              <div className="flex justify-between gap-2">
                <span className="truncate text-[#F5E9C9]">{task.name}</span>
                <span className="text-[#9AA3C4]">{task.status}</span>
              </div>
              {task.summary && <p className="mt-1 line-clamp-2 text-[#C6CEE6]">{task.summary}</p>}
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending || !run.briefUrl}
              className="rounded-md border border-[#8AA4FF]/30 px-2 py-1.5 text-[10.5px] text-[#AFC0FF] disabled:opacity-45"
            >
              查看 brief
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void retry()}
              className="rounded-md border border-[#F0C66A]/35 px-2 py-1.5 text-[10.5px] text-[#F0C66A] disabled:opacity-45"
            >
              重跑失败蜂群
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-[11.5px] leading-5 text-[#9AA3C4]">尚未启动后端蜂群产线。本地推演不会在这里冒充真实 run。</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!view.actions.startSwarm.enabled || pending}
              title={view.actions.startSwarm.disabledReason}
              onClick={() => void start('deep')}
              className="rounded-md border border-[#8AA4FF]/30 bg-[#8AA4FF]/[0.06] px-2 py-1.5 text-[10.5px] text-[#AFC0FF] disabled:cursor-not-allowed disabled:opacity-45"
            >
              启动深审
            </button>
            <button
              type="button"
              disabled={!view.actions.startSwarm.enabled || pending}
              title={view.actions.startSwarm.disabledReason}
              onClick={() => void start('live_swarm')}
              className="rounded-md border border-[#3DD68C]/30 bg-[#3DD68C]/[0.06] px-2 py-1.5 text-[10.5px] text-[#8AE4B4] disabled:cursor-not-allowed disabled:opacity-45"
            >
              LIVE 蜂群
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

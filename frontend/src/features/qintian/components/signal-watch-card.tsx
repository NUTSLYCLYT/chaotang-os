'use client';

/**
 * 钦天监 · 主动信号观察卡（2026-07-04）
 *
 * "check-on-render"：户部/工部工作台挂载时才检查，不接后台 cron(本仓无 cron，见
 * use-signal-watch.ts 顶注)。展示 + 可关闭(按 id 记忆，见该 hook)，不是新通知子系统——
 * 一个 hook + 一个卡片组件，仅此而已。
 */
import { X, Telescope } from 'lucide-react';
import { useNewEnergySignalWatch } from '@/features/qintian/hooks/use-signal-watch';

export function QintianSignalWatchCard({ relevanceHint }: { relevanceHint: string }) {
  const { visible, dismiss } = useNewEnergySignalWatch();
  if (visible.length === 0) return null;

  return (
    <div className="mb-3 space-y-1.5">
      {visible.map((s) => (
        <div
          key={s.id}
          className="hud-corner flex items-start justify-between gap-2 rounded-[10px] border px-3 py-2 text-[12px]"
          style={{ borderColor: '#B794F433', background: 'linear-gradient(180deg,#B794F412 0%,rgba(6,8,14,0.9) 100%)' }}
        >
          <div className="flex min-w-0 items-start gap-1.5">
            <Telescope size={13} className="mt-0.5 shrink-0" style={{ color: '#B794F4' }} />
            <span className="min-w-0">
              <span style={{ color: '#B794F4' }}>钦天监观察到：</span>
              <span className="text-[#E9DDBE]">{s.title}</span>
              <span className="text-[#9aa0ad]"> — 可能影响{relevanceHint}</span>
            </span>
          </div>
          <button
            onClick={() => dismiss(s.id)}
            aria-label="关闭此提示"
            className="shrink-0 text-[#8f835f] transition hover:text-[#F5E9C9]"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

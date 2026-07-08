'use client';

/**
 * 飞鸽传书 · Carrier Dove
 *
 * 挂在情报页右上角的浮动胶囊，展示"最新密报"
 * 和一个脉动飞鸽徽标。点击即选中该信号，抽屉打开详情。
 *
 * 这是锦衣卫页面的 signature 钩子之一：让"新情报进来"
 * 被动可感知，不打扰注意力主线。
 */

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store/app-store';
import type { IntelSignal } from '@/types/intel';

interface Props {
  signals: IntelSignal[];
}

const LEVEL_COLOR: Record<string, string> = {
  critical: '#EF4444',
  warning: '#F0C66A',
  watch: '#6BA0FF',
  info: '#6A7299',
};

export function CarrierDove({ signals }: Props) {
  const selectSignal = useAppStore((s) => s.selectSignal);

  const latest = useMemo<IntelSignal | null>(() => {
    if (!signals.length) return null;
    return [...signals].sort((a, b) => {
      const ta = new Date(a.lastUpdatedAt || a.firstSeenAt).getTime();
      const tb = new Date(b.lastUpdatedAt || b.firstSeenAt).getTime();
      return tb - ta;
    })[0]!;
  }, [signals]);

  if (!latest) return null;

  const color = LEVEL_COLOR[latest.level] ?? '#6A7299';
  const shortTitle = latest.title.length > 18 ? `${latest.title.slice(0, 18)}…` : latest.title;

  return (
    <button
      type="button"
      onClick={() => selectSignal(latest.id)}
      className="group flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] transition-all hover:-translate-y-0.5"
      style={{
        borderColor: `${color}55`,
        background: `linear-gradient(90deg, ${color}1A, transparent)`,
        boxShadow: `0 0 16px ${color}22`,
      }}
      title={`最新密报：${latest.title} · ${latest.regionLabel}`}
    >
      <span
        className="relative inline-flex shrink-0 animate-[doveBob_2.8s_ease-in-out_infinite]"
        aria-hidden
      >
        <span
          className="absolute inset-0 animate-ping rounded-full"
          style={{ background: color, opacity: 0.45 }}
        />
        <span className="relative text-[14px]">🕊</span>
      </span>
      <span className="uppercase tracking-[0.18em]" style={{ color, fontSize: 9 }}>
        飞鸽传书
      </span>
      <span className="text-[#EAEEFB]">{shortTitle}</span>
      <span className="text-[9px] text-[#6A7299]">{latest.regionLabel}</span>

      <style jsx>{`
        @keyframes doveBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
      `}</style>
    </button>
  );
}

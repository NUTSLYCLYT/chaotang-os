'use client';

/**
 * 全局朝堂脉搏条 · Global Pulse Strip
 *
 * 所有 (dashboard)/* 页面底部统一挂一条脉搏。基于 useCourtPulse
 * 聚合计数（非原始数组），与 throne 的 PulseTicker 并行不冲突。
 */

import { useEffect, useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import type { CourtPulse } from '@/features/shared/hooks/use-court-pulse';

interface Props {
  pulse: CourtPulse;
}

interface Line {
  id: string;
  text: string;
  color: string;
}

export function GlobalPulseStrip({ pulse }: Props) {
  const lines: Line[] = useMemo(() => {
    const out: Line[] = [];
    if (!pulse.loading && pulse.source === 'degraded') {
      out.push({
        id: 'court-pulse-soft',
        text: '外廷回声偏弱 · 可先下旨 · 丞相稍后补证',
        color: '#F5A524',
      });
    }
    if (pulse.runningTasks > 0) {
      out.push({
        id: 'running',
        text: `${pulse.runningTasks} 路正在办理 · 六部协同`,
        color: '#3DD68C',
      });
    }
    if (pulse.pendingReviews > 0) {
      out.push({
        id: 'pending',
        text: `${pulse.pendingReviews} 份呈报恭候御批`,
        color: '#F0C66A',
      });
    }
    if (pulse.criticalSignals > 0) {
      out.push({
        id: 'critical',
        text: `锦衣卫急报 · ${pulse.criticalSignals} 条待处置`,
        color: '#F43F5E',
      });
    }
    if (pulse.warningSignals > 0) {
      out.push({
        id: 'warning',
        text: `${pulse.warningSignals} 条警讯已收录 · 可巡视锦衣卫`,
        color: '#F5A524',
      });
    }
    if (pulse.totalTasks > 0) {
      out.push({
        id: 'archive',
        text: `史馆在录 · 往例可鉴`,
        color: '#6BA0FF',
      });
    }
    if (out.length === 0) {
      out.push({
        id: 'quiet',
        text: '朝堂清明 · 六部安好 · 无急务',
        color: '#6BA0FF',
      });
    }
    return out;
  }, [pulse]);

  const [cursor, setCursor] = useState(0);
  useEffect(() => {
    if (lines.length <= 1) return;
    const id = setInterval(() => {
      setCursor((c) => (c + 1) % lines.length);
    }, 4200);
    return () => clearInterval(id);
  }, [lines.length]);

  const current = lines[cursor % lines.length];
  if (!current) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex h-8 flex-shrink-0 items-center justify-center gap-3 border-t px-4 text-[11px] md:px-6"
      style={{
        borderColor: 'rgba(26, 33, 66, 0.8)',
        background: 'linear-gradient(90deg, rgba(10,8,4,0.8), rgba(20,16,8,0.7), rgba(10,8,4,0.8))',
        backdropFilter: 'blur(10px)',
      }}
    >
      <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
        <span
          className="absolute inset-0 animate-ping rounded-full"
          style={{ background: current.color, opacity: 0.6 }}
        />
        <span
          className="relative inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: current.color }}
        />
      </span>
      <Activity size={10} className="shrink-0 text-[#6A7299]" />
      <span className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">
        朝堂脉搏
      </span>
      <span className="text-[#484F72]">·</span>
      <span
        key={current.id}
        className="animate-[stripFade_.5s_ease-out] truncate"
        style={{ color: current.color }}
      >
        {current.text}
      </span>
      <div className="absolute right-4 hidden items-center gap-1 sm:flex md:right-6">
        {lines.map((_, i) => (
          <span
            key={i}
            className="h-0.5 w-3 rounded-full transition-colors"
            style={{
              background: i === cursor % lines.length ? current.color : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes stripFade {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

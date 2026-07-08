/**
 * AlertCard — 风险警报卡
 *
 * 锦衣卫捕获的风险信号的通用展示
 */

import { AlertTriangle, ChevronRight, Flame, Shield } from 'lucide-react';
import type { IntelSignal, IntelLevel } from '@/types/intel';

export interface AlertCardProps {
  signal: IntelSignal;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
}

const LEVEL_STYLE: Record<
  IntelLevel,
  { label: string; color: string; Icon: typeof AlertTriangle }
> = {
  info: { label: '情报', color: '#60A5FA', Icon: Shield },
  watch: { label: '关注', color: '#F0C66A', Icon: Shield },
  warning: { label: '警报', color: '#F5A524', Icon: AlertTriangle },
  critical: { label: '危急', color: '#F43F5E', Icon: Flame },
};

export function AlertCard({ signal, onClick, selected, compact }: AlertCardProps) {
  const style = LEVEL_STYLE[signal.level];
  const Icon = style.Icon;
  const forcePulse = signal.level === 'critical';

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`group cursor-pointer rounded-lg border p-${compact ? '2.5' : '3'} transition-all hover:bg-white/[0.03] ${
        forcePulse ? 'animate-breathe' : ''
      }`}
      style={{
        borderColor: selected ? `${style.color}aa` : `${style.color}55`,
        backgroundColor: selected ? `${style.color}14` : 'rgba(10, 14, 30, 0.4)',
      }}
    >
      {/* 顶部 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon size={11} style={{ color: style.color }} strokeWidth={2.2} />
          <span
            className="text-[9px] font-bold uppercase tracking-wider"
            style={{ color: style.color }}
          >
            {style.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {signal.impactScore !== undefined && (
            <span className="font-mono text-[9px]" style={{ color: style.color }}>
              {signal.impactScore}
            </span>
          )}
          <ChevronRight
            size={11}
            className="text-[#484F72] transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </div>

      {/* 标题 */}
      <h4 className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight text-[#EAEEFB]">
        {signal.title}
      </h4>

      {/* 摘要 */}
      {!compact && (
        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-[#9AA3C4]">
          {signal.summary}
        </p>
      )}

      {/* 元数据 */}
      <div className="mt-2 flex items-center gap-1.5 text-[9px]">
        <span
          className="rounded px-1 py-0.5 font-mono"
          style={{ backgroundColor: 'rgba(26, 33, 66, 0.6)', color: '#9AA3C4' }}
        >
          {signal.regionLabel}
        </span>
        <span className="text-[#6A7299]">· {signal.industry}</span>
      </div>
    </div>
  );
}

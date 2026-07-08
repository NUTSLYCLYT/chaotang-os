/**
 * 锦衣卫 · 信号简讯条（紧凑行，用于左栏预警列表 + 地图下钻列表）
 *
 * 每条含：等级色标 + 标题 + 可信度点 + 时效标记
 */

'use client';

import { useMemo } from 'react';
import { ShieldAlert, TrendingUp, Minus } from 'lucide-react';
import type { IntelSignal, IntelCredibility, IntelLevel } from '@/types/intel';

const LEVEL_DOT: Record<IntelLevel, string> = {
  info: '#60A5FA',
  watch: '#F0C66A',
  warning: '#F5A524',
  critical: '#F43F5E',
};

const CRED_DOTS: Record<IntelCredibility, number> = {
  low: 1,
  medium: 2,
  high: 3,
  verified: 4,
};

const CRED_COLOR: Record<IntelCredibility, string> = {
  low: '#6A7299',
  medium: '#60A5FA',
  high: '#3DD68C',
  verified: '#F0C66A',
};

function hoursAgo(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export interface SignalFeedCompactProps {
  signals: IntelSignal[];
  onSelect: (s: IntelSignal) => void;
  activeId?: string | null;
  maxItems?: number;
}

export function SignalFeedCompact({
  signals,
  onSelect,
  activeId,
  maxItems = 6,
}: SignalFeedCompactProps) {
  const visible = signals.slice(0, maxItems);
  const hidden = Math.max(signals.length - visible.length, 0);

  return (
    <div className="space-y-1">
      {visible.map((s) => {
        const isActive = s.id === activeId;
        const credDots = CRED_DOTS[s.credibility];
        const credColor = CRED_COLOR[s.credibility];
        const age = hoursAgo(s.lastUpdatedAt);

        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s)}
            className={`group relative flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-all ${
              isActive
                ? 'border-[#D4A84B]/40 bg-[#D4A84B]/[0.08]'
                : 'border-transparent hover:border-[#D4A84B]/20 hover:bg-[#D4A84B]/[0.04]'
            }`}
          >
            {/* 等级色点 */}
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: LEVEL_DOT[s.level] }}
            />

            {/* 内容 */}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-medium text-[#EAEEFB] group-hover:text-[#F5E9C9]">
                {s.title}
              </span>
              <span className="mt-0.5 flex items-center gap-2 text-[9px] text-[#6A7299]">
                <span>{s.regionLabel}</span>
                <span>·</span>
                <span>{age}</span>
              </span>
            </span>

            {/* 可信度点 */}
            <span className="flex shrink-0 gap-0.5">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1 rounded-sm"
                  style={{
                    backgroundColor: i <= credDots ? credColor : 'rgba(26,33,66,0.6)',
                  }}
                />
              ))}
            </span>
          </button>
        );
      })}
      {hidden > 0 && (
        <div className="px-2 pt-1 text-[9px] tracking-[0.08em] text-[#484F72]">
          另 {hidden} 条信号折叠
        </div>
      )}
    </div>
  );
}

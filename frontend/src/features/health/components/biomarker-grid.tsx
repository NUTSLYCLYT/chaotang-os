/**
 * 健康中心 · 体检指标格栅
 *
 * 每项指标一张卡：名称 + 数值 + 参考范围 + 状态 + 趋势 + mini sparkline
 */

'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { HealthMetric, MetricStatus, MetricTrend } from '@/types/health';

const STATUS_STYLE: Record<MetricStatus, { label: string; color: string }> = {
  normal: { label: '正常', color: '#3DD68C' },
  abnormal_high: { label: '偏高', color: '#F5A524' },
  abnormal_low: { label: '偏低', color: '#60A5FA' },
  borderline: { label: '临界', color: '#F0C66A' },
};

const TREND_ICON: Record<MetricTrend, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  stable: Minus,
};

export interface BiomarkerGridProps {
  metrics: HealthMetric[];
}

export function BiomarkerGrid({ metrics }: BiomarkerGridProps) {
  return (
    <GlassPanel tone="elevated" padding="md">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">
            Biomarker Panel
          </div>
          <h3 className="text-[13px] font-bold text-[#EAEEFB]">体检指标 · {metrics.length} 项</h3>
        </div>
        <div className="flex items-center gap-3 font-mono text-[9px]">
          {(['normal', 'borderline', 'abnormal_high'] as MetricStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: STATUS_STYLE[s].color }}
              />
              <span style={{ color: STATUS_STYLE[s].color }}>{STATUS_STYLE[s].label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <MetricCard key={m.code} metric={m} />
        ))}
      </div>
    </GlassPanel>
  );
}

function MetricCard({ metric }: { metric: HealthMetric }) {
  const style = STATUS_STYLE[metric.status];
  const TrendIcon = metric.trend ? TREND_ICON[metric.trend] : Minus;
  const trendColor =
    metric.trend === 'up'
      ? metric.status === 'abnormal_high' || metric.status === 'borderline'
        ? '#F5A524'
        : '#3DD68C'
      : metric.trend === 'down'
        ? metric.status === 'abnormal_high'
          ? '#3DD68C'
          : '#60A5FA'
        : '#9AA3C4';

  return (
    <div
      className="relative overflow-hidden rounded-lg border p-3"
      style={{
        borderColor: `${style.color}40`,
        backgroundColor: 'rgba(10, 14, 30, 0.5)',
      }}
    >
      {/* 左侧状态竖线 */}
      <div
        className="absolute bottom-0 left-0 top-0 w-[3px]"
        style={{ backgroundColor: style.color, boxShadow: `0 0 8px ${style.color}` }}
      />

      <div className="ml-2">
        {/* 顶部：代号 + 趋势 */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-wider text-[#6A7299]">
            {metric.code}
          </span>
          <div
            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px]"
            style={{
              backgroundColor: `${trendColor}15`,
              color: trendColor,
            }}
          >
            <TrendIcon size={8} strokeWidth={2.5} />
          </div>
        </div>

        {/* 中文名 */}
        <div className="mt-1 text-[11px] font-medium text-[#EAEEFB]">{metric.name}</div>

        {/* 数值 + 单位 */}
        <div className="mt-1.5 flex items-baseline gap-1">
          <span
            className="font-mono text-[22px] font-bold"
            style={{ color: style.color }}
          >
            {metric.value}
          </span>
          <span className="text-[10px] text-[#6A7299]">{metric.unit}</span>
        </div>

        {/* 参考范围 + 状态 */}
        <div className="mt-1 flex items-center justify-between text-[9px]">
          <span className="font-mono text-[#484F72]">ref {metric.referenceRange}</span>
          <span style={{ color: style.color }}>{style.label}</span>
        </div>

        {/* Sparkline */}
        {metric.trendSeries && metric.trendSeries.length > 1 && (
          <Sparkline values={metric.trendSeries} color={style.color} />
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   Sparkline —— 迷你折线图
   ========================================================================== */

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 110;
  const H = 22;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x},${y}`;
    })
    .join(' ');

  const lastX = ((values.length - 1) / (values.length - 1)) * W;
  const lastY = H - ((values[values.length - 1]! - min) / range) * H;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="mt-2 w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`spark-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* 面积 */}
      <polyline
        points={`0,${H} ${points} ${W},${H}`}
        fill={`url(#spark-${color})`}
        stroke="none"
      />
      {/* 折线 */}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      {/* 末端点 */}
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}

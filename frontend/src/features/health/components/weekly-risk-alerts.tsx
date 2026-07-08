/**
 * 健康中心 · 本周风险提示
 */

'use client';

import { AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { HealthAlert, HealthRiskLevel } from '@/types/health';

const LEVEL_STYLE: Record<
  HealthRiskLevel,
  { label: string; color: string; bg: string; Icon: typeof AlertCircle }
> = {
  normal: {
    label: '正常',
    color: '#3DD68C',
    bg: 'rgba(61, 214, 140, 0.1)',
    Icon: CheckCircle2,
  },
  watch: {
    label: '关注',
    color: '#F0C66A',
    bg: 'rgba(240, 198, 106, 0.1)',
    Icon: TrendingUp,
  },
  warning: {
    label: '警戒',
    color: '#F5A524',
    bg: 'rgba(245, 165, 36, 0.1)',
    Icon: AlertCircle,
  },
  danger: {
    label: '危急',
    color: '#F43F5E',
    bg: 'rgba(244, 63, 94, 0.12)',
    Icon: AlertCircle,
  },
};

export interface WeeklyRiskAlertsProps {
  alerts: HealthAlert[];
}

export function WeeklyRiskAlerts({ alerts }: WeeklyRiskAlertsProps) {
  const actionable = alerts.filter((a) => a.actionRequired).length;

  return (
    <GlassPanel tone="elevated" padding="md" hudCorners className="h-full">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">
            Weekly Health Alerts
          </div>
          <h3 className="text-[13px] font-bold text-[#EAEEFB]">本周提示</h3>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-[20px] font-bold text-[#F5A524]">{actionable}</span>
          <span className="text-[10px] text-[#6A7299]">/ {alerts.length}</span>
        </div>
      </div>

      <div className="space-y-2">
        {alerts.length === 0 && (
          <div className="py-4 text-center text-[10px] text-[#484F72]">本周无提示</div>
        )}
        {alerts.map((alert) => {
          const style = LEVEL_STYLE[alert.level];
          const Icon = style.Icon;
          return (
            <div
              key={alert.id}
              className="rounded-md border p-2.5"
              style={{
                borderColor: `${style.color}40`,
                backgroundColor: style.bg,
              }}
            >
              <div className="flex items-start gap-2">
                <Icon
                  size={13}
                  style={{ color: style.color }}
                  strokeWidth={2}
                  className="mt-0.5 flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[12px] font-medium text-[#EAEEFB]">{alert.title}</h4>
                    {alert.actionRequired && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-semibold"
                        style={{
                          backgroundColor: 'rgba(245, 165, 36, 0.15)',
                          color: '#F5A524',
                        }}
                      >
                        需关注
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-0.5 text-[10px] leading-relaxed"
                    style={{ color: '#9AA3C4' }}
                  >
                    {alert.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

/**
 * 健康中心 · 风险分层
 *
 * 4 级分层统计：正常 / 关注 / 警戒 / 危急
 * 数据从 metrics + alerts 推导
 */

'use client';

import { GlassPanel } from '@/components/ui/glass-panel';
import type { HealthMetric, HealthAlert, HealthRiskLevel } from '@/types/health';

export interface RiskStratificationProps {
  metrics: HealthMetric[];
  alerts: HealthAlert[];
}

interface Tier {
  key: HealthRiskLevel;
  label: string;
  sub: string;
  color: string;
  count: number;
}

export function RiskStratification({ metrics, alerts }: RiskStratificationProps) {
  // 从 metrics + alerts 聚合
  const normal =
    metrics.filter((m) => m.status === 'normal').length +
    alerts.filter((a) => a.level === 'normal').length;
  const watch =
    metrics.filter((m) => m.status === 'borderline').length +
    alerts.filter((a) => a.level === 'watch').length;
  const warning =
    metrics.filter((m) => m.status === 'abnormal_high' || m.status === 'abnormal_low').length +
    alerts.filter((a) => a.level === 'warning').length;
  const danger = alerts.filter((a) => a.level === 'danger').length;

  const tiers: Tier[] = [
    { key: 'normal', label: '正常', sub: 'Normal', color: '#3DD68C', count: normal },
    { key: 'watch', label: '关注', sub: 'Watch', color: '#F0C66A', count: watch },
    { key: 'warning', label: '警戒', sub: 'Warning', color: '#F5A524', count: warning },
    { key: 'danger', label: '危急', sub: 'Danger', color: '#F43F5E', count: danger },
  ];

  const total = tiers.reduce((acc, t) => acc + t.count, 0);

  return (
    <GlassPanel tone="elevated" padding="md" className="h-full">
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">
          Risk Stratification
        </div>
        <h3 className="text-[13px] font-bold text-[#EAEEFB]">风险分层</h3>
      </div>

      {/* 四段柱 */}
      <div className="mb-4 flex h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(26, 33, 66, 0.8)' }}>
        {tiers.map((tier) => {
          if (tier.count === 0) return null;
          const pct = (tier.count / Math.max(1, total)) * 100;
          return (
            <div
              key={tier.key}
              style={{
                width: `${pct}%`,
                backgroundColor: tier.color,
                boxShadow: `0 0 8px ${tier.color}66`,
              }}
            />
          );
        })}
      </div>

      {/* 4 列数字 */}
      <div className="grid grid-cols-4 gap-2">
        {tiers.map((tier) => {
          const isZero = tier.count === 0;
          return (
            <div
              key={tier.key}
              className="rounded-md border p-2 text-center"
              style={{
                borderColor: isZero ? 'rgba(26, 33, 66, 0.6)' : `${tier.color}40`,
                backgroundColor: isZero ? 'transparent' : `${tier.color}10`,
              }}
            >
              <div
                className="font-mono text-[20px] font-bold"
                style={{ color: isZero ? '#484F72' : tier.color }}
              >
                {tier.count}
              </div>
              <div
                className="text-[10px] font-medium"
                style={{ color: isZero ? '#484F72' : tier.color }}
              >
                {tier.label}
              </div>
              <div className="font-mono text-[8px] text-[#484F72]">{tier.sub}</div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-3 border-t pt-2 text-center text-[9px]"
        style={{ borderColor: 'rgba(26, 33, 66, 0.6)', color: '#484F72' }}
      >
        共 {total} 项监测维度 · 数据源：太医院
      </div>
    </GlassPanel>
  );
}

/**
 * HealthRiskBadge — 健康风险等级徽标
 *
 * 4 级：normal / watch / warning / danger
 * 区别于通用 RiskBadge（low/medium/high/critical），
 * 这个专门对应太医院语义
 */

import { CheckCircle2, ShieldAlert, AlertTriangle, Flame } from 'lucide-react';
import type { HealthRiskLevel } from '@/types/health';

export interface HealthRiskBadgeProps {
  level: HealthRiskLevel;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  pulse?: boolean;
  className?: string;
}

const LEVEL_STYLE: Record<
  HealthRiskLevel,
  { label: string; color: string; Icon: typeof CheckCircle2; forcePulse: boolean }
> = {
  normal: { label: '安康', color: '#3DD68C', Icon: CheckCircle2, forcePulse: false },
  watch: { label: '关注', color: '#F0C66A', Icon: ShieldAlert, forcePulse: false },
  warning: { label: '警戒', color: '#F5A524', Icon: AlertTriangle, forcePulse: false },
  danger: { label: '危急', color: '#F43F5E', Icon: Flame, forcePulse: true },
};

const SIZE = {
  sm: { fs: '10px', py: '2px', px: '6px', icon: 10 },
  md: { fs: '11px', py: '3px', px: '8px', icon: 12 },
  lg: { fs: '12px', py: '4px', px: '10px', icon: 14 },
} as const;

export function HealthRiskBadge({
  level,
  label,
  size = 'md',
  showIcon = true,
  pulse,
  className = '',
}: HealthRiskBadgeProps) {
  const style = LEVEL_STYLE[level];
  const sz = SIZE[size];
  const shouldPulse = pulse ?? style.forcePulse;
  const Icon = style.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-semibold tracking-wide ${
        shouldPulse ? 'animate-breathe' : ''
      } ${className}`}
      style={{
        backgroundColor: `${style.color}18`,
        border: `1px solid ${style.color}66`,
        color: style.color,
        fontSize: sz.fs,
        padding: `${sz.py} ${sz.px}`,
      }}
    >
      {showIcon && <Icon size={sz.icon} strokeWidth={2.2} />}
      {label ?? style.label}
    </span>
  );
}

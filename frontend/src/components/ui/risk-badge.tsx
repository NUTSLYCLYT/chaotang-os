/**
 * 朝堂 OS V2 · RiskBadge
 *
 * 4 级风险徽标 + 可选呼吸脉冲（critical 级别强制脉冲）
 */

import type { RiskLevel } from '@/types/agent';
import { AlertTriangle, ShieldCheck, ShieldAlert, Flame } from 'lucide-react';

export interface RiskBadgeProps {
  level: RiskLevel;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  pulse?: boolean;
  className?: string;
}

interface RiskStyle {
  label: string;
  color: string;
  bg: string;
  border: string;
  Icon: typeof AlertTriangle;
  forcePulse: boolean;
}

const RISK_STYLE: Record<RiskLevel, RiskStyle> = {
  low: {
    label: '低风险',
    color: '#3DD68C',
    bg: 'rgba(61, 214, 140, 0.12)',
    border: 'rgba(61, 214, 140, 0.5)',
    Icon: ShieldCheck,
    forcePulse: false,
  },
  medium: {
    label: '中风险',
    color: '#60A5FA',
    bg: 'rgba(96, 165, 250, 0.14)',
    border: 'rgba(96, 165, 250, 0.5)',
    Icon: ShieldAlert,
    forcePulse: false,
  },
  high: {
    label: '高风险',
    color: '#F5A524',
    bg: 'rgba(245, 165, 36, 0.16)',
    border: 'rgba(245, 165, 36, 0.55)',
    Icon: AlertTriangle,
    forcePulse: false,
  },
  critical: {
    label: '危急',
    color: '#F43F5E',
    bg: 'rgba(244, 63, 94, 0.2)',
    border: 'rgba(244, 63, 94, 0.65)',
    Icon: Flame,
    forcePulse: true,
  },
};

const SIZE = {
  sm: { fs: '10px', py: '2px', px: '6px', icon: 10 },
  md: { fs: '11px', py: '3px', px: '8px', icon: 12 },
  lg: { fs: '12px', py: '4px', px: '10px', icon: 14 },
} as const;

export function RiskBadge({
  level,
  label,
  size = 'md',
  showIcon = true,
  pulse,
  className = '',
}: RiskBadgeProps) {
  const style = RISK_STYLE[level];
  const sz = SIZE[size];
  const shouldPulse = pulse ?? style.forcePulse;
  const Icon = style.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-semibold tracking-wide uppercase ${
        shouldPulse ? 'animate-breathe' : ''
      } ${className}`}
      style={{
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
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

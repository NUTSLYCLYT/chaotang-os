/**
 * 朝堂 OS V2 · StatusChip
 *
 * 统一的 Agent 状态徽标。
 * 映射 9 种 AgentState → 颜色 + 标签 + 动画
 */

import type { AgentState } from '@/types/agent';

export interface StatusChipProps {
  state: AgentState;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

interface StateStyle {
  label: string;
  color: string;
  bg: string;
  pulse: boolean;
}

const STATE_STYLE: Record<AgentState, StateStyle> = {
  idle: {
    label: '待命',
    color: '#6A7299',
    bg: 'rgba(106, 114, 153, 0.15)',
    pulse: false,
  },
  assigned: {
    label: '已分派',
    color: '#4A82F0',
    bg: 'rgba(74, 130, 240, 0.18)',
    pulse: false,
  },
  running: {
    label: '执行中',
    color: '#F0C66A',
    bg: 'rgba(240, 198, 106, 0.2)',
    pulse: true,
  },
  waiting_dependency: {
    label: '等待依赖',
    color: '#60A5FA',
    bg: 'rgba(96, 165, 250, 0.15)',
    pulse: false,
  },
  summarizing: {
    label: '汇总中',
    color: '#6BA0FF',
    bg: 'rgba(107, 160, 255, 0.2)',
    pulse: true,
  },
  completed: {
    label: '已完成',
    color: '#3DD68C',
    bg: 'rgba(61, 214, 140, 0.18)',
    pulse: false,
  },
  failed: {
    label: '失败',
    color: '#F43F5E',
    bg: 'rgba(244, 63, 94, 0.2)',
    pulse: true,
  },
  fallback_completed: {
    label: '兜底',
    color: '#F5A524',
    bg: 'rgba(245, 165, 36, 0.18)',
    pulse: false,
  },
  archived: {
    label: '已归档',
    color: '#484F72',
    bg: 'rgba(72, 79, 114, 0.15)',
    pulse: false,
  },
};

const SIZE: Record<NonNullable<StatusChipProps['size']>, { fs: string; py: string; px: string; dot: number }> = {
  sm: { fs: '10px', py: '2px', px: '6px', dot: 5 },
  md: { fs: '11px', py: '3px', px: '8px', dot: 6 },
  lg: { fs: '12px', py: '4px', px: '10px', dot: 7 },
};

export function StatusChip({
  state,
  label,
  size = 'md',
  showDot = true,
  className = '',
}: StatusChipProps) {
  const style = STATE_STYLE[state];
  const sz = SIZE[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium tracking-wide ${className}`}
      style={{
        backgroundColor: style.bg,
        color: style.color,
        fontSize: sz.fs,
        padding: `${sz.py} ${sz.px}`,
        border: `1px solid ${style.color}33`,
      }}
    >
      {showDot && (
        <span
          className={style.pulse ? 'animate-pulse-glow' : ''}
          style={{
            display: 'inline-block',
            width: `${sz.dot}px`,
            height: `${sz.dot}px`,
            borderRadius: '50%',
            backgroundColor: style.color,
            color: style.color,
          }}
        />
      )}
      {label ?? style.label}
    </span>
  );
}

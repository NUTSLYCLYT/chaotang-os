import type { ButtonHTMLAttributes, CSSProperties } from 'react';

type SwarmStatus = 'idle' | 'running' | 'normal' | 'busy' | 'blocked' | 'warning' | 'done' | 'offline';

const INLINE_STYLE: Record<SwarmStatus, CSSProperties> = {
  idle:    { background: 'rgba(106,114,153,0.15)', color: '#6A7299' },
  running: { background: 'rgba(74,130,240,0.2)',   color: '#6BA0FF' },
  normal:  { background: 'rgba(61,214,140,0.15)',  color: '#3DD68C' },
  busy:    { background: 'rgba(212,168,75,0.2)',   color: '#F0C66A' },
  blocked: { background: 'rgba(244,63,94,0.2)',    color: '#F43F5E' },
  warning: { background: 'rgba(245,165,36,0.2)',   color: '#F5A524' },
  done:    { background: 'rgba(61,214,140,0.12)',  color: '#3DD68C' },
  offline: { background: 'rgba(26,33,66,0.6)',     color: '#484F72' },
};

const DOT_COLOR: Partial<Record<SwarmStatus, string>> = {
  blocked: '#F43F5E',
  warning: '#F5A524',
};

const LABEL: Record<SwarmStatus, string> = {
  idle: '待命',
  running: '运行中',
  normal: '正常',
  busy: '执行中',
  blocked: '阻塞',
  warning: '预警',
  done: '完成',
  offline: '离线',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  status: string;
  showLabel?: boolean;
}

export function StatusPillButton({ status, showLabel = true, className = '', style, ...rest }: Props) {
  const s = (status ?? 'offline') as SwarmStatus;
  const inlineStyle = INLINE_STYLE[s] ?? INLINE_STYLE.offline;
  const label = LABEL[s] ?? s;
  const dotColor = DOT_COLOR[s];
  const isAnimated = s === 'blocked' || s === 'warning';

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${className}`}
      style={{ ...inlineStyle, ...style }}
      {...rest}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isAnimated ? 'animate-breathe' : 'opacity-60'}`}
        style={dotColor ? { background: dotColor } : { background: 'currentColor' }}
      />
      {showLabel && label}
    </button>
  );
}

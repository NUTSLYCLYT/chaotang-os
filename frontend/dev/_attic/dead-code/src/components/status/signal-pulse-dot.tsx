/**
 * SignalPulseDot — 脉冲信号点
 *
 * 通用组件：地图/时间轴/事件流都可用
 * - 外层呼吸光晕
 * - 中环
 * - 核心点
 */

import type { IntelLevel } from '@/types/intel';

export interface SignalPulseDotProps {
  level: IntelLevel;
  /** 核心点直径（px），默认 8 */
  size?: number;
  /** 是否显示外层脉冲 */
  withPulse?: boolean;
  /** 自定义覆盖颜色 */
  colorOverride?: string;
  /** 点击事件 */
  onClick?: () => void;
  /** 可选的标签 */
  label?: string;
}

const LEVEL_COLOR: Record<IntelLevel, string> = {
  info: '#60A5FA',
  watch: '#F0C66A',
  warning: '#F5A524',
  critical: '#F43F5E',
};

export function SignalPulseDot({
  level,
  size = 8,
  withPulse = true,
  colorOverride,
  onClick,
  label,
}: SignalPulseDotProps) {
  const color = colorOverride ?? LEVEL_COLOR[level];
  const container = size * 3;

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      style={{ width: label ? undefined : container, height: container }}
    >
      <span
        className="relative inline-flex items-center justify-center"
        style={{ width: container, height: container }}
      >
        {/* 外层光晕 */}
        {withPulse && (
          <span
            className="animate-breathe absolute inset-0 rounded-full"
            style={{
              backgroundColor: color,
              opacity: 0.25,
              filter: 'blur(4px)',
            }}
          />
        )}
        {/* 中环 */}
        <span
          className="absolute rounded-full border"
          style={{
            width: size * 2,
            height: size * 2,
            borderColor: color,
            opacity: 0.5,
          }}
        />
        {/* 核心 */}
        <span
          className="relative rounded-full"
          style={{
            width: size,
            height: size,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </span>
      {label && (
        <span
          className="font-mono text-[10px]"
          style={{ color, opacity: 0.85 }}
        >
          {label}
        </span>
      )}
    </span>
  );
}

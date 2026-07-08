/**
 * 朝堂 OS V2 · 动画原语 · DrawLine
 *
 * SVG 线条从起点到终点的"绘制"动画。
 * 典型场景：
 * - 丞相调度部门时的金线（从中央射向 Agent）
 * - 依赖图的连接线 reveal
 * - 任务流动的可视化
 *
 * 性能：只动 stroke-dashoffset（compositor-friendly）。
 * 无障碍：reduce motion 时直接一次性画完。
 *
 * 用法：
 *   <svg width={400} height={200}>
 *     <DrawLine
 *       from={{ x: 10, y: 100 }}
 *       to={{ x: 390, y: 50 }}
 *       color="#F0C66A"
 *       durationMs={1000}
 *       delayMs={200}
 *     />
 *   </svg>
 *
 * 注意：必须包裹在 <svg> 元素内。
 */

'use client';

import { motion, useReducedMotion } from 'motion/react';

export interface DrawLineProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** 线色（默认金色） */
  color?: string;
  /** 线宽 px（默认 1.5） */
  strokeWidth?: number;
  /** 绘制时长 ms（默认 1000） */
  durationMs?: number;
  /** 开始前延迟 ms（默认 0） */
  delayMs?: number;
  /** 虚线样式（可选） */
  dasharray?: string;
  /** 绘制完成后是否显示终点圆点（默认 false） */
  endDot?: boolean;
  /** 发光效果（默认 true） */
  glow?: boolean;
}

export function DrawLine({
  from,
  to,
  color = '#F0C66A',
  strokeWidth = 1.5,
  durationMs = 1000,
  delayMs = 0,
  dasharray,
  endDot = false,
  glow = true,
}: DrawLineProps) {
  const reduce = useReducedMotion();

  const glowFilter = glow
    ? { filter: `drop-shadow(0 0 4px ${color})` }
    : undefined;

  return (
    <g style={glowFilter}>
      <motion.line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dasharray}
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: reduce ? 0 : durationMs / 1000,
          delay: reduce ? 0 : delayMs / 1000,
          ease: [0.16, 1, 0.3, 1],
        }}
      />
      {endDot && (
        <motion.circle
          cx={to.x}
          cy={to.y}
          r={3}
          fill={color}
          initial={reduce ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: reduce ? 0 : (delayMs + durationMs) / 1000,
            duration: 0.2,
          }}
        />
      )}
    </g>
  );
}

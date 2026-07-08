/**
 * 朝堂 OS V2 · 动画原语 · EnterStagger
 *
 * 子元素依次从下方 fade-up 入场。
 * 用于：页面进入、区块 reveal、列表初次加载。
 *
 * 性能：只动 transform + opacity（compositor-friendly）。
 * 无障碍：尊重 prefers-reduced-motion。
 *
 * 用法：
 *   <EnterStagger>
 *     <Card />
 *     <Card />
 *     <Card />
 *   </EnterStagger>
 */

'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { Children, isValidElement } from 'react';

export interface EnterStaggerProps {
  children: ReactNode;
  /** 相邻子元素之间的延迟（默认 60ms） */
  staggerMs?: number;
  /** 首个子元素的启动延迟（默认 0） */
  initialDelayMs?: number;
  /** 每个子元素的入场时长（默认 400ms） */
  durationMs?: number;
  /** 入场方向：up(默认) / down / left / right */
  from?: 'up' | 'down' | 'left' | 'right';
  /** 位移距离 px（默认 12） */
  distance?: number;
  /** 容器额外 className */
  className?: string;
}

const OFFSETS: Record<NonNullable<EnterStaggerProps['from']>, { x: number; y: number }> = {
  up: { x: 0, y: 12 },
  down: { x: 0, y: -12 },
  left: { x: 12, y: 0 },
  right: { x: -12, y: 0 },
};

export function EnterStagger({
  children,
  staggerMs = 60,
  initialDelayMs = 0,
  durationMs = 400,
  from = 'up',
  distance,
  className,
}: EnterStaggerProps) {
  const reduce = useReducedMotion();
  const base = OFFSETS[from];
  const offset = distance
    ? { x: base.x !== 0 ? Math.sign(base.x) * distance : 0, y: base.y !== 0 ? Math.sign(base.y) * distance : 0 }
    : base;

  const items = Children.toArray(children).filter(isValidElement);

  if (reduce) {
    // 无障碍：不动画，直接渲染
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className}>
      {items.map((child, i) => (
        <motion.div
          key={(child as { key?: string | number }).key ?? i}
          initial={{ opacity: 0, x: offset.x, y: offset.y }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{
            duration: durationMs / 1000,
            delay: (initialDelayMs + i * staggerMs) / 1000,
            ease: [0.16, 1, 0.3, 1], // expo-out，黑金指挥舱节奏
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

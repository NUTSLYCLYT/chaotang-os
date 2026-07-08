/**
 * 朝堂 OS · 动画原语 · Pulse
 *
 * 来源：court-console/apps/web-v2/src/components/effects/pulse.tsx
 *
 * 呼吸光晕。用于"激活态""工作中"的视觉信号。
 * 典型场景：Agent 矩阵上正在工作的部门、丞相中枢 hub、进行中的任务卡。
 *
 * 性能：只动 box-shadow 和 scale（compositor-friendly）。
 * 无障碍：reduce motion 时完全静止（只保留静态发光）。
 *
 * 用法：
 *   <Pulse color="#F0C66A">
 *     <AgentIcon />
 *   </Pulse>
 *
 *   <Pulse color="#F43F5E" intensity="strong">  // 告警用
 *     <AlertIcon />
 *   </Pulse>
 */

'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export interface PulseProps {
  children: ReactNode;
  /** 发光色（hex 或 rgb） */
  color?: string;
  /** 强度：subtle（轻微） / normal / strong */
  intensity?: 'subtle' | 'normal' | 'strong';
  /** 一次呼吸的周期 ms（默认 2000） */
  periodMs?: number;
  /** 是否同时缩放 scale（默认 false，只发光） */
  scale?: boolean;
  /** 容器 className */
  className?: string;
}

const INTENSITY: Record<NonNullable<PulseProps['intensity']>, { min: number; max: number; spread: number }> = {
  subtle: { min: 0.2, max: 0.5, spread: 12 },
  normal: { min: 0.35, max: 0.75, spread: 20 },
  strong: { min: 0.5, max: 0.95, spread: 32 },
};

function toRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function Pulse({
  children,
  color = '#F0C66A',
  intensity = 'normal',
  periodMs = 2000,
  scale = false,
  className,
}: PulseProps) {
  const reduce = useReducedMotion();
  const cfg = INTENSITY[intensity];

  if (reduce) {
    return (
      <div className={className} style={{ boxShadow: `0 0 ${cfg.spread}px ${toRgba(color, cfg.min)}` }}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      animate={{
        boxShadow: [
          `0 0 ${cfg.spread * 0.6}px ${toRgba(color, cfg.min)}`,
          `0 0 ${cfg.spread}px ${toRgba(color, cfg.max)}`,
          `0 0 ${cfg.spread * 0.6}px ${toRgba(color, cfg.min)}`,
        ],
        ...(scale && { scale: [1, 1.03, 1] }),
      }}
      transition={{
        duration: periodMs / 1000,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * 朝堂 OS V2 · 动画原语 · NumberCounter
 *
 * 数字从 0（或起始值）滚动到目标值的动画。
 * 典型场景：
 * - 4 象限的数字（风险数 / 机会数 / 健康分）
 * - 报告中的关键指标（营收、增速、毛利率）
 * - 置信度 / 命中度
 *
 * 性能：用 framer-motion 的 animate() + useMotionValue。
 * 无障碍：reduce motion 时直接显示终值。
 *
 * 用法：
 *   <NumberCounter value={92} durationMs={1000} suffix="%" />
 *   <NumberCounter value={39300000000} format={formatCurrency} prefix="$" />
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

export interface NumberCounterProps {
  /** 目标值 */
  value: number;
  /** 起始值（默认 0） */
  from?: number;
  /** 动画时长 ms（默认 1200） */
  durationMs?: number;
  /** 开始前延迟 ms（默认 0） */
  delayMs?: number;
  /** 小数位数（默认 0） */
  decimals?: number;
  /** 前缀（如 "$" "¥"） */
  prefix?: string;
  /** 后缀（如 "%" "  /  100"） */
  suffix?: string;
  /** 自定义格式化（覆盖 decimals/prefix/suffix） */
  format?: (value: number) => string;
  /** 容器 className */
  className?: string;
}

export function NumberCounter({
  value,
  from = 0,
  durationMs = 1200,
  delayMs = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  format,
  className,
}: NumberCounterProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState<number>(reduce ? value : from);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }

    let startTime: number | null = null;
    let cancelled = false;

    const startTimer = setTimeout(() => {
      const tick = (now: number) => {
        if (cancelled) return;
        if (startTime === null) startTime = now;
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        // easeOutExpo
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setDisplay(from + (value - from) * eased);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, from, durationMs, delayMs, reduce]);

  const formatted = format
    ? format(display)
    : `${prefix}${display.toFixed(decimals)}${suffix}`;

  return <span className={className}>{formatted}</span>;
}

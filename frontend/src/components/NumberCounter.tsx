'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

export interface NumberCounterProps {
  value: number;
  from?: number;
  durationMs?: number;
  delayMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  format?: (value: number) => string;
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

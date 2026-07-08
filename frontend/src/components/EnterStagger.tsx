'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { Children, isValidElement } from 'react';

export interface EnterStaggerProps {
  children: ReactNode;
  staggerMs?: number;
  initialDelayMs?: number;
  durationMs?: number;
  from?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
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
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

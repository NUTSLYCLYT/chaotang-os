/**
 * 朝堂 Console · 印章动画 (StampDrop)
 *
 * 核心 AHA 时刻：每一站处理完，"啪"一枚印章落下。
 *
 * 遵循 UI 原则 §5 / §6 / §7：
 *   - 动画时长 clamp(actual_duration_ms, 200, 1000)  — 不比真实事件快/慢
 *   - prefers-reduced-motion 下跳过动画直接落章
 *   - aria-live="polite" 让屏幕阅读器播报"已批红 / 已驳回"
 *   - 朱红只在印章上出现，不爆屏
 *
 * 三种印章形态（UI 原则 §5 status 对齐）：
 *   approved/committed → 朱红八角"批红"印
 *   rejected            → 灰黑"驳回"印 + 斜划
 *   forwarded (中转)    → 金色"转派"小印（轻）
 */

'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import type { DecisionKind } from '../types'

export interface StampDropProps {
  /** 决策类型（null = 未处理，不显示印章） */
  decision: DecisionKind | null | undefined
  /** 对应真实事件 duration，用来缩放动画（ms） */
  durationMs?: number | null
  /** 标签文字（如 '批红' / '驳回' / '转派'） */
  label?: string
  /** 站名（用于 aria 播报） */
  stationName?: string
  /** 尺寸（px） */
  size?: number
}

/**
 * 印章配色严格对齐 V2 design-tokens（无自造色）：
 *   approved  → 朝堂金（批红印 = 金印 · 统一黑金视觉）
 *   rejected  → danger（V2 唯一偏红 token）
 *   suspended → text-muted / info 混合（灰紫）
 *   forwarded → gold-deep（压暗金 · 中转轻印）
 */
const STAMP_COLOR: Record<DecisionKind, { fill: string; stroke: string; text: string }> = {
  approved: {
    fill: 'color-mix(in srgb, var(--color-gold) 88%, transparent)',
    stroke: 'var(--color-gold-bright)',
    text: 'var(--color-bg-deep)',
  },
  rejected: {
    fill: 'color-mix(in srgb, var(--color-danger) 88%, transparent)',
    stroke: 'var(--color-danger)',
    text: 'var(--color-text)',
  },
  suspended: {
    fill: 'color-mix(in srgb, var(--color-text-muted) 70%, transparent)',
    stroke: 'var(--color-text-dim)',
    text: 'var(--color-text)',
  },
  forwarded: {
    fill: 'color-mix(in srgb, var(--color-gold-deep) 80%, transparent)',
    stroke: 'var(--color-gold-deep)',
    text: 'var(--color-text)',
  },
}

/** shadow color per decision（与 fill 同源） */
const STAMP_SHADOW: Record<DecisionKind, string> = {
  approved: 'color-mix(in srgb, var(--color-gold) 45%, transparent)',
  rejected: 'color-mix(in srgb, var(--color-danger) 45%, transparent)',
  suspended: 'color-mix(in srgb, var(--color-text-muted) 35%, transparent)',
  forwarded: 'color-mix(in srgb, var(--color-gold-deep) 40%, transparent)',
}

const LABEL_MAP: Record<DecisionKind, string> = {
  approved: '批红',
  rejected: '驳回',
  suspended: '留中',
  forwarded: '转派',
}

export function StampDrop({ decision, durationMs, label, stationName, size = 56 }: StampDropProps) {
  const reduced = useReducedMotion()
  const animationMs = useMemo(() => {
    const base = durationMs ?? 400
    return Math.max(200, Math.min(1000, base))
  }, [durationMs])

  if (!decision) return null

  const color = STAMP_COLOR[decision]
  const text = label ?? LABEL_MAP[decision]

  const initial = reduced ? { scale: 1, opacity: 1, rotate: 0 } : { scale: 2.4, opacity: 0, rotate: -18 }
  const animate = { scale: 1, opacity: 1, rotate: 0 }
  const transition = reduced
    ? { duration: 0 }
    : {
        type: 'spring' as const,
        stiffness: 380,
        damping: 20,
        duration: animationMs / 1000,
      }

  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      className="pointer-events-none select-none"
      aria-live="polite"
      aria-atomic="true"
      role="status"
      style={{ width: size, height: size }}
    >
      {stationName && (
        <span className="sr-only">{stationName}已{text}</span>
      )}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ filter: `drop-shadow(0 2px 6px ${STAMP_SHADOW[decision]})` }}
      >
        {/* 八角形 (仿明清公文印) */}
        <polygon
          points="30,10 70,10 90,30 90,70 70,90 30,90 10,70 10,30"
          fill={color.fill}
          stroke={color.stroke}
          strokeWidth={2}
          opacity={0.96}
        />
        {/* 内框 */}
        <polygon
          points="36,18 64,18 82,36 82,64 64,82 36,82 18,64 18,36"
          fill="none"
          stroke={color.stroke}
          strokeWidth={1.2}
          opacity={0.7}
        />
        {/* 字 */}
        <text
          x="50"
          y="57"
          textAnchor="middle"
          fontSize={text.length > 1 ? 24 : 36}
          fontFamily="var(--font-serif)"
          fontWeight={700}
          fill={color.text}
          style={{ letterSpacing: '-1px' }}
        >
          {text}
        </text>
        {/* 驳回时加斜杠 */}
        {decision === 'rejected' && (
          <line x1="20" y1="80" x2="80" y2="20" stroke={color.stroke} strokeWidth={3} opacity={0.8} />
        )}
      </svg>
    </motion.div>
  )
}

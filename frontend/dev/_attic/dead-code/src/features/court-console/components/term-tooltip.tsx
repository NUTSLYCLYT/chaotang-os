/**
 * 朝堂 Console · 术语悬浮解释
 *
 * UI 原则 §4：每个朝堂术语第一次出现必须可 hover 查看解释。
 * 极轻视觉：dotted 下划线（仅 1px），hover 后浮出小黑金卡片。
 *
 * 辅助使用：接了 aria-describedby 让屏幕阅读器也能读到解释。
 */

'use client'

import { useId, useState, type ReactNode } from 'react'

export interface TermTooltipProps {
  term: ReactNode
  explain: string
  /** 额外类名，通常不需要 */
  className?: string
}

export function TermTooltip({ term, explain, className }: TermTooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)

  return (
    <span
      className={`relative inline-block cursor-help ${className ?? ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-describedby={id}
      style={{
        borderBottom: '1px dotted color-mix(in srgb, var(--color-gold) 50%, transparent)',
        paddingBottom: '1px',
      }}
    >
      {term}
      <span
        id={id}
        role="tooltip"
        className={`absolute bottom-full left-1/2 z-50 -translate-x-1/2 mb-2 whitespace-nowrap rounded px-3 py-1.5 text-xs transition-opacity duration-150 pointer-events-none`}
        style={{
          background: 'var(--color-surface)',
          border: '1px solid color-mix(in srgb, var(--color-gold) 35%, transparent)',
          color: 'var(--color-text)',
          opacity: open ? 1 : 0,
          boxShadow: '0 4px 16px color-mix(in srgb, var(--color-bg-deep) 60%, transparent)',
        }}
      >
        {explain}
      </span>
    </span>
  )
}

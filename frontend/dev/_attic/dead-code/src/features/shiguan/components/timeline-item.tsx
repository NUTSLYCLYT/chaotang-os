'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { colors } from '@/config/design-tokens'
import type { ArchiveItem } from '../lib/shiguan-types'
import { formatDate } from '../lib/shiguan-helpers'
import { OutcomeBadge } from './outcome-badge'

export function TimelineItem({ item }: { item: ArchiveItem }) {
  return (
    <div className="flex gap-4">
      {/* Date column */}
      <div className="flex w-12 flex-col items-center">
        <div className="text-[11px] font-mono text-[#6A7299]">{formatDate(item.date)}</div>
        <div className="mt-1.5 h-full w-px bg-white/8" />
      </div>

      {/* Content */}
      <div
        className="mb-3 flex-1 rounded-xl p-3 transition-all hover:border-white/12"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span
                className="rounded px-1.5 py-0.5 text-[11px]"
                style={{
                  background: item.isGovernance
                    ? 'rgba(240,198,106,0.1)'
                    : 'rgba(107,160,255,0.1)',
                  color: item.isGovernance ? colors.goldBright : colors.blueBright,
                }}
              >
                {item.type}
              </span>
              <span className="text-[11px] text-[#6A7299]">{item.department}</span>
            </div>
            <div className="text-[13px] font-medium text-[#F5E9C9] leading-snug">{item.title}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <OutcomeBadge outcome={item.outcome} />
            {item.reportId && (
              <Link
                href={`/reports/${item.reportId}`}
                className="flex items-center gap-1 text-[11px] transition hover:text-[#F0C66A]"
                style={{ color: colors.textMuted }}
              >
                战报 <ArrowRight size={10} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

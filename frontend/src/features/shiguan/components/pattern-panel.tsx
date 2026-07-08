'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GlassPanel } from '@/components/ui/glass-panel'
import { colors } from '@/config/design-tokens'
import type { ArchiveItem, CommandTypeFreq, DeptSuccessRate } from '../lib/shiguan-types'
import { OutcomeBadge } from './outcome-badge'

function StatMini({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="text-[11px] text-[#6A7299]">{label}</div>
      <div className="mt-1 text-[18px] font-semibold" style={{ color: color ?? '#F5E9C9' }}>
        {value}
      </div>
    </div>
  )
}

export function PatternPanel({
  items,
  topCase,
  commandTypes,
  deptSuccessRates,
}: {
  items: ArchiveItem[]
  topCase: ArchiveItem | undefined
  commandTypes: CommandTypeFreq[]
  deptSuccessRates: DeptSuccessRate[]
}) {
  const successCount = items.filter((i) => i.outcome === 'success').length
  const successRate = items.length > 0 ? Math.round((successCount / items.length) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Top case highlight */}
      {topCase && (
        <GlassPanel variant="gold" tone="elevated" padding="md">
          <div className="section-eyebrow mb-2 text-[#F0C66A]">本月最高价值案例</div>
          <div className="text-[14px] font-semibold text-[#F5E9C9]">{topCase.title}</div>
          <div className="mt-1 flex items-center gap-2">
            <OutcomeBadge outcome={topCase.outcome} />
            <span className="text-[11px] text-[#6A7299]">{topCase.department}</span>
          </div>
          {topCase.reportId && (
            <Link
              href={`/reports/${topCase.reportId}`}
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] transition hover:text-[#F0C66A]"
              style={{ color: colors.goldBright }}
            >
              查看完整战报 <ArrowRight size={11} />
            </Link>
          )}
        </GlassPanel>
      )}

      {/* Command types */}
      <GlassPanel tone="elevated" padding="md">
        <div className="section-eyebrow mb-3">命令类型分布</div>
        <div className="space-y-2">
          {commandTypes.map((ct) => (
            <div key={ct.type}>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-[#D9CFB4]">{ct.type}</span>
                <span className="font-mono text-[#6A7299]">{ct.count} 次</span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${ct.pct}%`,
                    background:
                      'linear-gradient(90deg, rgba(240,198,106,0.8), rgba(240,198,106,0.3))',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Dept success rates */}
      <GlassPanel tone="elevated" padding="md">
        <div className="section-eyebrow mb-3">各司成功率</div>
        <div className="space-y-2">
          {deptSuccessRates.map((d) => (
            <div key={d.dept} className="flex items-center gap-3">
              <div className="w-16 text-[11px] text-[#D9CFB4] shrink-0">{d.dept}</div>
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${d.rate}%`,
                    background:
                      d.rate >= 90
                        ? `rgba(61,214,140,0.7)`
                        : d.rate >= 75
                          ? `rgba(245,165,36,0.7)`
                          : `rgba(244,63,94,0.7)`,
                  }}
                />
              </div>
              <div className="w-9 text-right font-mono text-[11px] text-[#6A7299] shrink-0">
                {d.rate}%
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Overall stats */}
      <GlassPanel tone="flat" padding="md">
        <div className="section-eyebrow mb-3">全局统计</div>
        <div className="grid grid-cols-2 gap-2">
          <StatMini label="总案件" value={`${items.length}`} />
          <StatMini label="成功率" value={`${successRate}%`} color={colors.success} />
          <StatMini
            label="本月"
            value={`${items.filter((i) => new Date(i.date).getMonth() === new Date().getMonth()).length}`}
          />
          <StatMini
            label="治理议题"
            value={`${items.filter((i) => i.isGovernance).length}`}
            color={colors.goldBright}
          />
        </div>
      </GlassPanel>
    </div>
  )
}

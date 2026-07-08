'use client'

/**
 * 朝堂 Console · 庄园巡按列表页 (CC-010)
 *
 * 信息组 3（符合 Miller 5-8）：
 *   ① Hero 今日总览数字
 *   ② 健康筛选栏
 *   ③ 8 庄园卡片网格（主内容）
 *
 * 结构继承 V2 /overview 骨架：max-w-[1600px] + GlassPanel + section-eyebrow/title/gold-text
 */

import { useState } from 'react'
import Link from 'next/link'
import { GlassPanel } from '@/components/ui/glass-panel'
import {
  MANOR_SUMMARIES,
  HEALTH_LABEL,
  HEALTH_COLOR,
  formatElapsed,
  getManorsByHealth,
  type ManorHealth,
} from '../lib/manors-mock'

type FilterKey = 'all' | ManorHealth

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'normal', label: '正常' },
  { key: 'watch', label: '关注' },
  { key: 'warning', label: '预警' },
  { key: 'danger', label: '危险' },
]

export function ManorsPage() {
  const [filter, setFilter] = useState<FilterKey>('all')

  const totalCases = MANOR_SUMMARIES.reduce((s, m) => s + m.todayCases, 0)
  const totalPending = MANOR_SUMMARIES.reduce((s, m) => s + m.pendingCases, 0)
  const warningCount = MANOR_SUMMARIES.filter(
    m => m.health === 'warning' || m.health === 'danger',
  ).length
  const avgRate =
    MANOR_SUMMARIES.reduce((s, m) => s + m.approvedRate, 0) / MANOR_SUMMARIES.length

  const displayed = getManorsByHealth(filter)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] space-y-5 p-6">

        {/* 组 ① Hero · 今日总览 */}
        <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
          <div className="section-eyebrow">Manor Oversight · 庄园巡按</div>
          <h2 className="section-title gold-text mt-1 text-[20px]">八庄园今日</h2>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <OverviewCell label="今日总案" value={totalCases} unit="件" />
            <OverviewCell
              label="综合批红率"
              value={(avgRate * 100).toFixed(0)}
              unit="％"
              highlight
            />
            <OverviewCell label="待处理" value={totalPending} unit="件" />
            <OverviewCell
              label="预警庄园"
              value={warningCount}
              unit="处"
              alert={warningCount > 0}
            />
          </div>
        </GlassPanel>

        {/* 组 ② 筛选栏 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-medium tracking-wide uppercase"
            style={{ color: 'var(--color-text-muted)' }}
          >
            按健康状态筛选
          </span>
          {FILTERS.map(f => (
            <FilterPill
              key={f.key}
              label={f.label}
              active={filter === f.key}
              health={f.key === 'all' ? undefined : f.key}
              onClick={() => setFilter(f.key)}
            />
          ))}
        </div>

        {/* 组 ③ 庄园卡片网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map(manor => (
            <ManorCard key={manor.domain} manor={manor} />
          ))}
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function OverviewCell({
  label,
  value,
  unit,
  highlight,
  alert,
}: {
  label: string
  value: number | string
  unit: string
  highlight?: boolean
  alert?: boolean
}) {
  const valueColor = alert
    ? 'var(--color-warning)'
    : highlight
      ? 'var(--color-gold)'
      : 'var(--color-text)'

  return (
    <div
      className="rounded-md px-3 py-2"
      style={{ background: 'color-mix(in srgb, var(--color-gold) 6%, transparent)' }}
    >
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span
          className="text-2xl font-semibold"
          style={{ fontFamily: 'var(--font-serif)', color: valueColor }}
        >
          {value}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {unit}
        </span>
      </div>
    </div>
  )
}

function FilterPill({
  label,
  active,
  health,
  onClick,
}: {
  label: string
  active: boolean
  health?: ManorHealth
  onClick: () => void
}) {
  const dotColor = health ? HEALTH_COLOR[health] : undefined

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all"
      style={{
        background: active
          ? 'color-mix(in srgb, var(--color-gold) 18%, transparent)'
          : 'color-mix(in srgb, var(--color-text) 6%, transparent)',
        color: active ? 'var(--color-gold)' : 'var(--color-text-muted)',
        border: active
          ? '1px solid color-mix(in srgb, var(--color-gold) 40%, transparent)'
          : '1px solid color-mix(in srgb, var(--color-text) 12%, transparent)',
      }}
    >
      {dotColor && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: dotColor }}
        />
      )}
      {label}
    </button>
  )
}

function ManorCard({ manor }: { manor: (typeof MANOR_SUMMARIES)[number] }) {
  const healthColor = HEALTH_COLOR[manor.health]
  const healthLabel = HEALTH_LABEL[manor.health]
  const isAlert = manor.health === 'warning' || manor.health === 'danger'

  return (
    <Link href={`/court-console/court-manors/${manor.code}`} className="block group">
      <GlassPanel
        variant={isAlert ? 'danger' : 'default'}
        tone="elevated"
        padding="md"
        hudCorners
        className="h-full transition-transform group-hover:scale-[1.01]"
      >
        {/* 卡头：图标 + 台名 + 健康点 */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{manor.icon}</span>
            <div>
              <div
                className="text-[11px] tracking-widest uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {manor.label}
              </div>
              <div
                className="text-sm font-semibold leading-snug"
                style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-text)' }}
              >
                {manor.chiefTitle} · {manor.chiefName}
              </div>
            </div>
          </div>

          {/* 健康状态点 */}
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{
                background: healthColor,
                boxShadow: `0 0 6px ${healthColor}`,
              }}
            />
            <span className="text-[10px]" style={{ color: healthColor }}>
              {healthLabel}
            </span>
          </div>
        </div>

        {/* 今日接案 · 主数字 */}
        <div className="mt-3 flex items-baseline gap-1">
          <span
            className="text-3xl font-semibold"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-gold)' }}
          >
            {manor.todayCases}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            件 / 今日
          </span>
          {manor.pendingCases > 0 && (
            <span
              className="ml-auto text-xs px-1.5 py-0.5 rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
                color: 'var(--color-warning)',
              }}
            >
              待理 {manor.pendingCases}
            </span>
          )}
        </div>

        {/* 批红率 + 平均时长 */}
        <div
          className="mt-2 flex items-center gap-3 text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <span>批红率 {(manor.approvedRate * 100).toFixed(0)}%</span>
          <span className="opacity-40">·</span>
          <span>均耗 {formatElapsed(manor.avgElapsedMs)}</span>
        </div>

        {/* 最新动态 */}
        <div
          className="mt-3 pt-2 text-[11px] truncate"
          style={{
            color: 'var(--color-text-muted)',
            borderTop: '1px solid color-mix(in srgb, var(--color-text) 8%, transparent)',
          }}
        >
          {manor.recentActivity}
        </div>

        {/* 点击提示 */}
        <div
          className="mt-1.5 text-[10px] tracking-wide opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--color-gold)' }}
        >
          查看详情 →
        </div>
      </GlassPanel>
    </Link>
  )
}

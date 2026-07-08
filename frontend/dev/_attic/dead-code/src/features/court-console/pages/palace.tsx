/**
 * 朝堂 Console · 朝堂大殿 (Palace)
 *
 * 结构复刻 V2 /overview：
 *   - max-w-[1600px] space-y-5 p-6
 *   - 多 GlassPanel 堆叠 (variant="gold" tone="elevated|deep" padding hudCorners)
 *   - section-eyebrow / section-title gold-text 全局 class
 *   - md:grid-cols-12 左右分栏
 *
 * 信息组 6（符合 Miller's 5-8）：
 *   ① Hero 今日数字
 *   ② 活跃奏折榜（主钩子）
 *   ③ 六部忙闲
 *   ④ 八庄园快览
 *   ⑤ 红蓝队本日提示
 *   ⑥ 快捷入口
 */

'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { GlassPanel } from '@/components/ui/glass-panel'
import { TermTooltip } from '../components/term-tooltip'
import { PALACE_SNAPSHOT } from '../lib/palace-mock'
import { stationLabel, stationExplain } from '../lib/glossary'
import type { CourtKPI } from '@/app/api/court/kpi/route'
import type { DecisionKind, PetitionStation } from '../types'
import type { AsyncState } from '@/types/async-state'
import { asyncIdle, asyncLoading, asyncReady, asyncError } from '@/types/async-state'

const HEALTH_TOKENS: Record<'normal' | 'watch' | 'warning' | 'danger', string> = {
  normal: 'var(--color-success)',
  watch: 'var(--color-info)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
}

const DECISION_LABEL: Record<string, string> = {
  approved: '批红',
  rejected: '驳回',
  suspended: '留中',
  forwarded: '转派',
}

export function PalacePage() {
  const snap = PALACE_SNAPSHOT
  const [kpiState, setKpiState] = useState<AsyncState<CourtKPI>>(asyncIdle())

  useEffect(() => {
    let cancelled = false
    const fetchKpi = async () => {
      setKpiState((prev) => (prev.status === 'ready' ? prev : asyncLoading()))
      try {
        const res = await fetch('/api/court/kpi')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as CourtKPI
        if (!cancelled) setKpiState(asyncReady(data))
      } catch (err) {
        if (!cancelled)
          setKpiState(asyncError(err instanceof Error ? err.message : 'kpi fetch failed'))
      }
    }

    fetchKpi()
    // 每 30 秒刷新一次（演示时数字保持活跃）
    const timer = setInterval(fetchKpi, 30_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const kpi = kpiState.status === 'ready' ? kpiState.data : null
  // 真实模式下用 KPI 覆盖 digest 数字
  const todayPetitions = kpi?.source === 'real' ? kpi.todayCases : snap.digest.todayPetitions
  const totalManors = kpi ? kpi.totalManors : snap.manors.length

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] space-y-5 p-6">
        {/* 组 ① Hero · 朝堂一眼 ───────────────────────── */}
        <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
          <div className="section-eyebrow">Court Digest · 朝堂一眼</div>
          <h2 className="section-title gold-text mt-1 text-[20px]">朝堂今日</h2>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <DigestCell
              label="今日递奏"
              value={todayPetitions}
              unit="件"
              badge={kpi?.source === 'real' ? '真实' : undefined}
            />
            <DigestCell
              label="批红率"
              value={(snap.digest.approvedRate * 100).toFixed(0)}
              unit="％"
              highlight
            />
            <DigestCell label="留中" value={snap.digest.suspendedCount} unit="件" />
            <DigestCell label="驳回" value={snap.digest.rejectedCount} unit="件" />
          </div>
        </GlassPanel>

        {/* 组 ②③ · 左右两栏 ─────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          {/* 组 ② 活跃奏折榜 · 主钩子 */}
          <div className="md:col-span-7">
            <GlassPanel tone="elevated" padding="md" hudCorners>
              <div className="flex items-center justify-between">
                <div>
                  <div className="section-eyebrow">Active Petitions · 活跃奏折</div>
                  <h3 className="section-title gold-text mt-1 text-[18px]">
                    在办 · 前 {snap.activePetitions.length} 条
                  </h3>
                </div>
                <Link
                  href="/court-console/atrium"
                  className="text-[11px] underline-offset-4 hover:underline"
                  style={{ color: 'var(--color-gold-bright)' }}
                >
                  去奏折大厅 →
                </Link>
              </div>
              <ul className="mt-3 divide-y" style={{ borderColor: 'color-mix(in srgb, var(--color-gold) 12%, transparent)' }}>
                {snap.activePetitions.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/court-console/atrium?petition=${encodeURIComponent(p.id)}&situation=${encodeURIComponent(p.summary)}`}
                      className="flex items-center justify-between py-2.5 text-sm hover:bg-[color-mix(in_srgb,var(--color-gold)_5%,transparent)] rounded px-2 -mx-2 transition-colors cursor-pointer"
                    >
                    <div className="flex-1 min-w-0 pr-3">
                      <div style={{ color: 'var(--color-text)' }} className="truncate">
                        {p.summary}
                      </div>
                      <div className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="tabular-nums">{p.id}</span>
                        <span className="mx-1.5">·</span>
                        当前 ·{' '}
                        <TermTooltip
                          term={stationLabel(p.currentStation)}
                          explain={stationExplain(p.currentStation)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <DecisionBadge kind={p.lastDecision} />
                      <span
                        className="text-[11px] tabular-nums w-[48px] text-right"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {(p.elapsedMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          </div>

          {/* 组 ③ 六部忙闲 */}
          <div className="md:col-span-5">
            <GlassPanel tone="elevated" padding="md" hudCorners>
              <div className="section-eyebrow">Ministries · 六部忙闲</div>
              <h3 className="section-title gold-text mt-1 text-[18px]">今日在岗</h3>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {snap.ministries.map((m) => (
                  <div
                    key={m.code}
                    className="rounded-2xl border px-3 py-3"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--color-gold) 12%, transparent)',
                      background: 'color-mix(in srgb, var(--color-surface-1) 50%, transparent)',
                    }}
                  >
                    <div className="text-[12px]" style={{ color: 'var(--color-text-dim)' }}>
                      <TermTooltip
                        term={m.name}
                        explain={stationExplain(m.code as PetitionStation)}
                      />
                    </div>
                    <div className="mt-1 flex items-end justify-between">
                      <span
                        className="text-[20px] tabular-nums"
                        style={{ color: 'var(--color-gold-bright)', fontFamily: 'var(--font-serif)' }}
                      >
                        {m.activeCount}
                      </span>
                      <TrendArrow trend={m.trend} />
                    </div>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>
        </div>

        {/* 快捷入口行 · 一行 5 icon，首屏可见 ────────── */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { href: '/court-console/atrium',        icon: '⛩', label: '朝廷入口' },
            { href: '/court-console/court-manors',  icon: '🏡', label: '庄园巡按' },
            { href: '/court-console/audit',          icon: '📜', label: '刑部回档' },
            { href: '/court-console/gazette',        icon: '📰', label: '朝报'    },
            { href: '/court-console/palace',         icon: '🏯', label: '奉天殿'  },
          ].map(q => (
            <Link
              key={q.href}
              href={q.href}
              className="flex flex-col items-center gap-1 rounded-lg py-3 transition-all hover:scale-[1.03]"
              style={{
                background: 'color-mix(in srgb, var(--color-gold) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-gold) 18%, transparent)',
                color: 'var(--color-gold)',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 22 }}>{q.icon}</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-serif)' }}>{q.label}</span>
            </Link>
          ))}
        </div>

        {/* 组 ④ 八庄园快览 ─────────────────────────── */}
        <GlassPanel tone="deep" padding="md" hudCorners>
          <div className="flex items-center justify-between">
            <div>
              <div className="section-eyebrow">Manors · {totalManors} 庄园快览</div>
              <h3 className="section-title gold-text mt-1 text-[18px]">庄园今日接案</h3>
            </div>
            <Link
              href="/court-console/court-manors"
              className="text-[11px] underline-offset-4 hover:underline"
              style={{ color: 'var(--color-gold-bright)' }}
            >
              庄园巡按 →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {snap.manors.map((m) => (
              <div
                key={m.domain}
                className="rounded-2xl border px-4 py-3"
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-gold) 10%, transparent)',
                  background: 'color-mix(in srgb, var(--color-surface) 55%, transparent)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[12px]" style={{ color: 'var(--color-text-dim)' }}>
                    {m.name}
                  </div>
                  <HealthDot tone={m.health} />
                </div>
                <div
                  className="mt-1 text-[18px] tabular-nums"
                  style={{ color: 'var(--color-text)', fontFamily: 'var(--font-serif)' }}
                >
                  {m.todayCases}
                  <span className="text-[11px] ml-1" style={{ color: 'var(--color-text-muted)' }}>
                    案
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* 组 ⑤⑥ · 左右 ───────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          {/* 组 ⑤ 红蓝队本日提示 */}
          <div className="md:col-span-8">
            <GlassPanel tone="elevated" padding="md" hudCorners>
              <div className="section-eyebrow">Red/Blue Brief · 刑部摘要</div>
              <h3 className="section-title gold-text mt-1 text-[18px]">本日红蓝队</h3>
              <ul className="mt-3 space-y-2">
                {snap.risks.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start gap-3 rounded-2xl border px-3 py-2.5"
                    style={{
                      borderColor:
                        r.team === 'red'
                          ? 'color-mix(in srgb, var(--color-danger) 25%, transparent)'
                          : 'color-mix(in srgb, var(--color-info) 25%, transparent)',
                      background: 'color-mix(in srgb, var(--color-surface-1) 50%, transparent)',
                    }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-[0.15em] shrink-0 pt-0.5"
                      style={{
                        color:
                          r.team === 'red' ? 'var(--color-danger)' : 'var(--color-info)',
                      }}
                    >
                      {r.team === 'red' ? '红队' : '蓝队'}
                    </span>
                    <div className="text-sm flex-1" style={{ color: 'var(--color-text)' }}>
                      {r.content}
                    </div>
                    <span
                      className="text-[11px] tabular-nums shrink-0 pt-0.5"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {r.petitionId}
                    </span>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          </div>

          {/* 组 ⑥ 快捷入口 */}
          <div className="md:col-span-4">
            <GlassPanel tone="elevated" padding="md" hudCorners>
              <div className="section-eyebrow">Quick Access · 快捷入口</div>
              <h3 className="section-title gold-text mt-1 text-[18px]">进殿四步</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <QuickLink href="/court-console/atrium" title="奏折大厅" sub="请奏事" />
                <QuickLink href="/court-console/court-manors" title="庄园巡按" sub="看蜂群" />
                <QuickLink href="/court-console/audit" title="刑部回档" sub="回放审计" />
                <QuickLink href="/court-console/gazette" title="朝报" sub="今日日报" />
              </div>
            </GlassPanel>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── sub components ─── */

function DigestCell({ label, value, unit, highlight, badge }: { label: string; value: number | string; unit: string; highlight?: boolean; badge?: string }) {
  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{
        borderColor: 'color-mix(in srgb, var(--color-gold) 15%, transparent)',
        background: 'color-mix(in srgb, var(--color-surface-1) 40%, transparent)',
      }}
    >
      <div className="flex items-center gap-1.5">
        <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </div>
        {badge && (
          <span
            className="text-[9px] px-1 rounded"
            style={{
              background: 'color-mix(in srgb, var(--color-success) 15%, transparent)',
              color: 'var(--color-success)',
              letterSpacing: '0.05em',
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className="text-[28px] tabular-nums"
          style={{
            color: highlight ? 'var(--color-gold-bright)' : 'var(--color-text)',
            fontFamily: 'var(--font-serif)',
          }}
        >
          {value}
        </span>
        <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
          {unit}
        </span>
      </div>
    </div>
  )
}

function DecisionBadge({ kind }: { kind: DecisionKind | null }) {
  if (!kind) return <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>—</span>
  const colorMap: Record<DecisionKind, string> = {
    approved: 'var(--color-gold-bright)',
    rejected: 'var(--color-danger)',
    suspended: 'var(--color-text-dim)',
    forwarded: 'var(--color-gold-deep)',
  }
  return (
    <span
      className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border"
      style={{
        color: colorMap[kind],
        borderColor: `color-mix(in srgb, ${colorMap[kind]} 45%, transparent)`,
      }}
    >
      {DECISION_LABEL[kind] ?? kind}
    </span>
  )
}

function TrendArrow({ trend }: { trend: -1 | 0 | 1 }) {
  const sym = trend === 1 ? '▲' : trend === -1 ? '▼' : '—'
  const color = trend === 1 ? 'var(--color-success)' : trend === -1 ? 'var(--color-danger)' : 'var(--color-text-muted)'
  return (
    <span className="text-[10px]" style={{ color }}>
      {sym}
    </span>
  )
}

function HealthDot({ tone }: { tone: 'normal' | 'watch' | 'warning' | 'danger' }) {
  return (
    <span
      className="w-2 h-2 rounded-full inline-block"
      style={{ background: HEALTH_TOKENS[tone] }}
      aria-label={`健康 · ${tone}`}
    />
  )
}

function QuickLink({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border px-3 py-2.5 transition-colors hover:bg-[color-mix(in_srgb,var(--color-gold)_6%,transparent)]"
      style={{
        borderColor: 'color-mix(in srgb, var(--color-gold) 15%, transparent)',
        background: 'color-mix(in srgb, var(--color-surface) 40%, transparent)',
      }}
    >
      <div className="text-[13px]" style={{ color: 'var(--color-text)' }}>
        {title}
      </div>
      <div className="text-[10px] uppercase tracking-[0.15em] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
        {sub}
      </div>
    </Link>
  )
}

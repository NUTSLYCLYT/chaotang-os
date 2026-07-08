/**
 * 朝堂 Console · 朝报 (Gazette) — CC-013
 *
 * 6 信息组（Miller 5-8 合规）：
 *   ① 日期 picker + 标题
 *   ② 核心指标 6 格
 *   ③ 六部庄园排行榜
 *   ④ 红蓝队摘要（折叠）
 *   ⑤ 公文正文（竖排）
 *   ⑥ PDF 导出操作栏
 *
 * PDF 导出：window.print() + @media print 样式
 * 竖排：writing-mode: vertical-rl + text-orientation: mixed
 */

'use client'

import { useState } from 'react'
import { GlassPanel } from '@/components/ui/glass-panel'
import {
  getGazetteReport,
  getAvailableDates,
  type DailyKPI,
  type ManorRank,
  type TeamSummary,
} from '../lib/gazette-mock'

function KPICell({ kpi }: { kpi: DailyKPI }) {
  const up = kpi.delta > 0
  const down = kpi.delta < 0
  const isWarn = kpi.deltaLabel.includes('⚠')
  const deltaColor = isWarn
    ? 'var(--color-warning)'
    : up
    ? 'var(--color-success)'
    : down
    ? 'var(--color-danger)'
    : 'var(--color-text-muted)'

  return (
    <div
      className="flex flex-col gap-1 p-3 rounded"
      style={{ background: 'color-mix(in srgb, var(--color-surface) 40%, transparent)' }}
    >
      <span className="text-[10px] tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
        {kpi.label}
      </span>
      <div className="flex items-baseline gap-1">
        <span
          className="text-2xl tabular-nums"
          style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-serif)' }}
        >
          {kpi.value}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {kpi.unit}
        </span>
      </div>
      <span className="text-[10px] tabular-nums" style={{ color: deltaColor }}>
        {kpi.deltaLabel} · 较昨日
      </span>
    </div>
  )
}

function RankRow({ r }: { r: ManorRank }) {
  const rankColor =
    r.rank === 1
      ? 'var(--color-gold)'
      : r.rank === 2
      ? 'color-mix(in srgb, var(--color-text) 60%, transparent)'
      : r.rank === 3
      ? 'var(--color-warning)'
      : 'var(--color-text-muted)'

  return (
    <div
      className="grid items-center gap-3 py-2 text-sm"
      style={{
        gridTemplateColumns: '1.5rem 5rem 1fr 3rem 3rem 1fr',
        borderBottom: '1px solid color-mix(in srgb, var(--color-text) 6%, transparent)',
      }}
    >
      <span
        className="text-center text-xs font-bold"
        style={{ color: rankColor }}
      >
        {r.rank}
      </span>
      <span style={{ color: 'var(--color-text)' }}>{r.name}</span>
      <span className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
        {r.domain}
      </span>
      <span className="tabular-nums text-right text-xs" style={{ color: 'var(--color-text)' }}>
        {r.casesTotal} 件
      </span>
      <span
        className="tabular-nums text-right text-xs"
        style={{ color: r.approvedRate >= 85 ? 'var(--color-success)' : r.approvedRate >= 70 ? 'var(--color-text)' : 'var(--color-warning)' }}
      >
        {r.approvedRate}%
      </span>
      <span className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
        {r.highlight}
      </span>
    </div>
  )
}

function TeamCard({ summary, open, onToggle }: { summary: TeamSummary; open: boolean; onToggle: () => void }) {
  const isRed = summary.team === 'red'
  const teamColor = isRed ? 'var(--color-danger)' : 'var(--color-info)'

  return (
    <GlassPanel variant={isRed ? 'danger' : 'info'} padding="md">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: `color-mix(in srgb, ${teamColor} 15%, transparent)`, color: teamColor }}
          >
            {summary.label}
          </span>
          <span className="text-sm tabular-nums" style={{ color: 'var(--color-gold)' }}>
            {summary.score} 分
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            胜 {summary.wins} 局
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {open ? '收起 ▲' : '展开 ▼'}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="space-y-1">
            {summary.insights.map((s, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span style={{ color: teamColor }}>·</span>
                <span style={{ color: 'var(--color-text)' }}>{s}</span>
              </div>
            ))}
          </div>
          <div
            className="mt-2 pt-2 text-xs"
            style={{
              borderTop: `1px solid color-mix(in srgb, ${teamColor} 20%, transparent)`,
              color: 'var(--color-text-muted)',
            }}
          >
            建议：{summary.recommendation}
          </div>
        </div>
      )}
    </GlassPanel>
  )
}

function VerticalBody({ lines }: { lines: string[] }) {
  return (
    <div
      className="overflow-x-auto py-4"
      style={{ maxHeight: '280px' }}
    >
      <div
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          display: 'flex',
          flexDirection: 'row',
          gap: '2rem',
          height: '240px',
          minWidth: 'max-content',
        }}
      >
        {lines.map((line, i) => (
          <p
            key={i}
            className="text-sm leading-loose"
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-serif)',
              letterSpacing: '0.1em',
              borderRight: i < lines.length - 1 ? '1px solid color-mix(in srgb, var(--color-gold) 20%, transparent)' : 'none',
              paddingRight: '1.5rem',
            }}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}

export function GazettePage() {
  const dates = getAvailableDates()
  const [selectedDate, setSelectedDate] = useState(dates[0] ?? '2026-04-18')
  const [redOpen, setRedOpen] = useState(false)
  const [blueOpen, setBlueOpen] = useState(false)

  const report = getGazetteReport(selectedDate)

  const currentIdx = dates.indexOf(selectedDate)
  const canPrev = currentIdx < dates.length - 1
  const canNext = currentIdx > 0

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      {/* Print styles injected as a style tag — only active at @media print */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #gazette-print-area, #gazette-print-area * { visibility: visible; }
          #gazette-print-area {
            position: fixed; top: 0; left: 0; width: 100%;
            background: white; color: black; padding: 2cm;
          }
          .gazette-no-print { display: none !important; }
        }
      `}</style>

      <div className="p-6 space-y-5 max-w-5xl mx-auto">

        {/* ① 日期 picker + 标题 */}
        <GlassPanel variant="gold" padding="md" hudCorners>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-0.5">
              <div
                className="text-xs tracking-[0.2em] uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                朝报 · Daily Gazette
              </div>
              <h1
                className="text-xl"
                style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-serif)', letterSpacing: '0.05em' }}
              >
                {report.dateLabel}
              </h1>
            </div>

            {/* 日期导航 */}
            <div className="flex items-center gap-2 gazette-no-print">
              <button
                type="button"
                onClick={() => canPrev && setSelectedDate(dates[currentIdx + 1]!)}
                disabled={!canPrev}
                className="px-3 py-1 rounded border text-sm disabled:opacity-30 transition-opacity"
                style={{ borderColor: 'color-mix(in srgb, var(--color-gold) 40%, transparent)', color: 'var(--color-text-muted)' }}
              >
                ← 前日
              </button>
              <span className="text-sm tabular-nums" style={{ color: 'var(--color-text)' }}>
                {selectedDate}
              </span>
              <button
                type="button"
                onClick={() => canNext && setSelectedDate(dates[currentIdx - 1]!)}
                disabled={!canNext}
                className="px-3 py-1 rounded border text-sm disabled:opacity-30 transition-opacity"
                style={{ borderColor: 'color-mix(in srgb, var(--color-gold) 40%, transparent)', color: 'var(--color-text-muted)' }}
              >
                次日 →
              </button>
            </div>
          </div>

          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: 'var(--color-text)', borderTop: '1px solid color-mix(in srgb, var(--color-gold) 20%, transparent)', paddingTop: '0.75rem' }}
          >
            {report.headline}
          </p>
        </GlassPanel>

        <div id="gazette-print-area">
          {/* ② 核心指标 */}
          <section className="space-y-2">
            <div
              className="text-[10px] tracking-[0.2em] uppercase"
              style={{ color: 'var(--color-text-muted)' }}
            >
              今日核心指标
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {report.kpis.map((kpi, i) => (
                <KPICell key={i} kpi={kpi} />
              ))}
            </div>
          </section>

          {/* ③ 六部排行榜 */}
          <section className="space-y-2 mt-5">
            <div
              className="text-[10px] tracking-[0.2em] uppercase"
              style={{ color: 'var(--color-text-muted)' }}
            >
              六部庄园排行
            </div>
            <GlassPanel variant="default" tone="elevated" padding="md">
              {/* 表头 */}
              <div
                className="grid text-[10px] uppercase tracking-[0.1em] pb-2 mb-1 gap-3"
                style={{
                  gridTemplateColumns: '1.5rem 5rem 1fr 3rem 3rem 1fr',
                  color: 'var(--color-text-muted)',
                  borderBottom: '1px solid color-mix(in srgb, var(--color-gold) 15%, transparent)',
                }}
              >
                <span>#</span>
                <span>庄园</span>
                <span>领域</span>
                <span className="text-right">案卷</span>
                <span className="text-right">批红率</span>
                <span>今日亮点</span>
              </div>
              {report.manorRanks.map(r => (
                <RankRow key={r.rank} r={r} />
              ))}
            </GlassPanel>
          </section>

          {/* ④ 红蓝队摘要 */}
          <section className="space-y-2 mt-5">
            <div
              className="text-[10px] tracking-[0.2em] uppercase"
              style={{ color: 'var(--color-text-muted)' }}
            >
              红蓝队摘要
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TeamCard summary={report.redTeam}  open={redOpen}  onToggle={() => setRedOpen(o => !o)} />
              <TeamCard summary={report.blueTeam} open={blueOpen} onToggle={() => setBlueOpen(o => !o)} />
            </div>
          </section>

          {/* ⑤ 竖排公文正文 */}
          <section className="space-y-2 mt-5">
            <div
              className="text-[10px] tracking-[0.2em] uppercase"
              style={{ color: 'var(--color-text-muted)' }}
            >
              公文正文（竖排）
            </div>
            <GlassPanel variant="default" tone="deep" padding="md" hudCorners>
              <VerticalBody lines={report.bodyText} />
              <div
                className="mt-2 text-[10px] text-right"
                style={{ color: 'var(--color-text-muted)' }}
              >
                朝报司 · {report.dateLabel} · 子时发出
              </div>
            </GlassPanel>
          </section>
        </div>

        {/* ⑥ PDF 导出操作栏 */}
        <div className="flex items-center justify-end gap-3 gazette-no-print pt-2">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            使用系统打印对话框可另存为 PDF
          </span>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-1.5 rounded border text-sm transition-opacity hover:opacity-80"
            style={{
              borderColor: 'var(--color-gold)',
              color: 'var(--color-gold-bright)',
              background: 'transparent',
            }}
          >
            导出 PDF
          </button>
        </div>

      </div>
    </>
  )
}

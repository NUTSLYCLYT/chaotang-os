'use client'

/**
 * 朝堂 Console · 刑部回档 (CC-012)
 *
 * 信息组 4（符合 Miller 5-8）：
 *   ① 搜索栏 + 统计 Hero
 *   ② 分组案卷列表（今日/昨日/前天）
 *   ③ 时间轴详情（点击展开六站推演）
 *   ④ 回放控件（1x / 5x / 10x 速率）
 *
 * 布局：左栏（搜索+列表）+ 右栏（时间轴+回放）
 * Codex #3：回放基于快照，不重跑 LLM，脱敏版本化
 */

import { useState, useEffect, useRef } from 'react'
import { GlassPanel } from '@/components/ui/glass-panel'
import {
  AUDIT_RECORDS,
  GROUP_LABELS,
  DECISION_LABEL,
  DECISION_COLOR,
  formatElapsedMs,
  groupedRecords,
  type AuditRecord,
  type AuditGroup,
} from '../lib/audit-mock'

const REPLAY_SPEEDS = [1, 5, 10] as const
type Speed = (typeof REPLAY_SPEEDS)[number]

export function AuditPage() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AuditRecord | null>(AUDIT_RECORDS[0] ?? null)
  const [expandedGroups, setExpandedGroups] = useState<Set<AuditGroup>>(
    new Set(['today', 'yesterday']),
  )
  const [replaySpeed, setReplaySpeed] = useState<Speed>(1)
  const [replayIdx, setReplayIdx] = useState<number | null>(null)
  const replayRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filtered = AUDIT_RECORDS.filter(
    r =>
      r.title.includes(search) ||
      r.manor.includes(search) ||
      r.petitionId.includes(search),
  )
  const groups = groupedRecords(filtered)

  const totalToday = AUDIT_RECORDS.filter(r => r.group === 'today').length
  const archivedCount = AUDIT_RECORDS.filter(r => r.archived).length

  const toggleGroup = (g: AuditGroup) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(g) ? next.delete(g) : next.add(g)
      return next
    })
  }

  const startReplay = () => {
    if (!selected) return
    setReplayIdx(0)
  }

  const stopReplay = () => {
    if (replayRef.current) clearTimeout(replayRef.current)
    setReplayIdx(null)
  }

  useEffect(() => {
    if (replayIdx === null || !selected) return
    if (replayIdx >= selected.timeline.length) {
      setReplayIdx(null)
      return
    }
    const event = selected.timeline[replayIdx]
    if (!event) { setReplayIdx(null); return }
    const delay = event.elapsedMs / replaySpeed
    replayRef.current = setTimeout(() => setReplayIdx(i => (i !== null ? i + 1 : null)), delay)
    return () => { if (replayRef.current) clearTimeout(replayRef.current) }
  }, [replayIdx, selected, replaySpeed])

  const visibleTimeline = replayIdx !== null
    ? selected?.timeline.slice(0, replayIdx + 1)
    : selected?.timeline

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* 组 ① Hero */}
      <div className="flex-shrink-0 px-5 pt-4 pb-3">
        <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="section-eyebrow">Audit Archive · 刑部回档</div>
              <h2 className="section-title gold-text mt-0.5 text-[18px]">历史奏折证据链</h2>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-[22px] font-semibold" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-gold)' }}>
                  {totalToday}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>今日案卷</div>
              </div>
              <div>
                <div className="text-[22px] font-semibold" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-text)' }}>
                  {AUDIT_RECORDS.length}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>总案卷</div>
              </div>
              <div>
                <div className="text-[22px] font-semibold" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-text-muted)' }}>
                  {archivedCount}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>已归档</div>
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* 主体：左右分栏 */}
      <div className="flex-1 overflow-hidden flex gap-4 px-5 pb-5">

        {/* 左栏：组 ② 搜索 + 分组列表 */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-hidden">
          {/* 搜索框 */}
          <input
            type="search"
            placeholder="搜索奏折标题 / 庄园 / ID"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: 'color-mix(in srgb, var(--color-surface) 80%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-gold) 25%, transparent)',
              color: 'var(--color-text)',
            }}
          />

          {/* 分组列表 */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {(Object.entries(groups) as [AuditGroup, AuditRecord[]][]).map(([group, records]) => {
              if (records.length === 0) return null
              const expanded = expandedGroups.has(group)
              return (
                <div key={group}>
                  {/* 组标题 */}
                  <button
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                    onClick={() => toggleGroup(group)}
                  >
                    <span className="text-[10px] tracking-[0.15em] uppercase font-medium">
                      {GROUP_LABELS[group]}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{
                          background: 'color-mix(in srgb, var(--color-gold) 10%, transparent)',
                          color: 'var(--color-gold)',
                        }}
                      >
                        {records.length}
                      </span>
                      <span
                        className="text-xs transition-transform"
                        style={{ transform: expanded ? 'rotate(0)' : 'rotate(-90deg)' }}
                      >
                        ▾
                      </span>
                    </span>
                  </button>

                  {/* 案卷行 */}
                  {expanded && (
                    <div className="mt-1 space-y-1">
                      {records.map(r => {
                        const isActive = selected?.id === r.id
                        const dc = DECISION_COLOR[r.finalDecision]
                        return (
                          <button
                            key={r.id}
                            onClick={() => { setSelected(r); stopReplay() }}
                            className="w-full text-left rounded-lg px-3 py-2.5 transition-all"
                            style={{
                              background: isActive
                                ? 'color-mix(in srgb, var(--color-gold) 10%, transparent)'
                                : 'color-mix(in srgb, var(--color-surface) 60%, transparent)',
                              border: isActive
                                ? '1px solid color-mix(in srgb, var(--color-gold) 35%, transparent)'
                                : '1px solid color-mix(in srgb, var(--color-text) 6%, transparent)',
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className="text-sm font-medium leading-snug line-clamp-2"
                                style={{ color: isActive ? 'var(--color-gold)' : 'var(--color-text)' }}
                              >
                                {r.title}
                              </span>
                              {r.archived && (
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                                  style={{
                                    background: 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)',
                                    color: 'var(--color-text-muted)',
                                    border: '1px solid color-mix(in srgb, var(--color-text-muted) 20%, transparent)',
                                  }}
                                >
                                  已归档
                                </span>
                              )}
                            </div>
                            <div
                              className="mt-1 flex items-center gap-2 text-[10px]"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              <span>{r.timestamp}</span>
                              <span className="opacity-40">·</span>
                              <span>{r.manor}</span>
                              <span className="opacity-40">·</span>
                              <span>{formatElapsedMs(r.totalElapsedMs)}</span>
                              <span
                                className="ml-auto px-1.5 py-0.5 rounded-full text-[9px]"
                                style={{
                                  background: `color-mix(in srgb, ${dc} 12%, transparent)`,
                                  color: dc,
                                }}
                              >
                                {DECISION_LABEL[r.finalDecision]}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {filtered.length === 0 && (
              <div
                className="text-center py-12 text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                未找到匹配案卷
              </div>
            )}
          </div>
        </div>

        {/* 右栏：组 ③ 时间轴 + 组 ④ 回放控件 */}
        <div className="flex-1 overflow-hidden flex flex-col gap-3 min-w-0">
          {selected ? (
            <>
              {/* 案卷标题 */}
              <GlassPanel variant="default" tone="elevated" padding="md" hudCorners>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="section-eyebrow">{selected.petitionId}</div>
                    <h3
                      className="mt-0.5 text-[15px] font-semibold leading-snug"
                      style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-text)' }}
                    >
                      {selected.title}
                    </h3>
                    <div
                      className="mt-1 text-[11px] flex gap-3"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <span>{selected.manor}</span>
                      <span>·</span>
                      <span>总耗 {formatElapsedMs(selected.totalElapsedMs)}</span>
                      {selected.archived && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px]"
                          style={{
                            background: 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)',
                            color: 'var(--color-text-muted)',
                            border: '1px solid color-mix(in srgb, var(--color-text-muted) 20%, transparent)',
                          }}
                        >
                          已归档
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 组 ④ 回放控件 */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div
                      className="flex rounded-lg overflow-hidden"
                      style={{ border: '1px solid color-mix(in srgb, var(--color-gold) 25%, transparent)' }}
                    >
                      {REPLAY_SPEEDS.map(s => (
                        <button
                          key={s}
                          onClick={() => setReplaySpeed(s)}
                          className="px-3 py-1.5 text-xs font-medium transition-colors"
                          style={{
                            background: replaySpeed === s
                              ? 'color-mix(in srgb, var(--color-gold) 20%, transparent)'
                              : 'transparent',
                            color: replaySpeed === s
                              ? 'var(--color-gold)'
                              : 'var(--color-text-muted)',
                            borderRight: s !== 10
                              ? '1px solid color-mix(in srgb, var(--color-gold) 15%, transparent)'
                              : 'none',
                          }}
                        >
                          {s}×
                        </button>
                      ))}
                    </div>
                    {replayIdx === null ? (
                      <button
                        onClick={startReplay}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: 'color-mix(in srgb, var(--color-gold) 15%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--color-gold) 35%, transparent)',
                          color: 'var(--color-gold)',
                        }}
                      >
                        ▶ 时间回放
                      </button>
                    ) : (
                      <button
                        onClick={stopReplay}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium"
                        style={{
                          background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
                          color: 'var(--color-warning)',
                        }}
                      >
                        ■ 停止回放
                      </button>
                    )}
                  </div>
                </div>

                {/* 回放进度条 */}
                {replayIdx !== null && (
                  <div className="mt-3">
                    <div
                      className="h-1 rounded-full overflow-hidden"
                      style={{ background: 'color-mix(in srgb, var(--color-text) 8%, transparent)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${((replayIdx + 1) / selected.timeline.length) * 100}%`,
                          background: 'var(--color-gold)',
                        }}
                      />
                    </div>
                    <div
                      className="mt-1 text-[10px]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {replayIdx + 1} / {selected.timeline.length} 站 · {replaySpeed}× 速率
                    </div>
                  </div>
                )}
              </GlassPanel>

              {/* 组 ③ 时间轴 */}
              <div className="flex-1 overflow-y-auto">
                <GlassPanel variant="default" tone="elevated" padding="md" hudCorners className="h-full">
                  <div className="section-eyebrow mb-3">Timeline · 六站推演记录</div>
                  <div className="space-y-0">
                    {visibleTimeline?.map((event, i) => {
                      const dc = event.decisionKind ? DECISION_COLOR[event.decisionKind] : 'var(--color-text-muted)'
                      const isLast = i === (visibleTimeline.length - 1)
                      const isReplaying = replayIdx !== null && i === replayIdx
                      return (
                        <div key={event.seq} className="flex gap-3">
                          {/* 竖线 + 节点 */}
                          <div className="flex flex-col items-center flex-shrink-0">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-all"
                              style={{
                                background: isReplaying
                                  ? `color-mix(in srgb, var(--color-gold) 25%, transparent)`
                                  : `color-mix(in srgb, ${dc} 12%, transparent)`,
                                border: isReplaying
                                  ? `1px solid var(--color-gold)`
                                  : `1px solid color-mix(in srgb, ${dc} 35%, transparent)`,
                                color: isReplaying ? 'var(--color-gold)' : dc,
                                boxShadow: isReplaying ? `0 0 12px color-mix(in srgb, var(--color-gold) 40%, transparent)` : 'none',
                              }}
                            >
                              {event.seq}
                            </div>
                            {!isLast && (
                              <div
                                className="w-px flex-1 my-1"
                                style={{ background: 'color-mix(in srgb, var(--color-text) 8%, transparent)', minHeight: 16 }}
                              />
                            )}
                          </div>

                          {/* 内容 */}
                          <div className="pb-4 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="text-sm font-semibold"
                                style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-text)' }}
                              >
                                {event.stationLabel}
                              </span>
                              {event.decisionKind && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                                  style={{
                                    background: `color-mix(in srgb, ${dc} 12%, transparent)`,
                                    color: dc,
                                  }}
                                >
                                  {DECISION_LABEL[event.decisionKind]}
                                </span>
                              )}
                              <span
                                className="text-[10px] ml-auto"
                                style={{ color: 'var(--color-text-muted)' }}
                              >
                                {formatElapsedMs(event.elapsedMs)}
                              </span>
                            </div>

                            <div
                              className="mt-1 text-xs font-medium"
                              style={{ color: 'var(--color-gold)', opacity: 0.8 }}
                            >
                              {event.annotation}
                            </div>

                            <p
                              className="mt-1.5 text-[12px] leading-relaxed"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              {event.reasoning}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </GlassPanel>
              </div>
            </>
          ) : (
            <GlassPanel variant="default" tone="elevated" padding="lg" hudCorners className="flex-1">
              <div
                className="h-full flex flex-col items-center justify-center gap-3"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <span className="text-4xl">📜</span>
                <p className="text-sm">选择左侧案卷查看时间轴</p>
              </div>
            </GlassPanel>
          )}
        </div>
      </div>
    </div>
  )
}

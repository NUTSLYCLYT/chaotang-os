/**
 * 朝堂 Console · 奏折大厅 (Atrium)
 *
 * 黄金路径的首屏。遵循 70-UI_PRINCIPLES 全部原则：
 *   · 5 秒说清（hero 一行字 + 一个 CTA）
 *   · 单 CTA（"请奏事"输入框）
 *   · 零技术暴露（无 token/endpoint/LLM 文案）
 *   · 术语 TermTooltip
 *   · 仪式感：卷轴作为主角
 *
 * 布局：左侧历史奏折列表 + 右侧主区（CTA + 卷轴 + 调试条）
 * v1.2：打字机 placeholder + 完成烟花
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { GlassPanel } from '@/components/ui/glass-panel'
import { useCourtEventStream } from '../lib/event-bus-client'
import { PetitionScroll } from '../components/petition-scroll'
import { StationDrawer } from '../components/station-drawer'
import { TypewriterPlaceholder } from '../components/typewriter-placeholder'
import { PetitionConfetti } from '../components/petition-confetti'
import { HISTORY_PETITIONS } from '../lib/atrium-history-mock'
import type { CourtEvent } from '../types'

const PLACEHOLDERS = [
  '如：帮我分析这份供应商合同的风险点',
  '如：近 7 天电商大促的复盘摘要',
  '如：为下季度 HR 招聘盘出 3 个候选庄园',
]

const STATUS_MAP = {
  approved:  { label: '批红', color: 'var(--color-success)' },
  rejected:  { label: '驳回', color: 'var(--color-danger)' },
  suspended: { label: '留中', color: 'var(--color-warning)' },
}

export function AtriumPage() {
  const searchParams = useSearchParams()
  const [petitionId, setPetitionId] = useState<string | null>(null)
  const [submittedSituation, setSubmittedSituation] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<CourtEvent | null>(null)
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)
  const [confetti, setConfetti] = useState(false)
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 从 palace 活跃奏折榜跳转时，自动加载对应奏折
  useEffect(() => {
    const pid = searchParams.get('petition')
    const situation = searchParams.get('situation')
    if (pid && !petitionId) {
      setPetitionId(pid)
      setSubmittedSituation(situation ?? pid)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stream = useCourtEventStream(petitionId, {
    situation: submittedSituation ?? undefined,
  })

  // 检测最后一站（manor）committed 事件 → 触发烟花
  useEffect(() => {
    const hasCompletion = stream.events.some(
      (e) => e.stage === 'manor' && e.event_type === 'committed',
    )
    if (hasCompletion && !confetti) {
      setConfetti(true)
      confettiTimer.current = setTimeout(() => setConfetti(false), 2000)
    }
  }, [stream.events, confetti])

  useEffect(() => {
    return () => {
      if (confettiTimer.current) clearTimeout(confettiTimer.current)
    }
  }, [])

  const submit = () => {
    if (!draft.trim()) return
    setSubmittedSituation(draft.trim())
    setPetitionId(`pet_${Date.now().toString(36)}`)
    setActiveHistoryId(null)
    setConfetti(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  const loadHistory = (hid: string, summary: string) => {
    setActiveHistoryId(hid)
    setPetitionId(hid)
    setSubmittedSituation(summary)
    setDraft('')
    setConfetti(false)
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── 左侧 · 历史奏折列表 ── */}
      <aside
        className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 border-r overflow-y-auto"
        style={{
          borderColor: 'color-mix(in srgb, var(--color-gold) 12%, transparent)',
          background: 'color-mix(in srgb, var(--color-surface) 40%, transparent)',
        }}
      >
        <div
          className="px-4 pt-5 pb-3 text-[10px] uppercase tracking-[0.22em] flex-shrink-0"
          style={{ color: 'var(--color-text-muted)' }}
        >
          历史奏折
        </div>

        <div className="flex-1 space-y-0.5 px-2 pb-4">
          {HISTORY_PETITIONS.map((h) => {
            const s = STATUS_MAP[h.status]
            const isActive = activeHistoryId === h.id
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => loadHistory(h.id, h.summary)}
                className="w-full text-left rounded-md px-3 py-2.5 transition-colors group"
                style={{
                  background: isActive
                    ? 'color-mix(in srgb, var(--color-gold) 10%, transparent)'
                    : 'transparent',
                  borderLeft: isActive
                    ? '2px solid var(--color-gold)'
                    : '2px solid transparent',
                }}
              >
                <div
                  className="text-sm leading-snug truncate mb-1"
                  style={{
                    color: isActive ? 'var(--color-gold)' : 'var(--color-text)',
                  }}
                >
                  {h.title}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{
                      background: `color-mix(in srgb, ${s.color} 14%, transparent)`,
                      color: s.color,
                    }}
                  >
                    {s.label}
                  </span>
                  <span className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {h.manor} · {h.elapsed}
                  </span>
                </div>
                <div
                  className="text-[10px] mt-0.5"
                  style={{ color: 'color-mix(in srgb, var(--color-text-muted) 70%, transparent)' }}
                >
                  {h.createdAt}
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── 右侧 · 主区 ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5 max-w-3xl mx-auto">

          {/* Hero · 5 秒说清 */}
          <div className="text-center space-y-1">
            <h1
              className="text-2xl"
              style={{
                color: 'var(--color-gold)',
                letterSpacing: '0.04em',
                fontFamily: 'var(--font-serif)',
              }}
            >
              朝堂静候 · 请奏事
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              一事一奏折 · 观瞻六站流转 · 见其批红
            </p>
          </div>

          {/* 当前加载历史奏折时的提示条 */}
          {activeHistoryId && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded text-sm"
              style={{
                background: 'color-mix(in srgb, var(--color-gold) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-gold) 20%, transparent)',
                color: 'var(--color-text-muted)',
              }}
            >
              <span style={{ color: 'var(--color-gold)' }}>◷</span>
              <span>
                正在回放历史奏折
                <span className="mx-1" style={{ color: 'var(--color-text)' }}>
                  {HISTORY_PETITIONS.find(h => h.id === activeHistoryId)?.title}
                </span>
              </span>
              <button
                type="button"
                className="ml-auto text-xs underline"
                onClick={() => {
                  setActiveHistoryId(null)
                  setPetitionId(null)
                  setSubmittedSituation(null)
                }}
                style={{ color: 'var(--color-text-muted)' }}
              >
                退出回放
              </button>
            </div>
          )}

          {/* 主 CTA · 打字机 placeholder */}
          <GlassPanel variant="gold" padding="lg" hudCorners>
            <div className="space-y-3">
              <label
                htmlFor="petition-input"
                className="text-xs uppercase tracking-[0.2em]"
                style={{ color: 'var(--color-text-muted)' }}
              >
                请奏事 · Petition
              </label>
              <div className="relative">
                <textarea
                  id="petition-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder=""
                  rows={3}
                  className="w-full resize-none rounded border px-3 py-2 text-base outline-none transition-colors focus:border-[var(--color-gold-bright)]"
                  style={{
                    background: 'color-mix(in srgb, var(--color-surface) 60%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--color-gold) 30%, transparent)',
                    color: 'var(--color-text)',
                  }}
                />
                {/* 打字机 placeholder — 仅 draft 为空时显示 */}
                {!draft && (
                  <div
                    className="absolute top-2 left-3 text-base pointer-events-none select-none"
                    style={{ color: 'color-mix(in srgb, var(--color-text-muted) 60%, transparent)' }}
                  >
                    <TypewriterPlaceholder phrases={PLACEHOLDERS} />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  ⌘/Ctrl + Enter 递呈
                </span>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!draft.trim()}
                  className="px-5 py-1.5 rounded border text-sm transition-opacity disabled:opacity-40"
                  style={{
                    borderColor: 'var(--color-gold)',
                    color: 'var(--color-gold-bright)',
                    background: 'transparent',
                  }}
                >
                  递呈奏折
                </button>
              </div>
            </div>
          </GlassPanel>

          {/* 卷轴 · 主角 + 烟花覆盖层 */}
          <div className="relative min-h-[240px]">
            <PetitionConfetti active={confetti} />
            <PetitionScroll
              petitionId={petitionId}
              events={stream.events}
              onStationClick={setSelectedEvent}
            />
          </div>

          {/* 调试指标 · 配角（仅进行中时显示） */}
          {petitionId && (
            <GlassPanel padding="sm">
              <div
                className="text-[11px] tabular-nums flex gap-4 flex-wrap"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <span>
                  连接：
                  <span style={{ color: stream.connected ? 'var(--color-success)' : 'var(--color-warning)' }}>
                    {stream.connected ? '已连通' : '重连中'}
                  </span>
                </span>
                <span>事件：{stream.dedupedCount}</span>
                <span>缺口：{stream.gapCount}</span>
                <span>重连：{stream.reconnectCount}</span>
              </div>
            </GlassPanel>
          )}

        </div>
      </div>

      <StationDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  )
}

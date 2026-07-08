/**
 * 朝堂 Console · 站点详情 Drawer
 *
 * 点击卷轴印章弹出右侧抽屉。
 *
 * 严格遵守 Miller's 5-8 法则：站内信息组 ≤ 7：
 *   ① 站名 + 决策 badge
 *   ② 耗时
 *   ③ 使用模型
 *   ④ 批注原文（reasoning，主角）
 *   ⑤ 时间戳
 *   ⑥ 事件 id（debug 小字）
 *   ⑦ 关闭按钮
 *
 * 绝不放：token 数、cost、span_id（太技术 · 放 devtools 抽屉）
 */

'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import type { CourtEvent } from '../types'
import { stationLabel, stationExplain, GLOSSARY } from '../lib/glossary'
import { TermTooltip } from './term-tooltip'

/** 决策 badge 文案 */
const DECISION_LABEL: Record<string, string> = {
  approved: '已批红',
  rejected: '已驳回',
  suspended: '留中',
  forwarded: '转派下一站',
}

/** 决策 badge color via V2 tokens */
function badgeTokens(kind: string | null | undefined): { bg: string; border: string; color: string } {
  switch (kind) {
    case 'approved':
      return {
        bg: 'color-mix(in srgb, var(--color-gold) 18%, transparent)',
        border: 'var(--color-gold)',
        color: 'var(--color-gold-bright)',
      }
    case 'rejected':
      return {
        bg: 'color-mix(in srgb, var(--color-danger) 18%, transparent)',
        border: 'var(--color-danger)',
        color: 'var(--color-danger)',
      }
    case 'suspended':
      return {
        bg: 'color-mix(in srgb, var(--color-text-muted) 18%, transparent)',
        border: 'var(--color-text-dim)',
        color: 'var(--color-text-dim)',
      }
    default:
      return {
        bg: 'color-mix(in srgb, var(--color-gold-deep) 18%, transparent)',
        border: 'var(--color-gold-deep)',
        color: 'var(--color-text)',
      }
  }
}

export interface StationDrawerProps {
  /** 当前被查看的 committed 事件；null = 关闭 */
  event: CourtEvent | null
  onClose: () => void
}

export function StationDrawer({ event, onClose }: StationDrawerProps) {
  // ESC 关闭
  useEffect(() => {
    if (!event) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [event, onClose])

  return (
    <AnimatePresence>
      {event && (
        <>
          {/* 遮罩 */}
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: 'color-mix(in srgb, var(--color-bg-deep) 55%, transparent)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* 抽屉 */}
          <motion.aside
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] p-5 overflow-y-auto"
            style={{
              background: 'var(--color-surface)',
              borderLeft: '1px solid color-mix(in srgb, var(--color-gold) 30%, transparent)',
              boxShadow: '-8px 0 24px color-mix(in srgb, var(--color-bg-deep) 60%, transparent)',
            }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="station-drawer-title"
          >
            <DrawerContent event={event} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function DrawerContent({ event, onClose }: { event: CourtEvent; onClose: () => void }) {
  const label = stationLabel(event.station)
  const explain = stationExplain(event.station)
  const badge = badgeTokens(event.status_kind)
  const decisionText = event.status_kind ? DECISION_LABEL[event.status_kind] ?? event.status_kind : '处理中'

  // 时间格式
  const endedAt = event.ended_at ? new Date(event.ended_at) : null
  const timeText = endedAt
    ? `${endedAt.toLocaleDateString('zh-CN')} ${endedAt.toLocaleTimeString('zh-CN', { hour12: false })}`
    : '—'

  // 友化模型名（不暴露原始 model id）
  const modelFriendly = friendlyModel(event.model)

  return (
    <div className="space-y-5">
      {/* ① 站名 + 决策 badge */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <div
            className="text-[11px] uppercase tracking-[0.2em] mb-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            朝堂之站
          </div>
          <h2
            id="station-drawer-title"
            className="text-xl"
            style={{ color: 'var(--color-gold-bright)', fontFamily: 'var(--font-serif)' }}
          >
            {explain ? <TermTooltip term={label} explain={explain} /> : label}
          </h2>
        </div>

        <span
          className="px-3 py-1 rounded-full text-xs border"
          style={{ background: badge.bg, borderColor: badge.border, color: badge.color }}
        >
          {decisionText}
        </span>
      </header>

      {/* ② + ③ + ⑤ 耗时 · 模型 · 时间戳（3 项一组横排） */}
      <div
        className="grid grid-cols-3 gap-3 py-3 border-y"
        style={{
          borderColor: 'color-mix(in srgb, var(--color-gold) 15%, transparent)',
        }}
      >
        <MetaCell
          label="耗时"
          value={event.duration_ms != null ? `${(event.duration_ms / 1000).toFixed(1)} s` : '—'}
        />
        <MetaCell label="使臣" value={modelFriendly ?? '—'} />
        <MetaCell label="时辰" value={timeText} />
      </div>

      {/* ④ 批注原文 · 主角 */}
      <section aria-label="批注原文">
        <div
          className="text-[11px] uppercase tracking-[0.2em] mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          批注原文
        </div>
        {event.reasoning_ref ? (
          <div
            className="rounded p-4 text-sm leading-relaxed whitespace-pre-wrap"
            style={{
              background: 'var(--color-bg-deep)',
              border: '1px solid color-mix(in srgb, var(--color-gold) 12%, transparent)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-serif)',
            }}
          >
            {event.reasoning_ref}
          </div>
        ) : (
          <div
            className="text-sm italic"
            style={{ color: 'var(--color-text-muted)' }}
          >
            本站未留批注
          </div>
        )}
      </section>

      {/* ⑥ 事件 id · 仅 meta 小字 */}
      <div
        className="text-[10px] tabular-nums"
        style={{ color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)' }}
      >
        {event.event_id}
      </div>

      {/* ⑦ 关闭按钮 */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded border text-sm"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-gold) 40%, transparent)',
            color: 'var(--color-gold-bright)',
            background: 'transparent',
          }}
        >
          合卷
        </button>
      </div>
    </div>
  )
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[11px] uppercase tracking-[0.15em] mb-1"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </div>
      <div
        className="text-sm tabular-nums"
        style={{ color: 'var(--color-text)' }}
      >
        {value}
      </div>
    </div>
  )
}

/**
 * 把内部 model id 映射到"使臣"称谓（零技术暴露）
 * claude-haiku-*  → 近臣（轻快）
 * claude-sonnet-* → 高层（主力）
 * claude-opus-*   → 国老（重型）
 */
function friendlyModel(model: string | null): string | null {
  if (!model) return null
  if (model.includes('haiku')) return '近臣'
  if (model.includes('sonnet')) return '高层'
  if (model.includes('opus')) return '国老'
  return '文官'
}

// Keep GLOSSARY import alive (used indirectly)
void GLOSSARY

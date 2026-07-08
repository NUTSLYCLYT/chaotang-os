/**
 * 朝堂 Console · 奏折卷轴 (PetitionScroll)
 *
 * 核心视觉：横向 6 swimlane（太子 → 中书 → 门下 → 尚书 → 六部 → 庄园）
 *
 * 遵循 UI 原则：
 *   §2 黄金路径：这是主屏的主角，占 60%+ 屏幕高度
 *   §3 视觉层级：每站标题（配角，小号灰字） + 当前状态（主角：印章）
 *   §4 术语：站名包 TermTooltip
 *   §5 进度可见：进行中的站呼吸脉冲 + "太子正在思考..." 文案
 *   §6 仪式感：每站间用骑缝线分隔
 *
 * 数据驱动：根据 CourtEvent[] 推导每站状态：
 *   无 started 事件 → idle（灰）
 *   有 started 无 committed → running（金呼吸）
 *   有 committed → stamped（印章落下）
 *   有 aborted → rejected（朱红 X）
 */

'use client'

import { useMemo } from 'react'
import { motion } from 'motion/react'
import type { CourtEvent, PetitionStage, PetitionStation, DecisionKind } from '../types'
import { stageLabel, GLOSSARY, STAGES_IN_ORDER, stationLabel } from '../lib/glossary'
import { TermTooltip } from './term-tooltip'
import { StampDrop } from './stamp-drop'

interface StageAggregate {
  stage: PetitionStage
  started: CourtEvent | null
  committed: CourtEvent | null
  /** 若有 committed 则取其 decision */
  decision: DecisionKind | null
  /** 最近一次事件所在 station（六部/庄园会展开） */
  lastStation: string | null
}

function aggregateByStage(events: CourtEvent[]): Record<PetitionStage, StageAggregate> {
  const base = Object.fromEntries(
    STAGES_IN_ORDER.map((s) => [
      s,
      { stage: s, started: null, committed: null, decision: null, lastStation: null } as StageAggregate,
    ]),
  ) as Record<PetitionStage, StageAggregate>

  for (const e of events) {
    const agg = base[e.stage]
    if (!agg) continue
    if (e.event_type === 'started' && !agg.started) agg.started = e
    if (e.event_type === 'committed' || e.event_type === 'aborted') {
      agg.committed = e
      agg.decision = e.status_kind
    }
    agg.lastStation = e.station
  }

  return base
}

export interface PetitionScrollProps {
  /** 当前奏折 id（用于 aria） */
  petitionId: string | null
  /** 事件流（已按 seq 排序） */
  events: CourtEvent[]
  /** 点击某站的 committed 事件（用于弹 drawer） */
  onStationClick?: (event: CourtEvent) => void
}

export function PetitionScroll({ petitionId, events, onStationClick }: PetitionScrollProps) {
  const aggregates = useMemo(() => aggregateByStage(events), [events])

  return (
    <div className="w-full" role="region" aria-label="奏折流转卷轴">
      {/* 卷轴头部：奏折 id + hint */}
      <div className="flex items-center justify-between mb-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span>
          {petitionId ? (
            <>
              当前奏折 · <span style={{ color: 'var(--color-text)' }}>{petitionId}</span>
            </>
          ) : (
            '朝堂静候 · 点"请奏事"开始'
          )}
        </span>
        <span>太子 → 中书 → 门下 → 尚书 → 六部 → 庄园</span>
      </div>

      {/* 横向 6 swimlane */}
      <div
        className="grid grid-cols-6 gap-0 rounded overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--color-surface-2) 40%, transparent) 0%, color-mix(in srgb, var(--color-surface) 40%, transparent) 100%)',
          border: '1px solid color-mix(in srgb, var(--color-gold) 20%, transparent)',
        }}
      >
        {STAGES_IN_ORDER.map((stage, idx) => (
          <StationLane
            key={stage}
            stage={stage}
            agg={aggregates[stage]}
            isLast={idx === STAGES_IN_ORDER.length - 1}
            onClick={onStationClick}
          />
        ))}
      </div>
    </div>
  )
}

interface StationLaneProps {
  stage: PetitionStage
  agg: StageAggregate
  isLast: boolean
  onClick?: (event: CourtEvent) => void
}

function StationLane({ stage, agg, isLast, onClick }: StationLaneProps) {
  const { started, committed, decision, lastStation } = agg
  const isRunning = started && !committed
  const isDone = !!committed
  const isIdle = !started

  // 展示 label：六部/庄园展开到具体 station；治理层直接用 stage
  const displayKey = lastStation ?? stage
  const stageLabelText = stageLabel(stage)
  const stationLabelText = lastStation
    ? stationLabel(lastStation as PetitionStation)
    : stageLabelText

  const explain =
    lastStation && GLOSSARY[lastStation]?.explain
      ? GLOSSARY[lastStation].explain
      : stage === 'liubu'
      ? '六大执行部门之一'
      : stage === 'manor'
      ? '垂直能力军团'
      : GLOSSARY[displayKey]?.explain ?? ''

  const clickable = isDone && onClick
  const handleClick = () => {
    if (clickable && committed) onClick(committed)
  }
  const handleKey = (e: React.KeyboardEvent) => {
    if (!clickable || !committed) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(committed)
    }
  }

  return (
    <div
      className={`relative flex flex-col items-center p-4 min-h-[180px] transition-colors ${
        clickable ? 'cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-gold)_6%,transparent)]' : ''
      }`}
      style={{
        borderRight: isLast
          ? 'none'
          : '1px dashed color-mix(in srgb, var(--color-gold) 18%, transparent)',
      }}
      onClick={clickable ? handleClick : undefined}
      onKeyDown={clickable ? handleKey : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : -1}
      aria-label={clickable ? `查看${stationLabelText}站详情` : undefined}
    >
      {/* 站名 */}
      <div className="text-center mb-2">
        {explain ? (
          <TermTooltip term={stationLabelText} explain={explain} />
        ) : (
          <span>{stationLabelText}</span>
        )}
      </div>

      {/* 子标（stage label 在六部/庄园时显示） */}
      {stage !== 'taizi' && stage !== 'zhongshu' && stage !== 'menxia' && stage !== 'shangshu' && (
        <div
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {stageLabelText}
        </div>
      )}

      {/* 状态区（主角） */}
      <div className="flex-1 flex items-center justify-center">
        {isIdle && <IdleDot />}
        {isRunning && <RunningBreath stationName={stationLabelText} />}
        {isDone && (
          <StampDrop
            decision={decision}
            durationMs={committed?.duration_ms}
            stationName={stationLabelText}
          />
        )}
      </div>

      {/* 时间戳（配角） */}
      {committed?.duration_ms != null && (
        <div
          className="text-[10px] tabular-nums mt-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {(committed.duration_ms / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  )
}

function IdleDot() {
  return (
    <div
      className="w-2 h-2 rounded-full"
      style={{ background: 'color-mix(in srgb, var(--color-text-dim) 35%, transparent)' }}
      aria-label="未开始"
    />
  )
}

function RunningBreath({ stationName }: { stationName: string }) {
  return (
    <motion.div
      className="flex flex-col items-center"
      aria-live="polite"
      aria-label={`${stationName}正在处理`}
    >
      <motion.div
        className="w-4 h-4 rounded-full"
        style={{ background: 'var(--color-gold-bright)' }}
        animate={{ opacity: [0.35, 1, 0.35], scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="mt-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
        思考中
      </div>
    </motion.div>
  )
}

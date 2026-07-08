/**
 * 朝堂 Console · Event bus client（SSE 订阅 + 去重 + gap detection）
 *
 * Codex 防漏点：
 *   #1 状态原子性 — 只有 committed 事件驱动 swimlane 推进（在消费方判断）
 *   #2 顺序一致性 — per petition_id 去重，按 seq 检测 gap
 *   #4 tab 隔离 — 每个 hook 实例有独立 cursor/去重表（不共享 storage）
 *   #5 自监控 — 暴露 ingest_lag / reconnect / seen_event_count
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import type { CourtEvent } from '../types'

export interface BusClientOptions {
  /** 回放倍速（仅 mock 模式用，真 SSE 忽略） */
  speed?: number
  /** 自动重连延迟基线 ms（指数退避） */
  reconnectBaseMs?: number
  /** Last-Event-ID（断线续接） */
  lastEventId?: string
  /** 奏折原文（设置后服务端走真实 legal-agent，需配合 LEGAL_AGENT_URL） */
  situation?: string
  /** 庄园域（缺省由 situation 自动识别） */
  domain?: string
}

export interface BusClientState {
  events: CourtEvent[]
  lastEventId: string | null
  connected: boolean
  error: string | null
  /** 自监控：看到的事件总数（含重复） */
  ingestCount: number
  /** 自监控：去重后事件数 */
  dedupedCount: number
  /** 自监控：检测到的 seq gap 数 */
  gapCount: number
  /** 自监控：重连次数 */
  reconnectCount: number
}

/**
 * React hook 订阅一份奏折的事件流。
 * 按 event_id 去重，按 per-stage seq 检测 gap。
 */
export function useCourtEventStream(
  petitionId: string | null,
  opts: BusClientOptions = {},
): BusClientState {
  const [state, setState] = useState<BusClientState>({
    events: [],
    lastEventId: opts.lastEventId ?? null,
    connected: false,
    error: null,
    ingestCount: 0,
    dedupedCount: 0,
    gapCount: 0,
    reconnectCount: 0,
  })

  const seenIdsRef = useRef<Set<string>>(new Set())
  const lastSeqPerPetitionRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (!petitionId) return
    seenIdsRef.current.clear()
    lastSeqPerPetitionRef.current.clear()

    const url = new URL(`/api/court/petitions/${encodeURIComponent(petitionId)}/events`, window.location.origin)
    if (opts.speed)     url.searchParams.set('speed',     String(opts.speed))
    if (opts.situation) url.searchParams.set('situation', opts.situation)
    if (opts.domain)    url.searchParams.set('domain',    opts.domain)

    let cancelled = false
    let retry = 0
    let activeEs: EventSource | null = null

    function connect() {
      if (cancelled) return
      const es = new EventSource(url.toString())
      activeEs = es

      es.addEventListener('open', () => {
        setState((s) => ({ ...s, connected: true, error: null }))
      })

      es.addEventListener('court.v1', (raw) => {
        const msg = raw as MessageEvent<string>
        try {
          const event = JSON.parse(msg.data) as CourtEvent

          // 去重
          if (seenIdsRef.current.has(event.event_id)) {
            setState((s) => ({ ...s, ingestCount: s.ingestCount + 1 }))
            return
          }
          seenIdsRef.current.add(event.event_id)

          // Gap detection — 每条奏折内部 seq 单调递增
          const last = lastSeqPerPetitionRef.current.get(event.petition_id) ?? -1
          const gap = event.seq - last > 1 && last !== -1

          lastSeqPerPetitionRef.current.set(event.petition_id, Math.max(last, event.seq))

          setState((s) => ({
            ...s,
            events: [...s.events, event],
            lastEventId: event.event_id,
            ingestCount: s.ingestCount + 1,
            dedupedCount: s.dedupedCount + 1,
            gapCount: gap ? s.gapCount + 1 : s.gapCount,
          }))
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          setState((s) => ({ ...s, error: message }))
        }
      })

      es.addEventListener('error', () => {
        setState((s) => ({ ...s, connected: false }))
        es.close()
        if (cancelled) return
        // Exponential backoff, capped
        const delay = Math.min((opts.reconnectBaseMs ?? 500) * 2 ** retry, 10_000)
        retry += 1
        setTimeout(() => {
          setState((s) => ({ ...s, reconnectCount: s.reconnectCount + 1 }))
          connect()
        }, delay)
      })
    }

    connect()

    return () => {
      cancelled = true
      activeEs?.close()
      activeEs = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petitionId])

  return state
}

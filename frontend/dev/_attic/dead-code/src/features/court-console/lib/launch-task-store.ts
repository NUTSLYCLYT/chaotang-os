'use client'

import type {
  CourtEvent,
  LaunchTaskHistoryResponse,
  LaunchTaskRecord,
  LaunchTaskState,
} from '../types'
import type { AuditRecord, AuditTimelineEvent } from './audit-mock'
import { stationLabel } from './glossary'

const STORAGE_KEY = 'courtos.launchTasks.v1'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readRaw(): LaunchTaskRecord[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as LaunchTaskRecord[]
  } catch {
    return []
  }
}

function writeRaw(records: LaunchTaskRecord[]) {
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function listLaunchTasks(): LaunchTaskRecord[] {
  return readRaw().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export function upsertLaunchTask(record: LaunchTaskRecord) {
  const records = readRaw()
  const idx = records.findIndex((item) => item.requestId === record.requestId)
  if (idx >= 0) {
    records[idx] = record
  } else {
    records.unshift(record)
  }
  writeRaw(records)
}

export function patchLaunchTask(requestId: string, patch: Partial<LaunchTaskRecord>) {
  const records = readRaw()
  const current = records.find((item) => item.requestId === requestId)
  if (!current) return
  const next: LaunchTaskRecord = { ...current, ...patch }
  writeRaw(records.map((item) => (item.requestId === requestId ? next : item)))
}

export async function syncLaunchTaskRecord(requestId: string, patch: Partial<LaunchTaskRecord>) {
  try {
    await fetch(`/api/court/petitions/${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  } catch {
    // 首发阶段允许离线 fallback 到本地账本。
  }
}

export async function fetchLaunchTaskHistory(): Promise<LaunchTaskRecord[]> {
  const response = await fetch('/api/court/petitions/history', {
    method: 'GET',
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`history_fetch_failed:${response.status}`)
  }
  const data = (await response.json()) as LaunchTaskHistoryResponse
  return data.records
}

export async function fetchLaunchTaskRecord(requestId: string): Promise<LaunchTaskRecord | null> {
  const response = await fetch(`/api/court/petitions/${encodeURIComponent(requestId)}`, {
    method: 'GET',
    cache: 'no-store',
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`record_fetch_failed:${response.status}`)
  }
  return (await response.json()) as LaunchTaskRecord
}

function toDecisionKind(state: LaunchTaskState): AuditRecord['finalDecision'] {
  if (state === 'failed') return 'rejected'
  if (state === 'cancelled') return 'suspended'
  return 'approved'
}

function toAuditGroup(submittedAt: string): AuditRecord['group'] {
  const now = new Date()
  const submitted = new Date(submittedAt)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  if (submitted >= startOfToday) return 'today'
  if (submitted >= startOfYesterday) return 'yesterday'
  return 'before'
}

function toTimeline(events: CourtEvent[], summary?: string, errorMessage?: string): AuditTimelineEvent[] {
  const mapped = events.map<AuditTimelineEvent>((event) => ({
    seq: event.seq + 1,
    station: event.station,
    stationLabel: stationLabel(event.station),
    decisionKind: event.status_kind,
    elapsedMs: event.duration_ms ?? 800,
    reasoning: event.reasoning_ref || summary || errorMessage || '本站未留批注',
    annotation:
      event.event_type === 'aborted'
        ? '失败'
        : event.event_type === 'committed'
          ? '已提交结论'
          : '处理中',
  }))

  if (mapped.length > 0) return mapped

  return [
    {
      seq: 1,
      station: 'shangshu',
      stationLabel: '尚书',
      decisionKind: errorMessage ? 'rejected' : 'approved',
      elapsedMs: 1000,
      reasoning: summary || errorMessage || '任务已登记',
      annotation: errorMessage ? '执行失败' : '任务登记',
    },
  ]
}

export function launchTasksToAuditRecords(records: LaunchTaskRecord[]): AuditRecord[] {
  return records.map<AuditRecord>((record) => {
    const submitted = new Date(record.submittedAt)
    const timeLabel = submitted.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    return {
      id: `launch_${record.requestId}`,
      petitionId: record.requestId,
      title: record.userQuery.length > 26 ? `${record.userQuery.slice(0, 26)}…` : record.userQuery,
      group: toAuditGroup(record.submittedAt),
      timestamp: timeLabel,
      totalElapsedMs:
        record.events.reduce((sum, event) => sum + (event.duration_ms ?? 0), 0) || 1000,
      finalDecision: toDecisionKind(record.taskState),
      manor: stationLabel((record.response?.domain as never) ?? 'legal'),
      archived: false,
      timeline: toTimeline(record.events, record.summary, record.errorMessage),
    }
  })
}

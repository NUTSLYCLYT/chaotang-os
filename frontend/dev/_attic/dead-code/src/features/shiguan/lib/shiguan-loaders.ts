/**
 * 史馆 · fetch + 映射逻辑
 */

import type { ArchiveItem, ShiguanStats } from './shiguan-types'
import { withBasePath } from '@/lib/base-path'

type TaskPayload = {
  success?: boolean
  data?: Array<{
    id: string
    title?: string
    status?: string
    createdAt?: string
    plan?: { taskType?: string }
  }>
}

type GovPayload =
  | Array<{ id: string; title?: string; stage?: string; createdAt?: string; taskId?: string }>
  | {
      data?: Array<{
        id: string
        title?: string
        stage?: string
        createdAt?: string
        taskId?: string
      }>
    }

export async function fetchShiguanStats(): Promise<ShiguanStats | null> {
  try {
    const r = await fetch(withBasePath('/api/court/shiguan/stats'), { cache: 'no-store' })
    if (!r.ok) return null
    const data = (await r.json()) as Partial<ShiguanStats>
    if (typeof data.totalTasks !== 'number') return null
    return {
      totalTasks: data.totalTasks ?? 0,
      totalCases: data.totalCases ?? 0,
      successRate: data.successRate ?? 0,
    }
  } catch {
    return null
  }
}

export async function fetchArchive(): Promise<ArchiveItem[]> {
  const [tasksResult, govResult] = await Promise.allSettled([
    fetch(withBasePath('/api/court/backend/tasks?limit=50'), { cache: 'no-store' }).then((r) =>
      r.ok ? r.json() : null,
    ),
    fetch(withBasePath('/api/court/governance'), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
  ])

  const tasks: ArchiveItem[] = []
  const govCases: ArchiveItem[] = []

  if (tasksResult.status === 'fulfilled' && tasksResult.value !== null) {
    const payload = tasksResult.value as TaskPayload
    if (payload.success && Array.isArray(payload.data)) {
      for (const t of payload.data) {
        tasks.push({
          id: t.id,
          title: t.title ?? t.id,
          type: '蜂群任务',
          outcome:
            t.status === 'reviewed' || t.status === 'archived'
              ? 'success'
              : t.status === 'failed'
                ? 'failed'
                : 'pending',
          department: t.plan?.taskType ?? '战略司',
          date: t.createdAt ?? new Date().toISOString(),
          reportId: t.id,
        })
      }
    }
  }

  if (govResult.status === 'fulfilled' && govResult.value !== null) {
    const raw = govResult.value as GovPayload
    const govArray = Array.isArray(raw) ? raw : (raw.data ?? [])
    for (const g of govArray) {
      govCases.push({
        id: g.id,
        title: g.title ?? g.id,
        type: '治理议题',
        outcome:
          g.stage === 'decided' || g.stage === 'archived'
            ? 'success'
            : g.stage === 'blocked'
              ? 'blocked'
              : 'pending',
        department: '三省',
        date: g.createdAt ?? new Date().toISOString(),
        reportId: g.taskId,
        isGovernance: true,
      })
    }
  }

  return [...tasks, ...govCases].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

export async function generateShiguanAnalysis(): Promise<string | null> {
  const res = await fetch(withBasePath('/api/court/shiguan/analyze'), { method: 'POST' })
  if (!res.ok) return null
  const data = (await res.json()) as { analysis: string }
  return data.analysis
}

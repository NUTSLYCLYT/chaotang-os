'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { GlassPanel } from '@/components/ui/glass-panel'
import { LaunchGovernanceBanner } from '../components/launch-governance-banner'
import { fetchLaunchTaskRecord, listLaunchTasks } from '../lib/launch-task-store'
import type { LaunchTaskRecord } from '../types'

interface Props {
  petitionId: string
  simulateRenderError?: boolean
}

type LoadState = 'loading' | 'ready' | 'missing' | 'render_error'

export function ResultDetailPage({ petitionId, simulateRenderError = false }: Props) {
  const [record, setRecord] = useState<LaunchTaskRecord | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')

  useEffect(() => {
    let cancelled = false

    const loadRecord = async () => {
      try {
        const remote = await fetchLaunchTaskRecord(petitionId)
        if (cancelled) return
        if (remote) {
          setRecord(remote)
          setLoadState('ready')
          return
        }
      } catch {
        // 回退到本地账本。
      }

      if (cancelled) return
      const local = listLaunchTasks().find((item) => item.requestId === petitionId) ?? null
      setRecord(local)
      setLoadState(local ? 'ready' : 'missing')
    }

    void loadRecord()
    return () => {
      cancelled = true
    }
  }, [petitionId])

  useEffect(() => {
    if (loadState !== 'ready' || !record) return
    if (simulateRenderError) {
      setLoadState('render_error')
      return
    }
    const summary = record.summary ?? record.response?.summary
    if (record.taskState === 'completed' && !summary?.trim()) {
      setLoadState('render_error')
    }
  }, [loadState, record, simulateRenderError])

  const riskTone = useMemo(() => {
    const risk = record?.response?.risk_level
    if (risk === 'high') return 'var(--color-danger)'
    if (risk === 'medium') return 'var(--color-warning)'
    return 'var(--color-success)'
  }, [record])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1280px] space-y-5 p-6">
        <LaunchGovernanceBanner />
        <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="section-eyebrow">Launch Result · 首发结果页</div>
              <h2 className="section-title gold-text mt-1 text-[20px]">CourtOS 决策结果</h2>
              <div className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                petition_id: {petitionId}
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/court-console/atrium" className="rounded-md px-3 py-2 text-xs font-medium" style={{ background: 'color-mix(in srgb, var(--color-surface) 55%, transparent)', color: 'var(--color-text-muted)', border: '1px solid color-mix(in srgb, var(--color-text) 10%, transparent)' }}>
                返回奏折大厅
              </Link>
              <Link href={`/court-console/atrium?draft=${encodeURIComponent(record?.userQuery ?? '')}`} className="rounded-md px-3 py-2 text-xs font-medium" style={{ background: 'color-mix(in srgb, var(--color-info) 14%, transparent)', color: 'var(--color-info)', border: '1px solid color-mix(in srgb, var(--color-info) 24%, transparent)' }}>
                重新分析
              </Link>
              <Link href="/court-console/audit" className="rounded-md px-3 py-2 text-xs font-medium" style={{ background: 'color-mix(in srgb, var(--color-gold) 16%, transparent)', color: 'var(--color-gold-bright)', border: '1px solid color-mix(in srgb, var(--color-gold) 24%, transparent)' }}>
                查看刑部回档
              </Link>
            </div>
          </div>
        </GlassPanel>

        {loadState === 'loading' && <GlassPanel padding="md"><div className="text-sm" style={{ color: 'var(--color-text)' }}>正在加载正式结果记录。</div></GlassPanel>}

        {loadState === 'missing' && (
          <GlassPanel padding="md">
            <div className="space-y-2">
              <div className="text-sm" style={{ color: 'var(--color-danger)' }}>未找到该任务记录</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>当前结果页仅展示首发链路已登记到 CourtOS 账本的任务。</div>
            </div>
          </GlassPanel>
        )}

        {loadState === 'render_error' && record && (
          <GlassPanel padding="md">
            <div className="space-y-3">
              <div className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>结果渲染失败</div>
              <div className="text-xs leading-6" style={{ color: 'var(--color-text-muted)' }}>
                CourtOS 已拿到任务记录，但结果页缺少必要的结构化摘要，当前已按 `render_error` 进入受控回退。请返回 Audit 追踪原始记录，或回到 Atrium 发起重新分析。
              </div>
              <div className="rounded-md border px-4 py-3 text-xs" style={{ borderColor: 'color-mix(in srgb, var(--color-danger) 24%, transparent)', background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)', color: 'var(--color-danger)' }}>
                code: render_error · petition_id: {record.requestId}
              </div>
            </div>
          </GlassPanel>
        )}

        {record && loadState === 'ready' && (
          <>
            <div className="grid gap-5 md:grid-cols-3">
              <GlassPanel padding="md"><Metric label="任务状态" value={record.taskState} tone={record.taskState === 'failed' ? 'var(--color-danger)' : 'var(--color-gold)'} /></GlassPanel>
              <GlassPanel padding="md"><Metric label="归属庄园" value={record.response?.domain ?? record.domain} tone="var(--color-text)" /></GlassPanel>
              <GlassPanel padding="md"><Metric label="风险等级" value={record.response?.risk_level ?? 'pending'} tone={riskTone} /></GlassPanel>
            </div>

            {((record.response?.attack_vectors?.length ?? 0) > 0 || (record.response?.defense_vectors?.length ?? 0) > 0) && (
              <div className="grid gap-5 lg:grid-cols-2">
                <GlassPanel padding="md" hudCorners><ListBlock title="攻击向量" items={record.response?.attack_vectors ?? []} empty="当前无攻击向量。" /></GlassPanel>
                <GlassPanel padding="md" hudCorners><ListBlock title="防御向量" items={record.response?.defense_vectors ?? []} empty="当前无防御向量。" /></GlassPanel>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
              <GlassPanel padding="md" hudCorners>
                <div className="section-eyebrow">Decision Summary</div>
                <h3 className="mt-1 text-[16px] font-semibold" style={{ color: 'var(--color-text)' }}>{record.userQuery}</h3>
                <p className="mt-4 text-sm leading-7" style={{ color: 'var(--color-text)' }}>
                  {record.summary ?? record.response?.summary ?? record.errorMessage ?? '尚未返回结构化结果。'}
                </p>
              </GlassPanel>

              <GlassPanel padding="md" hudCorners>
                <div className="section-eyebrow">Trace</div>
                <div className="mt-3 space-y-3 text-sm">
                  <TraceRow label="submitted_at" value={record.submittedAt} />
                  <TraceRow label="updated_at" value={record.updatedAt ?? 'pending'} />
                  <TraceRow label="started_at" value={record.response?.trace?.started_at ?? 'pending'} />
                  <TraceRow label="completed_at" value={record.response?.trace?.completed_at ?? 'pending'} />
                  <TraceRow label="event_count" value={String(record.events.length)} />
                </div>
              </GlassPanel>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <GlassPanel padding="md" hudCorners><ListBlock title="建议动作" items={record.response?.recommendations ?? []} empty="当前无建议动作。" /></GlassPanel>
              <GlassPanel padding="md" hudCorners><ListBlock title="下一步" items={record.response?.next_actions ?? []} empty="当前无下一步动作。" /></GlassPanel>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div><div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'var(--color-text-muted)' }}>{label}</div><div className="mt-2 text-lg font-semibold" style={{ color: tone }}>{value}</div></div>
}

function TraceRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span style={{ color: 'var(--color-text-muted)' }}>{label}</span><span style={{ color: 'var(--color-text)' }}>{value}</span></div>
}

function ListBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <div className="section-eyebrow">{title}</div>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--color-gold) 14%, transparent)', background: 'color-mix(in srgb, var(--color-surface) 40%, transparent)', color: 'var(--color-text)' }}>{item}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>{empty}</div>
      )}
    </div>
  )
}

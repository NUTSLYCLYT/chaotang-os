'use client'

import { Loader2 } from 'lucide-react'
import type { AgentRun } from '@/types/agent'
import { AGENT_META, getNodeDisplayName } from '@/types/agent'
import { confidenceInPlainWords } from '@/features/throne/lib/plain-language'

/**
 * RunCard — 陛下视图 · 单个 agent 回禀卡
 *
 * 从 throne/brief/[taskId]/page.tsx 抽出，保持该页瘦身 <450 行。
 */
export function RunCard({ run }: { run: AgentRun }) {
  const meta = AGENT_META[run.agentCode]
  const confidenceText =
    run.confidence !== undefined ? confidenceInPlainWords(run.confidence) : null

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: `${meta.color}33`,
        background: `linear-gradient(180deg, ${meta.color}08, rgba(10,8,4,0.6))`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[22px]"
          style={{
            background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}08)`,
            border: `1px solid ${meta.color}55`,
          }}
        >
          {meta.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-semibold" style={{ color: meta.color }}>
              {meta.nameCn}
            </span>
            <span className="text-[11px] text-[#484F72]">{meta.nameEn}</span>
          </div>
          <div className="mt-1 text-[11px] text-[#9AA3C4]">
            {run.state === 'running' && (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" />
                正在办理
              </span>
            )}
            {run.state === 'completed' && <span className="text-[#3DD68C]">已办毕</span>}
            {run.state === 'waiting_dependency' && '等候先行任务'}
            {run.state === 'idle' && '待命'}
          </div>

          {(run.assignedNodeId || run.routingNodeIds?.length) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(run.routingNodeIds?.length
                ? run.routingNodeIds
                : run.assignedNodeId
                  ? [run.assignedNodeId]
                  : []
              ).map((nodeId) => (
                <span
                  key={nodeId}
                  className="rounded-full border border-[#F0C66A]/25 bg-[#F0C66A]/10 px-2 py-0.5 text-[9px] text-[#D9C79A]"
                >
                  {getNodeDisplayName(nodeId)}
                </span>
              ))}
            </div>
          )}

          {run.latestSummary && (
            <p className="mt-3 text-[12px] leading-relaxed text-[#EAEEFB]">
              <span style={{ color: meta.color }}>回禀 — </span>
              {run.latestSummary}
            </p>
          )}

          {confidenceText && (
            <div className="mt-3 flex items-center gap-2 text-[11px]">
              <span className="text-[#6A7299]">把握度：</span>
              <span
                style={{
                  color:
                    confidenceText.tone === 'green'
                      ? '#3DD68C'
                      : confidenceText.tone === 'red'
                        ? '#F43F5E'
                        : '#F0C66A',
                }}
              >
                {confidenceText.label}
              </span>
              <span className="text-[#484F72]">·</span>
              <span className="text-[#9AA3C4]">{confidenceText.advice}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

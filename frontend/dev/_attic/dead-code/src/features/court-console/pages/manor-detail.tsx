'use client'

/**
 * 朝堂 Console · 庄园巡按 详情页 (CC-011)
 *
 * 信息组 5（符合 Miller 5-8）：
 *   ① Hero KPI 4 指标
 *   ② 蜂群节点状态（7 节点 hex 布局）
 *   ③ 近期案卷 Top 7
 *   ④ 红蓝队摘要（折叠）
 *   ⑤ 周趋势迷你图
 *
 * 结构继承 V2 /overview 骨架
 */

import { useState } from 'react'
import Link from 'next/link'
import { GlassPanel } from '@/components/ui/glass-panel'
import { MANOR_SUMMARIES, HEALTH_COLOR, HEALTH_LABEL, formatElapsed } from '../lib/manors-mock'
import {
  getManorDetail,
  STATUS_LABEL,
  type SwarmNode,
  type CaseRecord,
  type RiskSummary,
} from '../lib/manor-detail-mock'

const STATUS_COLOR: Record<CaseRecord['status'], string> = {
  approved: 'var(--color-success)',
  rejected: 'var(--color-danger)',
  suspended: 'var(--color-warning)',
  in_progress: 'var(--color-info)',
}

const NODE_STATUS_COLOR: Record<SwarmNode['status'], string> = {
  active: 'var(--color-success)',
  busy: 'var(--color-warning)',
  idle: 'var(--color-text-muted)',
}

const SEVERITY_COLOR: Record<RiskSummary['severity'], string> = {
  high: 'var(--color-danger)',
  medium: 'var(--color-warning)',
  low: 'var(--color-info)',
}

interface Props {
  code: string
}

export function ManorDetailPage({ code }: Props) {
  const [redBlueOpen, setRedBlueOpen] = useState(false)

  const manor = MANOR_SUMMARIES.find(m => m.code === code)
  const detail = getManorDetail(code)

  if (!manor) {
    return (
      <div className="p-6">
        <GlassPanel variant="danger" padding="md" hudCorners>
          <p style={{ color: 'var(--color-danger)' }}>庄园 [{code}] 不在档案库中</p>
          <Link
            href="/court-console/court-manors"
            className="mt-2 block text-sm"
            style={{ color: 'var(--color-gold)' }}
          >
            ← 返回庄园列表
          </Link>
        </GlassPanel>
      </div>
    )
  }

  const healthColor = HEALTH_COLOR[manor.health]
  const weekMax = Math.max(...detail.weeklyTrend.map(d => d.cases), 1)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] space-y-5 p-6">

        {/* 面包屑 */}
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <Link
            href="/court-console/court-manors"
            className="hover:underline transition-opacity"
            style={{ color: 'var(--color-gold)' }}
          >
            庄园巡按
          </Link>
          <span className="opacity-40">›</span>
          <span>{manor.label}</span>
        </div>

        {/* 组 ① Hero KPI */}
        <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="section-eyebrow">{manor.label} · {manor.title}</div>
              <h2 className="section-title gold-text mt-1 text-[20px] flex items-center gap-2">
                <span>{manor.icon}</span>
                <span>{manor.chiefTitle} · {manor.chiefName}</span>
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: healthColor, boxShadow: `0 0 8px ${healthColor}` }}
                />
                <span className="text-sm font-normal" style={{ color: healthColor }}>
                  {HEALTH_LABEL[manor.health]}
                </span>
              </h2>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCell label="今日接案" value={manor.todayCases} unit="件" />
            <KpiCell
              label="批红率"
              value={(manor.approvedRate * 100).toFixed(0)}
              unit="％"
              highlight
            />
            <KpiCell label="待处理" value={manor.pendingCases} unit="件" alert={manor.pendingCases > 5} />
            <KpiCell label="平均耗时" value={formatElapsed(manor.avgElapsedMs)} unit="" />
          </div>
        </GlassPanel>

        <div className="grid md:grid-cols-12 gap-5">

          {/* 组 ② 蜂群节点 + 组 ⑤ 周趋势 · 左列 */}
          <div className="md:col-span-5 space-y-5">

            {/* 蜂群节点 hex 布局 */}
            <GlassPanel variant="default" tone="elevated" padding="md" hudCorners>
              <div className="section-eyebrow">Swarm · 蜂群节点</div>
              <h3 className="section-title mt-0.5 text-[15px]" style={{ color: 'var(--color-text)' }}>
                {detail.swarmNodes.length} 位近臣
              </h3>
              <div className="mt-4">
                <HexSwarm nodes={detail.swarmNodes} />
              </div>
              {/* 图例 */}
              <div className="mt-3 flex items-center gap-4 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-success)' }} />
                  活跃
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-warning)' }} />
                  繁忙
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-text-muted)' }} />
                  空闲
                </span>
              </div>
            </GlassPanel>

            {/* 组 ⑤ 周趋势迷你图 */}
            <GlassPanel variant="default" tone="elevated" padding="md" hudCorners>
              <div className="section-eyebrow">Weekly · 本周趋势</div>
              <div className="mt-3 flex items-end gap-2 h-16">
                {detail.weeklyTrend.map(d => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end" style={{ height: 48 }}>
                      {/* total bar */}
                      <div
                        className="w-full rounded-sm"
                        style={{
                          height: `${(d.cases / weekMax) * 48}px`,
                          background: 'color-mix(in srgb, var(--color-gold) 20%, transparent)',
                        }}
                      >
                        {/* approved overlay */}
                        <div
                          className="w-full rounded-sm"
                          style={{
                            height: `${(d.approved / d.cases) * 100}%`,
                            background: 'color-mix(in srgb, var(--color-gold) 60%, transparent)',
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
                      {d.day}
                    </span>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>

          {/* 组 ③ 近期案卷 + 组 ④ 红蓝队 · 右列 */}
          <div className="md:col-span-7 space-y-5">

            {/* 近期案卷 Top 7 */}
            <GlassPanel variant="default" tone="elevated" padding="md" hudCorners>
              <div className="section-eyebrow">Recent Cases · 近期案卷</div>
              <h3 className="section-title mt-0.5 text-[15px]" style={{ color: 'var(--color-text)' }}>
                最近 {detail.recentCases.length} 件
              </h3>
              <div className="mt-3 space-y-2">
                {detail.recentCases.map((c, i) => (
                  <CaseRow key={c.id} record={c} index={i + 1} />
                ))}
                {detail.recentCases.length === 0 && (
                  <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    暂无近期案卷
                  </p>
                )}
              </div>
            </GlassPanel>

            {/* 红蓝队摘要（折叠） */}
            <GlassPanel variant="default" tone="elevated" padding="md" hudCorners>
              <button
                className="w-full flex items-center justify-between"
                onClick={() => setRedBlueOpen(v => !v)}
              >
                <div className="text-left">
                  <div className="section-eyebrow">Red & Blue · 红蓝队</div>
                  <h3 className="section-title mt-0.5 text-[15px]" style={{ color: 'var(--color-text)' }}>
                    {detail.redBlue.length} 条摘要
                  </h3>
                </div>
                <span
                  className="text-lg transition-transform"
                  style={{
                    color: 'var(--color-gold)',
                    transform: redBlueOpen ? 'rotate(180deg)' : 'rotate(0)',
                  }}
                >
                  ▾
                </span>
              </button>

              {redBlueOpen && (
                <div className="mt-4 space-y-3">
                  {detail.redBlue.map((r, i) => (
                    <RiskCard key={i} risk={r} />
                  ))}
                  {detail.redBlue.length === 0 && (
                    <p className="text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>
                      暂无红蓝队摘要
                    </p>
                  )}
                </div>
              )}
            </GlassPanel>

          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function KpiCell({
  label,
  value,
  unit,
  highlight,
  alert,
}: {
  label: string
  value: number | string
  unit: string
  highlight?: boolean
  alert?: boolean
}) {
  const valueColor = alert
    ? 'var(--color-warning)'
    : highlight
      ? 'var(--color-gold)'
      : 'var(--color-text)'
  return (
    <div
      className="rounded-md px-3 py-2"
      style={{ background: 'color-mix(in srgb, var(--color-gold) 6%, transparent)' }}
    >
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span
          className="text-2xl font-semibold"
          style={{ fontFamily: 'var(--font-serif)', color: valueColor }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

function HexSwarm({ nodes }: { nodes: SwarmNode[] }) {
  // 7-node layout: top row 3, middle row (chief) 1, bottom row 3
  // simplified as two rows: 3 + 4 with offset for hex feel
  const topRow = nodes.slice(0, 3)
  const bottomRow = nodes.slice(3, 7)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-3">
        {topRow.map(node => (
          <NodeHex key={node.id} node={node} />
        ))}
      </div>
      <div className="flex gap-3" style={{ marginLeft: 36 }}>
        {bottomRow.map(node => (
          <NodeHex key={node.id} node={node} />
        ))}
      </div>
    </div>
  )
}

function NodeHex({ node }: { node: SwarmNode }) {
  const color = NODE_STATUS_COLOR[node.status]
  return (
    <div
      className="flex flex-col items-center gap-1 w-16"
      title={`${node.nameCn} · ${node.role} · 今日 ${node.casesToday} 件`}
    >
      <div
        className="w-12 h-12 flex items-center justify-center rounded-full text-sm font-semibold"
        style={{
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
          boxShadow: `0 0 8px color-mix(in srgb, ${color} 25%, transparent)`,
          color,
          fontFamily: 'var(--font-serif)',
        }}
      >
        {node.casesToday}
      </div>
      <div className="text-center">
        <div className="text-[9px] leading-tight" style={{ color: 'var(--color-text-muted)' }}>
          {node.role}
        </div>
        <div className="text-[10px] leading-tight" style={{ color: 'var(--color-text)' }}>
          {node.nameCn}
        </div>
      </div>
    </div>
  )
}

function CaseRow({ record, index }: { record: CaseRecord; index: number }) {
  const statusColor = STATUS_COLOR[record.status]
  return (
    <div
      className="flex items-center gap-3 py-1.5 px-2 rounded-md"
      style={{
        background:
          index % 2 === 0
            ? 'color-mix(in srgb, var(--color-text) 3%, transparent)'
            : 'transparent',
      }}
    >
      <span className="text-xs w-4 text-center flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
        {index}
      </span>
      <span className="flex-1 text-sm truncate" style={{ color: 'var(--color-text)' }}>
        {record.title}
      </span>
      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
        {record.timestamp}
      </span>
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{
          background: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
          color: statusColor,
        }}
      >
        {STATUS_LABEL[record.status]}
      </span>
    </div>
  )
}

function RiskCard({ risk }: { risk: RiskSummary }) {
  const teamColor = risk.team === 'red' ? 'var(--color-danger)' : 'var(--color-info)'
  const sevColor = SEVERITY_COLOR[risk.severity]
  return (
    <div
      className="rounded-md p-3"
      style={{
        background: `color-mix(in srgb, ${teamColor} 6%, transparent)`,
        border: `1px solid color-mix(in srgb, ${teamColor} 20%, transparent)`,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{
            background: `color-mix(in srgb, ${teamColor} 20%, transparent)`,
            color: teamColor,
          }}
        >
          {risk.team === 'red' ? '红队' : '蓝队'}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            background: `color-mix(in srgb, ${sevColor} 15%, transparent)`,
            color: sevColor,
          }}
        >
          {risk.severity === 'high' ? '高' : risk.severity === 'medium' ? '中' : '低'}
        </span>
        <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
          {risk.title}
        </span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        {risk.content}
      </p>
    </div>
  )
}

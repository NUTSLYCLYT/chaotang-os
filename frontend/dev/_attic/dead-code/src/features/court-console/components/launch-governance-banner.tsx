'use client'

import Link from 'next/link'
import {
  getLaunchEnvironment,
  getLaunchEnvironmentLabel,
  getLaunchEnvironmentTone,
  requiresLaunchConfirmation,
} from '../lib/launch-governance'

export function LaunchGovernanceBanner() {
  const environment = getLaunchEnvironment()
  const tone = getLaunchEnvironmentTone(environment)
  const label = getLaunchEnvironmentLabel(environment)
  const confirmation = requiresLaunchConfirmation()

  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{
        borderColor: 'color-mix(in srgb, var(--color-gold) 18%, transparent)',
        background: 'color-mix(in srgb, var(--color-surface) 52%, transparent)',
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'var(--color-text-muted)' }}>
            Launch Governance
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{
                background: `color-mix(in srgb, ${tone} 14%, transparent)`,
                color: tone,
              }}
            >
              {label}
            </span>
            <span>首发链路处于受控环境，所有结果应可追溯、可解释、可回档。</span>
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {confirmation ? '提交前需要明确确认受控执行。' : '当前环境未强制提交确认。'}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href="/court-console/audit"
            className="rounded-md px-3 py-2 text-xs font-medium"
            style={{
              background: 'color-mix(in srgb, var(--color-surface) 55%, transparent)',
              color: 'var(--color-text-muted)',
              border: '1px solid color-mix(in srgb, var(--color-text) 10%, transparent)',
            }}
          >
            查看回档
          </Link>
          <Link
            href="/api/court/launch/health"
            className="rounded-md px-3 py-2 text-xs font-medium"
            style={{
              background: 'color-mix(in srgb, var(--color-gold) 16%, transparent)',
              color: 'var(--color-gold-bright)',
              border: '1px solid color-mix(in srgb, var(--color-gold) 24%, transparent)',
            }}
          >
            健康接口
          </Link>
        </div>
      </div>
    </div>
  )
}

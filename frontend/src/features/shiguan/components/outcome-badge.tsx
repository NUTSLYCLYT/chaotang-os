'use client'

import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { colors } from '@/config/design-tokens'
import type { CaseOutcome } from '../lib/shiguan-types'

export function OutcomeBadge({ outcome }: { outcome: CaseOutcome }) {
  const map: Record<CaseOutcome, { label: string; color: string; icon: React.ReactNode }> = {
    success: {
      label: '成功',
      color: colors.success,
      icon: <CheckCircle2 size={11} />,
    },
    blocked: {
      label: '封驳',
      color: colors.danger,
      icon: <XCircle size={11} />,
    },
    failed: {
      label: '失败',
      color: colors.warning,
      icon: <AlertTriangle size={11} />,
    },
    pending: {
      label: '进行中',
      color: colors.textMuted,
      icon: null,
    },
  }
  const cfg = map[outcome]
  return (
    <span
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
      style={{ color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

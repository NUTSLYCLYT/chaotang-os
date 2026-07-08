'use client'

import Link from 'next/link'
import { Archive } from 'lucide-react'
import { colors } from '@/config/design-tokens'
import { ImperialHero } from '@/features/shared/components/imperial'
import type { ShiguanStats } from '../lib/shiguan-types'

function SummaryBand({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="text-[11px] uppercase tracking-[0.15em] text-[#8F835F]">{label}</div>
      <div className="mt-1.5 text-[22px] font-semibold" style={{ color: color ?? '#F5E9C9' }}>
        {value}
      </div>
    </div>
  )
}

export function ShiguanHero({
  stats,
  totalItems,
  thisMonthCount,
  govCount,
  successRate,
}: {
  stats: ShiguanStats | null
  totalItems: number
  thisMonthCount: number
  govCount: number
  successRate: number
}) {
  const rate = stats?.successRate ?? successRate
  return (
    <ImperialHero
      eyebrow="太史馆"
      icon={Archive}
      title="太史馆 · 太史令总档"
      decree="朝堂已结案的治理议题与蜂群任务尽录于此，供太史令辨其规律、为下一次裁断立先例。"
      leftSlot={
        <div className="flex gap-2">
          <Link
            href="/governance"
            className="rounded-full border border-[#F0C66A]/35 bg-[#F0C66A]/10 px-4 py-2 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16"
          >
            去三省审议台
          </Link>
          <Link
            href="/scribe"
            className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-[#EAEEFB] transition hover:bg-white/5"
          >
            去复盘台记忆线
          </Link>
        </div>
      }
    >
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryBand label="档案总数" value={`${stats?.totalTasks ?? totalItems}`} />
        <SummaryBand label="本月案件" value={`${thisMonthCount}`} color={colors.blueBright} />
        <SummaryBand
          label="治理议题"
          value={`${stats?.totalCases ?? govCount}`}
          color={colors.goldBright}
        />
        <SummaryBand
          label="综合成功率"
          value={`${rate}%`}
          color={rate >= 80 ? colors.success : colors.warning}
        />
      </div>
    </ImperialHero>
  )
}

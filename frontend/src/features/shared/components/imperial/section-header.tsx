import type { ReactNode } from 'react'

export interface SectionHeaderProps {
  label: string
  sub: string
  right?: ReactNode
}

/**
 * SectionHeader — 皇帝体区块标题
 *
 * 视觉契约来自 throne/brief/[taskId] 基准页（原内联 SectionHeader 函数）。
 */
export function SectionHeader({ label, sub, right }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="display-serif text-[18px] font-bold text-[#FBF7EC]">{label}</h2>
        <div className="text-[11px] uppercase tracking-wider text-[#6A7299]">{sub}</div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  )
}

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export interface ImperialHeroProps {
  eyebrow?: string
  icon?: LucideIcon
  title: string
  decree?: string
  leftSlot?: ReactNode
  rightSlot?: ReactNode
  children?: ReactNode
  accent?: 'gold' | 'info' | 'danger' | 'success'
}

/**
 * ImperialHero — 黑金皇帝风 Hero 区
 *
 * 视觉契约来自 throne/brief/[taskId] 基准页。
 * 初版仅实现 accent='gold'（默认）+ accent='danger'（权限/错误拒绝场景）。
 *
 * leftSlot / rightSlot 仅用于 KPI badge 或 action button；超出请开新 variant。
 */
export function ImperialHero({
  eyebrow,
  icon: Icon,
  title,
  decree,
  leftSlot,
  rightSlot,
  children,
  accent = 'gold',
}: ImperialHeroProps) {
  const { borderColor, background, eyebrowColor, decreeTint } = getAccentTokens(accent)

  return (
    <section
      className="relative overflow-hidden rounded-2xl border p-8 md:p-12"
      style={{
        borderColor,
        background,
      }}
    >
      {(eyebrow || rightSlot) && (
        <div className="flex items-start justify-between gap-4">
          {eyebrow ? (
            <div
              className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em]"
              style={{ color: eyebrowColor }}
            >
              {Icon ? <Icon size={11} /> : null}
              {eyebrow}
            </div>
          ) : (
            <div />
          )}
          {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
        </div>
      )}

      <h1 className="display-serif mt-3 text-[26px] font-bold leading-tight text-[#FBF7EC] md:text-[34px]">
        {title}
      </h1>

      {children}

      {decree ? (
        <p className="display-serif mt-6 rounded-md border border-white/5 bg-black/20 p-4 text-[13px] leading-relaxed text-[#C8CDD8]">
          <span style={{ color: decreeTint }}>陛下原旨 — </span>
          {decree}
        </p>
      ) : null}

      {leftSlot ? <div className="mt-6">{leftSlot}</div> : null}
    </section>
  )
}

function getAccentTokens(accent: NonNullable<ImperialHeroProps['accent']>) {
  switch (accent) {
    case 'danger':
      return {
        borderColor: 'rgba(244,63,94,0.35)',
        background:
          'radial-gradient(ellipse 120% 60% at 50% 0%, rgba(244,63,94,0.12), transparent 60%), linear-gradient(180deg, rgba(18,6,10,0.9), rgba(4,6,14,0.9))',
        eyebrowColor: '#F43F5E',
        decreeTint: '#F43F5E',
      }
    case 'gold':
    default:
      return {
        borderColor: 'rgba(240,198,106,0.3)',
        background:
          'radial-gradient(ellipse 120% 60% at 50% 0%, rgba(240,198,106,0.1), transparent 60%), linear-gradient(180deg, rgba(10,8,4,0.9), rgba(4,6,14,0.9))',
        eyebrowColor: '#F0C66A',
        decreeTint: '#F0C66A',
      }
  }
}

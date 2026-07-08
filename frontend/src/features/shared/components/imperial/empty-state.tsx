import Link from 'next/link'
import { Scroll, type LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  body?: string
  action?: { label: string; href: string }
  tone?: 'default' | 'locked' | 'error'
}

/**
 * EmptyState — 典雅皇帝体空状态卡
 *
 * tone:
 * - default: 灰调（暂无数据 / 未查到）
 * - locked:  金调（权限/解锁提示）
 * - error:   红调（送达失败等）
 */
export function EmptyState({
  icon: Icon = Scroll,
  title,
  body,
  action,
  tone = 'default',
}: EmptyStateProps) {
  const { borderColor, background, iconColor, titleColor, bodyColor, actionColor } =
    getToneTokens(tone)

  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center"
      style={{ borderColor, background }}
    >
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        <Icon size={20} style={{ color: iconColor }} />
      </div>
      <div
        className="display-serif text-[14px] font-semibold"
        style={{ color: titleColor }}
      >
        {title}
      </div>
      {body ? (
        <p
          className="mt-2 max-w-[320px] text-[12px] leading-relaxed"
          style={{ color: bodyColor }}
        >
          {body}
        </p>
      ) : null}
      {action ? (
        <Link
          href={action.href}
          className="mt-4 inline-block rounded-md border px-4 py-1.5 text-[11px] transition-colors hover:bg-white/5"
          style={{ borderColor: 'rgba(255,255,255,0.15)', color: actionColor }}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}

function getToneTokens(tone: NonNullable<EmptyStateProps['tone']>) {
  switch (tone) {
    case 'locked':
      return {
        borderColor: 'rgba(240,198,106,0.3)',
        background: 'rgba(240,198,106,0.04)',
        iconColor: '#F0C66A',
        titleColor: '#FBF7EC',
        bodyColor: '#C8CDD8',
        actionColor: '#F0C66A',
      }
    case 'error':
      return {
        borderColor: 'rgba(244,63,94,0.3)',
        background: 'rgba(244,63,94,0.04)',
        iconColor: '#F43F5E',
        titleColor: '#EAEEFB',
        bodyColor: '#C8CDD8',
        actionColor: '#EAEEFB',
      }
    case 'default':
    default:
      return {
        borderColor: 'rgba(255,255,255,0.1)',
        background: 'rgba(10,8,4,0.5)',
        iconColor: '#6A7299',
        titleColor: '#EAEEFB',
        bodyColor: '#9AA3C4',
        actionColor: '#9AA3C4',
      }
  }
}

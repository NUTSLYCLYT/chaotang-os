'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavTab {
  href: string
  icon: string
  cn: string
  en: string
  badge?: number
}

const TABS: NavTab[] = [
  { href: '/court-console/atrium',       icon: '⛩',  cn: '朝廷入口', en: 'Atrium' },
  { href: '/court-console/palace',       icon: '🏯',  cn: '奉天殿',   en: 'Palace' },
  { href: '/court-console/court-manors', icon: '🏡',  cn: '庄园巡按', en: 'Manors', badge: 8 },
  { href: '/court-console/audit',        icon: '📜',  cn: '刑部回档', en: 'Audit' },
  { href: '/court-console/gazette',      icon: '📰',  cn: '朝报',     en: 'Gazette' },
]

export function ConsoleNav() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  return (
    <nav
      aria-label="朝堂 Console 模块导航"
      style={{
        height: 44,
        borderBottom: '1px solid #2C3560',
        background: 'rgba(10,14,30,0.98)',
        display: 'flex',
        alignItems: 'stretch',
        padding: '0 20px',
        gap: 0,
        flexShrink: 0,
      }}
    >
      {TABS.map((tab, i) => {
        const active = isActive(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '0 16px',
              color: active ? 'var(--color-gold)' : 'var(--color-text-muted)',
              fontSize: 12,
              textDecoration: 'none',
              borderBottom: active
                ? '2px solid var(--color-gold)'
                : '2px solid transparent',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
              position: 'relative',
              borderRight: i < TABS.length - 1
                ? '1px solid #1A2142'
                : 'none',
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>{tab.icon}</span>
            <span>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-serif)',
                  lineHeight: 1.2,
                }}
              >
                {tab.cn}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 10,
                  opacity: 0.55,
                  lineHeight: 1.2,
                }}
              >
                {tab.en}
              </span>
            </span>
            {tab.badge !== undefined && (
              <span
                style={{
                  fontSize: 9,
                  background: active
                    ? 'color-mix(in srgb, var(--color-gold) 20%, transparent)'
                    : 'color-mix(in srgb, var(--color-text) 10%, transparent)',
                  color: active ? 'var(--color-gold)' : 'var(--color-text-muted)',
                  padding: '1px 5px',
                  borderRadius: 99,
                  marginLeft: 2,
                }}
              >
                {tab.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function EnterPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') ?? ''
  const [phase, setPhase] = useState<'checking' | 'granted' | 'denied'>('checking')

  useEffect(() => {
    if (!token) {
      setPhase('denied')
      return
    }
    setTimeout(() => {
      setPhase('granted')
      setTimeout(() => {
        router.push(`/dadian?token=${encodeURIComponent(token)}`)
      }, 2000)
    }, 1500)
  }, [token, router])

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at center, #0A1020 0%, #04060E 100%)' }}
    >
      {/* Gold decorative ring */}
      <div
        className="mb-8 flex h-24 w-24 items-center justify-center rounded-full"
        style={{
          border: '1px solid rgba(240,198,106,0.3)',
          background: 'rgba(240,198,106,0.05)',
          boxShadow: phase === 'granted' ? '0 0 60px rgba(240,198,106,0.2)' : 'none',
          transition: 'box-shadow 1s ease',
        }}
      >
        <span className="text-[40px]">{phase === 'denied' ? '🚫' : '⚖️'}</span>
      </div>

      <div className="text-[11px] uppercase tracking-[0.4em] text-[#8F835F]">
        {phase === 'checking' && 'Verifying Imperial Invitation · 核验入朝令牌'}
        {phase === 'granted' && 'Access Granted · 令牌有效，正在开殿'}
        {phase === 'denied' && 'Access Denied · 令牌无效或已过期'}
      </div>

      <h1
        className="mt-4 text-[28px] font-semibold"
        style={{
          color: phase === 'denied' ? '#F43F5E' : '#F0C66A',
          transition: 'color 0.5s ease',
        }}
      >
        {phase === 'checking' && '正在核验诏令…'}
        {phase === 'granted' && '圣旨到，开殿迎驾'}
        {phase === 'denied' && '此令牌无法入朝'}
      </h1>

      {phase === 'granted' && (
        <p className="mt-3 text-[13px] text-[#9AA3C4]">片刻之后，朝堂将为您开启…</p>
      )}
      {phase === 'denied' && (
        <p className="mt-3 text-[13px] text-[#9AA3C4]">
          请确认邀请链接完整，或联系邀请方重新获取令牌。
        </p>
      )}

      {/* Subtle loading dots for checking phase */}
      {phase === 'checking' && (
        <div className="mt-6 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#F0C66A]"
              style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function EnterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#04060E]" />
      }
    >
      <EnterPageInner />
    </Suspense>
  )
}

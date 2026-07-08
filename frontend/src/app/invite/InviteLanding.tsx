'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface InviteLandingProps {
  code: string;
}

/**
 * 邀请码落地页 — 展示邀请码并直接链接到登录页
 * 支持 `/invite/COURT2026` 这样的直接链接
 */
export function InviteLanding({ code }: InviteLandingProps) {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!code) {
      setStatus('invalid');
      setMessage('邀请码不能为空');
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const res = await fetch('/api/auth/verify-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
          signal: AbortSignal.timeout(5000),
        });

        const body = (await res.json().catch(() => ({}))) as {
          valid?: boolean;
          message?: string;
        };

        if (cancelled) return;

        if (res.ok && body.valid) {
          setStatus('valid');
        } else {
          setStatus('invalid');
          setMessage(body.message ?? '该邀请码无效或已过期');
        }
      } catch {
        if (cancelled) return;
        // 网络问题视为有效，直接放行到登录页
        setStatus('valid');
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [code]);

  // 金环装饰组件
  const RingIcon = ({ emoji }: { emoji: string }) => (
    <div
      className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full"
      style={{
        border: '1px solid rgba(240,198,106,0.3)',
        background: 'rgba(240,198,106,0.05)',
        boxShadow: status === 'valid' ? '0 0 60px rgba(240,198,106,0.2)' : 'none',
        transition: 'box-shadow 1s ease',
      }}
    >
      <span className="text-[40px]">{emoji}</span>
    </div>
  );

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'radial-gradient(ellipse at center, #0A1020 0%, #04060E 100%)' }}
    >
      {status === 'checking' && (
        <>
          <RingIcon emoji="⚖️" />
          <div
            className="text-[11px] uppercase tracking-[0.4em]"
            style={{ color: '#8F835F' }}
          >
            Verifying Imperial Invitation · 核验入朝令牌
          </div>
          <h1
            className="mt-4 text-[28px] font-semibold"
            style={{ color: '#F0C66A', fontFamily: '"Noto Serif SC", serif' }}
          >
            正在核验诏令…
          </h1>
          <div className="mt-6 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: '#F0C66A',
                  animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </>
      )}

      {status === 'valid' && (
        <>
          <RingIcon emoji="📜" />
          <div
            className="text-[11px] uppercase tracking-[0.4em]"
            style={{ color: '#8F835F' }}
          >
            Imperial Invitation · 入朝引荐
          </div>
          <h1
            className="mt-4 text-[28px] font-semibold text-center"
            style={{ color: '#F0C66A', fontFamily: '"Noto Serif SC", serif' }}
          >
            圣旨到，开殿迎驾
          </h1>

          {/* 邀请码展示 */}
          <div
            className="mt-8 px-8 py-5 rounded-xl text-center"
            style={{
              background: 'rgba(240,198,106,0.08)',
              border: '1px solid rgba(240,198,106,0.25)',
            }}
          >
            <p className="text-xs mb-2 tracking-[0.2em]" style={{ color: '#8A6A2A' }}>
              邀请码
            </p>
            <p
              className="text-2xl font-mono font-bold tracking-[0.3em]"
              style={{ color: '#F0C66A' }}
            >
              {code}
            </p>
          </div>

          <p className="mt-6 text-sm" style={{ color: '#9AA3C4' }}>
            请使用此邀请码注册或登录朝堂系统
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link
              href={`/login?next=/dadian&invite=${encodeURIComponent(code)}`}
              className="rounded-lg px-8 py-3 text-sm font-semibold tracking-[0.2em] transition-colors hover:opacity-90 text-center"
              style={{
                background: 'linear-gradient(135deg, #F0C66A, #D4A84B 50%, #8A6A2A)',
                color: '#04060E',
              }}
            >
              登入朝堂
            </Link>
            <Link
              href={`/register?invite=${encodeURIComponent(code)}`}
              className="rounded-lg px-8 py-3 text-sm font-semibold tracking-[0.2em] transition-colors hover:opacity-90 text-center"
              style={{
                background: 'transparent',
                border: '1px solid rgba(240,198,106,0.3)',
                color: '#F0C66A',
              }}
            >
              注册账号
            </Link>
          </div>
        </>
      )}

      {status === 'invalid' && (
        <>
          <RingIcon emoji="🚫" />
          <div
            className="text-[11px] uppercase tracking-[0.4em]"
            style={{ color: '#8F835F' }}
          >
            Access Denied · 令牌无效
          </div>
          <h1
            className="mt-4 text-[28px] font-semibold"
            style={{ color: '#F43F5E', fontFamily: '"Noto Serif SC", serif' }}
          >
            此邀请码无法入朝
          </h1>
          {message && (
            <p className="mt-3 text-sm" style={{ color: '#9AA3C4' }}>
              {message}
            </p>
          )}
          <p className="mt-2 text-sm" style={{ color: '#9AA3C4' }}>
            请确认邀请链接完整，或联系邀请方重新获取邀请码。
          </p>

          <div className="mt-8 flex gap-4">
            <Link
              href="/invite"
              className="rounded-lg px-6 py-3 text-sm font-semibold tracking-[0.15em] transition-colors hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #F0C66A, #D4A84B 50%, #8A6A2A)',
                color: '#04060E',
              }}
            >
              重新输入
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-6 py-3 text-sm font-semibold tracking-[0.15em] transition-colors hover:opacity-90"
              style={{
                background: 'transparent',
                border: '1px solid rgba(240,198,106,0.3)',
                color: '#F0C66A',
              }}
            >
              直接登录
            </Link>
          </div>
        </>
      )}
    </main>
  );
}

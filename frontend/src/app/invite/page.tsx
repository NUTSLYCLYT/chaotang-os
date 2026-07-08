'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * 邀请码页面 — 用户输入邀请码后可直接跳转至登录页
 */
export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteForm />
    </Suspense>
  );
}

function InviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const codeFromUrl = params.get('code') ?? '';

  const [code, setCode] = useState(codeFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const trimmed = code.trim();
    if (!trimmed) {
      setError('请输入邀请码');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/verify-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
        signal: AbortSignal.timeout(5000),
      });

      const body = (await res.json().catch(() => ({}))) as {
        valid?: boolean;
        message?: string;
      };

      if (!res.ok || !body.valid) {
        setError(body.message ?? '邀请码无效或已过期');
        setSubmitting(false);
        return;
      }

      setVerified(true);

      // 跳转至登录页，携带邀请码信息
      setTimeout(() => {
        router.push(`/login?next=/dadian&invite=${encodeURIComponent(trimmed)}`);
      }, 1500);
    } catch {
      setError('验证服务暂不可用，请稍后重试');
      setSubmitting(false);
    }
  }

  if (verified) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#04060E' }}
      >
        <div
          className="w-[420px] rounded-2xl px-10 py-12 text-center"
          style={{
            background: 'rgba(15,20,40,0.65)',
            border: '1px solid rgba(74,222,128,0.3)',
            backdropFilter: 'blur(20px) saturate(140%)',
            boxShadow: '0 0 0 1px rgba(74,222,128,0.08), 0 30px 80px rgba(0,0,0,0.5)',
          }}
        >
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #4ADE80, #166534)',
              boxShadow: '0 0 40px rgba(74,222,128,0.25)',
            }}
          >
            <span className="text-[36px]">✓</span>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#4ADE80' }}>
            邀请码有效
          </h2>
          <p className="text-sm mb-6" style={{ color: '#9AA3C4' }}>
            正在为您跳转至登录页面…
          </p>
          <Link
            href={`/login?next=/dadian&invite=${encodeURIComponent(code.trim())}`}
            className="inline-block rounded-lg px-6 py-3 text-sm font-semibold tracking-[0.2em] transition-colors hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #F0C66A, #D4A84B 50%, #8A6A2A)',
              color: '#04060E',
            }}
          >
            立即登入
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#04060E' }}
    >
      <form
        onSubmit={onSubmit}
        className="w-[420px] rounded-2xl px-10 py-12"
        style={{
          background: 'rgba(15,20,40,0.65)',
          border: '1px solid rgba(240,198,106,0.25)',
          backdropFilter: 'blur(20px) saturate(140%)',
          boxShadow:
            '0 0 0 1px rgba(240,198,106,0.08), 0 30px 80px rgba(0,0,0,0.5)',
        }}
      >
        <div className="mb-8 text-center">
          <p
            className="text-xs tracking-[0.4em] mb-2"
            style={{ color: '#8A6A2A' }}
          >
            COURTOS · INVITATION
          </p>
          <h1
            className="text-3xl font-bold"
            style={{
              color: '#F0C66A',
              fontFamily: '"Noto Serif SC", serif',
            }}
          >
            入朝引荐
          </h1>
          <p className="mt-3 text-sm" style={{ color: '#9AA3C4' }}>
            请输入您的邀请码以进入系统
          </p>
        </div>

        <label className="block mb-6">
          <span
            className="block text-xs mb-1.5"
            style={{ color: '#9AA3C4' }}
          >
            邀请码
          </span>
          <input
            type="text"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="输入邀请码，如 COURT2026"
            className="w-full rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-600 placeholder:text-[#58617F] tracking-[0.15em] font-mono"
            style={{
              background: 'rgba(10,14,30,0.6)',
              border: '1px solid #1A2142',
              color: '#EAEEFB',
            }}
            required
          />
        </label>

        {error && (
          <p
            className="mb-4 text-sm rounded-md px-3 py-2"
            style={{
              background: 'rgba(244,63,94,0.1)',
              border: '1px solid rgba(244,63,94,0.3)',
              color: '#F87171',
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg px-4 py-3 text-sm font-semibold tracking-[0.2em] disabled:opacity-50 transition-colors"
          style={{
            background:
              'linear-gradient(135deg, #F0C66A, #D4A84B 50%, #8A6A2A)',
            color: '#04060E',
          }}
        >
          {submitting ? '验证中…' : '验证邀请码'}
        </button>

        <p className="mt-5 text-center text-xs" style={{ color: '#9AA3C4' }}>
          已有账号？{' '}
          <Link
            href="/login"
            style={{ color: '#F0C66A', textDecoration: 'underline' }}
          >
            直接登录
          </Link>
        </p>

        <p className="mt-3 text-center text-xs" style={{ color: '#58617F' }}>
          尚无邀请码？{' '}
          <Link
            href="/register"
            style={{ color: '#8A6A2A', textDecoration: 'underline' }}
          >
            注册账号
          </Link>
        </p>
      </form>
    </main>
  );
}

'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { setSession, decodeJwtExp, type AuthSession } from '@/lib/auth';
import { withBasePath } from '@/lib/base-path';
import { backendFetch } from '@/lib/backend-api';

/**
 * 本地 mock 用户登录校验（后端不可用时的回退）。
 * 仅校验 /api/auth/register 写入 globalThis.__courtosLocalUsers 的已注册用户。
 */
async function tryBackendLogin(username: string, password: string): Promise<AuthSession | null> {
  try {
    const res = await backendFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      token: string;
      user?: { username?: string };
      tenant?: { id?: number };
    };
    return {
      accessToken: body.token,
      refreshToken: '',
      tenantId: body.tenant?.id ?? 1,
      username: body.user?.username ?? username,
      accountType: 0,
      expiresAt: decodeJwtExp(body.token) || Date.now() + 8 * 60 * 60 * 1000,
    };
  } catch {
    return null;
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/dadian';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const user = username.trim();
      const pass = password;
      if (!user || !pass) throw new Error('请填写账号和密码');

      // 1. 尝试 jiqun_ai 后端登录（直连后端）
      let loggedIn = false;
      const localSession = await tryBackendLogin(user, pass);
      if (localSession) {
        setSession(localSession);
        loggedIn = true;
      }

      if (!loggedIn) throw new Error('账号或密码错误，请确认已注册。');
      window.location.assign(withBasePath(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Login"
      title="登入朝堂"
      body="进入大殿查看今日朝堂态势，再前往上书房处理待裁奏折、军机处会审、六部意见和史馆归档。"
      footer={
        <div className="flex items-center justify-between gap-4">
          <div className="text-[12px] leading-6 text-[#9AA3C4]">
            尚无账号？先注册席位。
          </div>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-[#EAEEFB] transition hover:border-white/15 hover:bg-white/[0.06]"
          >
            立即注册
            <ArrowRight size={13} />
          </Link>
        </div>
      }
    >
      <form
        onSubmit={onSubmit}
        className="w-full"
      >
        <div className="mb-7">
          <div className="page-eyebrow">CourtOS Entry</div>
          <h2 className="page-title-plain mt-2">账号验证</h2>
          <p className="mt-3 text-[13px] leading-7" style={{ color: '#9AA3C4' }}>
            仅限已注册用户登入
          </p>
        </div>

        <label className="block mb-4">
          <span className="block text-xs mb-1.5" style={{ color: '#9AA3C4' }}>用户名</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="login-auth-input w-full px-3 py-2.5 text-sm"
            required
          />
        </label>

        <label className="block mb-6">
          <span className="block text-xs mb-1.5" style={{ color: '#9AA3C4' }}>密码</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-auth-input w-full px-3 py-2.5 text-sm"
            required
          />
        </label>

        {error && (
          <p className="mb-4 text-sm rounded-md px-3 py-2" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#F87171' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg px-4 py-3 text-sm font-semibold tracking-[0.2em] disabled:opacity-50 transition-colors"
          style={{
            background: 'linear-gradient(135deg, #F0C66A, #D4A84B 50%, #8A6A2A)',
            color: '#04060E',
          }}
        >
          {submitting ? '验证中…' : '入朝议政'}
        </button>
      </form>
      <style jsx global>{`
        .login-auth-input {
          height: 42px;
          border: 1px solid rgba(240, 198, 106, 0.16);
          border-radius: 0;
          outline: none !important;
          color: #eaeefb;
          caret-color: #f0c66a;
          background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(0,0,0,0.16));
          box-shadow: inset 0 1px 0 rgba(245,233,201,0.035);
          transition:
            border-color 180ms ease,
            box-shadow 180ms ease,
            background 180ms ease;
        }
        .login-auth-input:hover {
          border-color: rgba(240, 198, 106, 0.24);
          background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(0,0,0,0.18));
        }
        .login-auth-input:focus,
        .login-auth-input:focus-visible {
          border-color: rgba(240, 198, 106, 0.52) !important;
          outline: none !important;
          box-shadow:
            inset 0 1px 0 rgba(245,233,201,0.08),
            0 0 0 1px rgba(240,198,106,0.14),
            0 0 14px rgba(240,198,106,0.14) !important;
          background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(0,0,0,0.22));
        }
      `}</style>
    </AuthShell>
  );
}

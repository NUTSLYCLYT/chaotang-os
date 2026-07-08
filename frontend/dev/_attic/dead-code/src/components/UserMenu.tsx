'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, getSession, type AuthSession } from '@/lib/auth';

export function UserMenu() {
  const router = useRouter();
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSessionState(getSession());
    const tick = setInterval(() => setSessionState(getSession()), 60_000);
    return () => clearInterval(tick);
  }, []);

  if (!session) return null;

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs"
        style={{
          background: 'rgba(15,20,40,0.7)',
          border: '1px solid rgba(240,198,106,0.25)',
          color: '#EAEEFB',
        }}
      >
        <span style={{ color: '#F0C66A' }}>{session.username}</span>
        <span style={{ color: '#6A7299' }}>· 租户 {session.tenantId}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-md py-1 z-50"
          style={{
            background: 'rgba(10,14,30,0.95)',
            border: '1px solid rgba(240,198,106,0.2)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="px-3 py-2 text-xs" style={{ color: '#9AA3C4', borderBottom: '1px solid #1A2142' }}>
            过期：{new Date(session.expiresAt).toLocaleTimeString()}
          </div>
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 text-xs hover:bg-amber-900/20"
            style={{ color: '#F87171' }}
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}

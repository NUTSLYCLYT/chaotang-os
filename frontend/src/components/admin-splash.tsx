/**
 * AdminSplash — /admin 守门拒绝态展示组件（server-friendly，无 hooks）
 *
 * 由 server component（/admin/page.tsx）在 SSR 阶段直接渲染，
 * 避免 client gate 的"核验中"闪烁与空壳泄露。
 */
import Link from 'next/link';
import { Lock, ShieldAlert } from 'lucide-react';

export type SplashKind = 'unauthenticated' | 'forbidden';

const PRESETS: Record<
  SplashKind,
  {
    icon: React.ReactNode;
    eyebrow: string;
    title: string;
    body: string;
    cta: { href: string; label: string };
    secondary?: { href: string; label: string };
  }
> = {
  unauthenticated: {
    icon: <Lock size={28} />,
    eyebrow: 'REQUIRES SIGN-IN',
    title: '请先登入朝堂',
    body: '后院 / 平台运维仅对已登入账号开放。请先回登入殿验明身份。',
    cta: { href: '/login?next=/admin', label: '前往登入 →' },
    secondary: { href: '/throne', label: '返朝堂' },
  },
  forbidden: {
    icon: <ShieldAlert size={28} />,
    eyebrow: 'ACCESS DENIED',
    title: '权限不足',
    body: '后院 / 平台运维仅向主账号（MAIN）与平台管理员（SUPER_ADMIN）开放。当前账号为普通成员，请联系本租户主账号申请权限。',
    cta: { href: '/throne', label: '返朝堂' },
    secondary: { href: '/more', label: '业务索引' },
  },
};

export function AdminSplash({ kind }: { kind: SplashKind }) {
  const preset = PRESETS[kind];
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#04060E] px-6">
      <div
        className="w-full max-w-[480px] rounded-2xl px-8 py-10 text-center"
        style={{
          background: 'rgba(15,20,40,0.65)',
          border: '1px solid rgba(240,198,106,0.2)',
          backdropFilter: 'blur(16px) saturate(140%)',
          boxShadow: '0 0 0 1px rgba(240,198,106,0.05), 0 30px 80px rgba(0,0,0,0.4)',
        }}
      >
        <div className="mb-4 flex justify-center" style={{ color: '#F0C66A' }}>
          {preset.icon}
        </div>
        <p
          className="mb-2 text-[10px] tracking-[0.32em]"
          style={{ color: '#8F835F', fontFamily: 'JetBrains Mono, monospace' }}
        >
          {preset.eyebrow}
        </p>
        <h2 className="display-serif text-[22px] font-bold" style={{ color: '#F5E9C9' }}>
          {preset.title}
        </h2>
        <p
          className="mx-auto mt-4 max-w-[360px] text-[13px] leading-7"
          style={{ color: '#9AA3C4' }}
        >
          {preset.body}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href={preset.cta.href}
            className="rounded-full px-5 py-2 text-[12px] font-semibold transition hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, #F0C66A 0%, #D4A84B 100%)',
              color: '#04060E',
            }}
          >
            {preset.cta.label}
          </Link>
          {preset.secondary && (
            <Link
              href={preset.secondary.href}
              className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-2 text-[12px] transition hover:border-white/20"
              style={{ color: '#C8CDD8' }}
            >
              {preset.secondary.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

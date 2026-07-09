'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';

// 无需登录即可访问的路由（白名单）。
// 所有其他路由都需要有效 session。
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/enter',
  '/invite',
  '/dadian',
  '/shangshufang',
  '/junjichu',
  '/command-center',
  '/liubu',
  '/zhusi',
  '/shiguan',
];

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

function stripBasePath(pathname: string) {
  if (BASE_PATH && pathname.startsWith(`${BASE_PATH}/`)) return pathname.slice(BASE_PATH.length);
  if (BASE_PATH && pathname === BASE_PATH) return '/';
  return pathname;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const routePath = stripBasePath(pathname);

  useEffect(() => {
    // 公开路由 — 不检查
    const isPublic =
      PUBLIC_ROUTES.some((p) => routePath === p || routePath.startsWith(p + '/')) ||
      routePath === '/' ||
      routePath.startsWith('/_next') ||
      routePath.startsWith('/api/');
    if (isPublic) return;

    const session = getSession();
    if (!session) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
    }
  }, [pathname, routePath, router]);

  return <>{children}</>;
}

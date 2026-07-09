import { getToken, refreshAccessToken } from '@/lib/auth';

export const CHAOTANG_BACKEND_BASE = (
  process.env.NEXT_PUBLIC_JIQUN_API_URL ??
  process.env.NEXT_PUBLIC_CHAOTANG_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  'http://localhost:8081'
).replace(/\/$/, '');

export function toBackendApiPath(path: string): string {
  const [pathname, query = ''] = path.split('?', 2);
  let next = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (next.startsWith('/api/court/chaotang/')) {
    next = `/api/chaotang/${next.slice('/api/court/chaotang/'.length)}`;
  } else if (next === '/api/court/chaotang') {
    next = '/api/chaotang';
  } else if (next.startsWith('/api/court/shangshufang/')) {
    next = `/api/shangshufang/${next.slice('/api/court/shangshufang/'.length)}`;
  } else if (next === '/api/court/shangshufang') {
    next = '/api/shangshufang';
  } else if (next === '/api/court/legal/overview') {
    next = '/api/legal/overview';
  } else if (next === '/api/court/swarm/roster') {
    next = '/api/swarm/roster';
  } else if (next === '/api/court/court-session/latest') {
    next = '/api/court-session/latest';
  } else if (next === '/api/court/chaotang/dept/finance/overview' || next === '/api/court/hubu/overview') {
    next = '/api/chaotang/dept/finance/overview';
  } else if (next === '/api/court/bingbu/overview') {
    next = '/api/chaotang/dept/ops/overview';
  } else if (next === '/api/court/libu/promo') {
    next = '/api/chaotang/dept/market/overview';
  }

  return query ? `${next}?${query}` : next;
}

export function backendApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${CHAOTANG_BACKEND_BASE}${toBackendApiPath(path)}`;
}

export async function backendAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const buildInit = async (tokenOverride?: string | null): Promise<RequestInit> => {
    const headers = new Headers(init.headers);
    if (!headers.has('accept')) headers.set('accept', 'application/json');
    const token = tokenOverride ?? (typeof window !== 'undefined' ? getToken() : null);
    if (token) headers.set('authorization', `Bearer ${token}`);
    return {
      ...init,
      cache: init.cache ?? 'no-store',
      credentials: init.credentials ?? 'include',
      headers,
    };
  };

  const first = await fetch(backendApiUrl(path), await buildInit());
  if (first.status !== 401 || typeof window === 'undefined') return first;

  const refreshed = await refreshAccessToken();
  if (!refreshed) return first;
  return fetch(backendApiUrl(path), await buildInit(refreshed));
}

export async function backendJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await backendFetch(path, init);
  const json = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return json as T;
}

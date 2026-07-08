import { getToken, clearSession, refreshAccessToken } from './auth';
import { APP_BASE_PATH } from './base-path';
// Frontend-owned BFF rewrites are retired. Browser data calls must target an
// explicit backend URL; localhost is only the local backend default.
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

async function doFetch(path: string, init?: RequestInit, token?: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${BASE}${path}`, { ...init, headers });
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isBrowser = typeof window !== 'undefined';
  let token = isBrowser ? getToken() : null;

  // Skip auth for /auth endpoints (login, refresh, bootstrap)
  const isAuthEndpoint = path.startsWith('/auth/');
  if (isAuthEndpoint) token = null;

  let res = await doFetch(path, init, token);

  // 401 → try refresh once, then retry. If refresh fails → redirect /login.
  if (res.status === 401 && isBrowser && !isAuthEndpoint) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(path, init, newToken);
    }
    if (res.status === 401) {
      clearSession();
      // 注意：window.location.pathname 含 basePath 前缀（如 /chaotang/tasks），
      // 重定向必须也带 basePath，否则跳到根 /login 命中 404 / 死循环。
      const loginPath = `${APP_BASE_PATH}/login`;
      if (!window.location.pathname.startsWith(loginPath)) {
        // next 保留完整 pathname（含 basePath），登录后跳回原页
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `${loginPath}?next=${next}`;
      }
      throw new Error(`401 Unauthorized — redirected to ${loginPath}`);
    }
  }

  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);

  const body: unknown = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return ((body as any)?.data ?? body) as T;
}

export function swrFetcher<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export const api = {
  get: <T = unknown>(path: string): Promise<T> => apiFetch<T>(path),
  post: (path: string, data: unknown): Promise<unknown> =>
    apiFetch(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: (path: string, data: unknown): Promise<unknown> =>
    apiFetch(path, { method: 'PATCH', body: JSON.stringify(data) }),
};

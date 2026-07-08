// Token store + refresh rotation. localStorage based (SSR-safe via window guards).

export const AUTH_STORAGE_KEY = 'courtos.auth';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tenantId: number;
  username: string;
  accountType: number;
  expiresAt: number; // unix ms (access token exp)
}

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (Date.now() >= session.expiresAt) {
      // expired access token; caller should call refreshAccessToken before retrying
      return session;
    }
    return session;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  const s = getSession();
  if (!s) return null;
  if (Date.now() >= s.expiresAt) return null; // expired → caller should refresh
  return s.accessToken;
}

/**
 * Cookie 镜像 — 让 server component（如 /admin SSR 守门）能读到 access token。
 *
 * ⚠️ 安全约束（必读）：
 *   1. httpOnly = false 因为客户端 JS 也要写；XSS 面与 localStorage 等价（本来就可读）
 *   2. **后端 API 不消费此 cookie，仅消费 Authorization Bearer 头**
 *      （见 src/auth/strategies/jwt.strategy.ts: ExtractJwt.fromAuthHeaderAsBearerToken）
 *      —— 这避免了 cookie 自动随同源请求带上引入 CSRF 风险
 *   3. **不要改后端为读 cookie 鉴权**，否则瞬间引入 CSRF
 *   4. SameSite=Lax 是双保险（即使后端某天误读 cookie，跨站 GET 也不会带）
 *
 * 同名不与 /api/auth/session 的 'courtos_auth'（demo 流 httpOnly cookie）撞车。
 */
const ACCESS_COOKIE_NAME = 'courtos.access_token';

function writeAccessCookie(token: string, expiresAtMs: number): void {
  if (typeof document === 'undefined') return;
  const maxAgeSec = Math.max(60, Math.floor((expiresAtMs - Date.now()) / 1000));
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ACCESS_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

function clearAccessCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ACCESS_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function setSession(session: AuthSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  writeAccessCookie(session.accessToken, session.expiresAt);
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  clearAccessCookie();
}

export function decodeJwtExp(token: string): number {
  try {
    // JWT payload 是 base64url（- _），atob 只认标准 base64（+ /）→ 先归一化，
    // 否则真实后端 token 的 payload 含 -/_ 时 atob 抛错 → 返回 0 →
    // expiresAt 回退 8h（安全复核 Finding 4）。
    const seg = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(seg)) as { exp?: unknown };
    const exp = payload.exp;
    // 后端真实 JWT 的 exp 是 ISO 字符串；dev/本地 token 是 unix 秒。统一返回 ms 时间戳。
    // 之前 `(exp ?? 0) * 1000` 对 ISO 字符串 = NaN → expiresAt/cookie Max-Age 损坏。
    if (typeof exp === 'number') return exp * 1000;
    if (typeof exp === 'string') {
      const t = Date.parse(exp);
      return Number.isFinite(t) ? t : 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

/** Refresh the access token using stored refresh token. Single-flight: dedupes concurrent calls. */
export async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (refreshInFlight) return refreshInFlight;
  const session = (() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthSession) : null;
    } catch {
      return null;
    }
  })();
  if (!session?.refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      // 走 basePath，否则 prod /chaotang/* 下 /api/v1/auth/refresh 命中不到 rewrite
      // → 401 → clearSession → 用户被踢回登录（这是 /qa 找出来的 P0/P1 系列 bug 之三）
      const { withBasePath } = await import('@/lib/base-path');
      const res = await fetch(withBasePath('/api/v1/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      });
      if (!res.ok) {
        clearSession();
        return null;
      }
      const body = (await res.json()) as { data: { access_token: string; refresh_token: string } };
      const next: AuthSession = {
        ...session,
        accessToken: body.data.access_token,
        refreshToken: body.data.refresh_token,
        expiresAt: decodeJwtExp(body.data.access_token) || Date.now() + 15 * 60 * 1000,
      };
      setSession(next);
      return next.accessToken;
    } catch {
      clearSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

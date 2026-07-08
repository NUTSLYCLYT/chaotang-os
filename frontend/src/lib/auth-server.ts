import 'server-only';

import { cookies } from 'next/headers';
import {
  isExpired,
  normalizeSession,
  type NormalizedSession,
} from '@/lib/auth/session-claims';

const ACCESS_COOKIE_NAME = 'courtos.access_token';

export interface AccessTokenPayload {
  // 真实后端 jiqun_ai/src/tenant.py 下发的 claims
  user_id?: number | string;
  tenant_slug?: string;
  role?: string; // 'user' | 'admin'
  // dev/本地 makeLocalJwt 兼容
  sub?: string;
  principalType?: 'account' | 'user';
  accountType?: number; // 0 NORMAL, 1 MAIN, 2 SUPER_ADMIN
  tenantId?: number;
  username?: string;
  exp?: number | string; // 后端 = ISO 字符串；dev = unix 秒
  iat?: number;
}

function decodeBase64Url(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  const replaced = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(replaced, 'base64').toString('utf-8');
}

export function decodeAccessTokenServer(token: string): AccessTokenPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(decodeBase64Url(part)) as AccessTokenPayload;
  } catch {
    return null;
  }
}

/**
 * 读 server-side cookie 取 access token。返回 null = 未登录或 cookie 缺失。
 * 注意：这只验证 token 存在 + 解码出 payload，不验签。
 * 真正的鉴权必须由后端 JwtAuthGuard 守 — 这里只用于前端 SSR 路由级"早拒"。
 */
export async function readAccessPayload(): Promise<AccessTokenPayload | null> {
  const store = await cookies();
  const tok = store.get(ACCESS_COOKIE_NAME)?.value;
  if (!tok) return null;
  const payload = decodeAccessTokenServer(tok);
  if (!payload) return null;
  // 过期判断容忍 ISO 字符串(后端) 与 unix 秒(dev)，见 session-claims.isExpired。
  if (isExpired(payload.exp, Date.now())) return null;
  return payload;
}

/**
 * 规范化会话视图（推荐新代码用此，而非裸 readAccessPayload）。
 *   统一 userId(user_id??sub) / tenant(tenant_slug??tenantId) / role / isAdmin，
 *   容忍真实后端与 dev 两种 token 形状。null = 未登录/过期。
 */
export async function readSession(): Promise<NormalizedSession | null> {
  const store = await cookies();
  const tok = store.get(ACCESS_COOKIE_NAME)?.value;
  return normalizeSession(tok);
}

export async function isAdminAccount(): Promise<boolean> {
  const session = await readSession();
  return session?.isAdmin ?? false;
}

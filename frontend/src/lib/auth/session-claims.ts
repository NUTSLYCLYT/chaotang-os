/**
 * 朝堂 OS · 会话声明规范化（单一来源 · decode-only · 验签由后端守）
 *
 * 背景（2026-06-02 对齐真实后端 jiqun_ai/src/tenant.py）：
 *   生产环境 access_token = 后端 HS256 真签 JWT，payload 形如：
 *     { user_id, username, tenant_slug, role: 'user'|'admin', exp: <ISO 字符串> }
 *   开发/本地回退 makeLocalJwt（后端不可达）则是另一形状：
 *     { sub, username, tenantId, accountType, exp: <unix 秒> }
 *
 * 历史上前端各处自带解码器，且只认 dev 形状（sub / tenantId / accountType / exp*1000），
 * 对真实后端 token 全部失配 —— userId 恒空(chat/prompt-suggest 401 所有人)、
 * tenantId 恒空(租户隔离失效)、exp 是 ISO 字符串时 `exp*1000` = NaN(过期判断永不触发)。
 *
 * 本模块是【唯一】规范化入口：容忍两种形状，输出统一 NormalizedSession。
 * 仅解码、不验签（与全仓信任模型一致：真正验签由后端 JwtAuthGuard 守）。
 * 注意：本文件不加 'server-only'，以便 route handler / 中间件层（Node）复用同一逻辑。
 */

export interface RawClaims {
  // 真实后端
  user_id?: number | string;
  tenant_slug?: string;
  role?: string; // 'user' | 'admin'
  // dev/本地兼容
  sub?: string;
  tenantId?: number;
  accountType?: number;
  // 通用
  username?: string;
  exp?: number | string; // unix 秒 或 ISO 字符串
}

/** 统一会话视图。tenant 用 string|number 同时容纳后端 slug 与 dev 数字 id。 */
export interface NormalizedSession {
  /** 稳定用户 id：user_id（后端）优先，回退 sub（dev）。 */
  userId: string | null;
  /** 租户标识：tenant_slug（后端）优先，回退 tenantId（dev）。null = 无租户归属。 */
  tenant: string | number | null;
  /** 角色 claim（后端二值 user|admin），无则 null。 */
  role: string | null;
  /** 是否管理员会话（特权身份的真实信号）：role==='admin' 或 dev 旁路 accountType>=1。 */
  isAdmin: boolean;
  /** 原始 claims（少数需要细粒度判断的调用方用）。 */
  raw: RawClaims;
}

/** base64url 解码 JWT 的 payload 段（第二段）。失败 → null。不验签。 */
export function decodeJwtClaims(token: string): RawClaims | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const json = Buffer.from(
      padded.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf-8');
    return JSON.parse(json) as RawClaims;
  } catch {
    return null;
  }
}

/**
 * 过期判断，容忍两种 exp 形状：
 *  - number → unix 秒（dev）：exp*1000 < now
 *  - string → ISO 日期（后端）：Date.parse(exp) < now
 *  - 缺失/不可解析 → 视为不过期（fail-open on missing，与既有行为一致）。
 */
export function isExpired(exp: unknown, nowMs: number): boolean {
  if (exp == null) return false;
  if (typeof exp === 'number') return exp * 1000 < nowMs;
  if (typeof exp === 'string') {
    const t = Date.parse(exp);
    return Number.isFinite(t) && t < nowMs;
  }
  return false;
}

/**
 * 把一个 access_token 规范化为统一会话视图。
 *  · token 缺失 / 解不出 payload / 已过期 → null（= 未登录）。
 *  · nowMs 显式传入便于测试与确定性。
 */
export function normalizeSession(
  token: string | undefined | null,
  nowMs: number = Date.now(),
): NormalizedSession | null {
  if (!token) return null;
  const c = decodeJwtClaims(token);
  if (!c) return null;
  if (isExpired(c.exp, nowMs)) return null;

  const userId = c.user_id != null ? String(c.user_id) : (c.sub ?? null);
  const tenant =
    c.tenant_slug != null
      ? c.tenant_slug
      : typeof c.tenantId === 'number'
        ? c.tenantId
        : null;
  const role = typeof c.role === 'string' ? c.role : null;
  // 生产环境只认后端真实 role claim 判定管理员；accountType 是 dev/本地 makeLocalJwt
  // 的旁路字段，真实后端 token 从不带它。仅在非生产兜底接受 accountType，避免伪造
  // accountType cookie 在生产环境提权（安全复核 Finding 1）。
  const isAdmin =
    c.role === 'admin' ||
    (process.env.NODE_ENV !== 'production' && (c.accountType ?? 0) >= 1);

  return { userId, tenant, role, isAdmin, raw: c };
}

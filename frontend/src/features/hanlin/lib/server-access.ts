import type { HanlinCapability, HanlinRole } from './access';
import { logger } from '@/lib/logger';
import { isExpired } from '@/lib/auth/session-claims';

const VALID_ROLES = new Set<HanlinRole>([
  'emperor',
  'taizi',
  'hanlin_scholar',
  'hubu',
  'contributor',
  'viewer',
]);

/**
 * 角色等级序(高 → 低)。用于在客户端意图与服务端会话授予之间取 min。
 * emperor > taizi > hanlin_scholar > hubu > contributor > viewer。
 */
const ROLE_RANK: Record<HanlinRole, number> = {
  emperor: 5,
  taizi: 4,
  hanlin_scholar: 3,
  hubu: 2,
  contributor: 1,
  viewer: 0,
};

const ACCESS_COOKIE = 'courtos.access_token';

interface SessionPayload {
  // 后端真实下发(jiqun_ai/src/tenant.py):role 二值 user|admin,无 accountType。
  role?: string;
  accountType?: number; // local-login 旁路可能补;access_token 本身没有
  exp?: number | string; // 后端 = ISO 字符串；dev = unix 秒
}

/**
 * 从原始 Cookie header 取出某个 cookie 的值。
 * 函数签名是 Web `Request`(非 NextRequest),所以手动解析 cookie 头。
 */
function readCookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const pair of cookieHeader.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    if (key === name) return pair.slice(eq + 1).trim();
  }
  return undefined;
}

/**
 * 从 access_token JWT 解码 payload(仅解码不验签 —— 真正的签名校验由后端守)。
 * 含 exp 过期校验。null = 无有效会话。仿 actor-context.ts 的 decodeSessionPayload。
 */
function decodeSessionPayload(cookieHeader: string | null): SessionPayload | null {
  const tok = readCookieValue(cookieHeader, ACCESS_COOKIE);
  if (!tok) return null;
  try {
    const part = tok.split('.')[1];
    if (!part) return null;
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const json = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    const p = JSON.parse(json) as SessionPayload;
    if (isExpired(p.exp, Date.now())) return null; // 过期(容忍 ISO 字符串/unix 秒)
    return p;
  } catch {
    // 解析失败 = 无有效会话,fail-closed(不向客户端泄漏内部细节)
    logger.warn('hanlin: failed to decode session payload');
    return null;
  }
}

/**
 * 推导会话授予的最高翰林角色(fail-closed)。
 * 真实信号:后端 JWT 只有 role(user|admin),无 accountType。故:
 *   无有效会话              → 'viewer'(只读)
 *   role==='admin'(或 accountType>=2)→ 'emperor'(全权)
 *   accountType>=1(兼容旁路) → 'hubu'(中间角色)
 *   其余(普通登录 user)    → 'viewer'
 */
function deriveSessionMaxRole(session: SessionPayload | null): HanlinRole {
  if (!session) return 'viewer';
  if (session.role === 'admin' || (session.accountType ?? 0) >= 2) return 'emperor';
  if ((session.accountType ?? 0) >= 1) return 'hubu';
  return 'viewer';
}

/** 取角色等级序中较低者(min) —— 最终权限不得高于会话授予。 */
function lowerRole(a: HanlinRole, b: HanlinRole): HanlinRole {
  return ROLE_RANK[a] <= ROLE_RANK[b] ? a : b;
}

const ROLE_CAPABILITIES: Record<HanlinRole, HanlinCapability[]> = {
  emperor: ['contribute', 'recommend', 'experiment', 'scouting_refresh', 'incubation_manage', 'export_manage', 'award_manage', 'demo_reset'],
  taizi: ['contribute', 'recommend', 'experiment', 'scouting_refresh', 'incubation_manage', 'export_manage', 'award_manage', 'demo_reset'],
  hanlin_scholar: ['contribute', 'recommend', 'experiment'],
  hubu: ['contribute', 'export_manage', 'award_manage'],
  contributor: ['contribute'],
  viewer: [],
};

/**
 * 从 request 解析当前翰林角色。
 *
 * SECURITY (AUTHZ-002 · 2026-06-02 真修):
 *   角色不再单纯信任客户端 x-hanlin-role 头(那只是 UI 意图)。已落地服务端会话派生:
 *   - 从 cookie 'courtos.access_token'(JWT)解码 accountType,推导会话授予的最高角色 sessionMaxRole;
 *     无有效会话 / accountType<1 → viewer(fail-closed)。
 *   - 客户端 x-hanlin-role 仅作 UI 意图:最终角色 = min(claimedRole, sessionMaxRole) ——
 *     即权限不得高于会话授予,仅凭 `x-hanlin-role: emperor` 头不再能拿到敏感能力。
 *   - 无 claimed → 取 min(sessionMaxRole, viewer) = viewer。
 *
 * AUTHZ-LANE-03 (2026-06-02 reviewed): header-as-UI-intent + session-cap 已满足。
 * TODO(LANE-04, deferred): 翰林角色最终应来自 JWT 中显式的 role claim;当前
 *   accountType→role 的派生(deriveSessionMaxRole)是过渡期映射,需后端在签发会话时
 *   写入显式 role claim 后切换。在此之前不引入 jwtVerify(硬约束 #1,decode-only 保留)。
 *   tenantId 作用域收窄(LANE-07)为 store 层工作,在另一处推进,本文件不涉及。
 */
export function readHanlinRoleFromRequest(request: Request): HanlinRole {
  const cookieHeader = request.headers.get('cookie');
  const session = decodeSessionPayload(cookieHeader);
  const sessionMaxRole = deriveSessionMaxRole(session);

  const raw = request.headers.get('x-hanlin-role');
  const claimedRole: HanlinRole | null =
    raw && VALID_ROLES.has(raw as HanlinRole) ? (raw as HanlinRole) : null;

  // 无 claimed → 回退 min(sessionMaxRole, viewer) = viewer
  if (!claimedRole) return lowerRole(sessionMaxRole, 'viewer');

  // 最终权限不得高于会话授予角色
  return lowerRole(claimedRole, sessionMaxRole);
}

export function assertHanlinCapability(role: HanlinRole, capability: HanlinCapability) {
  return ROLE_CAPABILITIES[role].includes(capability);
}

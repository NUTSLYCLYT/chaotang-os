import 'server-only';

import { requireSessionUserId, SessionUserError } from '@/lib/auth/require-session-user';
import { backendVerifyOrReject } from '@/lib/auth/backend-verify';
import { rateLimit } from '@/lib/rate-limit';

/**
 * 部门→蜂群派发路由的统一守门(2026-07-06 独立会审 CRITICAL 修复)。
 *
 * 病根:`/api/court/*` 在 middleware 被整族标"公开·后端自守",但 dept 派发 route 直调
 * dispatchDeptToSwarm(内部注入 JIQUN_ADMIN_TOKEN 打后端 /api/swarm/run),自己没装任何锁——
 * 匿名者可无限触发真实蜂群/LLM(烧钱)且以 admin 身份落后端(confused deputy 提权)。
 *
 * schneier:安全默认必须是"拒绝",例外才显式开口。把锁焊在所有 dept 派发共享的这一道门,
 * 一处覆盖全部 route(swarm-dispatch / xing-bu·legal / gong-bu·feasibility / li-bu·recruit ...)。
 *
 * 三层(与 orchestrate/all 同级):
 *   ① 会话身份 401(无 session/无 bearer 直拒,不给匿名走到烧钱那步)
 *   ② 后端验签前置 fail-closed(FENGQUN_AUTH strict 下伪造 token 在 fan-out 前被后端拒)
 *   ③ per-user 限流(身份已验,换 userId 刷不动配额)
 *
 * 用法:route handler 首行 `const gate = await requireCourtSwarmAuth(req); if (gate.rejected) return gate.rejected;`
 * 通过后 `gate.userId` 可用。
 */

const RATE_MAX = 12;
const RATE_WINDOW_MS = 60_000;

export type CourtSwarmAuth = { rejected: Response; userId?: undefined } | { rejected: null; userId: string };

export async function requireCourtSwarmAuth(req: Request, bucket = 'dept-swarm'): Promise<CourtSwarmAuth> {
  let userId: string;
  try {
    userId = await requireSessionUserId();
  } catch (error) {
    if (!(error instanceof SessionUserError)) throw error;
    return { rejected: Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const verifyReject = await backendVerifyOrReject(req);
  if (verifyReject) return { rejected: verifyReject };

  const rl = rateLimit(`${bucket}:${userId}`, RATE_MAX, RATE_WINDOW_MS);
  if (!rl.ok) {
    return {
      rejected: Response.json(
        { ok: false, error: `蜂群派发过频,请 ${Math.ceil(rl.retryAfterMs / 1000)}s 后再发` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      ),
    };
  }

  return { rejected: null, userId };
}

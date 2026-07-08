/**
 * 朝堂 OS · Actor Identity 服务端解析
 *
 * v1.4 漏洞：客户端 POST body.actor='ruler' 任何人都能批准自己案
 * v1.5 修复：server-side 解析 actor · body.actor 必须与 cookie 一致
 *
 * 实现：
 *   - 优先级：cookie 'courtos.actor' > header 'x-courtos-actor' > 'anonymous'
 *   - 'ruler' 是超级身份 · 可代任何 actor 触发（御前权）· 但需 cookie 真为 ruler
 *   - 'system' 仅在内部 API 用 · 服务端注入 · 客户端不能伪造
 *
 * 生产升级路径：
 *   - 把 cookie 替换成 JWT · payload 含 role + exp
 *   - 加 refresh / revocation
 *   - 本接口不变 · resolveActor() 内部实现替换即可
 */

import type { NextRequest } from 'next/server';
import type { Actor } from './bill-fsm';
import { logger } from '@/lib/logger';
import { isExpired } from '@/lib/auth/session-claims';

const COOKIE_NAME = 'courtos.actor';
const HEADER_NAME = 'x-courtos-actor';
const VALID: Actor[] = ['ruler', 'zhongshu', 'menxia', 'shangshu', 'liubu', 'system'];

/**
 * 特权省份(三省):担任 zhongshu/menxia/shangshu 需会话 accountType 达标。
 * liubu(六部)为任何有效会话的最小可领身份(always-allowed)。
 */
const PRIVILEGED_PROVINCES: ReadonlySet<Actor> = new Set<Actor>([
  'zhongshu',
  'menxia',
  'shangshu',
]);

/**
 * 担任特权省份(中书/门下/尚书)所需的最小 accountType。
 * 默认 1(MAIN/admin)。可用 env COURTOS_PROVINCE_MIN_ACCOUNT_TYPE 覆盖。
 *
 * ⚠️ 这是【过渡期】的 fail-closed 闸门:当前会话 JWT 只带 accountType/exp,
 *    没有真实的 role/dept claim,无法精确区分"此人属于哪一省"。因此用 accountType
 *    地板把"裸会话冒充三省"挡住——与 RULER_MIN_ACCOUNT_TYPE 同法(约束 #5"扩展到其余省份同法")。
 *    真正的三省/六部隔离需后端在 JWT 里下发 per-department(role/dept) claim
 *    (LANE-03 / GOV-FSM-01 完整版),那是跨文件/后端协调项,此处 deferred。
 */
const PROVINCE_MIN_ACCOUNT_TYPE = Number(
  process.env.COURTOS_PROVINCE_MIN_ACCOUNT_TYPE ?? 1,
);

function parseActor(raw: string | undefined | null): Actor | null {
  if (!raw) return null;
  return VALID.includes(raw as Actor) ? (raw as Actor) : null;
}

const ACCESS_COOKIE = 'courtos.access_token';

/**
 * 担任 'ruler'(御前终审 · 可批准/驳回任意议案)所需的最小 accountType。
 * accountType: 0 NORMAL / 1 MAIN(admin) / 2 SUPER_ADMIN(见 lib/auth-server.ts)。
 * 默认 2(fail-closed)。可用 env COURTOS_RULER_MIN_ACCOUNT_TYPE 覆盖。
 *
 * ⚠️ 必须由人确认:local-login 目前把 accountType 设为 `role==='admin'?1:0`,
 *    "陛下/emperor"账号实际可能只拿到 0。请核对你的后端给陛下发的真实 accountType,
 *    或在后端 JWT 里加显式 role claim 后改用 role 判定,否则 ruler 会被锁(治理无法终审)。
 */
const RULER_MIN_ACCOUNT_TYPE = Number(process.env.COURTOS_RULER_MIN_ACCOUNT_TYPE ?? 2);

interface SessionPayload {
  // 后端真实下发(jiqun_ai/src/tenant.py):role 二值 user|admin,无 accountType。
  role?: string;
  accountType?: number; // local-login 旁路可能补(role==='admin'?1:0);access_token 本身没有
  tenant_slug?: string; // 后端真实租户标识(slug)
  tenantId?: number; // dev/本地 token 兼容(数字 id)
  exp?: number | string; // 后端 = ISO 字符串；dev = unix 秒
}

/**
 * 是否管理员会话 —— 特权身份(ruler/三省)的真实判定信号。
 * 后端 JWT 只有 role(user/admin),所以 role==='admin' 是主信号;
 * accountType 旁路作为兼容(若某 token 路径补了它)。二者任一达标即视为管理员。
 */
function sessionIsAdmin(s: SessionPayload, minAccountType: number): boolean {
  return s.role === 'admin' || (s.accountType ?? 0) >= minAccountType;
}

/** 从服务端会话 cookie(access_token JWT)解码 payload。null = 无有效会话。仅解码不验签(验签由后端守)。 */
function decodeSessionPayload(req: NextRequest): SessionPayload | null {
  const tok = req.cookies.get(ACCESS_COOKIE)?.value;
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
    return null;
  }
}

/**
 * 从 request 解析当前 actor。
 *
 * SECURITY (AUTHZ-001 · 2026-06-02 真修):
 *   身份不再信任客户端自设的 courtos.actor cookie / x-courtos-actor 头(那只是 UI 意图)。
 *   - 无有效服务端会话(access_token)→ 最小权 'liubu'。
 *   - 声称 'ruler' 必须会话 accountType 达标,否则降级到 'liubu' —— 杜绝任意访客冒充 ruler 批准议案。
 *   - 'system' 永远不能从客户端解析(仅服务端 internal call)。
 */
export function resolveActor(req: NextRequest): Actor {
  const session = decodeSessionPayload(req);
  if (!session) return 'liubu'; // 未登录 → 最小权

  const claimed =
    parseActor(req.cookies.get(COOKIE_NAME)?.value) ??
    parseActor(req.headers.get(HEADER_NAME));

  if (claimed === 'ruler') {
    // 真实信号:后端 role==='admin'(JWT 无 accountType 层级,默认 2 永远锁死,故改读 role)
    const eligible = sessionIsAdmin(session, RULER_MIN_ACCOUNT_TYPE);
    return eligible ? 'ruler' : 'liubu'; // ruler 需服务端验证的管理员会话,否则降级
  }

  // AUTHZ-LANE-03 / GOV-FSM-01:特权省份(中书/门下/尚书)不再凭"任何会话信任 claimed"。
  // 会话 payload 当前只带 accountType/exp,没有 role/dept claim,所以从 accountType
  // 派生一个省份资格地板——与上面 ruler 的 accountType-capping 同一模式(约束 #5)。
  // 派生真实 role/dept claim 的完整版(LANE-03/GOV-FSM-01)需后端在 JWT 里下发该 claim,
  // 此处用 accountType 地板作为过渡期 fail-closed 闸门。
  //
  // TODO(LANE-03/GOV-FSM-01 完整版 · deferred · 需后端协调):
  //   三省/六部真正隔离需后端 JWT 下发 per-department(role/dept)claim,
  //   以精确判定"此会话属于哪一省"。在此之前,accountType 地板是过渡期 fail-closed 闸门,
  //   不引入独立代码路径以免与 ruler 分支逻辑发散。
  if (claimed && PRIVILEGED_PROVINCES.has(claimed)) {
    // 后端 role 二值(user/admin),无法区分具体哪一省 → admin 可担任任一三省;user 降级。
    // 真正的 per-dept 隔离待后端在 JWT 下发 dept claim(LANE-03/GOV-FSM-01)。
    const eligible = sessionIsAdmin(session, PROVINCE_MIN_ACCOUNT_TYPE);
    if (eligible) return claimed;
    logger.warn('actor: 特权省份声称未达管理员门槛 · 降级至 liubu', {
      claimed,
      minAccountType: PROVINCE_MIN_ACCOUNT_TYPE,
    });
    return 'liubu';
  }

  // liubu(六部)为任何有效会话的最小可领身份;'system' 不可被客户端声称。
  if (claimed === 'liubu') return 'liubu';
  return 'liubu';
}

/**
 * 从会话解析租户 id（BL-07 · 租户隔离）。
 *   tenantId 取自已解码会话 payload（与其它授权同一信任模型：仅解码、验签由后端守）。
 *   无有效会话或 payload 无 tenantId → null（调用方按"不限租户/向后兼容"处理）。
 *   用于把 governance 本地 store 的读写按租户 scope，杜绝跨租户横向访问。
 */
export function resolveTenantId(req: NextRequest): string | number | null {
  const session = decodeSessionPayload(req);
  if (!session) return null;
  // 真实后端用 tenant_slug(字符串)；dev/本地 token 用 tenantId(数字)。
  if (typeof session.tenant_slug === 'string') return session.tenant_slug;
  if (typeof session.tenantId === 'number') return session.tenantId;
  return null;
}

export interface ActorAuthResult {
  ok: boolean;
  resolved: Actor;
  /** 客户端声称的 actor */
  claimed: Actor;
  /** 拒绝原因 */
  reason?: string;
}

/**
 * 校验 client-claimed actor 是否合法
 *  · 同身份永远 ok
 *  · ruler 可代任何身份（御前权 · 但 cookie 必须真是 ruler）
 *  · system 永远不可被声称（仅内部 API）
 */
export function authorizeActor(req: NextRequest, claimed: Actor): ActorAuthResult {
  if (!VALID.includes(claimed)) {
    return {
      ok: false,
      resolved: 'liubu',
      claimed,
      reason: `unknown actor · ${claimed}`,
    };
  }

  if (claimed === 'system') {
    // system 由服务端内部触发 · 不接受客户端声称
    return {
      ok: false,
      resolved: resolveActor(req),
      claimed,
      reason: `actor 'system' is server-only · 客户端不可声称`,
    };
  }

  const resolved = resolveActor(req);

  if (resolved === claimed) {
    return { ok: true, resolved, claimed };
  }

  // ruler 可代任何身份触发
  if (resolved === 'ruler') {
    return { ok: true, resolved, claimed };
  }

  return {
    ok: false,
    resolved,
    claimed,
    reason: `身份不符 · cookie/header 解析为 ${resolved} · 不可声称为 ${claimed}（仅 ruler 可代他人）`,
  };
}

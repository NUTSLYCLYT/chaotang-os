/**
 * LIVE_SWARM trace 验真承重墙(6大神会审 wy1tg27my · C4)
 *
 * assertLiveSwarmTrace 是同步预闸:只挡构造垃圾(格式可仿)。
 * 本文件是终极防伪:向 jiqun 往返核对 session 真登记——格式可仿,登记不可仿。
 * 一个 adapter 返 {trace_id:'20260622_085226_x'}(格式合法但后端无此 session)能过预闸,
 * 但过不了这里——除非 jiqun /api/tasks 真登记了它。
 *
 * fail-closed:够不到 jiqun / session 未登记 / 任何异常 → verified=false,绝不轻信。
 * 宁可把真链误判为"待兑现",不可把假 trace 盖 LIVE_SWARM 帝金章。
 */
import { isGenuineSwarmTraceId } from '../source-label.ts';

export interface ReverifyResult {
  verified: boolean;
  reason: string;
}

export interface ReverifyOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /**
   * jiqun admin JWT。sessions 反查端点要鉴权(实测:无/失效 token → "未登录/Token 无效")。
   * 缺它则 GET 必 401 → fail-closed 判 verified=false → 真链永远降 MIXED,LIVE_SWARM 盖不出。
   * 必须与 adapter POST /run 用同一 token(adapter 已带,此处对齐)。
   */
  adminToken?: string;
}

interface JiqunSessionLike {
  session_id?: string;
  status?: string;
  synthetic?: boolean;
}

/**
 * 反查端点 = GET /api/swarm/sessions/{session_id}(2026-06-22 实测确认:
 * 真 session → 200 + 同 session_id;伪造 session → 404)。
 * 注:不是 /api/tasks(那是 running/recent 登记池,libu/finance session 不进该池,
 * 早期实现打错端点会致每条真链永远降级——已实测纠正)。
 */
export async function reverifyLiveSwarmTrace(
  traceId: unknown,
  opts: ReverifyOptions = {},
): Promise<ReverifyResult> {
  if (!isGenuineSwarmTraceId(traceId)) {
    return { verified: false, reason: 'trace_id 格式非真 jiqun session,疑似构造' };
  }
  const sid = String(traceId).trim();
  const baseUrl = opts.baseUrl ?? process.env.JIQUN_API_URL ?? 'http://127.0.0.1:8081';
  const fetchImpl = opts.fetchImpl ?? fetch;
  const adminToken = opts.adminToken ?? process.env.JIQUN_ADMIN_TOKEN;
  try {
    const res = await fetchImpl(`${baseUrl}/api/swarm/sessions/${encodeURIComponent(sid)}`, {
      headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
      signal: AbortSignal.timeout(opts.timeoutMs ?? 6000),
    });
    if (res.status === 404) {
      return { verified: false, reason: 'jiqun 无此 session(404),trace 不可兑现/疑似伪造' };
    }
    if (!res.ok) {
      return { verified: false, reason: `jiqun sessions 不可达(${res.status}),trace 无法兑现` };
    }
    const json = (await res.json().catch(() => ({}))) as JiqunSessionLike;
    if (json.session_id !== sid) {
      return { verified: false, reason: 'jiqun 返回 session_id 不匹配,trace 不可信' };
    }
    if (json.synthetic === true) {
      return { verified: false, reason: '该 session 标记为 synthetic(合成/测试),非真实蜂群跑批' };
    }
    return { verified: true, reason: 'jiqun /api/swarm/sessions 确认该 session 真存在,trace 可向后端兑现' };
  } catch (e) {
    return {
      verified: false,
      reason: `反查异常,fail-closed 不轻信:${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

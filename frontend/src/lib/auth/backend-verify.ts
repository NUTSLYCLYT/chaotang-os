/**
 * backend-verify —— R1·A-探针(特权写入/烧 LLM 的端点统一鉴权前置)。
 *
 * 本仓硬约束 #1/#3:Next/边缘层 decode-only、不验签,验签由后端(FENGQUN_AUTH)守。
 * 因此凡是【会写台账 / 扇出 LLM】的特权 route,在 fan-out/写库前都必须经此探针:
 * strict 模式(FENGQUN_AUTH=true)把调用方 token 转发后端一个 authed 端点做一次往返——
 * 401/403 → 伪造/无效签名,拒;后端故障/不可达 → fail-closed(不拿可疑请求烧钱/写库)。
 * dev(FENGQUN_AUTH≠true)后端本就放行,跳过探针、沿用本地 decode-only。
 *
 * 设计意图(大神会审天才建议):让"特权端点忘记装锁"难以发生——
 * sign-off 与 orchestrate/all 共用同一道门,新增同类端点只需 import 这一个函数。
 */

const JIQUN_BASE_URL = process.env.JIQUN_API_URL ?? 'http://127.0.0.1:8081';
// 验签探针目标:复用应用已在用的 authed 端点(BFF /study/briefing → jiqun);可经 env 改指。
const JIQUN_VERIFY_PATH = process.env.JIQUN_VERIFY_PATH ?? '/api/chaotang/study/briefing';

/**
 * 返回 null=放行;非 null=应直接返回给调用方的拒绝 Response。
 * 用法:在 getUserIdFromSession 之后、Promise.all fan-out / recordOrchestration 之前调用。
 */
export async function backendVerifyOrReject(req: Request): Promise<Response | null> {
  // 运行时读取，便于 fail-safe + 可测。
  const strict = process.env.FENGQUN_AUTH === 'true';
  if (!strict) {
    // ★ fail-closed(charity-majors:misconfig 要响亮失败，不要安静地不安全)：
    // 生产环境未设 FENGQUN_AUTH=true → 验签门未激活，绝不静默旁路成"看似有墙实则裸奔"，
    // 改为拒绝特权写入并 CRITICAL 报错。运维一忘设，下旨/sign-off 立刻 503 被发现，而非悄悄不安全。
    // 仅 dev，或显式 CHAOTANG_ALLOW_INSECURE_AUTH=1(留痕逃生阀) 才旁路。
    if (process.env.NODE_ENV === 'production' && process.env.CHAOTANG_ALLOW_INSECURE_AUTH !== '1') {
      // eslint-disable-next-line no-console
      console.error(
        '[backend-verify] CRITICAL: 生产环境未设 FENGQUN_AUTH=true，特权写入验签门未激活 → fail-closed 拒绝。' +
          '请部署设 FENGQUN_AUTH=true（或显式 CHAOTANG_ALLOW_INSECURE_AUTH=1 承担风险）。',
      );
      return Response.json({ error: '鉴权未配置(FENGQUN_AUTH)，拒绝特权写入' }, { status: 503 });
    }
    return null;
  }
  // probe 必须用后端认得的凭证。后端 cookie 名是 `token`，而浏览器侧是 `courtos.access_token`——
  // 直接转发原始 cookie 串会让只带 cookie 的合法用户在 strict 模式被误拒(false-close)。
  // 故:优先 Authorization Bearer;否则从 courtos.access_token cookie 提取 token，
  // 同时以 Bearer 头与后端期望的 token= cookie 两种姿态转发(belt-and-suspenders)。
  const auth = req.headers.get('authorization');
  let bearer = auth;
  let tokenValue: string | null = null;
  const cookieHeader = req.headers.get('cookie') ?? '';
  const m = cookieHeader.match(/(?:^|;\s*)courtos\.access_token=([^;]+)/);
  if (m) tokenValue = decodeURIComponent(m[1]);
  if (!bearer && tokenValue) bearer = `Bearer ${tokenValue}`;
  if (!bearer) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const probe = await fetch(`${JIQUN_BASE_URL}${JIQUN_VERIFY_PATH}`, {
      method: 'GET',
      headers: {
        Authorization: bearer,
        ...(tokenValue ? { cookie: `token=${tokenValue}` } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
    if (probe.status === 401 || probe.status === 403) {
      return Response.json({ error: '后端验签未通过' }, { status: 401 });
    }
    if (!probe.ok) {
      return Response.json({ error: '验签后端异常，暂拒特权写入' }, { status: 503 });
    }
    return null; // 后端验签通过
  } catch {
    return Response.json({ error: '验签后端不可达，暂拒特权写入' }, { status: 503 });
  }
}

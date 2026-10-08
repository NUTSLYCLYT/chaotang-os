import { getJinyiweiTrust } from "../../../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../../../lib/session.ts";

const FRIENDLY = { validation: "调查编号未通过校验。", not_found: "调查案卷不存在。", storage: "锦衣卫真实性评估暂时不可用，请稍后重试。", network: "无法连接朝堂后端，请稍后重试。", unknown: "锦衣卫真实性评估暂时不可用，请稍后重试。" } as const;
const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export function createTrustHandler(readTrust: typeof getJinyiweiTrust = getJinyiweiTrust, readSession: typeof readSessionId = readSessionId) {
  return async function handleTrust(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
    const sessionId = readSession(request);
    if (!sessionId) return reply({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
    if ([...new URL(request.url).searchParams.keys()].length > 0) return reply({ status: "error", reason: "validation", message: FRIENDLY.validation }, 400);
    const { id } = await context.params;
    let decoded: string;
    try { decoded = decodeURIComponent(id); } catch { return reply({ status: "error", reason: "validation", message: FRIENDLY.validation }, 400); }
    if (decoded.length < 1 || decoded.length > 128 || decoded.trim().length === 0) return reply({ status: "error", reason: "validation", message: FRIENDLY.validation }, 400);
    const result = await readTrust(decoded, { sessionId });
    if (result.ok) return reply({ status: "ok", trust: result.data }, 200);
    const status = result.kind === "validation" ? 400 : result.kind === "not_found" ? 404 : 503;
    return reply({ status: "error", reason: result.kind, message: FRIENDLY[result.kind] }, status);
  };
}

export const GET = createTrustHandler();

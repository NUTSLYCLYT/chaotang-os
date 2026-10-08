import { listJinyiweiFeeds } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

const FRIENDLY = {
  validation: "查询条件未通过校验。",
  not_found: "来源目录不存在。",
  storage: "锦衣卫来源目录暂时不可用，请稍后重试。",
  network: "无法连接朝堂后端，请稍后重试。",
  unknown: "锦衣卫来源目录暂时不可用，请稍后重试。",
} as const;
const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export function createFeedsHandler(readFeeds: typeof listJinyiweiFeeds = listJinyiweiFeeds, readSession: typeof readSessionId = readSessionId) {
  return async function handleFeeds(request: Request): Promise<Response> {
    const sessionId = readSession(request);
    if (!sessionId) return reply({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
    if ([...new URL(request.url).searchParams.keys()].length > 0) return reply({ status: "error", reason: "validation", message: FRIENDLY.validation }, 400);
    const result = await readFeeds({ sessionId });
    if (result.ok) return reply({ status: "ok", feeds: result.data }, 200);
    const status = result.kind === "validation" ? 400 : result.kind === "not_found" ? 404 : 503;
    return reply({ status: "error", reason: result.kind, message: FRIENDLY[result.kind] }, status);
  };
}

export const GET = createFeedsHandler();

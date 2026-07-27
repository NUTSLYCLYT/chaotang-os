import { getShiguanStatistics } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

const FRIENDLY_MESSAGE_BY_KIND = {
  validation: "史馆统计请求未通过校验。",
  not_found: "未找到对应史馆统计。",
  storage: "史馆暂时不可用，请稍后重试。",
  network: "无法连接朝堂后端，请稍后重试。",
  unknown: "史馆服务暂时不可用，请稍后重试。",
  unauthenticated: "authentication required",
} as const;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return jsonResponse({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
  const result = await getShiguanStatistics({ sessionId });

  if (result.ok) {
    return jsonResponse({ status: "ok", statistics: result.data }, 200);
  }

  return jsonResponse(
    {
      status: "error",
      reason: result.kind,
      message: FRIENDLY_MESSAGE_BY_KIND[result.kind],
    },
    result.kind === "unauthenticated" ? 401 : result.kind === "validation" ? 422 : 503,
  );
}

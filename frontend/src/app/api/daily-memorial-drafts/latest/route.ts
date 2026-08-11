
import { getLatestDailyMemorialDraft } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function failure(kind: "unauthenticated" | "not_found" | "conflict" | "storage" | "network" | "unknown"): Response {
  const status = kind === "unauthenticated" ? 401 : kind === "not_found" ? 404 : kind === "conflict" ? 409 : 503;
  const message = kind === "unauthenticated"
    ? "需要登录"
    : kind === "not_found"
      ? "未找到每日奏报"
      : kind === "conflict"
        ? "每日奏报草稿已更新"
        : "每日奏报暂时不可用";
  return json({ status: "error", reason: kind, message }, status);
}

export function createLatestHandler(readLatest: typeof getLatestDailyMemorialDraft = getLatestDailyMemorialDraft) {
  return async function GET(request: Request): Promise<Response> {
    const sessionId = readSessionId(request);
    if (!sessionId) return failure("unauthenticated");
    if ([...new URL(request.url).searchParams.keys()].length !== 0) {
      return json({ status: "error", reason: "validation", message: "请求格式无效" }, 400);
    }
    try {
      const result = await readLatest({ sessionId });
      return result.ok ? json({ status: "ok", latest: result.data }, 200) : failure(result.kind);
    } catch {
      return failure("unknown");
    }
  };
}

export const GET = createLatestHandler();

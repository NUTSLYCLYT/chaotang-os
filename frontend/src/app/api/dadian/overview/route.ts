import { getDadianOverview } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function GET(request: Request): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return jsonResponse({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
  const department = new URL(request.url).searchParams.get("department")?.trim() || undefined;
  const result = await getDadianOverview({ department, sessionId });
  if (result.ok) return jsonResponse({ status: "ok", overview: result.data }, 200);
  const status = result.kind === "unauthenticated" ? 401 : result.kind === "validation" ? 422 : 503;
  return jsonResponse({ status: "error", reason: result.kind, message: result.kind === "unauthenticated" ? "authentication required" : "大殿概览暂时不可用，请稍后重试。" }, status);
}

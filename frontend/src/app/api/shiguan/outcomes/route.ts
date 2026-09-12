// Lands at frontend/src/app/api/shiguan/outcomes/route.ts
import { listShiguanOutcomes } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

const FRIENDLY_MESSAGE_BY_KIND = {
  validation: "结果账查询未通过校验，请确认分页参数后重试。",
  not_found: "未找到对应史馆结果账。",
  conflict: "结果账状态已变化，请刷新后重试。",
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

function errorStatus(kind: keyof typeof FRIENDLY_MESSAGE_BY_KIND): number {
  if (kind === "unauthenticated") return 401;
  if (kind === "validation") return 422;
  if (kind === "not_found") return 404;
  if (kind === "conflict") return 409;
  return 503;
}

function readPaging(request: Request): { limit?: number; cursor?: string } | null {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const rawCursor = url.searchParams.get("cursor");
  const paging: { limit?: number; cursor?: string } = {};
  if (rawLimit !== null) {
    if (!/^\d+$/u.test(rawLimit)) return null;
    const limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return null;
    paging.limit = limit;
  }
  if (rawCursor !== null) {
    if (rawCursor.trim().length === 0 || rawCursor.length > 256) return null;
    paging.cursor = rawCursor;
  }
  return paging;
}

export async function GET(request: Request): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) {
    return jsonResponse(
      { status: "error", reason: "unauthenticated", message: "authentication required" },
      401,
    );
  }

  const paging = readPaging(request);
  if (paging === null) {
    return jsonResponse(
      { status: "error", reason: "validation", message: "分页参数不合法：limit 需在 1 到 100 之间。" },
      400,
    );
  }

  const result = await listShiguanOutcomes({ sessionId, ...paging });
  if (result.ok) {
    return jsonResponse({ status: "ok", page: result.data }, 200);
  }
  return jsonResponse(
    { status: "error", reason: result.kind, message: FRIENDLY_MESSAGE_BY_KIND[result.kind] },
    errorStatus(result.kind),
  );
}

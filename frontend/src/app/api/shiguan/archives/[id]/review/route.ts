import {
  type ReviewStatusValue,
  updateShiguanReview,
} from "../../../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../../../lib/session.ts";

const REVIEW_STATUSES = new Set<ReviewStatusValue>([
  "ACHIEVED",
  "NOT_ACHIEVED",
  "PARTIAL",
  "OBSERVING",
]);

const FRIENDLY_MESSAGE_BY_KIND = {
  validation: "复盘状态未通过校验，请确认状态值与备注后重试。",
  not_found: "未找到对应史馆档案。",
  conflict: "史馆档案状态冲突，请刷新后重试。",
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
  if (kind === "unauthenticated") {
    return 401;
  }
  if (kind === "validation") {
    return 422;
  }
  if (kind === "not_found") {
    return 404;
  }
  if (kind === "conflict") {
    return 409;
  }
  return 503;
}

async function readArchiveId(
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<string> {
  const params = await context.params;
  return params.id;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return jsonResponse({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      { status: "error", reason: "validation", message: "请求体不是合法 JSON。" },
      400,
    );
  }

  if (typeof payload !== "object" || payload === null) {
    return jsonResponse(
      { status: "error", reason: "validation", message: "请求体必须是 JSON 对象。" },
      400,
    );
  }

  const status = (payload as { status?: unknown }).status;
  const note = (payload as { note?: unknown }).note;
  if (typeof status !== "string" || !REVIEW_STATUSES.has(status as ReviewStatusValue)) {
    return jsonResponse(
      { status: "error", reason: "validation", message: "未知的复盘状态。" },
      400,
    );
  }
  if (note !== undefined && typeof note !== "string") {
    return jsonResponse(
      { status: "error", reason: "validation", message: "复盘备注必须是字符串。" },
      400,
    );
  }

  const result = await updateShiguanReview(
    await readArchiveId(context),
    status as ReviewStatusValue,
    note ?? "",
    { sessionId },
  );

  if (result.ok) {
    return jsonResponse({ status: "ok", reviewStatus: result.data }, 200);
  }

  return jsonResponse(
    {
      status: "error",
      reason: result.kind,
      message: FRIENDLY_MESSAGE_BY_KIND[result.kind],
    },
    errorStatus(result.kind),
  );
}

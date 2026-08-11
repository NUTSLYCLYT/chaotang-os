import {
  type ArchiveDecisionValue,
  updateShiguanDecision,
} from "../../../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../../../lib/session.ts";

const DECISIONS = new Set<ArchiveDecisionValue>([
  "APPROVED",
  "REJECTED",
  "ADOPTED",
  "RETURNED_FOR_RECONSIDERATION",
]);

const FRIENDLY_MESSAGE_BY_KIND = {
  validation: "处置未通过校验，请确认文书类型与决定后重试。",
  not_found: "未找到对应史馆档案。",
  conflict: "该文书已有不同处置，请刷新查看已归档结果。",
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

function isExactDecisionPayload(value: unknown): value is { decision: ArchiveDecisionValue } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 1 &&
    typeof record.decision === "string" &&
    DECISIONS.has(record.decision as ArchiveDecisionValue);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) {
    return jsonResponse({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ status: "error", reason: "validation", message: "请求体不是合法 JSON。" }, 400);
  }
  if (!isExactDecisionPayload(payload)) {
    return jsonResponse({ status: "error", reason: "validation", message: "处置请求必须且只能包含合法 decision。" }, 400);
  }

  const { id } = await context.params;
  if (typeof id !== "string" || id.trim().length === 0 || id.length > 200) {
    return jsonResponse({ status: "error", reason: "validation", message: "档案标识不合法。" }, 400);
  }

  const result = await updateShiguanDecision(id, payload.decision, { sessionId });
  if (result.ok) {
    return jsonResponse({ status: "ok", decisionStatus: result.data }, 200);
  }
  return jsonResponse({
    status: "error",
    reason: result.kind,
    message: FRIENDLY_MESSAGE_BY_KIND[result.kind],
  }, errorStatus(result.kind));
}

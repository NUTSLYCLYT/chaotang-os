import { recallShiguanArchives } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

const FRIENDLY_MESSAGE_BY_KIND = {
  validation: "旧案召回条件未通过校验，请至少填写事项类型或所属部门。",
  not_found: "未找到对应旧案。",
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

export async function POST(request: Request): Promise<Response> {
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

  const matterType = (payload as { matterType?: unknown }).matterType;
  const department = (payload as { department?: unknown }).department;
  const limit = (payload as { limit?: unknown }).limit;

  if (matterType !== undefined && typeof matterType !== "string") {
    return jsonResponse(
      { status: "error", reason: "validation", message: "事项类型必须是字符串。" },
      400,
    );
  }
  if (department !== undefined && typeof department !== "string") {
    return jsonResponse(
      { status: "error", reason: "validation", message: "所属部门必须是字符串。" },
      400,
    );
  }
  if (limit !== undefined && typeof limit !== "number") {
    return jsonResponse(
      { status: "error", reason: "validation", message: "召回数量必须是数字。" },
      400,
    );
  }

  const result = await recallShiguanArchives({ matterType, department, limit, sessionId });

  if (result.ok) {
    return jsonResponse({ status: "ok", matches: result.data }, 200);
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

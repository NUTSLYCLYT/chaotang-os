import {
  type ArchiveType,
  listShiguanArchives,
} from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

const ARCHIVE_TYPES = new Set<ArchiveType>([
  "MEMORIAL",
  "REPLY",
]);

const FRIENDLY_MESSAGE_BY_KIND = {
  validation: "史馆筛选条件未通过校验，请调整后重试。",
  not_found: "未找到对应史馆档案。",
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
  return 503;
}

export async function GET(request: Request): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return jsonResponse({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const limit = url.searchParams.get("limit");

  if (type !== null && !ARCHIVE_TYPES.has(type as ArchiveType)) {
    return jsonResponse(
      { status: "error", reason: "validation", message: "未知的史馆档案类型。" },
      400,
    );
  }

  const result = await listShiguanArchives({
    type: type === null ? undefined : (type as ArchiveType),
    matterType: url.searchParams.get("matterType") ?? undefined,
    department: url.searchParams.get("department") ?? undefined,
    limit: limit === null ? undefined : Number(limit),
    sessionId,
  });

  if (result.ok) {
    return jsonResponse({ status: "ok", archives: result.data }, 200);
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

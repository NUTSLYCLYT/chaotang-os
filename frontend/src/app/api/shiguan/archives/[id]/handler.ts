import { getShiguanArchive } from "../../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../../lib/session.ts";

const ARCHIVE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:+-]{0,198}[A-Za-z0-9])?$/u;
const genericNotFound = { status: "error", reason: "not_found", message: "未找到对应史馆档案。" };

function response(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "private, no-store", "vary": "Cookie" } });
}

export async function getArchiveResponse(request: Request, id: unknown): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return response({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
  if (typeof id !== "string" || !ARCHIVE_ID.test(id)) {
    return response({ status: "error", reason: "validation", message: "档案标识不合法。" }, 400);
  }
  const result = await getShiguanArchive(id, { sessionId });
  if (result.ok) return response({ status: "ok", archive: result.data }, 200);
  if (result.kind === "unauthenticated") return response({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
  if (result.kind === "not_found") return response(genericNotFound, 404);
  return response({ status: "error", reason: "unavailable", message: "史馆暂时不可用，请稍后重试。" }, 503);
}

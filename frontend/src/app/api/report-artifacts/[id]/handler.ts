import { downloadReportArtifact, type ReportArtifactDownloadResult } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
type Context = { params: Promise<{ id: string }> };
type Download = (id: string, options: { sessionId: string }) => Promise<ReportArtifactDownloadResult>;

function errorResponse(reason: string, status: number): Response {
  const message = status === 401 ? "authentication required" : status === 404 ? "report artifact not found" :
    status === 400 ? "invalid artifact id" : "report artifact temporarily unavailable";
  return Response.json({ status: "error", reason, message }, { status });
}

function validId(id: string): boolean {
  const value = id.trim();
  return value.length > 0 && value === id && value !== "." && value !== ".." && !/[\\/%]/.test(value);
}

function safeDisposition(value: string | null): string {
  const fallback = "attachment; filename*=UTF-8''report-artifact.xlsx";
  if (value === null || !/^attachment; filename\*=UTF-8''(?:[A-Za-z0-9._~-]|%[0-9A-Fa-f]{2})+$/.test(value)) {
    return fallback;
  }
  try {
    const decoded = decodeURIComponent(value.slice("attachment; filename*=UTF-8''".length));
    if (!decoded || /[\\/\r\n"]/u.test(decoded) || !decoded.toLowerCase().endsWith(".xlsx")) return fallback;
    return value;
  } catch {
    return fallback;
  }
}

export function createGetHandler(download: Download = downloadReportArtifact, readSession: typeof readSessionId = readSessionId) {
  return async function GET(request: Request, context: Context): Promise<Response> {
    const sessionId = readSession(request);
    if (!sessionId) return errorResponse("unauthenticated", 401);
    const { id } = await context.params;
    if (!validId(id)) return errorResponse("validation", 400);
    let result: ReportArtifactDownloadResult;
    try { result = await download(id, { sessionId }); }
    catch { return errorResponse("unavailable", 503); }
    if (!result.ok) {
      if (result.kind === "unauthenticated") return errorResponse(result.kind, 401);
      if (result.kind === "not_found") return errorResponse(result.kind, 404);
      return errorResponse(result.kind, 503);
    }
    const contentType = result.response.headers.get("content-type")?.split(";")[0].trim();
    if (contentType !== XLSX || result.response.body === null) return errorResponse("unavailable", 503);
    const headers = new Headers({
      "content-type": XLSX,
      "content-disposition": safeDisposition(result.response.headers.get("content-disposition")),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    });
    const contentLength = result.response.headers.get("content-length");
    if (contentLength !== null && /^(0|[1-9]\d*)$/.test(contentLength)) {
      headers.set("content-length", contentLength);
    }
    return new Response(result.response.body, { status: 200, headers });
  };
}

export const GET = createGetHandler();

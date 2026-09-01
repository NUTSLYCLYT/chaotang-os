import {
  fetchReportArtifactWorkProduct,
  type ReportWorkProductResult,
} from "../../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../../lib/session.ts";

type Context = { params: Promise<{ id: string }> };
type FetchWorkProduct = (
  id: string,
  options: { sessionId: string; signal: AbortSignal },
) => Promise<ReportWorkProductResult>;
const MAX_ID_BYTES = 256;
const encoder = new TextEncoder();

function errorResponse(reason: string, status: number): Response {
  const message = status === 401
    ? "authentication required"
    : status === 404
      ? "report work product not found"
      : status === 400
        ? "invalid artifact id"
        : "report work product temporarily unavailable";
  return Response.json(
    { status: "error", reason, message },
    { status, headers: { "cache-control": "private, no-store" } },
  );
}

export function createGetHandler(
  fetchWorkProduct: FetchWorkProduct = fetchReportArtifactWorkProduct,
  readSession: typeof readSessionId = readSessionId,
) {
  return async function GET(request: Request, context: Context): Promise<Response> {
    const sessionId = readSession(request);
    if (!sessionId) return errorResponse("unauthenticated", 401);
    const { id } = await context.params;
    if (!id || id !== id.trim() || encoder.encode(id).length > MAX_ID_BYTES) {
      return errorResponse("validation", 400);
    }
    let result: ReportWorkProductResult;
    try {
      result = await fetchWorkProduct(id, { sessionId, signal: request.signal });
    } catch {
      return errorResponse("unavailable", 503);
    }
    if (result.ok) {
      return Response.json(result.data, {
        status: 200,
        headers: { "cache-control": "private, no-store" },
      });
    }
    if (result.kind === "unauthenticated") return errorResponse(result.kind, 401);
    if (result.kind === "not_found") return errorResponse(result.kind, 404);
    return errorResponse(result.kind, 503);
  };
}

export const GET = createGetHandler();

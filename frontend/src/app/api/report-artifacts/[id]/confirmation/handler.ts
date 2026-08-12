import {
  submitReportArtifactConfirmation,
  type ConfirmationDecision,
  type ReportWorkProductResult,
} from "../../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../../lib/session.ts";

type Context = { params: Promise<{ id: string }> };
type SubmitConfirmation = (
  id: string,
  payload: { decision: ConfirmationDecision; structuredReason: string },
  options: { sessionId: string },
) => Promise<ReportWorkProductResult>;

function errorResponse(reason: string, status: number): Response {
  const message = status === 401
    ? "authentication required"
    : status === 404
      ? "report work product not found"
      : status === 409
        ? "confirmation transition invalid"
        : status === 400
          ? "invalid confirmation request"
          : "report work product temporarily unavailable";
  return Response.json({ status: "error", reason, message }, { status });
}

function parseBody(value: unknown): { decision: ConfirmationDecision; structuredReason: string } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || !("decision" in record) || !("structured_reason" in record) ||
      typeof record.decision !== "string" ||
      !["CONFIRMED", "REVISION_REQUIRED", "ESCALATED"].includes(record.decision) ||
      typeof record.structured_reason !== "string" || record.structured_reason.trim().length === 0) return null;
  return {
    decision: record.decision as ConfirmationDecision,
    structuredReason: record.structured_reason.trim(),
  };
}

export function createPostHandler(
  submitConfirmation: SubmitConfirmation = submitReportArtifactConfirmation,
  readSession: typeof readSessionId = readSessionId,
) {
  return async function POST(request: Request, context: Context): Promise<Response> {
    const sessionId = readSession(request);
    if (!sessionId) return errorResponse("unauthenticated", 401);
    const { id } = await context.params;
    if (!id || id !== id.trim()) return errorResponse("validation", 400);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("validation", 400);
    }
    const payload = parseBody(body);
    if (!payload) return errorResponse("validation", 400);
    let result: ReportWorkProductResult;
    try {
      result = await submitConfirmation(id, payload, { sessionId });
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
    if (result.kind === "invalid_transition") return errorResponse(result.kind, 409);
    return errorResponse(result.kind, 503);
  };
}

export const POST = createPostHandler();

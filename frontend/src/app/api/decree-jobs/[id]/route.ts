import { getDecreeJob } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";


type Context = { params: Promise<{ id: string }> };
type ReadJob = typeof getDecreeJob;
type ReadSession = typeof readSessionId;


function response(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}


function error(reason: string, status: number): Response {
  const message = status === 401
    ? "authentication required"
    : status === 404
      ? "decree job not found"
      : status === 400
        ? "invalid decree job id"
        : "decree job temporarily unavailable";
  return response({ status: "error", reason, message }, status);
}


export function createGetHandler(
  readJob: ReadJob = getDecreeJob,
  readSession: ReadSession = readSessionId,
) {
  return async function GET(request: Request, context: Context): Promise<Response> {
    const sessionId = readSession(request);
    if (!sessionId) return error("unauthenticated", 401);
    const { id } = await context.params;
    if (!/^[0-9a-f]{32}$/.test(id)) return error("validation", 400);
    let result: Awaited<ReturnType<ReadJob>>;
    try {
      result = await readJob(id, { sessionId });
    } catch {
      return error("unavailable", 503);
    }
    if (result.ok) return response(result.data, 200);
    if (result.kind === "unauthenticated") return error(result.kind, 401);
    if (result.kind === "not_found") return error(result.kind, 404);
    return error(result.kind, 503);
  };
}


export const GET = createGetHandler();

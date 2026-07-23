import { getCurrentUser } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

const UNAUTHENTICATED = { status: "error", reason: "unauthenticated", message: "authentication required" };
function json(body: unknown, status: number): Response { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }

export async function GET(request: Request): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return json(UNAUTHENTICATED, 401);
  const result = await getCurrentUser({ sessionId });
  if (!result.ok) return json(result.kind === "unauthenticated" ? UNAUTHENTICATED : { status: "error", reason: result.kind, message: "authentication service unavailable" }, result.kind === "unauthenticated" ? 401 : 503);
  return json({ user: result.user }, 200);
}

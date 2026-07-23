import { registerUser } from "../../../../lib/backendClient.ts";
import { setSessionCookie } from "../../../../lib/session.ts";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try { payload = await request.json(); } catch { return json({ status: "error", reason: "validation", message: "invalid request" }, 400); }
  if (
    typeof payload !== "object" || payload === null ||
    typeof (payload as Record<string, unknown>).username !== "string" ||
    typeof (payload as Record<string, unknown>).email !== "string" ||
    typeof (payload as Record<string, unknown>).password !== "string"
  ) return json({ status: "error", reason: "validation", message: "invalid request" }, 400);
  const result = await registerUser(payload as { username: string; email: string; password: string });
  if (!result.ok) {
    const status = result.kind === "validation" ? 422 : result.kind === "conflict" ? 409 : result.kind === "unauthenticated" ? 401 : 503;
    return json({ status: "error", reason: result.kind, message: "registration failed" }, status);
  }
  return setSessionCookie(json({ user: result.user }, result.status), result.sessionId!);
}

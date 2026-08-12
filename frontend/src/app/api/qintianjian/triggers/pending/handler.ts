import { listPendingQintianTriggers } from "../../../../../lib/backendClient.ts";
import { hasNoQuery, json, requireSession, safeFailure, validationFailure } from "../../routeSupport.ts";

export function createPendingTriggersHandler(list: typeof listPendingQintianTriggers = listPendingQintianTriggers) {
  return async function GET(request: Request): Promise<Response> {
    const session = requireSession(request);
    if (session instanceof Response) return session;
    if (!hasNoQuery(request)) return validationFailure();
    const result = await list({ sessionId: session });
    return result.ok ? json({ status: "ok", triggers: result.data.items }, 200) : safeFailure(result);
  };
}
export const GET = createPendingTriggersHandler();

import { getQintianForecast } from "../../../../../lib/backendClient.ts";
import { decodeRouteId, hasNoQuery, json, requireSession, safeFailure, validationFailure } from "../../routeSupport.ts";

type Context = { params: Promise<{ id: string }> };
export function createForecastGetHandler(get: typeof getQintianForecast = getQintianForecast) {
  return async function GET(request: Request, context: Context): Promise<Response> {
    const session = requireSession(request);
    if (session instanceof Response) return session;
    if (!hasNoQuery(request)) return validationFailure();
    const id = decodeRouteId((await context.params).id);
    if (!id) return validationFailure();
    const result = await get(id, { sessionId: session });
    return result.ok ? json({ status: "ok", forecast: result.data }, 200) : safeFailure(result);
  };
}
export const GET = createForecastGetHandler();

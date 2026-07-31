import { createQintianForecast, listQintianForecasts } from "../../../../lib/backendClient.ts";
import { hasNoQuery, json, parseCreateBody, readJson, requireSession, safeFailure, validationFailure } from "../routeSupport.ts";

export function createForecastsGetHandler(list: typeof listQintianForecasts = listQintianForecasts) {
  return async function GET(request: Request): Promise<Response> {
    const session = requireSession(request);
    if (session instanceof Response) return session;
    if (!hasNoQuery(request)) return validationFailure();
    const result = await list({ sessionId: session });
    return result.ok ? json({ status: "ok", forecasts: result.data.items }, 200) : safeFailure(result);
  };
}
export function createForecastsPostHandler(create: typeof createQintianForecast = createQintianForecast) {
  return async function POST(request: Request): Promise<Response> {
    const session = requireSession(request);
    if (session instanceof Response) return session;
    const input = parseCreateBody(await readJson(request));
    if (!input) return validationFailure();
    const result = await create(input, { sessionId: session });
    return result.ok ? json({ status: "ok", forecast: result.data }, 201) : safeFailure(result);
  };
}
export const GET = createForecastsGetHandler();
export const POST = createForecastsPostHandler();

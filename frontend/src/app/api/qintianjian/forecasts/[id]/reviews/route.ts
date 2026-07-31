import { reviewQintianForecast } from "../../../../../../lib/backendClient.ts";
import { decodeRouteId, json, parseReviewBody, readJson, requireSession, safeFailure, validationFailure } from "../../../routeSupport.ts";

type Context = { params: Promise<{ id: string }> };
export function createReviewHandler(review: typeof reviewQintianForecast = reviewQintianForecast) {
  return async function POST(request: Request, context: Context): Promise<Response> {
    const session = requireSession(request);
    if (session instanceof Response) return session;
    const id = decodeRouteId((await context.params).id);
    const input = parseReviewBody(await readJson(request));
    if (!id || !input) return validationFailure();
    const result = await review(id, input, { sessionId: session });
    return result.ok ? json({ status: "ok", review: result.data }, 201) : safeFailure(result);
  };
}
export const POST = createReviewHandler();

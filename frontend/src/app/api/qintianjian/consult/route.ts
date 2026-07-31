import { consultQintian } from "../../../../lib/backendClient.ts";
import { json, parseConsultBody, readJson, requireSession, safeFailure, validationFailure } from "../routeSupport.ts";

export function createConsultHandler(consult: typeof consultQintian = consultQintian) {
  return async function POST(request: Request): Promise<Response> {
    const session = requireSession(request);
    if (session instanceof Response) return session;
    const input = parseConsultBody(await readJson(request));
    if (!input) return validationFailure();
    const result = await consult(input, { sessionId: session });
    return result.ok ? json(result.data, 200) : safeFailure(result);
  };
}
export const POST = createConsultHandler();

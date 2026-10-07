import { requestBingbu, type BingbuResult } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

type Params = { params: Promise<{ segments: string[] }> };
type Reader = typeof requestBingbu;

const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function errorResponse(result: Extract<BingbuResult, { ok: false }>): Response {
  const status = result.kind === "unauthenticated"
    ? 401
    : result.kind === "forbidden"
      ? 403
      : result.kind === "not_found"
        ? 404
        : result.kind === "validation"
          ? 422
          : result.kind === "conflict"
            ? 409
            : 503;
  const message = result.kind === "unauthenticated"
    ? "authentication required"
    : result.kind === "forbidden"
      ? "当前身份无权访问兵部对象"
      : result.kind === "not_found"
        ? "兵部对象不存在"
        : result.kind === "validation"
          ? "请求或销售事实无效"
          : result.kind === "conflict"
            ? "销售事实发生冲突"
            : "兵部服务暂时不可用，请稍后重试";
  return reply({ status: "error", reason: result.kind, message }, status);
}

function isSupportedRoute(segments: string[], method: string): boolean {
  const key = segments.join("/");
  if (method === "GET") {
    return key === "overview" || key === "opportunities" ||
      /^opportunities\/[^/]+(?:\/timeline)?$/.test(key) ||
      /^decision-packets\/[^/]+$/.test(key) || /^imports\/[^/]+$/.test(key);
  }
  if (method !== "POST") return false;
  return key === "imports/preview" || key === "imports/commit" || key === "war-rooms" ||
    key === "action-drafts" || /^action-drafts\/[^/]+\/(approve|reject)$/.test(key);
}

async function dispatch(request: Request, segments: string[], sessionId: string, reader: Reader): Promise<Response> {
  const method = request.method as "GET" | "POST";
  const query = new URL(request.url).search;
  let path = `/api/v1/bingbu/${segments.map(encodeURIComponent).join("/")}`;
  if (method === "GET" && segments.join("/") === "opportunities" && query) path += query;
  let body: unknown;
  if (method === "POST") {
    try {
      body = await request.json();
    } catch {
      return reply({ status: "error", reason: "validation", message: "请求体无效" }, 400);
    }
  }
  const result = await reader(path, { method, body, sessionId });
  return result.ok ? reply({ status: "ok", data: result.data }, result.status) : errorResponse(result);
}

function createBingbuHandler(reader: Reader = requestBingbu, sessionReader: typeof readSessionId = readSessionId) {
  return async function handle(request: Request, context: Params): Promise<Response> {
    const sessionId = sessionReader(request);
    if (!sessionId) return reply({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
    const { segments } = await context.params;
    if (segments.length === 0 || !isSupportedRoute(segments, request.method)) {
      return reply({ status: "error", reason: "validation", message: "unsupported bingbu route" }, 400);
    }
    const url = new URL(request.url);
    if (request.method === "GET" && segments.join("/") !== "opportunities" && url.search) {
      return reply({ status: "error", reason: "validation", message: "query is not supported for this route" }, 400);
    }
    if (request.method === "GET" && segments.join("/") === "opportunities") {
      const allowed = new Set(["stage", "health", "limit", "cursor"]);
      for (const key of url.searchParams.keys()) {
        if (!allowed.has(key)) return reply({ status: "error", reason: "validation", message: "unsupported query" }, 400);
      }
    }
    return dispatch(request, segments, sessionId, reader);
  };
}

export { createBingbuHandler };

const handler = createBingbuHandler();
export const GET = handler;
export const POST = handler;

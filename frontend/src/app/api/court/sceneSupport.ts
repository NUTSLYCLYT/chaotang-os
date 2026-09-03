import { getBackendBaseUrl } from "../../../lib/backendClient.ts";
import { readSessionId } from "../../../lib/session.ts";

type Method = "GET" | "POST" | "PATCH";

const FRIENDLY_MESSAGE = "朝堂场景服务暂时不可用，请稍后重试。";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function safeSegment(value: string): string | null {
  const normalized = value.trim();
  return /^[a-z0-9][a-z0-9-]{0,118}[a-z0-9]$/.test(normalized)
    ? normalized
    : null;
}

export function safeSceneSlug(value: string): string | null {
  return safeSegment(value);
}

export function safeOpaqueId(value: string): string | null {
  const normalized = value.trim();
  return /^[a-zA-Z0-9_-]{1,128}$/.test(normalized) ? normalized : null;
}

export async function forwardCourtSceneRequest(
  request: Request,
  backendPath: string,
  method: Method,
): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) {
    return jsonResponse(
      { status: "error", reason: "unauthenticated", message: "authentication required" },
      401,
    );
  }
  let body: string | undefined;
  if (method !== "GET") {
    try {
      body = JSON.stringify(await request.json());
    } catch {
      return jsonResponse({ status: "error", reason: "validation", message: "请求格式无效。" }, 400);
    }
  }
  try {
    const response = await fetch(
      `${getBackendBaseUrl().replace(/\/+$/, "")}${backendPath}`,
      {
        method,
        headers: {
          authorization: `Bearer ${sessionId}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body }),
        cache: "no-store",
      },
    );
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return jsonResponse({ status: "error", reason: "network", message: FRIENDLY_MESSAGE }, 503);
  }
}

import {
  ShiguanUiError,
  type ShiguanErrorKind,
} from "./shiguanController.ts";

const ERROR_KINDS = new Set<ShiguanErrorKind>([
  "validation",
  "not_found",
  "storage",
  "network",
  "unauthenticated",
  "unknown",
]);

interface ErrorResponse {
  status: "error";
  reason?: unknown;
  message?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseErrorKind(
  response: Response,
  body: ErrorResponse,
): ShiguanErrorKind {
  if (response.status === 401) return "unauthenticated";
  if (
    typeof body.reason === "string" &&
    ERROR_KINDS.has(body.reason as ShiguanErrorKind)
  ) {
    return body.reason as ShiguanErrorKind;
  }
  if (response.status === 400 || response.status === 422) return "validation";
  if (response.status === 404) return "not_found";
  return "unknown";
}

export async function requestShiguanJson<T>(
  input: string,
  init: RequestInit,
  parse: (body: unknown) => T | null,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ShiguanUiError("network", "无法连接史馆服务，请稍后重试");
  }

  if (response.status === 401) {
    throw new ShiguanUiError(
      "unauthenticated",
      "会话已过期，正在返回登录页。",
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ShiguanUiError("unknown", "史馆服务返回了无法识别的响应，请稍后重试");
  }

  if (!response.ok) {
    const errorBody: ErrorResponse = isRecord(body)
      ? {
          status: "error",
          reason: body.reason,
          message: body.message,
        }
      : { status: "error" };
    const kind = responseErrorKind(response, errorBody);
    const message = kind === "unauthenticated"
      ? "会话已过期，正在返回登录页。"
      : typeof errorBody.message === "string"
        ? errorBody.message
        : "史馆请求失败，请稍后重试";
    throw new ShiguanUiError(kind, message);
  }

  const parsed = parse(body);
  if (parsed === null) {
    throw new ShiguanUiError("unknown", "史馆服务返回了不完整的响应，请稍后重试");
  }
  return parsed;
}

/**
 * 服务端专用的后端客户端。
 *
 * 只应在 Next.js 服务端代码（Server Component、Route Handler）中调用；不导出任何
 * `NEXT_PUBLIC_` 变量，避免把后端地址暴露到浏览器端。当前仅封装 `GET /health`，
 * 用于最小骨架阶段的前后端联通展示。
 */

/** `GET /health` 契约成功响应体的形状。 */
export interface BackendHealth {
  status: string;
  service: string;
  version: string;
}

/** `fetchHealth` 的返回结果：成功携带响应体，失败携带可读的错误描述。 */
export type BackendHealthResult =
  | { ok: true; data: BackendHealth }
  | { ok: false; error: string };

const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_TIMEOUT_MS = 3000;

/**
 * 读取服务端专用环境变量 `BACKEND_BASE_URL`；未设置时使用本地开发默认值。
 * 刻意不使用 `NEXT_PUBLIC_` 前缀，因为该变量只应在服务端读取。
 */
export function getBackendBaseUrl(): string {
  const value = process.env.BACKEND_BASE_URL?.trim();
  return value && value.length > 0 ? value : DEFAULT_BACKEND_BASE_URL;
}

export interface FetchHealthOptions {
  /** 覆盖默认后端基础地址，主要用于测试。 */
  baseUrl?: string;
  /** 请求超时时间（毫秒），默认 3000ms。 */
  timeoutMs?: number;
}

/**
 * 调用后端 `GET /health`。
 *
 * 永远不会抛出未捕获异常：网络错误、超时、非 200 状态码或响应体不是合法 JSON
 * 时都会返回 `{ ok: false, error }`，由调用方（页面）决定如何展示「后端不可用」。
 */
export async function fetchHealth(
  options: FetchHealthOptions = {},
): Promise<BackendHealthResult> {
  const baseUrl = options.baseUrl ?? getBackendBaseUrl();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/health`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, error: `后端响应非 200 状态码：${response.status}` };
    }

    const data = (await response.json()) as BackendHealth;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  } finally {
    clearTimeout(timer);
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "请求超时";
    }
    return error.message;
  }
  return String(error);
}

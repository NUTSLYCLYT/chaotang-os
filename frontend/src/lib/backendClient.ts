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

/** 一个被军机处/单部门咨询的部门及其办理意见，保序。 */
export interface MinistryOpinion {
  department: string;
  opinion: string;
}

/**
 * `POST /api/v1/decrees/chancellor` 成功响应体映射到前端后的形状。
 *
 * 对应后端 `route_type/rationale/processing_path/departments/ministry_opinions/
 * final_verdict` 驼峰化后的字段：`routeType/rationale/processingPath/departments/
 * ministryOpinions/finalVerdict`。旧的单段 `memorialText` 字段已被这组结构化字段
 * 整体替代（见 `docs/decisions/0012-decree-six-ministries-joint-review.md`）。
 */
export interface SubmitDecreeData {
  status: string;
  chancellor: string;
  routeType: string;
  rationale: string;
  processingPath: string[];
  departments: string[];
  ministryOpinions: MinistryOpinion[];
  finalVerdict: string;
}

/**
 * `submitDecree` 的返回结果：成功携带映射后的响应体；失败携带一个稳定的错误分类
 * `kind`（供调用方决定 HTTP 状态码/展示文案）和一段可读的错误描述。
 */
export type SubmitDecreeResult =
  | { ok: true; data: SubmitDecreeData }
  | {
      ok: false;
      kind: "validation" | "config" | "model" | "network" | "unknown";
      error: string;
    };

export interface SubmitDecreeOptions {
  /** 覆盖默认后端基础地址，主要用于测试。 */
  baseUrl?: string;
  /** 请求超时时间（毫秒），默认 `DECREE_TIMEOUT_MS`。 */
  timeoutMs?: number;
}

/**
 * `submitDecree` 专用超时常量：LLM 调用可能耗时较长，刻意独立于 `fetchHealth` 的
 * `DEFAULT_TIMEOUT_MS`（3000ms），不与其共用默认值。
 *
 * 一次下旨最坏情况会触发 8 次串行 DeepSeek 调用（1 次丞相路由 + 最多 6 次六部会审
 * + 1 次军机处汇总，均由后端图按确定顺序串行执行，不并发），而不是旧版单次丞相回
 * 奏；因此从 45000ms 上调至 120000ms，避免把"模型仍在处理"误判为网络错误。数值
 * 依据详见 `docs/decisions/0012-decree-six-ministries-joint-review.md`。
 */
const DECREE_TIMEOUT_MS = 120000;

/** 从错误响应体中提取脱敏的 `message` 字段；解析失败或字段缺失时回退到 `fallback`。 */
async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body?.message === "string" && body.message.length > 0) {
      return body.message;
    }
  } catch {
    // 响应体不是合法 JSON 或不含 message 字段时，使用 fallback。
  }
  return fallback;
}

/** 校验并提取一份 `{department, opinion}` 数组；任一元素形状不符时返回 `null`。 */
function parseMinistryOpinions(value: unknown): MinistryOpinion[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const opinions: MinistryOpinion[] = [];
  for (const entry of value) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as Record<string, unknown>).department !== "string" ||
      ((entry as Record<string, unknown>).department as string).trim().length === 0 ||
      typeof (entry as Record<string, unknown>).opinion !== "string" ||
      ((entry as Record<string, unknown>).opinion as string).trim().length === 0
    ) {
      return null;
    }
    opinions.push({
      department: ((entry as Record<string, unknown>).department as string).trim(),
      opinion: ((entry as Record<string, unknown>).opinion as string).trim(),
    });
  }
  return opinions;
}

/** 校验并提取一份非空字符串数组；形状不符时返回 `null`。 */
function parseNonEmptyStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  if (!value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    return null;
  }
  return value as string[];
}

/**
 * 校验并提取一份符合新契约的 `SubmitDecreeData`；任一必需字段缺失或形状不符（含旧的
 * `memorial_text` 单段字形状）都回退到 `null`，由调用方映射为 `kind: "unknown"`。
 */
function parseSubmitDecreeData(body: unknown): SubmitDecreeData | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;

  if (record.status !== "ok") {
    return null;
  }
  if (typeof record.chancellor !== "string" || record.chancellor.trim().length === 0) {
    return null;
  }
  if (typeof record.route_type !== "string" || record.route_type.trim().length === 0) {
    return null;
  }
  if (typeof record.rationale !== "string" || record.rationale.trim().length === 0) {
    return null;
  }
  const processingPath = parseNonEmptyStringArray(record.processing_path);
  if (processingPath === null) {
    return null;
  }
  const departments = parseNonEmptyStringArray(record.departments);
  if (departments === null) {
    return null;
  }
  const ministryOpinions = parseMinistryOpinions(record.ministry_opinions);
  if (ministryOpinions === null) {
    return null;
  }
  if (typeof record.final_verdict !== "string" || record.final_verdict.trim().length === 0) {
    return null;
  }

  return {
    status: record.status,
    chancellor: record.chancellor.trim(),
    routeType: record.route_type.trim(),
    rationale: record.rationale.trim(),
    processingPath,
    departments,
    ministryOpinions,
    finalVerdict: record.final_verdict.trim(),
  };
}

/**
 * 调用后端 `POST /api/v1/decrees/chancellor`，提交一句旨意并请求丞相 Agent 生成回奏。
 *
 * 与 `fetchHealth` 一致，永远不会抛出未捕获异常：网络错误、超时、校验失败（422）、
 * 配置不可用（503）、模型调用失败（502）、其他非 2xx 或响应体不是合法 JSON，都会
 * 返回一个带有稳定 `kind` 的 `{ ok: false, kind, error }` 结果，由调用方决定如何
 * 映射 HTTP 状态码与展示文案。
 */
export async function submitDecree(
  decreeText: string,
  options: SubmitDecreeOptions = {},
): Promise<SubmitDecreeResult> {
  const baseUrl = options.baseUrl ?? getBackendBaseUrl();
  const timeoutMs = options.timeoutMs ?? DECREE_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/v1/decrees/chancellor`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decree_text: decreeText }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 422) {
      return {
        ok: false,
        kind: "validation",
        error: await extractErrorMessage(response, "旨意校验失败"),
      };
    }
    if (response.status === 503) {
      return {
        ok: false,
        kind: "config",
        error: await extractErrorMessage(response, "后端配置不可用"),
      };
    }
    if (response.status === 502) {
      return {
        ok: false,
        kind: "model",
        error: await extractErrorMessage(response, "丞相模型调用失败"),
      };
    }

    if (!response.ok) {
      return { ok: false, kind: "unknown", error: `后端响应非预期状态码：${response.status}` };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, kind: "unknown", error: "后端响应不是合法 JSON" };
    }

    const data = parseSubmitDecreeData(body);
    if (data === null) {
      return { ok: false, kind: "unknown", error: "后端成功响应体不符合预期契约" };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, kind: "network", error: describeError(error) };
  } finally {
    clearTimeout(timer);
  }
}

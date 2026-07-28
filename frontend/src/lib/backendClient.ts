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
  fetchImpl?: typeof fetch;
  scheduleTimeout?: (callback: () => void, delayMs: number) => unknown;
  cancelTimeout?: (handle: unknown) => void;
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
  const fetchImpl = options.fetchImpl ?? fetch;
  const scheduleTimeout =
    options.scheduleTimeout ??
    ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs));
  const cancelTimeout =
    options.cancelTimeout ??
    ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  const controller = new AbortController();
  const timer = scheduleTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/health`, {
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
    cancelTimeout(timer);
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "请求超时";
    }
  }
  return "无法连接后端，请稍后重试";
}

/** Public account fields that may cross the BFF boundary. */
export interface PublicUser {
  id: string;
  username: string;
  email: string;
}

export type BackendAuthResult =
  | { ok: true; status: number; user: PublicUser; sessionId?: string }
  | {
      ok: false;
      kind: "validation" | "conflict" | "unauthenticated" | "network" | "unknown";
    };

export interface RegisterOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export interface LoginOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

export interface AuthenticatedRequestOptions {
  baseUrl?: string;
  timeoutMs?: number;
  /** Opaque session forwarded only by Next.js server code. */
  sessionId?: string;
}

function parsePublicUser(value: unknown): PublicUser | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.username !== "string" ||
    typeof record.email !== "string"
  ) {
    return null;
  }
  return { id: record.id, username: record.username, email: record.email };
}

function authFailure(status: number): BackendAuthResult {
  if (status === 401) return { ok: false, kind: "unauthenticated" };
  if (status === 409) return { ok: false, kind: "conflict" };
  if (status === 422) return { ok: false, kind: "validation" };
  return { ok: false, kind: "unknown" };
}

async function requestAuth(
  path: string,
  init: RequestInit,
  options: AuthenticatedRequestOptions = {},
  expectsSession = false,
): Promise<BackendAuthResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${(options.baseUrl ?? getBackendBaseUrl()).replace(/\/+$/, "")}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        ...(options.sessionId ? { authorization: `Bearer ${options.sessionId}` } : {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return authFailure(response.status);
    if (response.status === 204) return { ok: true, status: response.status, user: { id: "", username: "", email: "" } };
    const body = await response.json() as unknown;
    const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : null;
    const user = parsePublicUser(expectsSession ? record?.user : body);
    const sessionId = expectsSession && typeof record?.session_id === "string" ? record.session_id : undefined;
    if (user === null || (expectsSession && !sessionId)) return { ok: false, kind: "unknown" };
    return { ok: true, status: response.status, user, sessionId };
  } catch {
    return { ok: false, kind: "network" };
  } finally {
    clearTimeout(timer);
  }
}

export function registerUser(
  payload: { username: string; email: string; password: string },
  options: RegisterOptions = {},
): Promise<BackendAuthResult> {
  return requestAuth(
    "/api/v1/auth/register",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) },
    options,
    true,
  );
}

export function loginUser(
  payload: { identifier: string; password: string },
  options: LoginOptions = {},
): Promise<BackendAuthResult> {
  return requestAuth(
    "/api/v1/auth/login",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) },
    options,
    true,
  );
}

export function getCurrentUser(options: AuthenticatedRequestOptions): Promise<BackendAuthResult> {
  return requestAuth("/api/v1/auth/me", { method: "GET" }, options);
}

export async function logoutUser(options: AuthenticatedRequestOptions): Promise<BackendAuthResult> {
  return requestAuth("/api/v1/auth/logout", { method: "POST" }, options);
}

/** 一个司级意见，按所属部的咨询顺序保留。 */
export interface BureauOpinion {
  bureau: string;
  opinion: string;
}

/** 一个被军机处/单部门咨询的部门及其分层办理意见，保序。 */
export interface MinistryOpinion {
  department: string;
  bureauOpinions: BureauOpinion[];
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
  councilVerdict: string | null;
  finalVerdict: string;
  recommendations: string[];
}

/**
 * `submitDecree` 的返回结果：成功携带映射后的响应体；失败携带一个稳定的错误分类
 * `kind`（供调用方决定 HTTP 状态码/展示文案）和一段可读的错误描述。
 */
export type SubmitDecreeResult =
  | { ok: true; data: SubmitDecreeData }
  | {
      ok: false;
      kind: "validation" | "config" | "model" | "network" | "timeout" | "unauthenticated" | "unknown";
      error: string;
    };

export interface SubmitDecreeOptions {
  /** 覆盖默认后端基础地址，主要用于测试。 */
  baseUrl?: string;
  /** 请求超时时间（毫秒），默认 `DECREE_TIMEOUT_MS`。 */
  timeoutMs?: number;
  /** 测试注入点；生产默认使用全局 `fetch`。 */
  fetchImpl?: typeof fetch;
  /** 测试注入点；生产默认使用 `setTimeout`。 */
  scheduleTimeout?: (callback: () => void, delayMs: number) => unknown;
  /** 与 `scheduleTimeout` 配对的取消函数。 */
  cancelTimeout?: (handle: unknown) => void;
  /** Opaque session forwarded only by Next.js server code. */
  sessionId?: string;
}

/**
 * `submitDecree` 专用超时常量：LLM 调用可能耗时较长，刻意独立于 `fetchHealth` 的
 * `DEFAULT_TIMEOUT_MS`（3000ms），不与其共用默认值。
 *
 * 分层回奏最坏会触发 54 次串行 DeepSeek 调用（司级咨询、部级补充、军机处会审与
 * 丞相最终汇总均不并发），可能仍超过既有 120 秒；本轮按产品约束只更新风险说明，
 * 不改变超时。数值依据见分层回奏任务与 ADR 0014。
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
function parseBureauOpinions(value: unknown): BureauOpinion[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const opinions: BureauOpinion[] = [];
  const bureauNames = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      return null;
    }
    const record = entry as Record<string, unknown>;
    if (
      Object.keys(record).length !== 2 ||
      !("bureau" in record) ||
      !("opinion" in record) ||
      typeof record.bureau !== "string" ||
      record.bureau.trim().length === 0 ||
      typeof record.opinion !== "string" ||
      record.opinion.trim().length === 0
    ) {
      return null;
    }
    const bureau = record.bureau.trim();
    if (bureauNames.has(bureau)) {
      return null;
    }
    bureauNames.add(bureau);
    opinions.push({ bureau, opinion: record.opinion.trim() });
  }
  return opinions;
}

function parseMinistryOpinions(value: unknown, departments: string[]): MinistryOpinion[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const opinions: MinistryOpinion[] = [];
  if (value.length !== departments.length) {
    return null;
  }
  for (const [index, entry] of value.entries()) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Object.keys(entry).length !== 3 ||
      typeof (entry as Record<string, unknown>).department !== "string" ||
      ((entry as Record<string, unknown>).department as string).trim().length === 0 ||
      ((entry as Record<string, unknown>).department as string).trim() !== departments[index] ||
      typeof (entry as Record<string, unknown>).opinion !== "string" ||
      ((entry as Record<string, unknown>).opinion as string).trim().length === 0
    ) {
      return null;
    }
    const bureauOpinions = parseBureauOpinions(
      (entry as Record<string, unknown>).bureau_opinions,
    );
    if (bureauOpinions === null) {
      return null;
    }
    opinions.push({
      department: ((entry as Record<string, unknown>).department as string).trim(),
      bureauOpinions,
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
  if (record.route_type !== "single" && record.route_type !== "multi") {
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
  if (
    departments === null ||
    new Set(departments).size !== departments.length ||
    (record.route_type === "single" && departments.length !== 1) ||
    (record.route_type === "multi" && departments.length < 2)
  ) {
    return null;
  }
  const ministryOpinions = parseMinistryOpinions(record.ministry_opinions, departments);
  if (ministryOpinions === null) {
    return null;
  }
  let councilVerdict: string | null;
  if (record.route_type === "single") {
    if (record.council_verdict !== null) {
      return null;
    }
    councilVerdict = null;
  } else {
    if (
      typeof record.council_verdict !== "string" ||
      record.council_verdict.trim().length === 0
    ) {
      return null;
    }
    councilVerdict = record.council_verdict.trim();
  }
  if (typeof record.final_verdict !== "string" || record.final_verdict.trim().length === 0) {
    return null;
  }
  const recommendations = parseNonEmptyStringArray(record.recommendations);
  if (
    recommendations === null ||
    recommendations.length !== 3 ||
    new Set(recommendations.map((item) => item.trim())).size !== 3
  ) {
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
    councilVerdict,
    finalVerdict: record.final_verdict.trim(),
    recommendations: recommendations.map((item) => item.trim()),
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
  const fetchImpl = options.fetchImpl ?? fetch;
  const scheduleTimeout =
    options.scheduleTimeout ??
    ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs));
  const cancelTimeout =
    options.cancelTimeout ??
    ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  const controller = new AbortController();
  let didTimeout = false;
  const timer = scheduleTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/api/v1/decrees/chancellor`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.sessionId ? { authorization: `Bearer ${options.sessionId}` } : {}),
      },
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
    if (response.status === 401) {
      return { ok: false, kind: "unauthenticated", error: "authentication required" };
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
    if (didTimeout) {
      return { ok: false, kind: "timeout", error: "请求超时" };
    }
    return { ok: false, kind: "network", error: describeError(error) };
  } finally {
    cancelTimeout(timer);
  }
}

export type ArchiveType = "MEMORIAL" | "REPLY";
export type ArchiveSourceKind = "DECREE" | "MEMORIAL";
export type RealityLabel = "LIVE" | "MIXED" | "FALLBACK";
export type ReviewStatusValue = "ACHIEVED" | "NOT_ACHIEVED" | "PARTIAL" | "OBSERVING";

export interface ShiguanEvidence {
  source: string;
  realityLabel: RealityLabel;
  note: string | null;
}

interface EvidenceSnapshotCore {
  evidenceId: string;
  factKey: string;
  value: JsonValue;
  unit: string | null;
  asOf: string;
  publishedAt: string | null;
  retrievedAt: string;
  sourceUrl: string;
  publisher: string;
  sourceType: JinyiweiSourceType;
  coverage: string[] | null;
  licenseNote: string | null;
  quality: JinyiweiEvidenceQuality;
  stance: JinyiweiEvidenceStance;
  excerpt: string;
  contentHash: string;
  confidence: number;
  accessUrl: string | null;
  accessMetadata: { [key: string]: JsonValue } | null;
}

export interface ShiguanEvidenceSnapshot extends EvidenceSnapshotCore {
  category: JinyiweiFactCategory;
  dataScope: JinyiweiDataScope;
  subject: string;
  jurisdiction: string | null;
}

export interface ShiguanEvidenceReference {
  packId: string;
  investigationId: string;
  snapshot: ShiguanEvidenceSnapshot;
  ordinal: number;
  evidenceId: string;
  snapshotHash: string;
}

export interface ShiguanReviewStatus {
  status: ReviewStatusValue;
  reviewedAt: string;
  note: string | null;
}

export interface ShiguanArchive {
  id: string;
  type: ArchiveType;
  title: string;
  content: string;
  matterType: string;
  department: string;
  relatedArchiveIds: string[];
  evidence: ShiguanEvidence[];
  createdAt: string;
  lessonsLearned: string | null;
  pitfalls: string | null;
  sourceKind: ArchiveSourceKind | null;
  sourceText: string | null;
  participatingDepartments: string[] | null;
  replyProcess: string | null;
  replyConclusion: string | null;
  replyTime: string | null;
  respondent: string | null;
  reviewStatus: ShiguanReviewStatus | null;
  evidenceReferences: ShiguanEvidenceReference[];
}

export interface ShiguanStatistics {
  total: number;
  achieved: number;
  notAchieved: number;
  partial: number;
  observing: number;
  pendingReview: number;
  successRate: number | null;
}

export interface DadianDepartmentCount {
  department: string;
  count: number;
}

export interface DadianRecentReply {
  id: string;
  title: string;
  participatingDepartments: string[];
  replyConclusion: string;
  replyTime: string;
  createdAt: string;
  respondent: string;
}

export interface DadianOverview {
  replyCount: number;
  departmentCounts: DadianDepartmentCount[];
  recentReplies: DadianRecentReply[];
  pendingReviewCount: number;
  todayFocus: string;
}

export interface ShiguanRecallMatch {
  archiveId: string;
  matchReason: string;
  historicalConclusion: string;
  evidenceLabels: RealityLabel[];
  reviewStatus: ShiguanReviewStatus | null;
  lessonsLearned: string | null;
  pitfalls: string | null;
}

export type ShiguanResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "validation" | "not_found" | "storage" | "network" | "unauthenticated" | "unknown";
      error: string;
    };

type ShiguanErrorKind = Exclude<ShiguanResult<unknown>, { ok: true }>["kind"];

export interface ShiguanRequestOptions {
  baseUrl?: string;
  timeoutMs?: number;
  /** Opaque session forwarded only by Next.js server code. */
  sessionId?: string;
  /** 测试注入点；生产默认使用全局 `fetch`。 */
  fetchImpl?: typeof fetch;
  /** 测试注入点；生产默认使用 `setTimeout`。 */
  scheduleTimeout?: (callback: () => void, delayMs: number) => unknown;
  /** 与 `scheduleTimeout` 配对的取消函数。 */
  cancelTimeout?: (handle: unknown) => void;
}

export interface ListShiguanArchivesOptions extends ShiguanRequestOptions {
  type?: ArchiveType;
  matterType?: string;
  department?: string;
  limit?: number;
}

export interface ChancellorConsultMessage {
  role: "user" | "assistant";
  content: string;
}

export type SubmitConsultResult =
  | { ok: true; reply: string; consultant: string }
  | {
      ok: false;
      kind: "validation" | "config" | "model" | "unauthenticated" | "network" | "timeout" | "unknown";
    };

export interface ChancellorConsultOptions extends AuthenticatedRequestOptions {
  fetchImpl?: typeof fetch;
  scheduleTimeout?: (callback: () => void, delayMs: number) => unknown;
  cancelTimeout?: (handle: unknown) => void;
}

export async function chancellorConsult(
  messages: ChancellorConsultMessage[],
  options: ChancellorConsultOptions = {},
): Promise<SubmitConsultResult> {
  const controller = new AbortController();
  let timedOut = false;
  const schedule = options.scheduleTimeout ?? ((callback, delay) => setTimeout(callback, delay));
  const cancel = options.cancelTimeout ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const timer = schedule(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 30000);
  try {
    const response = await (options.fetchImpl ?? fetch)(
      `${(options.baseUrl ?? getBackendBaseUrl()).replace(/\/+$/, "")}/api/v1/chancellor-consult`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.sessionId ? { authorization: `Bearer ${options.sessionId}` } : {}),
        },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const kind =
        response.status === 401 ? "unauthenticated" :
        response.status === 422 ? "validation" :
        response.status === 503 ? "config" :
        response.status === 502 ? "model" : "unknown";
      return { ok: false, kind };
    }
    const body = await response.json() as Record<string, unknown>;
    if (body.status !== "ok" || typeof body.consultant !== "string" ||
        typeof body.reply !== "string" || !body.reply.trim()) {
      return { ok: false, kind: "unknown" };
    }
    return { ok: true, consultant: body.consultant, reply: body.reply.trim() };
  } catch {
    return { ok: false, kind: timedOut ? "timeout" : "network" };
  } finally {
    cancel(timer);
  }
}

export interface RecallShiguanArchivesOptions extends ShiguanRequestOptions {
  matterType?: string;
  department?: string;
  limit?: number;
}

export type UpdateShiguanReviewOptions = ShiguanRequestOptions;

const SHIGUAN_TIMEOUT_MS = 10000;
const ARCHIVE_TYPES = new Set<ArchiveType>(["MEMORIAL", "REPLY"]);
const ARCHIVE_SOURCE_KINDS = new Set<ArchiveSourceKind>(["DECREE", "MEMORIAL"]);
const REALITY_LABELS = new Set<RealityLabel>(["LIVE", "MIXED", "FALLBACK"]);
const REVIEW_STATUSES = new Set<ReviewStatusValue>([
  "ACHIEVED",
  "NOT_ACHIEVED",
  "PARTIAL",
  "OBSERVING",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(record);
  return actual.length === keys.length && keys.every((key) => key in record);
}

function parseNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isNullableString(value: unknown): boolean {
  return value === null || value === undefined || typeof value === "string";
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length === value.length ? strings : null;
}

function parseEvidence(value: unknown): ShiguanEvidence[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const evidence: ShiguanEvidence[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (
      record === null ||
      !hasExactKeys(record, ["source", "reality_label", "note"]) ||
      typeof record.source !== "string" ||
      record.source.trim().length === 0 ||
      !REALITY_LABELS.has(record.reality_label as RealityLabel) ||
      !isNullableString(record.note)
    ) {
      return null;
    }
    evidence.push({
      source: record.source,
      realityLabel: record.reality_label as RealityLabel,
      note: parseNullableString(record.note),
    });
  }
  return evidence;
}

function parseReviewStatus(value: unknown): ShiguanReviewStatus | null {
  if (value === null || value === undefined) {
    return null;
  }
  const record = asRecord(value);
  if (
    record === null ||
    !hasExactKeys(record, ["status", "reviewed_at", "note"]) ||
    !REVIEW_STATUSES.has(record.status as ReviewStatusValue) ||
    !isIsoDateTime(record.reviewed_at) ||
    !isNullableString(record.note)
  ) {
    return null;
  }
  return {
    status: record.status as ReviewStatusValue,
    reviewedAt: record.reviewed_at,
    note: parseNullableString(record.note),
  };
}

function parseArchive(value: unknown): ShiguanArchive | null {
  const record = asRecord(value);
  if (
    record === null ||
    !hasExactKeys(record, [
      "type", "title", "content", "matter_type", "department", "related_archive_ids",
      "evidence", "lessons_learned", "pitfalls", "participating_departments",
      "source_kind", "source_text", "reply_process", "reply_conclusion", "reply_time",
      "respondent",
      "id", "created_at", "review_status", "evidence_references",
    ]) ||
    typeof record.id !== "string" ||
    record.id.trim().length === 0 ||
    !ARCHIVE_TYPES.has(record.type as ArchiveType) ||
    typeof record.title !== "string" ||
    record.title.trim().length === 0 ||
    typeof record.content !== "string" ||
    record.content.trim().length === 0 ||
    typeof record.matter_type !== "string" ||
    record.matter_type.trim().length === 0 ||
    typeof record.department !== "string" ||
    record.department.trim().length === 0 ||
    !isIsoDateTime(record.created_at)
  ) {
    return null;
  }
  const relatedArchiveIds = parseStringArray(record.related_archive_ids);
  const evidence = parseEvidence(record.evidence);
  const reviewStatus = parseReviewStatus(record.review_status);
  const evidenceReferences = parseShiguanEvidenceReferences(record.evidence_references);
  if (
    relatedArchiveIds === null ||
    relatedArchiveIds.some((archiveId) => archiveId.trim().length === 0) ||
    evidence === null ||
    !("review_status" in record) ||
    (record.review_status !== null && reviewStatus === null) ||
    evidenceReferences === null ||
    !isNullableString(record.lessons_learned) ||
    !isNullableString(record.pitfalls)
  ) {
    return null;
  }
  const participatingDepartments =
    record.participating_departments === null || record.participating_departments === undefined
      ? null
      : parseStringArray(record.participating_departments);
  if (participatingDepartments === null && Array.isArray(record.participating_departments)) {
    return null;
  }
  const replyFieldsAreValid =
    ARCHIVE_SOURCE_KINDS.has(record.source_kind as ArchiveSourceKind) &&
    ((record.source_kind === "DECREE" && relatedArchiveIds.length === 0) ||
      (record.source_kind === "MEMORIAL" && relatedArchiveIds.length === 1)) &&
    typeof record.source_text === "string" &&
    record.source_text.trim().length > 0 &&
    participatingDepartments !== null &&
    participatingDepartments.length > 0 &&
    participatingDepartments.every((department) => department.trim().length > 0) &&
    new Set(participatingDepartments.map((department) => department.trim())).size ===
      participatingDepartments.length &&
    typeof record.reply_process === "string" &&
    record.reply_process.trim().length > 0 &&
    typeof record.reply_conclusion === "string" &&
    record.reply_conclusion.trim().length > 0 &&
    isIsoDateTime(record.reply_time) &&
    typeof record.respondent === "string" &&
    record.respondent.trim().length > 0 &&
    ((record.source_kind === "DECREE" && relatedArchiveIds.length === 0) ||
      (record.source_kind === "MEMORIAL" && relatedArchiveIds.length === 1));
  const replyFieldsAreEmpty =
    record.source_kind == null &&
    record.source_text == null &&
    record.participating_departments == null &&
    record.reply_process == null &&
    record.reply_conclusion == null &&
    record.reply_time == null &&
    record.respondent == null;
  if (
    (record.type === "REPLY" && !replyFieldsAreValid) ||
    (record.type === "MEMORIAL" && !replyFieldsAreEmpty)
  ) {
    return null;
  }
  return {
    id: record.id,
    type: record.type as ArchiveType,
    title: record.title,
    content: record.content,
    matterType: record.matter_type,
    department: record.department,
    relatedArchiveIds,
    evidence,
    createdAt: record.created_at,
    lessonsLearned: parseNullableString(record.lessons_learned),
    pitfalls: parseNullableString(record.pitfalls),
    sourceKind: record.type === "REPLY" ? (record.source_kind as ArchiveSourceKind) : null,
    sourceText: parseNullableString(record.source_text),
    participatingDepartments,
    replyProcess: parseNullableString(record.reply_process),
    replyConclusion: parseNullableString(record.reply_conclusion),
    replyTime: parseNullableString(record.reply_time),
    respondent: parseNullableString(record.respondent),
    reviewStatus,
    evidenceReferences,
  };
}

function parseStatistics(value: unknown): ShiguanStatistics | null {
  const record = asRecord(value);
  if (
    record === null ||
    !hasExactKeys(record, [
      "total", "achieved", "not_achieved", "partial", "observing", "pending_review",
      "success_rate",
    ]) ||
    typeof record.total !== "number" ||
    typeof record.achieved !== "number" ||
    typeof record.not_achieved !== "number" ||
    typeof record.partial !== "number" ||
    typeof record.observing !== "number" ||
    typeof record.pending_review !== "number" ||
    (record.success_rate !== null && typeof record.success_rate !== "number")
  ) {
    return null;
  }
  return {
    total: record.total,
    achieved: record.achieved,
    notAchieved: record.not_achieved,
    partial: record.partial,
    observing: record.observing,
    pendingReview: record.pending_review,
    successRate: record.success_rate,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseDadianOverview(value: unknown): DadianOverview | null {
  const record = asRecord(value);
  if (
    record === null ||
    !hasExactKeys(record, ["reply_count", "department_counts", "recent_replies", "pending_review_count", "today_focus"]) ||
    !isNonNegativeInteger(record.reply_count) ||
    !isNonNegativeInteger(record.pending_review_count) ||
    typeof record.today_focus !== "string" || record.today_focus.trim().length === 0 ||
    !Array.isArray(record.department_counts) || !Array.isArray(record.recent_replies)
  ) return null;
  const departmentCounts: DadianDepartmentCount[] = [];
  for (const item of record.department_counts) {
    const department = asRecord(item);
    if (department === null || !hasExactKeys(department, ["department", "count"]) ||
      typeof department.department !== "string" || department.department.trim().length === 0 ||
      !isNonNegativeInteger(department.count)) return null;
    departmentCounts.push({ department: department.department, count: department.count });
  }
  const recentReplies: DadianRecentReply[] = [];
  for (const item of record.recent_replies) {
    const reply = asRecord(item);
    if (reply === null || !hasExactKeys(reply, ["id", "title", "participating_departments", "reply_conclusion", "reply_time", "created_at", "respondent"]) ||
      typeof reply.id !== "string" || !reply.id.trim() || typeof reply.title !== "string" || !reply.title.trim() ||
      typeof reply.reply_conclusion !== "string" || !reply.reply_conclusion.trim() ||
      typeof reply.respondent !== "string" || !reply.respondent.trim() ||
      !isIsoDateTime(reply.reply_time) || !isIsoDateTime(reply.created_at)) return null;
    const participatingDepartments = parseStringArray(reply.participating_departments);
    if (participatingDepartments === null || participatingDepartments.length === 0 || participatingDepartments.some((department) => !department.trim())) return null;
    recentReplies.push({ id: reply.id, title: reply.title, participatingDepartments, replyConclusion: reply.reply_conclusion, replyTime: reply.reply_time, createdAt: reply.created_at, respondent: reply.respondent });
  }
  return { replyCount: record.reply_count, departmentCounts, recentReplies, pendingReviewCount: record.pending_review_count, todayFocus: record.today_focus };
}

function parseRecallMatch(value: unknown): ShiguanRecallMatch | null {
  const record = asRecord(value);
  if (
    record === null ||
    !hasExactKeys(record, [
      "archive_id", "match_reason", "historical_conclusion", "evidence_labels",
      "review_status", "lessons_learned", "pitfalls",
    ]) ||
    typeof record.archive_id !== "string" ||
    record.archive_id.trim().length === 0 ||
    typeof record.match_reason !== "string" ||
    record.match_reason.trim().length === 0 ||
    typeof record.historical_conclusion !== "string" ||
    record.historical_conclusion.trim().length === 0 ||
    !isNullableString(record.lessons_learned) ||
    !isNullableString(record.pitfalls)
  ) {
    return null;
  }
  const evidenceLabels = parseStringArray(record.evidence_labels);
  const reviewStatus = parseReviewStatus(record.review_status);
  if (
    evidenceLabels === null ||
    !evidenceLabels.every((label): label is RealityLabel =>
      REALITY_LABELS.has(label as RealityLabel),
    ) ||
    !("review_status" in record) ||
    (record.review_status !== null && reviewStatus === null)
  ) {
    return null;
  }
  return {
    archiveId: record.archive_id,
    matchReason: record.match_reason,
    historicalConclusion: record.historical_conclusion,
    evidenceLabels,
    reviewStatus,
    lessonsLearned: parseNullableString(record.lessons_learned),
    pitfalls: parseNullableString(record.pitfalls),
  };
}

function mapShiguanErrorStatus(status: number): ShiguanErrorKind {
  if (status === 401) {
    return "unauthenticated";
  }
  if (status === 404) {
    return "not_found";
  }
  if (status === 422) {
    return "validation";
  }
  if (status === 503) {
    return "storage";
  }
  return "unknown";
}

async function parseShiguanResponse<T>(
  response: Response,
  parse: (body: unknown) => T | null,
): Promise<ShiguanResult<T>> {
  if (!response.ok) {
    return {
      ok: false,
      kind: mapShiguanErrorStatus(response.status),
      error: await extractErrorMessage(response, `史馆后端响应非预期状态码：${response.status}`),
    };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, kind: "unknown", error: "史馆后端响应不是合法 JSON" };
  }
  const data = parse(body);
  if (data === null) {
    return { ok: false, kind: "unknown", error: "史馆后端成功响应体不符合预期契约" };
  }
  return { ok: true, data };
}

async function fetchShiguan<T>(
  path: string,
  init: RequestInit,
  parse: (body: unknown) => T | null,
  options: ShiguanRequestOptions = {},
): Promise<ShiguanResult<T>> {
  const baseUrl = options.baseUrl ?? getBackendBaseUrl();
  const timeoutMs = options.timeoutMs ?? SHIGUAN_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const scheduleTimeout =
    options.scheduleTimeout ??
    ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs));
  const cancelTimeout =
    options.cancelTimeout ??
    ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const controller = new AbortController();
  const timer = scheduleTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        ...(options.sessionId ? { authorization: `Bearer ${options.sessionId}` } : {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    return await parseShiguanResponse(response, parse);
  } catch (error) {
    return { ok: false, kind: "network", error: describeError(error) };
  } finally {
    cancelTimeout(timer);
  }
}

export async function listShiguanArchives(
  options: ListShiguanArchivesOptions = {},
): Promise<ShiguanResult<ShiguanArchive[]>> {
  const params = new URLSearchParams();
  if (options.type) {
    params.set("type", options.type);
  }
  if (options.matterType?.trim()) {
    params.set("matter_type", options.matterType.trim());
  }
  if (options.department?.trim()) {
    params.set("department", options.department.trim());
  }
  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return fetchShiguan(
    `/api/v1/shiguan/archives${suffix}`,
    { method: "GET" },
    (body) => {
      if (!Array.isArray(body)) {
        return null;
      }
      const archives = body.map(parseArchive);
      return archives.every((archive): archive is ShiguanArchive => archive !== null)
        ? archives
        : null;
    },
    options,
  );
}

export async function getShiguanStatistics(
  options: ShiguanRequestOptions = {},
): Promise<ShiguanResult<ShiguanStatistics>> {
  return fetchShiguan(
    "/api/v1/shiguan/statistics",
    { method: "GET" },
    parseStatistics,
    options,
  );
}

export async function getDadianOverview(
  options: { department?: string; baseUrl?: string; timeoutMs?: number; sessionId?: string } = {},
): Promise<ShiguanResult<DadianOverview>> {
  const params = new URLSearchParams();
  if (options.department?.trim()) params.set("department", options.department.trim());
  const suffix = params.size ? `?${params.toString()}` : "";
  return fetchShiguan(
    `/api/v1/shiguan/dadian-overview${suffix}`,
    { method: "GET" },
    parseDadianOverview,
    options,
  );
}

export async function recallShiguanArchives(
  options: RecallShiguanArchivesOptions = {},
): Promise<ShiguanResult<ShiguanRecallMatch[]>> {
  return fetchShiguan(
    "/api/v1/shiguan/recall",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        matter_type: options.matterType?.trim() || undefined,
        department: options.department?.trim() || undefined,
        limit: options.limit,
      }),
    },
    (body) => {
      if (!Array.isArray(body)) {
        return null;
      }
      const matches = body.map(parseRecallMatch);
      return matches.every((match): match is ShiguanRecallMatch => match !== null)
        ? matches
        : null;
    },
    options,
  );
}

export async function updateShiguanReview(
  archiveId: string,
  status: ReviewStatusValue,
  note: string,
  options: UpdateShiguanReviewOptions = {},
): Promise<ShiguanResult<ShiguanReviewStatus>> {
  return fetchShiguan(
    `/api/v1/shiguan/archives/${encodeURIComponent(archiveId)}/review`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status,
        reviewed_at: new Date().toISOString(),
        note: note.trim() || undefined,
      }),
    },
    parseReviewStatus,
    options,
  );
}

// ---- Read-only Grand Council case ledger ---------------------------------

export type JunjichuCaseStatus =
  | "MINISTRY_REVIEWING"
  | "COUNCIL_REVIEWING"
  | "CHANCELLOR_FINALIZING"
  | "ARCHIVED"
  | "FAILED";

export interface JunjichuCase {
  id: string;
  decreeText: string;
  departments: string[];
  status: JunjichuCaseStatus;
  processingPath: string[];
  completedMinistryOpinions: JunjichuMinistryOpinion[];
  councilVerdict: string | null;
  replyId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JunjichuBureauOpinion {
  bureau: string;
  opinion: string;
}

export interface JunjichuMinistryOpinion {
  department: string;
  bureauOpinions: JunjichuBureauOpinion[];
  opinion: string;
}

export type JunjichuCasesResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "validation" | "not_found" | "storage" | "network" | "unauthenticated" | "unknown"; error: string };

export interface ListJunjichuCasesOptions extends AuthenticatedRequestOptions {
  status?: JunjichuCaseStatus;
  department?: string;
  keyword?: string;
  fetchImpl?: typeof fetch;
}

const JUNJICHU_CASE_STATUSES = new Set<JunjichuCaseStatus>([
  "MINISTRY_REVIEWING", "COUNCIL_REVIEWING", "CHANCELLOR_FINALIZING", "ARCHIVED", "FAILED",
]);

function parseJunjichuBureauOpinion(value: unknown): JunjichuBureauOpinion | null {
  const record = asRecord(value);
  if (record === null || !hasExactKeys(record, ["bureau", "opinion"]) ||
    typeof record.bureau !== "string" || !record.bureau.trim() ||
    typeof record.opinion !== "string" || !record.opinion.trim()) return null;
  return { bureau: record.bureau, opinion: record.opinion };
}

function parseJunjichuMinistryOpinion(value: unknown): JunjichuMinistryOpinion | null {
  const record = asRecord(value);
  if (record === null || !hasExactKeys(record, ["department", "bureau_opinions", "opinion"]) ||
    typeof record.department !== "string" || !record.department.trim() ||
    typeof record.opinion !== "string" || !record.opinion.trim() || !Array.isArray(record.bureau_opinions)) return null;
  const bureauOpinions = record.bureau_opinions.map(parseJunjichuBureauOpinion);
  return bureauOpinions.every((item): item is JunjichuBureauOpinion => item !== null)
    ? { department: record.department, bureauOpinions, opinion: record.opinion }
    : null;
}

function parseJunjichuCase(value: unknown): JunjichuCase | null {
  const record = asRecord(value);
  if (record === null || !hasExactKeys(record, [
    "id", "decree_text", "departments", "status", "processing_path", "completed_ministry_opinions",
    "council_verdict", "reply_id", "failure_reason", "created_at", "updated_at",
  ]) || typeof record.id !== "string" || !record.id.trim() || typeof record.decree_text !== "string" ||
    !record.decree_text.trim() || typeof record.status !== "string" || !JUNJICHU_CASE_STATUSES.has(record.status as JunjichuCaseStatus) ||
    !isNullableString(record.council_verdict) || !isNullableString(record.reply_id) || !isNullableString(record.failure_reason) ||
    !isIsoDateTime(record.created_at) || !isIsoDateTime(record.updated_at)) return null;
  const departments = parseStringArray(record.departments);
  const processingPath = parseStringArray(record.processing_path);
  if (departments === null || processingPath === null || !Array.isArray(record.completed_ministry_opinions)) return null;
  const completedMinistryOpinions = record.completed_ministry_opinions.map(parseJunjichuMinistryOpinion);
  if (!completedMinistryOpinions.every((item): item is JunjichuMinistryOpinion => item !== null)) return null;
  return {
    id: record.id, decreeText: record.decree_text, departments, status: record.status as JunjichuCaseStatus,
    processingPath, completedMinistryOpinions,
    councilVerdict: parseNullableString(record.council_verdict), replyId: parseNullableString(record.reply_id), failureReason: parseNullableString(record.failure_reason),
    createdAt: record.created_at, updatedAt: record.updated_at,
  };
}

function mapJunjichuCasesErrorStatus(status: number): Exclude<JunjichuCasesResult<unknown>, { ok: true }>['kind'] {
  if (status === 401) return "unauthenticated";
  if (status === 404) return "not_found";
  if (status === 400 || status === 422) return "validation";
  if (status === 503) return "storage";
  return "unknown";
}

export async function listJunjichuCases(
  options: ListJunjichuCasesOptions = {},
): Promise<JunjichuCasesResult<JunjichuCase[]>> {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.department?.trim()) params.set("department", options.department.trim());
  if (options.keyword?.trim()) params.set("keyword", options.keyword.trim());
  const suffix = params.size ? `?${params.toString()}` : "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(
      `${(options.baseUrl ?? getBackendBaseUrl()).replace(/\/+$/, "")}/api/v1/junjichu/cases${suffix}`,
      { method: "GET", headers: options.sessionId ? { authorization: `Bearer ${options.sessionId}` } : undefined, signal: controller.signal, cache: "no-store" },
    );
    if (!response.ok) return { ok: false, kind: mapJunjichuCasesErrorStatus(response.status), error: await extractErrorMessage(response, "军机处案卷暂时不可用") };
    const body: unknown = await response.json();
    if (!Array.isArray(body)) return { ok: false, kind: "unknown", error: "军机处案卷响应不符合预期契约" };
    const cases = body.map(parseJunjichuCase);
    return cases.every((item): item is JunjichuCase => item !== null)
      ? { ok: true, data: cases }
      : { ok: false, kind: "unknown", error: "军机处案卷响应不符合预期契约" };
  } catch (error) {
    return { ok: false, kind: "network", error: describeError(error) };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Read-only Jinyiwei audit contracts ---------------------------------

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JinyiweiStatus = "RESOLVED" | "PARTIAL" | "BLOCKED" | "UNAVAILABLE";
export type JinyiweiSourceType = "SHIGUAN" | "MCP" | "PUBLIC_API" | "PUBLIC_WEB";
export type JinyiweiEvidenceQuality = "PRIMARY" | "AUTHORITATIVE" | "SECONDARY" | "UNVERIFIED";
export type JinyiweiEvidenceStance = "SUPPORTS" | "CONTRADICTS";
export type JinyiweiAttemptStatus = "SUCCEEDED" | "FAILED" | "SKIPPED" | "BLOCKED";
export type JinyiweiAdoptionStatus = "PENDING" | "CONFIRMED";
export type JinyiweiFactCategory = "MARKET_QUOTE" | "REGULATORY_FILING" | "NEWS_EVENT" | "PUBLIC_STATISTIC" | "ENTITY_REFERENCE";
export type JinyiweiMarketMetric = "LAST_PRICE" | "VOLUME" | "CHANGE_PERCENT" | "INTRADAY_SERIES" | "PE_RATIO" | "PB_RATIO" | "MARKET_CAP" | "PRICE_TREND_30D";
export type JinyiweiDataScope = "INTERNAL_BUSINESS" | "EXTERNAL_PUBLIC" | "HYBRID";

export interface JinyiweiSummary {
  totalInvestigations: number; resolvedCount: number; partialCount: number;
  blockedCount: number; unavailableCount: number; distinctEvidenceCount: number;
  pendingAdoptionCount: number; confirmedAdoptionCount: number;
}
export interface JinyiweiListItem {
  investigationId: string; requestId: string; requestingAgent: string; question: string;
  status: JinyiweiStatus; startedAt: string; completedAt: string;
  sourceAttemptCount: number; evidenceCount: number; linkedReplyCount: number;
}
export interface JinyiweiPage { items: JinyiweiListItem[]; total: number; limit: number; offset: number; }
export interface JinyiweiRequiredFact { key: string; description: string; category: JinyiweiFactCategory; dataScope: JinyiweiDataScope; subject: string; jurisdiction: string | null; expectedUnit: string | null; expectedShape: string | null; marketMetric: JinyiweiMarketMetric | null; }
export interface JinyiweiFreshness { maxAgeSeconds: number | null; notBefore: string | null; }
export interface JinyiweiRequest {
  requestingAgent: string; question: string; requiredFacts: JinyiweiRequiredFact[];
  decisionContext: string; freshness: JinyiweiFreshness; existingEvidenceIds: string[];
  requestId: string; timeoutSeconds: number; sourceScope: JinyiweiSourceType[];
}
export type JinyiweiEvidence = EvidenceSnapshotCore;
export interface JinyiweiMcpCallAudit {
  serverId: string; toolName: string; approvalVersion: string; durationMs: number;
  argumentsHash: string; responseBytes: number | null; responseHash: string | null;
  mappingOutcome: string; cacheHit: boolean; error: string | null;
}
export interface JinyiweiSourceAttempt {
  sourceType: JinyiweiSourceType; sourceName: string; status: JinyiweiAttemptStatus;
  startedAt: string; completedAt: string; error: string | null; factsAttempted: string[];
  callAudits: JinyiweiMcpCallAudit[];
}
export interface JinyiweiConflict { factKey: string; evidenceIds: string[]; summary: string; }
export interface JinyiweiCache { hit: boolean; cacheKey: string | null; cachedAt: string | null; expiresAt: string | null; }
export interface JinyiweiAdoption {
  evidenceId: string; replyId: string; status: JinyiweiAdoptionStatus;
  createdAt: string; updatedAt: string; confirmedAt: string | null;
}
export interface JinyiweiDetail {
  packId: string; investigationId: string; status: JinyiweiStatus; request: JinyiweiRequest;
  investigationPlan: { factKeys: string[]; sourceScope: JinyiweiSourceType[] };
  evidenceByFact: Record<string, JinyiweiEvidence[]>; resolvedFacts: string[];
  historicalEvidenceByFact: Record<string, JinyiweiEvidence[]>;
  unresolvedFacts: string[]; conflicts: JinyiweiConflict[]; sourceAttempts: JinyiweiSourceAttempt[];
  investigationStartedAt: string; investigationCompletedAt: string; cache: JinyiweiCache;
  doNotInfer: string[]; adoptions: JinyiweiAdoption[];
}

export type JinyiweiReadResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "validation" | "not_found" | "storage" | "network" | "unknown"; error: string };

export interface JinyiweiReadOptions {
  baseUrl?: string;
  timeoutMs?: number;
  /** 测试注入点；生产默认使用全局 `fetch`。 */
  fetchImpl?: typeof fetch;
  /** 测试注入点；生产默认使用 `setTimeout`。 */
  scheduleTimeout?: (callback: () => void, delayMs: number) => unknown;
  /** 与 `scheduleTimeout` 配对的取消函数。 */
  cancelTimeout?: (handle: unknown) => void;
}
export interface ListJinyiweiOptions extends JinyiweiReadOptions { status?: JinyiweiStatus; limit?: number; offset?: number; }

const JINYIWEI_TIMEOUT_MS = 10000;
const JINYIWEI_STATUSES = new Set<JinyiweiStatus>(["RESOLVED", "PARTIAL", "BLOCKED", "UNAVAILABLE"]);
const JINYIWEI_SOURCES = new Set<JinyiweiSourceType>(["SHIGUAN", "MCP", "PUBLIC_API", "PUBLIC_WEB"]);
const JINYIWEI_QUALITIES = new Set<JinyiweiEvidenceQuality>(["PRIMARY", "AUTHORITATIVE", "SECONDARY", "UNVERIFIED"]);
const JINYIWEI_STANCES = new Set<JinyiweiEvidenceStance>(["SUPPORTS", "CONTRADICTS"]);
const ATTEMPT_STATUSES = new Set<JinyiweiAttemptStatus>(["SUCCEEDED", "FAILED", "SKIPPED", "BLOCKED"]);
const ADOPTION_STATUSES = new Set<JinyiweiAdoptionStatus>(["PENDING", "CONFIRMED"]);
const FACT_CATEGORIES = new Set<JinyiweiFactCategory>(["MARKET_QUOTE", "REGULATORY_FILING", "NEWS_EVENT", "PUBLIC_STATISTIC", "ENTITY_REFERENCE"]);
const MARKET_METRICS = new Set<JinyiweiMarketMetric>(["LAST_PRICE", "VOLUME", "CHANGE_PERCENT", "INTRADAY_SERIES", "PE_RATIO", "PB_RATIO", "MARKET_CAP", "PRICE_TREND_30D"]);
const DATA_SCOPES = new Set<JinyiweiDataScope>(["INTERNAL_BUSINESS", "EXTERNAL_PUBLIC", "HYBRID"]);
const HASH_RE = /^[0-9a-f]{64}$/;
const TZ_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function textValue(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function nonNegativeInteger(value: unknown): value is number { return Number.isInteger(value) && (value as number) >= 0; }
function exactDate(value: unknown): value is string { return typeof value === "string" && TZ_RE.test(value) && !Number.isNaN(Date.parse(value)); }
function optionalDate(value: unknown): value is string | null { return value === null || exactDate(value); }
function nullableText(value: unknown): value is string | null { return value === null || textValue(value); }
function uniqueTextArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(textValue) || new Set(value).size !== value.length) return null;
  return [...value];
}
function enumArray<T extends string>(value: unknown, allowed: Set<T>): T[] | null {
  const values = uniqueTextArray(value);
  return values !== null && values.every((item) => allowed.has(item as T)) ? values as T[] : null;
}
function cloneJson(value: unknown): JsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const result: JsonValue[] = [];
    for (const item of value) { const parsed = cloneJson(item); if (parsed === undefined) return undefined; result.push(parsed); }
    return result;
  }
  const record = asRecord(value);
  if (record === null) return undefined;
  const result: { [key: string]: JsonValue } = {};
  for (const [key, item] of Object.entries(record)) { const parsed = cloneJson(item); if (parsed === undefined) return undefined; result[key] = parsed; }
  return result;
}

function parseEvidenceItem(value: unknown): JinyiweiEvidence | null {
  const r = asRecord(value);
  const keys = ["evidence_id","fact_key","value","unit","as_of","published_at","retrieved_at","source_url","publisher","source_type","coverage","license_note","quality","stance","excerpt","content_hash","confidence","access_url","access_metadata"];
  if (!r || !hasExactKeys(r, keys) || !textValue(r.evidence_id) || !textValue(r.fact_key) ||
      !(r.unit === null || textValue(r.unit)) || !exactDate(r.as_of) || !optionalDate(r.published_at) || !exactDate(r.retrieved_at) ||
      !textValue(r.source_url) || !textValue(r.publisher) || !JINYIWEI_SOURCES.has(r.source_type as JinyiweiSourceType) ||
      !(r.coverage === null || (uniqueTextArray(r.coverage) !== null)) || !nullableText(r.license_note) ||
      !JINYIWEI_QUALITIES.has(r.quality as JinyiweiEvidenceQuality) || !JINYIWEI_STANCES.has(r.stance as JinyiweiEvidenceStance) ||
      !textValue(r.excerpt) || typeof r.content_hash !== "string" || !HASH_RE.test(r.content_hash) ||
      typeof r.confidence !== "number" || !Number.isFinite(r.confidence) || r.confidence < 0 || r.confidence > 1 ||
      !nullableText(r.access_url)) return null;
  const json = cloneJson(r.value); if (json === undefined) return null;
  const metadataRecord = r.access_metadata === null ? null : asRecord(r.access_metadata);
  const metadata = metadataRecord === null ? null : cloneJson(metadataRecord);
  if (r.access_metadata !== null && (metadataRecord === null || metadata === undefined || Array.isArray(metadata) || metadata === null || typeof metadata !== "object")) return null;
  return { evidenceId:r.evidence_id, factKey:r.fact_key, value:json, unit:r.unit as string|null,
    asOf:r.as_of, publishedAt:r.published_at as string|null, retrievedAt:r.retrieved_at, sourceUrl:r.source_url, publisher:r.publisher,
    sourceType:r.source_type as JinyiweiSourceType, coverage:r.coverage === null ? null : uniqueTextArray(r.coverage), licenseNote:r.license_note as string|null, quality:r.quality as JinyiweiEvidenceQuality,
    stance:r.stance as JinyiweiEvidenceStance, excerpt:r.excerpt, contentHash:r.content_hash, confidence:r.confidence,
    accessUrl:r.access_url as string|null, accessMetadata:metadata as { [key:string]:JsonValue }|null };
}

function parseArchiveEvidenceSnapshot(value: unknown): ShiguanEvidenceSnapshot | null {
  const r=asRecord(value);
  const keys=["evidence_id","fact_key","category","data_scope","subject","jurisdiction","value","unit","as_of","published_at","retrieved_at","source_url","publisher","source_type","coverage","license_note","quality","stance","excerpt","content_hash","confidence","access_url","access_metadata"];
  if(!r||!hasExactKeys(r,keys)||!FACT_CATEGORIES.has(r.category as JinyiweiFactCategory)||!DATA_SCOPES.has(r.data_scope as JinyiweiDataScope)||!textValue(r.subject)||!nullableText(r.jurisdiction))return null;
  const {category,data_scope,subject,jurisdiction,...evidence}=r;
  const parsed=parseEvidenceItem(evidence);
  return parsed===null?null:{...parsed,category:category as JinyiweiFactCategory,dataScope:data_scope as JinyiweiDataScope,subject:subject as string,jurisdiction:jurisdiction as string|null};
}

function parseShiguanEvidenceReferences(value: unknown): ShiguanEvidenceReference[] | null {
  if (!Array.isArray(value)) return null;
  const result: ShiguanEvidenceReference[] = [];
  for (const item of value) {
    const r = asRecord(item);
    if (!r || !hasExactKeys(r,["pack_id","investigation_id","snapshot","ordinal","evidence_id","snapshot_hash"]) ||
        !textValue(r.pack_id) || !textValue(r.investigation_id) || !nonNegativeInteger(r.ordinal) ||
        !textValue(r.evidence_id) || typeof r.snapshot_hash !== "string" || !HASH_RE.test(r.snapshot_hash)) return null;
    const snapshot = parseArchiveEvidenceSnapshot(r.snapshot); if (!snapshot || snapshot.evidenceId !== r.evidence_id) return null;
    result.push({packId:r.pack_id, investigationId:r.investigation_id, snapshot, ordinal:r.ordinal,
      evidenceId:r.evidence_id, snapshotHash:r.snapshot_hash});
  }
  return result;
}

function parseSummary(value: unknown): JinyiweiSummary | null {
  const r=asRecord(value); const keys=["total_investigations","resolved_count","partial_count","blocked_count","unavailable_count","distinct_evidence_count","pending_adoption_count","confirmed_adoption_count"];
  if(!r||!hasExactKeys(r,keys)||!keys.every(k=>nonNegativeInteger(r[k]))) return null;
  if((r.resolved_count as number)+(r.partial_count as number)+(r.blocked_count as number)+(r.unavailable_count as number)!==r.total_investigations) return null;
  return {totalInvestigations:r.total_investigations as number,resolvedCount:r.resolved_count as number,partialCount:r.partial_count as number,blockedCount:r.blocked_count as number,unavailableCount:r.unavailable_count as number,distinctEvidenceCount:r.distinct_evidence_count as number,pendingAdoptionCount:r.pending_adoption_count as number,confirmedAdoptionCount:r.confirmed_adoption_count as number};
}

function parseListItem(value:unknown):JinyiweiListItem|null {
  const r=asRecord(value), keys=["investigation_id","request_id","requesting_agent","question","status","started_at","completed_at","source_attempt_count","evidence_count","linked_reply_count"];
  if(!r||!hasExactKeys(r,keys)||![r.investigation_id,r.request_id,r.requesting_agent,r.question].every(textValue)||!JINYIWEI_STATUSES.has(r.status as JinyiweiStatus)||!exactDate(r.started_at)||!exactDate(r.completed_at)||Date.parse(r.completed_at)<Date.parse(r.started_at)||![r.source_attempt_count,r.evidence_count,r.linked_reply_count].every(nonNegativeInteger)) return null;
  return {investigationId:r.investigation_id as string,requestId:r.request_id as string,requestingAgent:r.requesting_agent as string,question:r.question as string,status:r.status as JinyiweiStatus,startedAt:r.started_at,completedAt:r.completed_at,sourceAttemptCount:r.source_attempt_count as number,evidenceCount:r.evidence_count as number,linkedReplyCount:r.linked_reply_count as number};
}
function parsePage(value:unknown):JinyiweiPage|null { const r=asRecord(value); if(!r||!hasExactKeys(r,["items","total","limit","offset"])||!Array.isArray(r.items)||!nonNegativeInteger(r.total)||!Number.isInteger(r.limit)||!(r.limit as number>=1&&r.limit as number<=100)||!nonNegativeInteger(r.offset)) return null; const items=r.items.map(parseListItem); return items.every(Boolean)?{items:items as JinyiweiListItem[],total:r.total,limit:r.limit as number,offset:r.offset}:null; }

function parseRequest(value:unknown):JinyiweiRequest|null {
  const r=asRecord(value), keys=["requesting_agent","question","required_facts","decision_context","freshness","existing_evidence_ids","request_id","timeout_seconds","source_scope"];
  if(!r||!hasExactKeys(r,keys)||![r.requesting_agent,r.question,r.decision_context,r.request_id].every(textValue)||!Array.isArray(r.required_facts)||r.required_facts.length<1||r.required_facts.length>5||!Number.isInteger(r.timeout_seconds)||!(r.timeout_seconds as number>=1&&r.timeout_seconds as number<=120)) return null;
  const facts:JinyiweiRequiredFact[]=[]; for(const f of r.required_facts){const x=asRecord(f),baseKeys=["key","description","category","data_scope","subject","jurisdiction","expected_unit","expected_shape"],hasMarketMetric="market_metric" in (x??{});if(!x||!(hasExactKeys(x,baseKeys)||(hasMarketMetric&&hasExactKeys(x,[...baseKeys,"market_metric"])))||!textValue(x.key)||!textValue(x.description)||!FACT_CATEGORIES.has(x.category as JinyiweiFactCategory)||!DATA_SCOPES.has(x.data_scope as JinyiweiDataScope)||!textValue(x.subject)||!nullableText(x.jurisdiction)||!nullableText(x.expected_unit)||!nullableText(x.expected_shape)||!(x.market_metric===undefined||x.market_metric===null||MARKET_METRICS.has(x.market_metric as JinyiweiMarketMetric))||(hasMarketMetric&&(x.category==="MARKET_QUOTE"?x.market_metric===null:x.market_metric!==null)))return null;facts.push({key:x.key,description:x.description,category:x.category as JinyiweiFactCategory,dataScope:x.data_scope as JinyiweiDataScope,subject:x.subject,jurisdiction:x.jurisdiction as string|null,expectedUnit:x.expected_unit as string|null,expectedShape:x.expected_shape as string|null,marketMetric:(x.market_metric??null) as JinyiweiMarketMetric|null});}
  if(new Set(facts.map(f=>f.key)).size!==facts.length)return null;
  const fr=asRecord(r.freshness);if(!fr||!hasExactKeys(fr,["max_age_seconds","not_before"])||!(fr.max_age_seconds===null||(Number.isInteger(fr.max_age_seconds)&&fr.max_age_seconds as number>0&&fr.max_age_seconds as number<=31536000))||!optionalDate(fr.not_before)||(fr.max_age_seconds===null&&fr.not_before===null))return null;
  const ids=uniqueTextArray(r.existing_evidence_ids),sources=enumArray(r.source_scope,JINYIWEI_SOURCES); if(!ids||!sources||sources.length<1)return null;
  return {requestingAgent:r.requesting_agent as string,question:r.question as string,requiredFacts:facts,decisionContext:r.decision_context as string,freshness:{maxAgeSeconds:fr.max_age_seconds as number|null,notBefore:fr.not_before as string|null},existingEvidenceIds:ids,requestId:r.request_id as string,timeoutSeconds:r.timeout_seconds as number,sourceScope:sources};
}

function parseDetail(value:unknown):JinyiweiDetail|null {
  const r=asRecord(value), keys=["pack_id","investigation_id","status","request","investigation_plan","evidence_by_fact","historical_evidence_by_fact","resolved_facts","unresolved_facts","conflicts","source_attempts","investigation_started_at","investigation_completed_at","cache","do_not_infer","adoptions"];
  if(!r||!hasExactKeys(r,keys)||!textValue(r.pack_id)||!textValue(r.investigation_id)||!JINYIWEI_STATUSES.has(r.status as JinyiweiStatus)||!exactDate(r.investigation_started_at)||!exactDate(r.investigation_completed_at))return null;
  const request=parseRequest(r.request), plan=asRecord(r.investigation_plan);if(!request||!plan||!hasExactKeys(plan,["fact_keys","source_scope"]))return null;const factKeys=uniqueTextArray(plan.fact_keys),planSources=enumArray(plan.source_scope,JINYIWEI_SOURCES);if(!factKeys||!planSources||factKeys.length<1)return null;
  const parseGrouped=(value:unknown):Record<string,JinyiweiEvidence[]>|null=>{const grouped=asRecord(value);if(!grouped)return null;const result:Record<string,JinyiweiEvidence[]>={};for(const [key,items] of Object.entries(grouped)){if(!factKeys.includes(key)||!Array.isArray(items))return null;const parsed=items.map(parseEvidenceItem);if(parsed.some(x=>!x||x.factKey!==key))return null;result[key]=parsed as JinyiweiEvidence[];}return result;};
  const evidenceByFact=parseGrouped(r.evidence_by_fact),historicalEvidenceByFact=parseGrouped(r.historical_evidence_by_fact);if(!evidenceByFact||!historicalEvidenceByFact)return null;
  const resolved=uniqueTextArray(r.resolved_facts),unresolved=uniqueTextArray(r.unresolved_facts),limits=uniqueTextArray(r.do_not_infer);if(!resolved||!unresolved||!limits)return null;
  if(new Set([...resolved,...unresolved]).size!==factKeys.length||![...resolved,...unresolved].every(k=>factKeys.includes(k)))return null;
  if(!Array.isArray(r.conflicts)||!Array.isArray(r.source_attempts)||!Array.isArray(r.adoptions))return null;
  const conflicts:JinyiweiConflict[]=[];for(const item of r.conflicts){const x=asRecord(item);const ids=x&&uniqueTextArray(x.evidence_ids);if(!x||!hasExactKeys(x,["fact_key","evidence_ids","summary"])||!textValue(x.fact_key)||!ids||ids.length<2||!textValue(x.summary))return null;conflicts.push({factKey:x.fact_key,evidenceIds:ids,summary:x.summary});}
  const attempts:JinyiweiSourceAttempt[]=[];for(const item of r.source_attempts){const x=asRecord(item);const facts=x&&uniqueTextArray(x.facts_attempted);if(!x||!hasExactKeys(x,["source_type","source_name","status","started_at","completed_at","error","facts_attempted","call_audits"])||!JINYIWEI_SOURCES.has(x.source_type as JinyiweiSourceType)||!textValue(x.source_name)||!ATTEMPT_STATUSES.has(x.status as JinyiweiAttemptStatus)||!exactDate(x.started_at)||!exactDate(x.completed_at)||!nullableText(x.error)||(typeof x.error==="string"&&/[\r\n]/.test(x.error))||!facts||!Array.isArray(x.call_audits))return null;const callAudits:JinyiweiMcpCallAudit[]=[];for(const audit of x.call_audits){const a=asRecord(audit);if(!a||!hasExactKeys(a,["server_id","tool_name","approval_version","duration_ms","arguments_hash","response_bytes","response_hash","mapping_outcome","cache_hit","error"])||!textValue(a.server_id)||!textValue(a.tool_name)||!textValue(a.approval_version)||!nonNegativeInteger(a.duration_ms)||typeof a.arguments_hash!=="string"||!HASH_RE.test(a.arguments_hash)||!(a.response_bytes===null||nonNegativeInteger(a.response_bytes))||!(a.response_hash===null||(typeof a.response_hash==="string"&&HASH_RE.test(a.response_hash)))||((a.response_bytes===null)!==(a.response_hash===null))||!textValue(a.mapping_outcome)||typeof a.cache_hit!=="boolean"||!nullableText(a.error)||(typeof a.error==="string"&&/[\r\n]/.test(a.error)))return null;callAudits.push({serverId:a.server_id,toolName:a.tool_name,approvalVersion:a.approval_version,durationMs:a.duration_ms,argumentsHash:a.arguments_hash,responseBytes:a.response_bytes as number|null,responseHash:a.response_hash as string|null,mappingOutcome:a.mapping_outcome,cacheHit:a.cache_hit,error:a.error as string|null});}attempts.push({sourceType:x.source_type as JinyiweiSourceType,sourceName:x.source_name,status:x.status as JinyiweiAttemptStatus,startedAt:x.started_at,completedAt:x.completed_at,error:x.error as string|null,factsAttempted:facts,callAudits});}
  const cache=asRecord(r.cache);if(!cache||!hasExactKeys(cache,["hit","cache_key","cached_at","expires_at"])||typeof cache.hit!=="boolean"||!nullableText(cache.cache_key)||!optionalDate(cache.cached_at)||!optionalDate(cache.expires_at))return null;
  const adoptions:JinyiweiAdoption[]=[];for(const item of r.adoptions){const x=asRecord(item);if(!x||!hasExactKeys(x,["evidence_id","reply_id","status","created_at","updated_at","confirmed_at"])||!textValue(x.evidence_id)||!textValue(x.reply_id)||!ADOPTION_STATUSES.has(x.status as JinyiweiAdoptionStatus)||!exactDate(x.created_at)||!exactDate(x.updated_at)||!optionalDate(x.confirmed_at))return null;adoptions.push({evidenceId:x.evidence_id,replyId:x.reply_id,status:x.status as JinyiweiAdoptionStatus,createdAt:x.created_at,updatedAt:x.updated_at,confirmedAt:x.confirmed_at as string|null});}
  const detail={packId:r.pack_id,investigationId:r.investigation_id,status:r.status as JinyiweiStatus,request,investigationPlan:{factKeys,sourceScope:planSources},evidenceByFact,historicalEvidenceByFact,resolvedFacts:resolved,unresolvedFacts:unresolved,conflicts,sourceAttempts:attempts,investigationStartedAt:r.investigation_started_at,investigationCompletedAt:r.investigation_completed_at,cache:{hit:cache.hit,cacheKey:cache.cache_key as string|null,cachedAt:cache.cached_at as string|null,expiresAt:cache.expires_at as string|null},doNotInfer:limits,adoptions};
  return validDetailRelations(detail)?detail:null;
}

function sameSet<T>(left:readonly T[],right:readonly T[]):boolean{return left.length===right.length&&left.every(item=>right.includes(item));}

function validDetailRelations(detail:JinyiweiDetail):boolean {
  const requested=detail.request.requiredFacts.map(fact=>fact.key);
  if(!sameSet(detail.investigationPlan.factKeys,requested)||!detail.investigationPlan.sourceScope.every(source=>detail.request.sourceScope.includes(source)))return false;
  if(Date.parse(detail.investigationCompletedAt)<Date.parse(detail.investigationStartedAt))return false;
  if(!Object.keys(detail.evidenceByFact).every(fact=>requested.includes(fact)))return false;
  if(!sameSet([...detail.resolvedFacts,...detail.unresolvedFacts],requested))return false;

  const evidenceIds=new Set<string>();
  const currentEvidenceIds=new Set<string>();
  const evidenceIdsByFact=new Map<string,Set<string>>();
  for(const [groupName,grouped] of [["current",detail.evidenceByFact],["historical",detail.historicalEvidenceByFact]] as const){
    for(const [factKey,items] of Object.entries(grouped)){
      const groupIds=evidenceIdsByFact.get(factKey)??new Set<string>();
      for(const item of items){
        if(item.factKey!==factKey||evidenceIds.has(item.evidenceId)||!detail.request.sourceScope.includes(item.sourceType)||!detail.investigationPlan.sourceScope.includes(item.sourceType))return false;
        evidenceIds.add(item.evidenceId);groupIds.add(item.evidenceId);
        if(groupName==="current")currentEvidenceIds.add(item.evidenceId);
      }
      evidenceIdsByFact.set(factKey,groupIds);
    }
  }
  if(detail.conflicts.some(conflict=>!requested.includes(conflict.factKey)||conflict.evidenceIds.some(id=>!evidenceIdsByFact.get(conflict.factKey)?.has(id))))return false;
  if(detail.status==="RESOLVED"&&(!sameSet(detail.resolvedFacts,requested)||detail.unresolvedFacts.length>0||detail.conflicts.length>0))return false;
  if(detail.sourceAttempts.some(attempt=>!detail.investigationPlan.sourceScope.includes(attempt.sourceType)||attempt.factsAttempted.some(fact=>!requested.includes(fact))||Date.parse(attempt.completedAt)<Date.parse(attempt.startedAt)))return false;

  const adoptionKeys=new Set<string>();
  for(const adoption of detail.adoptions){
    const created=Date.parse(adoption.createdAt),updated=Date.parse(adoption.updatedAt),confirmed=adoption.confirmedAt===null?null:Date.parse(adoption.confirmedAt);
    const key=`${adoption.evidenceId}\u0000${adoption.replyId}`;
    if(!currentEvidenceIds.has(adoption.evidenceId)||adoptionKeys.has(key)||updated<created||(adoption.status==="PENDING"&&confirmed!==null)||(adoption.status==="CONFIRMED"&&(confirmed===null||confirmed<created||confirmed>updated)))return false;
    adoptionKeys.add(key);
  }
  return true;
}

async function fetchJinyiwei<T>(path:string,parse:(value:unknown)=>T|null,options:JinyiweiReadOptions={}):Promise<JinyiweiReadResult<T>> {
  const base=options.baseUrl??getBackendBaseUrl(), controller=new AbortController();
  const fetchImpl=options.fetchImpl??fetch;
  const scheduleTimeout=options.scheduleTimeout??((callback:()=>void,delayMs:number)=>setTimeout(callback,delayMs));
  const cancelTimeout=options.cancelTimeout??((handle:unknown)=>clearTimeout(handle as ReturnType<typeof setTimeout>));
  const timer=scheduleTimeout(()=>controller.abort(),options.timeoutMs??JINYIWEI_TIMEOUT_MS);
  try { const response=await fetchImpl(`${base.replace(/\/+$/,"")}${path}`,{method:"GET",signal:controller.signal,cache:"no-store"});
    if(!response.ok){const kind=response.status===404?"not_found":response.status===422?"validation":response.status===503?"storage":"unknown";return {ok:false,kind,error:"锦衣卫只读档案暂时不可用"};}
    let body:unknown;try{body=await response.json();}catch{return {ok:false,kind:"unknown",error:"锦衣卫后端响应不是合法 JSON"};}const data=parse(body);return data===null?{ok:false,kind:"unknown",error:"锦衣卫后端成功响应体不符合预期契约"}:{ok:true,data};
  }catch(error){return {ok:false,kind:"network",error:describeError(error)};}finally{cancelTimeout(timer);}
}
export function getJinyiweiSummary(options:JinyiweiReadOptions={}):Promise<JinyiweiReadResult<JinyiweiSummary>>{return fetchJinyiwei("/api/v1/jinyiwei/summary",parseSummary,options);}
export function listJinyiweiInvestigations(options:ListJinyiweiOptions={}):Promise<JinyiweiReadResult<JinyiweiPage>>{const q=new URLSearchParams();if(options.status)q.set("status",options.status);q.set("limit",String(options.limit??20));q.set("offset",String(options.offset??0));return fetchJinyiwei(`/api/v1/jinyiwei/investigations?${q}`,parsePage,options);}
export function getJinyiweiInvestigation(id:string,options:JinyiweiReadOptions={}):Promise<JinyiweiReadResult<JinyiweiDetail>>{return fetchJinyiwei(`/api/v1/jinyiwei/investigations/${encodeURIComponent(id)}`,parseDetail,options);}

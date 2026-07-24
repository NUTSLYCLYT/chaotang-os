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
      kind: "validation" | "config" | "model" | "network" | "unauthenticated" | "unknown";
      error: string;
    };

export interface SubmitDecreeOptions {
  /** 覆盖默认后端基础地址，主要用于测试。 */
  baseUrl?: string;
  /** 请求超时时间（毫秒），默认 `DECREE_TIMEOUT_MS`。 */
  timeoutMs?: number;
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/v1/decrees/chancellor`, {
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
    return { ok: false, kind: "network", error: describeError(error) };
  } finally {
    clearTimeout(timer);
  }
}

export type ArchiveType = "MEMORIAL" | "REPLY";
export type ReplySourceKind = "DECREE" | "MEMORIAL";
export type RealityLabel = "LIVE" | "MIXED" | "FALLBACK";
export type ReviewStatusValue = "ACHIEVED" | "NOT_ACHIEVED" | "PARTIAL" | "OBSERVING";

export interface ShiguanEvidence {
  source: string;
  realityLabel: RealityLabel;
  note: string | null;
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
  sourceKind: ReplySourceKind | null;
  sourceText: string | null;
  participatingDepartments: string[] | null;
  replyProcess: string | null;
  replyConclusion: string | null;
  replyTime: string | null;
  respondent: string | null;
  reviewStatus: ShiguanReviewStatus | null;
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

export interface ListShiguanArchivesOptions {
  type?: ArchiveType;
  matterType?: string;
  department?: string;
  limit?: number;
  baseUrl?: string;
  timeoutMs?: number;
  sessionId?: string;
}

export interface RecallShiguanArchivesOptions {
  matterType?: string;
  department?: string;
  limit?: number;
  baseUrl?: string;
  timeoutMs?: number;
  sessionId?: string;
}

export interface UpdateShiguanReviewOptions {
  baseUrl?: string;
  timeoutMs?: number;
  sessionId?: string;
}

const SHIGUAN_TIMEOUT_MS = 10000;
const ARCHIVE_TYPES = new Set<ArchiveType>([
  "MEMORIAL",
  "REPLY",
]);
const REPLY_SOURCE_KINDS = new Set<ReplySourceKind>(["DECREE", "MEMORIAL"]);
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
      "source_kind", "source_text", "reply_process", "reply_conclusion", "reply_time", "respondent",
      "id", "created_at", "review_status",
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
  if (
    relatedArchiveIds === null ||
    relatedArchiveIds.some((archiveId) => archiveId.trim().length === 0) ||
    evidence === null ||
    !("review_status" in record) ||
    (record.review_status !== null && reviewStatus === null) ||
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
  const replyFieldsAreStrings =
    participatingDepartments !== null &&
    participatingDepartments.length > 0 &&
    participatingDepartments.every((department) => department.trim().length > 0) &&
    new Set(participatingDepartments.map((department) => department.trim())).size ===
      participatingDepartments.length &&
    REPLY_SOURCE_KINDS.has(record.source_kind as ReplySourceKind) &&
    typeof record.source_text === "string" &&
    record.source_text.trim().length > 0 &&
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
    (record.type === "REPLY" && !replyFieldsAreStrings) ||
    (record.type !== "REPLY" && !replyFieldsAreEmpty)
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
    sourceKind: record.source_kind as ReplySourceKind | null,
    sourceText: parseNullableString(record.source_text),
    participatingDepartments,
    replyProcess: parseNullableString(record.reply_process),
    replyConclusion: parseNullableString(record.reply_conclusion),
    replyTime: parseNullableString(record.reply_time),
    respondent: parseNullableString(record.respondent),
    reviewStatus,
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
  options: { baseUrl?: string; timeoutMs?: number; sessionId?: string } = {},
): Promise<ShiguanResult<T>> {
  const baseUrl = options.baseUrl ?? getBackendBaseUrl();
  const timeoutMs = options.timeoutMs ?? SHIGUAN_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
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
    clearTimeout(timer);
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
  options: { baseUrl?: string; timeoutMs?: number; sessionId?: string } = {},
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

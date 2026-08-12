/**
 * `/study`（上书房）页面的下旨 UI 状态模型与映射函数。
 *
 * 纯函数模块：不依赖 React、DOM 或网络请求，可在 `decreeStatus.test.ts` 中完全离线
 * 单测。本文件刻意不从 `src/lib/backendClient.ts` 导入任何运行时符号（哪怕只是
 * 类型），以保持零依赖——`decreeStatus.test.ts` 通过 `node --test` 直接运行，不经过
 * Next.js/TypeScript 打包，无法解析 `tsconfig.json` 的 `@/*` 路径别名（详见
 * `frontend/AGENTS.md`「Test」章节的既有约束）。
 *
 * `DecreeSubmitOutcome` 在结构上与 `src/lib/backendClient.ts` 导出的
 * `SubmitDecreeResult` 兼容（字段名/形状一致），调用方既可以直接把
 * `SubmitDecreeResult` 值传入本模块的函数（结构类型兼容），也可以在
 * `src/app/study/page.tsx` 里根据 Route Handler 的 HTTP 响应（`/api/decrees/chancellor`
 * 已把 `SubmitDecreeResult` 映射为 JSON body + 状态码）重新构造出一个符合该结构的
 * 字面量再传入。
 */
import type { DeliveryKind, ReportArtifact } from "../../lib/backendClient.ts";

/** 与 `SubmitDecreeResult` 的 `kind` 保持一致的稳定错误分类。 */
export type DecreeErrorKind = "validation" | "draft_not_current" | "source_not_current" | "idempotency_conflict" | "config" | "model" | "timeout" | "network" | "unknown";

export interface DecreeBureauOpinion {
  bureau: string;
  opinion: string;
}

/** 一个被军机处/单部门咨询的部门及其分层办理意见，保序。 */
export interface DecreeMinistryOpinion {
  department: string;
  bureauOpinions: DecreeBureauOpinion[];
  opinion: string;
}

export interface DecreeSuccessData {
  status: string;
  chancellor: string;
  routeType: "single" | "multi";
  rationale: string;
  processingPath: string[];
  departments: string[];
  ministryOpinions: DecreeMinistryOpinion[];
  councilVerdict: string | null;
  finalVerdict: string;
  recommendations: string[];
  deliveryKind: DeliveryKind;
  deliveryPeriod: { startYear: number; endYear: number } | null;
  artifacts: ReportArtifact[];
}

/**
 * 与 `src/lib/backendClient.ts` 的 `SubmitDecreeResult` 结构兼容的下旨提交结果。
 *
 * `data` 形状对应新的结构化流转契约（`routeType/rationale/processingPath/
 * departments/ministryOpinions/finalVerdict`），替代旧的单段 `memorialText`；
 * 详见 `docs/decisions/0012-decree-six-ministries-joint-review.md`。
 */
export type DecreeSubmitOutcome =
  | {
      ok: true;
      data: DecreeSuccessData;
    }
  | { ok: false; kind: DecreeErrorKind; error: string };

/** `/study` 页面渲染下旨流程所需的全部 UI 状态。 */
export type DecreeUiState =
  | { phase: "idle" }
  | { phase: "enqueueing" }
  | { phase: "queued" | "running"; jobId: string }
  | {
      phase: "success";
      chancellor: string;
      routeType: string;
      rationale: string;
      processingPath: string[];
      departments: string[];
      ministryOpinions: DecreeMinistryOpinion[];
      councilVerdict: string | null;
      finalVerdict: string;
      recommendations: string[];
      deliveryKind: DeliveryKind;
      deliveryPeriod?: { startYear: number; endYear: number } | null;
      artifacts: ReportArtifact[];
    }
  | { phase: "error"; message: string };

export interface DecreeJobFailure {
  errorStage?: unknown;
  errorCategory?: unknown;
  errorCode?: unknown;
}

const ASYNC_FAILURE_MESSAGES: Readonly<Record<string, string>> = {
  "format:format_unrecognized": "会计司未能识别现有数据格式，已尝试替代读取策略。",
  "tool:tool_unavailable": "会计司所需读取工具暂时不可用，请稍后重试或联系管理员检查工具状态。",
  "data:source_not_found": "系统内未找到可用的财务数据，请确认数据已接入后重新下旨。",
  "validation:validation_failed": "财务数据校验未通过，请修正数据勾稽关系后重新下旨。",
  "model:model_failed": "丞相模型调用失败，请稍后重试。",
  "artifact:artifact_failed": "财务分析已办理，但 Excel 文件生成或发布失败，请稍后重试。",
};

export function mapDecreeJobFailure(failure: DecreeJobFailure): DecreeUiState {
  const key = `${String(failure.errorCategory)}:${String(failure.errorCode)}`;
  return {
    phase: "error",
    message: ASYNC_FAILURE_MESSAGES[key] ?? FRIENDLY_MESSAGE_BY_KIND.unknown,
  };
}

export interface OwnerScopedDecreeUiState {
  ownerId: string;
  value: DecreeUiState;
}

/**
 * 每种错误分类对应的、用户可读的中文固定文案。
 *
 * 刻意不透传 `DecreeSubmitOutcome` 里的 `error` 原文：一是该字段在校验失败场景下
 * 本就是 `submitDecree` 提供的通用兜底文案（后端 422 响应体是 FastAPI 默认的
 * `detail` 数组，不含 `message` 字段，细节见 `backend/app/api/decrees.py` 与相关
 * 后端测试），二是固定文案能保证四种失败场景的措辞在 UI 上保持一致、友好、不泄露
 * 任何内部实现细节。
 */
const FRIENDLY_MESSAGE_BY_KIND: Record<DecreeErrorKind, string> = {
  validation: "旨意校验未通过：请确认内容非空且不超过 2000 字后重试。",
  draft_not_current: "拟旨草案已失效，请重新拟旨后再下旨。",
  source_not_current: "会计数据源已变化，请重新拟旨后再下旨。",
  idempotency_conflict: "本次下旨标识与既有请求冲突，请刷新页面后重试。",
  config: "朝堂后端配置暂不可用，请联系管理员检查后端配置后重试。",
  model: "丞相暂时无法给出回奏（模型调用失败），请稍后重试。",
  timeout: "下旨处理超时，请稍后重试。",
  network: "无法连接朝堂后端，请确认后端服务已启动后重试。",
  unknown: "发生未知错误，请稍后重试。",
};

/** 用户尚未点击「下旨」之前的初始状态。 */
export const IDLE_UI_STATE: DecreeUiState = { phase: "idle" };

export function resolveOwnerScopedDecreeUiState(
  envelope: OwnerScopedDecreeUiState,
  currentOwnerId: string,
): DecreeUiState {
  return envelope.ownerId === currentOwnerId ? envelope.value : IDLE_UI_STATE;
}

/** 用户点击「下旨」后、收到响应前的处理中状态。 */
export const SUBMITTING_UI_STATE: DecreeUiState = { phase: "enqueueing" };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseNonEmptyStrings(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isNonEmptyString)) {
    return null;
  }
  return value.map((item) => item.trim());
}

function parseReportArtifacts(value: unknown): ReportArtifact[] | null {
  if (!Array.isArray(value)) return null;
  const artifacts: ReportArtifact[] = [];
  const artifactIds = new Set<string>();
  for (const rawArtifact of value) {
    if (typeof rawArtifact !== "object" || rawArtifact === null || Array.isArray(rawArtifact)) return null;
    const artifact = rawArtifact as Record<string, unknown>;
    if (
      Object.keys(artifact).length !== 6 ||
      !isNonEmptyString(artifact.artifactId) ||
      artifact.kind !== "ACCOUNTING_MANAGEMENT_REPORT_XLSX" ||
      !isNonEmptyString(artifact.displayName) ||
      !Number.isInteger(artifact.periodStart) ||
      !Number.isInteger(artifact.periodEnd) ||
      !isNonEmptyString(artifact.generatedAt)
    ) return null;
    if (artifactIds.has(artifact.artifactId)) return null;
    artifactIds.add(artifact.artifactId);
    artifacts.push({
      artifactId: artifact.artifactId,
      kind: artifact.kind,
      displayName: artifact.displayName,
      periodStart: artifact.periodStart as number,
      periodEnd: artifact.periodEnd as number,
      generatedAt: artifact.generatedAt,
    });
  }
  return artifacts;
}

/** 严格校验 Route Handler 的 camelCase 成功响应；非法结构返回 null。 */
export function parseChancellorSuccessResponse(body: unknown): DecreeSuccessData | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const record = body as Record<string, unknown>;
  if (
    record.status !== "ok" ||
    !isNonEmptyString(record.chancellor) ||
    (record.routeType !== "single" && record.routeType !== "multi") ||
    !isNonEmptyString(record.rationale) ||
    !isNonEmptyString(record.finalVerdict)
  ) {
    return null;
  }
  const processingPath = parseNonEmptyStrings(record.processingPath);
  const departments = parseNonEmptyStrings(record.departments);
  if (
    processingPath === null ||
    departments === null ||
    new Set(departments).size !== departments.length ||
    (record.routeType === "single" && departments.length !== 1) ||
    (record.routeType === "multi" && departments.length < 2)
  ) {
    return null;
  }
  if (
    !Array.isArray(record.ministryOpinions) ||
    record.ministryOpinions.length !== departments.length
  ) {
    return null;
  }
  const ministryOpinions: DecreeMinistryOpinion[] = [];
  for (const [index, rawMinistry] of record.ministryOpinions.entries()) {
    if (typeof rawMinistry !== "object" || rawMinistry === null || Array.isArray(rawMinistry)) {
      return null;
    }
    const ministry = rawMinistry as Record<string, unknown>;
    if (
      Object.keys(ministry).length !== 3 ||
      ministry.department !== departments[index] ||
      !isNonEmptyString(ministry.opinion) ||
      !Array.isArray(ministry.bureauOpinions) ||
      ministry.bureauOpinions.length === 0
    ) {
      return null;
    }
    const bureauOpinions: DecreeBureauOpinion[] = [];
    const bureauNames = new Set<string>();
    for (const rawBureau of ministry.bureauOpinions) {
      if (typeof rawBureau !== "object" || rawBureau === null || Array.isArray(rawBureau)) {
        return null;
      }
      const bureau = rawBureau as Record<string, unknown>;
      if (
        Object.keys(bureau).length !== 2 ||
        !isNonEmptyString(bureau.bureau) ||
        !isNonEmptyString(bureau.opinion) ||
        bureauNames.has(bureau.bureau.trim())
      ) {
        return null;
      }
      bureauNames.add(bureau.bureau.trim());
      bureauOpinions.push({ bureau: bureau.bureau.trim(), opinion: bureau.opinion.trim() });
    }
    ministryOpinions.push({
      department: departments[index],
      bureauOpinions,
      opinion: ministry.opinion.trim(),
    });
  }
  let councilVerdict: string | null;
  if (record.routeType === "single") {
    if (record.councilVerdict !== null) {
      return null;
    }
    councilVerdict = null;
  } else {
    if (!isNonEmptyString(record.councilVerdict)) {
      return null;
    }
    councilVerdict = record.councilVerdict.trim();
  }
  const recommendations = parseNonEmptyStrings(record.recommendations);
  const artifacts = parseReportArtifacts(record.artifacts);
  const deliveryKind = record.deliveryKind;
  const rawPeriod = record.deliveryPeriod;
  const deliveryPeriod =
    typeof rawPeriod === "object" && rawPeriod !== null && !Array.isArray(rawPeriod) &&
    Object.keys(rawPeriod).length === 2 &&
    Number.isInteger((rawPeriod as Record<string, unknown>).startYear) &&
    Number.isInteger((rawPeriod as Record<string, unknown>).endYear) &&
    (rawPeriod as Record<string, number>).startYear <=
      (rawPeriod as Record<string, number>).endYear
      ? rawPeriod as { startYear: number; endYear: number }
      : null;
  if (
    recommendations === null ||
    recommendations.length !== 3 ||
    new Set(recommendations).size !== 3 ||
    artifacts === null ||
    (deliveryKind !== "none" && deliveryKind !== "accounting_report" && deliveryKind !== "accounting_analysis") ||
    (deliveryKind === "none" ? artifacts.length !== 0 : artifacts.length !== 1) ||
    (deliveryKind === "none" ? rawPeriod !== null : deliveryPeriod === null) ||
    (deliveryKind !== "none" && deliveryPeriod !== null &&
      (artifacts[0].periodStart !== deliveryPeriod.startYear ||
       artifacts[0].periodEnd !== deliveryPeriod.endYear))
  ) {
    return null;
  }
  return {
    status: "ok",
    chancellor: record.chancellor.trim(),
    routeType: record.routeType,
    rationale: record.rationale.trim(),
    processingPath,
    departments,
    ministryOpinions,
    councilVerdict,
    finalVerdict: record.finalVerdict.trim(),
    recommendations,
    deliveryKind,
    deliveryPeriod,
    artifacts,
  };
}

/**
 * 根据当前文本和提交流程状态计算表单控件是否可用。
 *
 * 输入框是否可编辑只取决于是否正在提交，不能依赖当前文本是否可提交；否则空的
 * 初始输入框会被永久禁用。按钮则同时受提交状态和去除首尾空白后的长度约束。
 */
export function getDecreeFormAvailability(
  decreeText: string,
  uiState: DecreeUiState,
): { canEdit: boolean; canSubmit: boolean } {
  const isSubmitting = ["enqueueing", "queued", "running"].includes(uiState.phase);
  const normalizedLength = decreeText.trim().length;

  return {
    canEdit: !isSubmitting,
    canSubmit: !isSubmitting && normalizedLength >= 1 && normalizedLength <= 2000,
  };
}

/** 把一次下旨提交结果（成功或失败）映射为页面可直接渲染的 UI 状态。 */
export function mapSubmitDecreeResultToUiState(result: DecreeSubmitOutcome): DecreeUiState {
  if (result.ok) {
    return {
      phase: "success",
      chancellor: result.data.chancellor,
      routeType: result.data.routeType,
      rationale: result.data.rationale,
      processingPath: result.data.processingPath,
      departments: result.data.departments,
      ministryOpinions: result.data.ministryOpinions,
      councilVerdict: result.data.councilVerdict,
      finalVerdict: result.data.finalVerdict,
      recommendations: result.data.recommendations,
      deliveryKind: result.data.deliveryKind,
      deliveryPeriod: result.data.deliveryPeriod,
      artifacts: result.data.artifacts,
    };
  }
  return { phase: "error", message: FRIENDLY_MESSAGE_BY_KIND[result.kind] };
}

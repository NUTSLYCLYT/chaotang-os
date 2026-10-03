import type {
  ChancellorDraftEdict,
  ChancellorDraftResult,
} from "../../app/study/chancellorDraft.ts";
import type {
  DecreeJobProgress,
  DecreeUiState,
} from "../../app/study/decreeStatus.ts";

export type StudySourceMode = "DEMO" | "LOCAL" | "API_LIVE";

export const SOURCE_MODE_LABELS: Readonly<Record<StudySourceMode, string>> = {
  DEMO: "DEMO · 演示数据",
  LOCAL: "LOCAL · 浏览器本地输入",
  API_LIVE: "API_LIVE · 已验证接口响应",
};

export type StudyStage = "EMPTY" | "DAILY_MEMORIAL_REVIEW_ONLY" | "CONSULTING" |
  "UNDERSTANDING_READY" | "CONFIRMED_AND_DRAFTING" | "DRAFT_READY" |
  "DRAFT_BLOCKED" | "QUEUED_OR_RUNNING" | "SUCCEEDED" | "FAILED_OR_CANCELLED";

/**
 * 非 `DRAFT_READY` 草案的唯一恢复动作。
 *
 * 只投影既有草案状态，不新增状态机或存储；返回的 `action` 恒为 `REDRAFT`，
 * `label` 是面向用户的唯一恢复控件文案。`status` 保留真实阻断状态，便于渲染
 * 真实原因而不是把它伪装成 `EMPTY`（没有草案）。
 */
export interface StudyDraftBlockRecovery {
  status: ChancellorDraftResult["status"];
  action: "REDRAFT";
  label: string;
}

const STUDY_DRAFT_BLOCK_RECOVERY_LABEL = "重新拟旨 · 更新目标后重试";

export function resolveStudyDraftBlockRecovery(
  status: ChancellorDraftResult["status"],
): StudyDraftBlockRecovery {
  return { status, action: "REDRAFT", label: STUDY_DRAFT_BLOCK_RECOVERY_LABEL };
}

/** A display projection of existing states, not another job or authority state. */
export function projectStudyPrimaryAction(input: {
  uiPhase: DecreeUiState["phase"];
  draftStatus: ChancellorDraftResult["status"] | null;
  draftPending: boolean;
  consultPending: boolean;
  understandingReady: boolean;
  goal: string;
  dailyMemorialReady: boolean;
}): { stage: StudyStage; label: string | null } {
  let stage: StudyStage;
  if (["enqueueing", "queued", "running"].includes(input.uiPhase)) stage = "QUEUED_OR_RUNNING";
  else if (input.uiPhase === "error") stage = "FAILED_OR_CANCELLED";
  else if (input.uiPhase === "success") stage = "SUCCEEDED";
  else if (input.consultPending) stage = "CONSULTING";
  else if (input.draftPending) stage = "CONFIRMED_AND_DRAFTING";
  else if (input.draftStatus === "DRAFT_READY") stage = "DRAFT_READY";
  else if (input.understandingReady && input.draftStatus === null) stage = "UNDERSTANDING_READY";
  // A non-null, non-ready draft is a real block: never fall through to EMPTY.
  else if (input.draftStatus !== null) stage = "DRAFT_BLOCKED";
  else if (!input.goal.trim() && input.dailyMemorialReady) stage = "DAILY_MEMORIAL_REVIEW_ONLY";
  else stage = "EMPTY";
  const labels: Record<StudyStage, string | null> = {
    EMPTY: "请丞相复述", DAILY_MEMORIAL_REVIEW_ONLY: "确认上奏并归档为奏折",
    CONSULTING: null, UNDERSTANDING_READY: "确认理解 · 生成拟旨",
    CONFIRMED_AND_DRAFTING: null, DRAFT_READY: "确认下旨 · 开始办理",
    DRAFT_BLOCKED: null,
    QUEUED_OR_RUNNING: null, SUCCEEDED: "查看成果", FAILED_OR_CANCELLED: "查看原因与下一步",
  };
  const label = stage === "DRAFT_BLOCKED" && input.draftStatus !== null
    ? resolveStudyDraftBlockRecovery(input.draftStatus).label
    : labels[stage];
  return { stage, label };
}

export interface StudyAcceptanceContract {
  objective?: string;
  scope?: string[];
  exclusions?: string[];
  inputMaterials?: string[];
  materialGaps?: string[];
  keyQuestions?: string[];
  executionSteps?: string[];
  deliverables?: string[];
  completionCriteria?: string[];
  permissionsAndLimits?: string[];
}

export interface StudyTaskCockpit {
  sourceMode: StudySourceMode;
  title?: string;
  acceptance?: StudyAcceptanceContract;
  progress?: DecreeJobProgress;
}

interface StudyTaskCockpitInput {
  decreeText: string;
  draftResult: ChancellorDraftResult | null;
  uiState: DecreeUiState;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function projectAcceptance(
  draft: ChancellorDraftEdict | null,
): StudyAcceptanceContract | undefined {
  if (draft === null) return undefined;
  const raw = draft as unknown as Record<string, unknown>;
  return {
    objective: stringValue(raw.objective),
    scope: stringList(raw.scope),
    exclusions: stringList(raw.exclusions),
    inputMaterials: stringList(raw.input_materials),
    materialGaps: stringList(raw.material_gaps),
    keyQuestions: stringList(raw.key_questions),
    executionSteps: stringList(raw.execution_steps),
    deliverables: stringList(raw.deliverables),
    completionCriteria: stringList(raw.completion_criteria),
    permissionsAndLimits: stringList(raw.permissions_and_limits),
  };
}

function progressFromState(uiState: DecreeUiState): DecreeJobProgress | undefined {
  if (uiState.phase === "queued" || uiState.phase === "running") {
    return uiState.jobProgress;
  }
  if (uiState.phase === "success") return uiState.jobProgress;
  if (uiState.phase === "error") return uiState.lastVerifiedProgress;
  return undefined;
}

export function projectStudyTaskCockpit({
  decreeText,
  draftResult,
  uiState,
}: StudyTaskCockpitInput): StudyTaskCockpit {
  const progress = progressFromState(uiState);
  const normalizedLocalTitle = decreeText.trim();
  const title = draftResult?.decree_text ?? (
    normalizedLocalTitle.length > 0 ? normalizedLocalTitle : undefined
  );
  const hasVerifiedTerminalResponse = uiState.phase === "success" || (
    uiState.phase === "error" && uiState.progressFreshness === "current"
  );
  const currentTaskBranchVisible = uiState.phase === "error" ||
    uiState.phase === "enqueueing" || uiState.phase === "queued" ||
    uiState.phase === "running";
  const visibleDraftApiBacked = draftResult !== null && !currentTaskBranchVisible;
  const apiBacked = visibleDraftApiBacked || progress !== undefined ||
    hasVerifiedTerminalResponse;

  return {
    sourceMode: apiBacked ? "API_LIVE" : "LOCAL",
    title,
    acceptance: projectAcceptance(draftResult?.draft ?? null),
    progress,
  };
}

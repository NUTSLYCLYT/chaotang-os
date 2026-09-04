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

import type { DecreeUiState } from "./decreeStatus.ts";

export type StudyWorkspaceTone = "neutral" | "pending" | "success" | "danger";

export interface StudyWorkspaceSummary {
  stage: string;
  detail: string;
  tone: StudyWorkspaceTone;
}

export function getStudyWorkspaceSummary(state: DecreeUiState): StudyWorkspaceSummary {
  switch (state.phase) {
    case "idle":
      return { stage: "候旨", detail: "请在中枢拟定旨意，确认后再下旨。", tone: "neutral" };
    case "submitting":
      return { stage: "会审中", detail: "六部与丞相正在依次审议旨意。", tone: "pending" };
    case "success":
      return { stage: "已回奏", detail: "丞相回奏已送达中枢。", tone: "success" };
    case "error":
      return { stage: "待复核", detail: "本次下旨未完成，可核对内容后重试。", tone: "danger" };
  }
}

import type { DecreeUiState } from "../../app/study/decreeStatus";
import type { ReportArtifact } from "../../lib/backendClient";

export function projectStudyArtifacts(uiState: DecreeUiState): ReportArtifact[] {
  return uiState.phase === "success" ? uiState.artifacts : [];
}

export function getStudyDepartmentCountLabel(
  uiState: DecreeUiState,
): string {
  return uiState.phase === "success"
    ? `${uiState.departments.length} 部门`
    : "待分流";
}

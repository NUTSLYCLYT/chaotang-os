import type { DecreeUiState } from "../../app/study/decreeStatus";

export function getStudyDepartmentCountLabel(
  uiState: DecreeUiState,
): string {
  return uiState.phase === "success"
    ? `${uiState.departments.length} 部门`
    : "待分流";
}

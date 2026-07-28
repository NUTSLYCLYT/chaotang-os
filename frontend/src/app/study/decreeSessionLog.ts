import type { DecreeUiState } from "./decreeStatus";

export interface DecreeSessionRecord {
  id: number;
  decree: string;
  outcome: "success" | "error";
  summary: string;
}

export function appendDecreeSessionRecord(
  records: DecreeSessionRecord[],
  decree: string,
  state: DecreeUiState,
): DecreeSessionRecord[] {
  if (state.phase !== "success" && state.phase !== "error") return records;
  const summary = state.phase === "success" ? state.finalVerdict : state.message;
  return [...records, { id: records.length + 1, decree: decree.trim(), outcome: state.phase, summary }];
}

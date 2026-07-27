import type { ReplyCaseView } from "../court-replies/replyFeed.ts";

export interface JunjichuFact {
  label: "参与部门" | "司级明细" | "风险字段";
  value: number | null;
}

export function projectJunjichuFacts(
  selected: ReplyCaseView,
): readonly JunjichuFact[] {
  return [
    { label: "参与部门", value: selected.departments.length },
    { label: "司级明细", value: null },
    { label: "风险字段", value: null },
  ];
}

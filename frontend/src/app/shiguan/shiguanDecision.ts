import type {
  ArchiveDecisionValue,
  ArchiveType,
} from "../../lib/backendClient.ts";

export interface ArchiveDecisionAction {
  decision: ArchiveDecisionValue;
  label: string;
}

const ACTIONS: Record<ArchiveType, readonly ArchiveDecisionAction[]> = {
  MEMORIAL: [
    { decision: "APPROVED", label: "准奏" },
    { decision: "REJECTED", label: "驳回" },
  ],
  REPLY: [
    { decision: "ADOPTED", label: "采纳" },
    { decision: "RETURNED_FOR_RECONSIDERATION", label: "发回重议" },
  ],
};

const LABELS: Record<ArchiveDecisionValue, string> = {
  APPROVED: "已准奏",
  REJECTED: "已驳回",
  ADOPTED: "已采纳",
  RETURNED_FOR_RECONSIDERATION: "已发回重议",
};

export function decisionActionsForArchive(type: ArchiveType): readonly ArchiveDecisionAction[] {
  return ACTIONS[type];
}

export function formatArchiveDecision(decision: ArchiveDecisionValue | null): string {
  return decision === null ? "待处置" : LABELS[decision];
}

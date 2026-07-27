import type { ArchiveType, RealityLabel, ReviewStatusValue } from "../../lib/backendClient.ts";

export const ARCHIVE_TYPE_LABELS: Record<ArchiveType, string> = {
  MEMORIAL: "奏折",
  REPLY: "回奏",
};

export const REALITY_LABELS: Record<RealityLabel, string> = {
  LIVE: "实时链路来源",
  MIXED: "实时与降级来源混合",
  FALLBACK: "降级或演示来源",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatusValue, string> = {
  ACHIEVED: "达成",
  NOT_ACHIEVED: "未达成",
  PARTIAL: "部分达成",
  OBSERVING: "持续观察",
};

export function formatArchiveType(type: ArchiveType): string {
  return ARCHIVE_TYPE_LABELS[type];
}

export function formatRealityLabel(label: RealityLabel): string {
  return REALITY_LABELS[label];
}

export function formatReviewStatus(status: ReviewStatusValue | null): string {
  return status === null ? "待复盘" : REVIEW_STATUS_LABELS[status];
}

export function formatSuccessRate(value: number | null): string {
  return value === null ? "暂无可计算样本" : `${Math.round(value * 100)}%`;
}

export function reviewDraftFromStatus(
  status: ReviewStatusValue | null,
  note: string | null,
  reviewedAt: string | null,
): { status: ReviewStatusValue; note: string; revision: string } {
  return {
    status: status ?? "OBSERVING",
    note: note ?? "",
    revision: `${String(status)}\u0000${String(note)}\u0000${String(reviewedAt)}`,
  };
}

export function resolveReviewDraft(
  current: ReturnType<typeof reviewDraftFromStatus>,
  incoming: ReturnType<typeof reviewDraftFromStatus>,
): ReturnType<typeof reviewDraftFromStatus> {
  return current.revision === incoming.revision ? current : incoming;
}

export function buildArchiveFilterQuery(input: {
  type?: string;
  matterType?: string;
  department?: string;
  limit?: number;
}): string {
  const params = new URLSearchParams();
  if (input.type) {
    params.set("type", input.type);
  }
  if (input.matterType?.trim()) {
    params.set("matterType", input.matterType.trim());
  }
  if (input.department?.trim()) {
    params.set("department", input.department.trim());
  }
  if (input.limit !== undefined) {
    params.set("limit", String(input.limit));
  }
  return params.toString();
}

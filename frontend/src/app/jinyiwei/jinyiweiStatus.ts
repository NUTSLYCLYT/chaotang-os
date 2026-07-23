export type InvestigationStatus = "RESOLVED" | "PARTIAL" | "BLOCKED" | "UNAVAILABLE";
export type EvidenceQuality = "PRIMARY" | "AUTHORITATIVE" | "SECONDARY" | "UNVERIFIED";

const STATUS = {
  RESOLVED: { label: "已解决", symbol: "✓" },
  PARTIAL: { label: "部分解决", symbol: "◐" },
  BLOCKED: { label: "受阻", symbol: "!" },
  UNAVAILABLE: { label: "不可用", symbol: "×" },
} as const;

const QUALITY = {
  PRIMARY: { label: "一手", symbol: "◆" },
  AUTHORITATIVE: { label: "权威", symbol: "■" },
  SECONDARY: { label: "二手", symbol: "▲" },
  UNVERIFIED: { label: "未核验", symbol: "?" },
} as const;

export function statusPresentation(status: InvestigationStatus) { return STATUS[status]; }
export function qualityPresentation(quality: EvidenceQuality) { return QUALITY[quality]; }
export function formatConfidence(value: number): string { return `${(value * 100).toFixed(1)}%`; }

export function getPageAvailability(offset: number, limit: number, total: number, itemCount: number) {
  return {
    previousOffset: Math.max(0, offset - limit),
    canPrevious: offset > 0,
    canNext: offset + itemCount < total,
  };
}

export function buildInvestigationQuery(status: InvestigationStatus | "ALL", limit: number, offset: number): string {
  const query = new URLSearchParams();
  if (status !== "ALL") query.set("status", status);
  query.set("limit", String(limit));
  query.set("offset", String(offset));
  return query.toString();
}

export function createGenerationGuard() {
  let generation = 0;
  return {
    next: () => ++generation,
    invalidate: () => { generation += 1; },
    isCurrent: (candidate: number) => candidate === generation,
  };
}

export function resetDetailForListRefresh(
  controller: AbortController | null,
  guard: { invalidate: () => void },
  clearSelection: () => void,
  clearDetail: () => void,
): void {
  controller?.abort();
  guard.invalidate();
  clearSelection();
  clearDetail();
}

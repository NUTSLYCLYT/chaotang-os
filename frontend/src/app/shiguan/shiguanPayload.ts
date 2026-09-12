import type {
  ArchiveDecision,
  ArchiveDecisionValue,
  JinyiweiDataScope,
  JinyiweiEvidenceQuality,
  JinyiweiEvidenceStance,
  JinyiweiFactCategory,
  JinyiweiSourceType,
  JsonValue,
  RealityLabel,
  ReviewStatusValue,
  ShiguanEvidence,
  ShiguanArchive,
  ShiguanEvidenceReference,
  ShiguanEvidenceSnapshot,
  ShiguanOutcomePage,
  ShiguanOutcomeProjection,
  ShiguanRecallMatch,
  ShiguanReviewStatus,
  ShiguanStatistics,
} from "../../lib/backendClient.ts";

const ARCHIVE_DECISIONS = new Set<ArchiveDecisionValue>([
  "APPROVED",
  "REJECTED",
  "ADOPTED",
  "RETURNED_FOR_RECONSIDERATION",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(record);
  return actual.length === keys.length && keys.every((key) => key in record);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isIsoDateTime(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  const match = /^(?!0000)(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/u.exec(
    value,
  );
  if (!match || Number.isNaN(Date.parse(value))) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  if (
    month < 1 ||
    month > 12 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

function parseStringArray(
  value: unknown,
  options: { nonEmpty?: boolean } = {},
): string[] | null {
  if (
    !Array.isArray(value) ||
    (options.nonEmpty && value.length === 0) ||
    !value.every(isNonEmptyString)
  ) {
    return null;
  }
  return [...value];
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

const REALITY_LABELS = new Set<RealityLabel>(["LIVE", "MIXED", "FALLBACK"]);
const REVIEW_STATUSES = new Set<ReviewStatusValue>([
  "ACHIEVED",
  "NOT_ACHIEVED",
  "PARTIAL",
  "OBSERVING",
]);
const SOURCE_TYPES = new Set<JinyiweiSourceType>([
  "SHIGUAN",
  "MCP",
  "PUBLIC_API",
  "PUBLIC_WEB",
]);
const EVIDENCE_QUALITIES = new Set<JinyiweiEvidenceQuality>([
  "PRIMARY",
  "AUTHORITATIVE",
  "SECONDARY",
  "UNVERIFIED",
]);
const EVIDENCE_STANCES = new Set<JinyiweiEvidenceStance>([
  "SUPPORTS",
  "CONTRADICTS",
]);
const FACT_CATEGORIES = new Set<JinyiweiFactCategory>([
  "MARKET_QUOTE",
  "REGULATORY_FILING",
  "NEWS_EVENT",
  "PUBLIC_STATISTIC",
  "ENTITY_REFERENCE",
]);
const DATA_SCOPES = new Set<JinyiweiDataScope>([
  "INTERNAL_BUSINESS",
  "EXTERNAL_PUBLIC",
  "HYBRID",
]);
const SHA256 = /^[0-9a-f]{64}$/u;

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isNullableIsoDateTime(value: unknown): value is string | null {
  return value === null || isIsoDateTime(value);
}

function isHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isNullableHttpUrl(value: unknown): value is string | null {
  return value === null || isHttpUrl(value);
}

function parseEvidence(value: unknown): ShiguanEvidence[] | null {
  if (!Array.isArray(value)) return null;
  const evidence: ShiguanEvidence[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["source", "realityLabel", "note"]) ||
      !isNonEmptyString(item.source) ||
      !REALITY_LABELS.has(item.realityLabel as RealityLabel) ||
      !isNullableString(item.note)
    ) {
      return null;
    }
    evidence.push({
      source: item.source,
      realityLabel: item.realityLabel as RealityLabel,
      note: item.note,
    });
  }
  return evidence;
}

function parseEvidenceSnapshot(value: unknown): ShiguanEvidenceSnapshot | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "evidenceId",
      "factKey",
      "value",
      "unit",
      "asOf",
      "publishedAt",
      "retrievedAt",
      "sourceUrl",
      "publisher",
      "sourceType",
      "coverage",
      "licenseNote",
      "quality",
      "stance",
      "excerpt",
      "contentHash",
      "confidence",
      "accessUrl",
      "accessMetadata",
      "category",
      "dataScope",
      "subject",
      "jurisdiction",
    ]) ||
    !isNonEmptyString(value.evidenceId) ||
    !isNonEmptyString(value.factKey) ||
    !isJsonValue(value.value) ||
    !isNullableString(value.unit) ||
    !isIsoDateTime(value.asOf) ||
    !isNullableIsoDateTime(value.publishedAt) ||
    !isIsoDateTime(value.retrievedAt) ||
    !isHttpUrl(value.sourceUrl) ||
    !isNonEmptyString(value.publisher) ||
    !SOURCE_TYPES.has(value.sourceType as JinyiweiSourceType) ||
    !isNullableString(value.licenseNote) ||
    !EVIDENCE_QUALITIES.has(value.quality as JinyiweiEvidenceQuality) ||
    !EVIDENCE_STANCES.has(value.stance as JinyiweiEvidenceStance) ||
    !isNonEmptyString(value.excerpt) ||
    typeof value.contentHash !== "string" ||
    !SHA256.test(value.contentHash) ||
    typeof value.confidence !== "number" ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    !isNullableHttpUrl(value.accessUrl) ||
    !FACT_CATEGORIES.has(value.category as JinyiweiFactCategory) ||
    !DATA_SCOPES.has(value.dataScope as JinyiweiDataScope) ||
    !isNonEmptyString(value.subject) ||
    !isNullableString(value.jurisdiction)
  ) {
    return null;
  }
  const coverage = value.coverage === null
    ? null
    : parseStringArray(value.coverage);
  if (
    coverage === null && value.coverage !== null ||
    value.accessMetadata !== null &&
      (!isRecord(value.accessMetadata) ||
        !Object.values(value.accessMetadata).every(isJsonValue))
  ) {
    return null;
  }
  return {
    evidenceId: value.evidenceId,
    factKey: value.factKey,
    value: value.value,
    unit: value.unit,
    asOf: value.asOf,
    publishedAt: value.publishedAt,
    retrievedAt: value.retrievedAt,
    sourceUrl: value.sourceUrl,
    publisher: value.publisher,
    sourceType: value.sourceType as JinyiweiSourceType,
    coverage,
    licenseNote: value.licenseNote,
    quality: value.quality as JinyiweiEvidenceQuality,
    stance: value.stance as JinyiweiEvidenceStance,
    excerpt: value.excerpt,
    contentHash: value.contentHash,
    confidence: value.confidence,
    accessUrl: value.accessUrl,
    accessMetadata: value.accessMetadata as { [key: string]: JsonValue } | null,
    category: value.category as JinyiweiFactCategory,
    dataScope: value.dataScope as JinyiweiDataScope,
    subject: value.subject,
    jurisdiction: value.jurisdiction,
  };
}

function parseEvidenceReferences(value: unknown): ShiguanEvidenceReference[] | null {
  if (!Array.isArray(value)) return null;
  const references: ShiguanEvidenceReference[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, [
        "packId",
        "investigationId",
        "evidenceId",
        "ordinal",
        "snapshotHash",
        "snapshot",
      ]) ||
      !isNonEmptyString(item.packId) ||
      !isNonEmptyString(item.investigationId) ||
      !isNonEmptyString(item.evidenceId) ||
      !isNonNegativeInteger(item.ordinal) ||
      typeof item.snapshotHash !== "string" ||
      !SHA256.test(item.snapshotHash)
    ) {
      return null;
    }
    const snapshot = parseEvidenceSnapshot(item.snapshot);
    if (snapshot === null || snapshot.evidenceId !== item.evidenceId) {
      return null;
    }
    references.push({
      packId: item.packId,
      investigationId: item.investigationId,
      evidenceId: item.evidenceId,
      ordinal: item.ordinal,
      snapshotHash: item.snapshotHash,
      snapshot,
    });
  }
  return references;
}

function parseReviewStatus(value: unknown): ShiguanReviewStatus | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["status", "reviewedAt", "note"]) ||
    !REVIEW_STATUSES.has(value.status as ReviewStatusValue) ||
    !isIsoDateTime(value.reviewedAt) ||
    !isNullableString(value.note)
  ) {
    return null;
  }
  return {
    status: value.status as ReviewStatusValue,
    reviewedAt: value.reviewedAt,
    note: value.note,
  };
}

function parseNullableReviewStatus(
  value: unknown,
): ShiguanReviewStatus | null | undefined {
  if (value === null) return null;
  return parseReviewStatus(value) ?? undefined;
}

function parseArchiveDecision(value: unknown): ArchiveDecision | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["decision", "decidedAt"]) ||
    !ARCHIVE_DECISIONS.has(value.decision as ArchiveDecisionValue) ||
    !isIsoDateTime(value.decidedAt)
  ) {
    return null;
  }
  return {
    decision: value.decision as ArchiveDecisionValue,
    decidedAt: value.decidedAt,
  };
}

function parseNullableArchiveDecision(value: unknown): ArchiveDecision | null | undefined {
  if (value === null) return null;
  return parseArchiveDecision(value) ?? undefined;
}

function parseArchive(value: unknown): ShiguanArchive | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "id",
      "type",
      "title",
      "content",
      "matterType",
      "department",
      "relatedArchiveIds",
      "evidence",
      "createdAt",
      "lessonsLearned",
      "pitfalls",
      "sourceKind",
      "sourceText",
      "participatingDepartments",
      "replyProcess",
      "replyConclusion",
      "replyTime",
      "respondent",
      "reviewStatus",
      "decisionStatus",
      "evidenceReferences",
    ]) ||
    (value.type !== "MEMORIAL" && value.type !== "REPLY") ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.content) ||
    !isNonEmptyString(value.matterType) ||
    !isNonEmptyString(value.department) ||
    !isIsoDateTime(value.createdAt) ||
    !isNullableString(value.lessonsLearned) ||
    !isNullableString(value.pitfalls)
  ) {
    return null;
  }
  const relatedArchiveIds = parseStringArray(value.relatedArchiveIds);
  const evidence = parseEvidence(value.evidence);
  const evidenceReferences = parseEvidenceReferences(value.evidenceReferences);
  const reviewStatus = parseNullableReviewStatus(value.reviewStatus);
  const decisionStatus = parseNullableArchiveDecision(value.decisionStatus);
  const decisionMatchesArchiveType = decisionStatus === null ||
    (value.type === "MEMORIAL" &&
      (decisionStatus?.decision === "APPROVED" || decisionStatus?.decision === "REJECTED")) ||
    (value.type === "REPLY" &&
      (decisionStatus?.decision === "ADOPTED" ||
        decisionStatus?.decision === "RETURNED_FOR_RECONSIDERATION"));
  if (
    relatedArchiveIds === null ||
    evidence === null ||
    evidenceReferences === null ||
    reviewStatus === undefined ||
    decisionStatus === undefined ||
    !decisionMatchesArchiveType
  ) {
    return null;
  }

  let sourceKind: ShiguanArchive["sourceKind"] = null;
  let sourceText: string | null = null;
  let participatingDepartments: string[] | null = null;
  let replyProcess: string | null = null;
  let replyConclusion: string | null = null;
  let replyTime: string | null = null;
  let respondent: string | null = null;
  if (value.type === "MEMORIAL") {
    if (
      value.sourceKind !== null ||
      value.sourceText !== null ||
      value.participatingDepartments !== null ||
      value.replyProcess !== null ||
      value.replyConclusion !== null ||
      value.replyTime !== null ||
      value.respondent !== null
    ) {
      return null;
    }
  } else {
    participatingDepartments = parseStringArray(
      value.participatingDepartments,
      { nonEmpty: true },
    );
    if (
      (value.sourceKind !== "DECREE" && value.sourceKind !== "MEMORIAL") ||
      !isNonEmptyString(value.sourceText) ||
      participatingDepartments === null ||
      !isNonEmptyString(value.replyProcess) ||
      !isNonEmptyString(value.replyConclusion) ||
      !isIsoDateTime(value.replyTime) ||
      !isNonEmptyString(value.respondent)
    ) {
      return null;
    }
    sourceKind = value.sourceKind;
    sourceText = value.sourceText;
    replyProcess = value.replyProcess;
    replyConclusion = value.replyConclusion;
    replyTime = value.replyTime;
    respondent = value.respondent;
  }

  return {
    id: value.id,
    type: value.type,
    title: value.title,
    content: value.content,
    matterType: value.matterType,
    department: value.department,
    relatedArchiveIds,
    evidence,
    createdAt: value.createdAt,
    lessonsLearned: value.lessonsLearned,
    pitfalls: value.pitfalls,
    sourceKind,
    sourceText,
    participatingDepartments,
    replyProcess,
    replyConclusion,
    replyTime,
    respondent,
    reviewStatus,
    decisionStatus,
    evidenceReferences,
  };
}

export function parseArchivesPayload(value: unknown): ShiguanArchive[] | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["status", "archives"]) ||
    value.status !== "ok" ||
    !Array.isArray(value.archives)
  ) {
    return null;
  }
  const archives = value.archives.map(parseArchive);
  return archives.every((archive): archive is ShiguanArchive => archive !== null)
    ? archives
    : null;
}

export function parseStatisticsPayload(value: unknown): ShiguanStatistics | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["status", "statistics"]) ||
    value.status !== "ok" ||
    !isRecord(value.statistics)
  ) {
    return null;
  }
  const statistics = value.statistics;
  if (
    !hasExactKeys(statistics, [
      "total",
      "achieved",
      "notAchieved",
      "partial",
      "observing",
      "pendingReview",
      "successRate",
    ]) ||
    !isNonNegativeInteger(statistics.total) ||
    !isNonNegativeInteger(statistics.achieved) ||
    !isNonNegativeInteger(statistics.notAchieved) ||
    !isNonNegativeInteger(statistics.partial) ||
    !isNonNegativeInteger(statistics.observing) ||
    !isNonNegativeInteger(statistics.pendingReview) ||
    (
      statistics.successRate !== null &&
      (
        !Number.isFinite(statistics.successRate) ||
        typeof statistics.successRate !== "number" ||
        statistics.successRate < 0 ||
        statistics.successRate > 1
      )
    )
  ) {
    return null;
  }
  const countedTotal =
    statistics.achieved +
    statistics.notAchieved +
    statistics.partial +
    statistics.observing +
    statistics.pendingReview;
  const denominator =
    statistics.achieved +
    statistics.notAchieved +
    statistics.partial;
  const expectedSuccessRate = denominator === 0
    ? null
    : statistics.achieved / denominator;
  if (
    statistics.total !== countedTotal ||
    (
      expectedSuccessRate === null
        ? statistics.successRate !== null
        : typeof statistics.successRate !== "number" ||
          Math.abs(statistics.successRate - expectedSuccessRate) > 1e-12
    )
  ) {
    return null;
  }
  return {
    total: statistics.total,
    achieved: statistics.achieved,
    notAchieved: statistics.notAchieved,
    partial: statistics.partial,
    observing: statistics.observing,
    pendingReview: statistics.pendingReview,
    successRate: statistics.successRate,
  };
}

export function parseRecallPayload(value: unknown): ShiguanRecallMatch[] | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["status", "matches"]) ||
    value.status !== "ok" ||
    !Array.isArray(value.matches)
  ) {
    return null;
  }
  const matches: ShiguanRecallMatch[] = [];
  for (const item of value.matches) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, [
        "archiveId",
        "matchReason",
        "historicalConclusion",
        "evidenceLabels",
        "reviewStatus",
        "lessonsLearned",
        "pitfalls",
      ]) ||
      !isNonEmptyString(item.archiveId) ||
      !isNonEmptyString(item.matchReason) ||
      !isNonEmptyString(item.historicalConclusion) ||
      !isNullableString(item.lessonsLearned) ||
      !isNullableString(item.pitfalls)
    ) {
      return null;
    }
    const evidenceLabels = parseStringArray(item.evidenceLabels);
    const reviewStatus = parseNullableReviewStatus(item.reviewStatus);
    if (
      evidenceLabels === null ||
      !evidenceLabels.every((label) =>
        REALITY_LABELS.has(label as RealityLabel)
      ) ||
      reviewStatus === undefined
    ) {
      return null;
    }
    matches.push({
      archiveId: item.archiveId,
      matchReason: item.matchReason,
      historicalConclusion: item.historicalConclusion,
      evidenceLabels: evidenceLabels as RealityLabel[],
      reviewStatus,
      lessonsLearned: item.lessonsLearned,
      pitfalls: item.pitfalls,
    });
  }
  return matches;
}

export function parseReviewPayload(value: unknown): ShiguanReviewStatus | null {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["status", "reviewStatus"]) &&
    value.status === "ok"
  )
    ? parseReviewStatus(value.reviewStatus)
    : null;
}

export function parseDecisionPayload(value: unknown): ArchiveDecision | null {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["status", "decisionStatus"]) &&
    value.status === "ok"
  )
    ? parseArchiveDecision(value.decisionStatus)
    : null;
}

const OUTCOME_VALUES = new Set(["ACHIEVED", "PARTIAL", "NOT_ACHIEVED", "OBSERVING"]);
const OUTCOME_EVENT_KINDS = new Set(["RECORDED", "CORRECTED"]);
const OUTCOME_EVENT_ID = /^[0-9a-f]{32}$/u;
const OUTCOME_DIGEST = /^sha256:[0-9a-f]{64}$/u;

const OUTCOME_PROJECTION_KEYS = [
  "eventId",
  "archiveId",
  "eventKind",
  "outcome",
  "sourceType",
  "sourceAuthLevel",
  "occurredAt",
  "recordedAt",
  "archiveDigest",
  "decisionDigest",
  "evidenceBundleDigest",
  "evidenceCount",
  "supersedesEventId",
  "eventDigest",
];

/**
 * 重新校验跨网络边界回来的结果事件。BFF 已经校验过一次，但浏览器这一侧不能
 * 把上游的正确性当作前提；闭合契约在这里再判一次。
 */
function parseOutcomeProjection(value: unknown): ShiguanOutcomeProjection | null {
  if (!isRecord(value) || !hasExactKeys(value, OUTCOME_PROJECTION_KEYS)) {
    return null;
  }
  if (
    typeof value.eventId !== "string" || !OUTCOME_EVENT_ID.test(value.eventId) ||
    typeof value.archiveId !== "string" || value.archiveId.trim().length === 0 ||
    typeof value.eventKind !== "string" || !OUTCOME_EVENT_KINDS.has(value.eventKind) ||
    typeof value.outcome !== "string" || !OUTCOME_VALUES.has(value.outcome) ||
    value.sourceType !== "OWNER_ATTESTATION" ||
    value.sourceAuthLevel !== "AUTHENTICATED_OWNER_ASSERTION" ||
    typeof value.occurredAt !== "string" || value.occurredAt.trim().length === 0 ||
    typeof value.recordedAt !== "string" || value.recordedAt.trim().length === 0 ||
    typeof value.archiveDigest !== "string" || !OUTCOME_DIGEST.test(value.archiveDigest) ||
    typeof value.decisionDigest !== "string" || !OUTCOME_DIGEST.test(value.decisionDigest) ||
    typeof value.evidenceBundleDigest !== "string" ||
    !OUTCOME_DIGEST.test(value.evidenceBundleDigest) ||
    !Number.isInteger(value.evidenceCount) || (value.evidenceCount as number) < 1 ||
    !(value.supersedesEventId === null ||
      (typeof value.supersedesEventId === "string" &&
        OUTCOME_EVENT_ID.test(value.supersedesEventId))) ||
    typeof value.eventDigest !== "string" || !OUTCOME_DIGEST.test(value.eventDigest)
  ) {
    return null;
  }
  return {
    eventId: value.eventId,
    archiveId: value.archiveId,
    eventKind: value.eventKind as ShiguanOutcomeProjection["eventKind"],
    outcome: value.outcome as ShiguanOutcomeProjection["outcome"],
    sourceType: "OWNER_ATTESTATION",
    sourceAuthLevel: "AUTHENTICATED_OWNER_ASSERTION",
    occurredAt: value.occurredAt,
    recordedAt: value.recordedAt,
    archiveDigest: value.archiveDigest,
    decisionDigest: value.decisionDigest,
    evidenceBundleDigest: value.evidenceBundleDigest,
    evidenceCount: value.evidenceCount as number,
    supersedesEventId: value.supersedesEventId as string | null,
    eventDigest: value.eventDigest,
  };
}

export function parseOutcomeRecordPayload(value: unknown): ShiguanOutcomeProjection | null {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["status", "outcome"]) &&
    value.status === "ok"
  )
    ? parseOutcomeProjection(value.outcome)
    : null;
}

export function parseOutcomeListPayload(value: unknown): ShiguanOutcomePage | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["status", "page"]) ||
    value.status !== "ok" ||
    !isRecord(value.page) ||
    !hasExactKeys(value.page, ["items", "nextCursor"]) ||
    !Array.isArray(value.page.items) ||
    !(value.page.nextCursor === null || (typeof value.page.nextCursor === "string" && value.page.nextCursor.trim().length > 0 && value.page.nextCursor.length <= 256))
  ) {
    return null;
  }
  const items: ShiguanOutcomeProjection[] = [];
  for (const item of value.page.items) {
    const parsed = parseOutcomeProjection(item);
    if (parsed === null) {
      return null;
    }
    items.push(parsed);
  }
  return { items, nextCursor: value.page.nextCursor as string | null };
}

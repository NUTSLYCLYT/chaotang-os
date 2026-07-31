export type QintianSubjectKind = "DECREE" | "DRAFT" | "REPLY";
export type QintianConfidence = "LOW" | "MEDIUM" | "HIGH";
export type QintianScenarioKind = "OPTIMISTIC" | "BASELINE" | "PESSIMISTIC";
export type QintianTriggerStatus = "PENDING" | "REVIEWED";
export type QintianReviewDecision = "KEEP" | "INVALIDATE" | "REQUEST_RERUN" | "ESCALATE_TO_CHANCELLOR";

export interface QintianSubject {
  kind: QintianSubjectKind;
  id: string;
  title: string;
  content: string;
}
export interface QintianEvidenceRef {
  id: string;
  summary: string;
  source: string;
  asOf: string | null;
}
export interface QintianProbabilityInterval { lower: number; upper: number }
export interface QintianScenario {
  kind: QintianScenarioKind;
  summary: string;
  impact: string;
  timeWindow: string;
  probabilityInterval: QintianProbabilityInterval | null;
  counterfactual: string;
}
export interface QintianAssumption { statement: string; critical: boolean }
export interface QintianTrigger {
  id: string;
  signal: string;
  threshold: string;
  window: string;
  reviewAt: string;
  status: QintianTriggerStatus;
}
export interface QintianForecast {
  id: string;
  createdAt: string;
  subject: QintianSubject;
  question: string;
  judgment: string;
  status: "COMPLETED";
  confidence: QintianConfidence;
  confidenceBasis: string;
  reviewAt: string;
  methodologyVersion: string;
  scenarios: [QintianScenario, QintianScenario, QintianScenario];
  assumptions: QintianAssumption[];
  evidenceRefs: QintianEvidenceRef[];
  triggers: QintianTrigger[];
  reviews: QintianReview[];
  humanSignoffRequired: boolean;
  disclaimer: string;
}
export interface QintianPendingTrigger extends QintianTrigger {
  forecastId: string;
  forecastSummary: string;
  isDue: boolean;
  subject: QintianSubject;
  contextRef: Pick<QintianSubject, "kind" | "id">;
}
export interface QintianReview {
  id: string;
  forecastId: string;
  triggerId: string;
  decision: QintianReviewDecision;
  observation: string;
  judgmentInvalidated: boolean;
  createdAt: string;
}
export interface QintianConsultResponse { status: "ok"; consultant: "钦天监"; reply: string }

type RecordValue = Record<string, unknown>;
const SUBJECT_KINDS = new Set<QintianSubjectKind>(["DECREE", "DRAFT", "REPLY"]);
const CONFIDENCES = new Set<QintianConfidence>(["LOW", "MEDIUM", "HIGH"]);
const SCENARIO_KINDS = new Set<QintianScenarioKind>(["OPTIMISTIC", "BASELINE", "PESSIMISTIC"]);
const TRIGGER_STATUSES = new Set<QintianTriggerStatus>(["PENDING", "REVIEWED"]);
const REVIEW_DECISIONS = new Set<QintianReviewDecision>(["KEEP", "INVALIDATE", "REQUEST_RERUN", "ESCALATE_TO_CHANCELLOR"]);

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}
function exact(value: RecordValue, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && [...keys].sort().every((key, index) => key === actual[index]);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function date(value: unknown): value is string {
  return text(value) && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}
function nullableDate(value: unknown): value is string | null {
  return value === null || date(value);
}

function parseSubject(value: unknown): QintianSubject | null {
  const item = record(value);
  if (!item || !exact(item, ["kind", "id", "title", "content"]) ||
      !SUBJECT_KINDS.has(item.kind as QintianSubjectKind) ||
      !text(item.id) || !text(item.title) || !text(item.content)) return null;
  return { kind: item.kind as QintianSubjectKind, id: item.id, title: item.title, content: item.content };
}
function parseEvidence(value: unknown): QintianEvidenceRef | null {
  const item = record(value);
  if (!item || !exact(item, ["id", "summary", "source", "as_of"]) ||
      !text(item.id) || !text(item.summary) || !text(item.source) || !nullableDate(item.as_of)) return null;
  return { id: item.id, summary: item.summary, source: item.source, asOf: item.as_of };
}
function parseScenario(value: unknown): QintianScenario | null {
  const item = record(value);
  if (!item || !exact(item, ["kind", "summary", "impact", "time_window", "probability_interval", "counterfactual"]) ||
      !SCENARIO_KINDS.has(item.kind as QintianScenarioKind) || !text(item.summary) || !text(item.impact) ||
      !text(item.time_window) || !text(item.counterfactual)) return null;
  let interval: QintianProbabilityInterval | null = null;
  if (item.probability_interval !== null) {
    const raw = record(item.probability_interval);
    if (!raw || !exact(raw, ["lower", "upper"]) || typeof raw.lower !== "number" ||
        typeof raw.upper !== "number" || !Number.isFinite(raw.lower) || !Number.isFinite(raw.upper) ||
        raw.lower < 0 || raw.upper > 1 || raw.lower > raw.upper) return null;
    interval = { lower: raw.lower, upper: raw.upper };
  }
  return {
    kind: item.kind as QintianScenarioKind, summary: item.summary, impact: item.impact,
    timeWindow: item.time_window, probabilityInterval: interval, counterfactual: item.counterfactual,
  };
}
function parseAssumption(value: unknown): QintianAssumption | null {
  const item = record(value);
  return item && exact(item, ["statement", "critical"]) && text(item.statement) && typeof item.critical === "boolean"
    ? { statement: item.statement, critical: item.critical } : null;
}
function parseTrigger(value: unknown): QintianTrigger | null {
  const item = record(value);
  if (!item || !exact(item, ["id", "signal", "threshold", "window", "review_at", "status"]) ||
      !text(item.id) || !text(item.signal) || !text(item.threshold) || !text(item.window) ||
      !date(item.review_at) || !TRIGGER_STATUSES.has(item.status as QintianTriggerStatus)) return null;
  return {
    id: item.id, signal: item.signal, threshold: item.threshold, window: item.window,
    reviewAt: item.review_at, status: item.status as QintianTriggerStatus,
  };
}

export function parseQintianConsultResponse(value: unknown): QintianConsultResponse | null {
  const item = record(value);
  return item && exact(item, ["status", "consultant", "reply"]) &&
    item.status === "ok" && item.consultant === "钦天监" && text(item.reply)
    ? { status: "ok", consultant: "钦天监", reply: item.reply } : null;
}

export function parseQintianForecast(value: unknown): QintianForecast | null {
  const item = record(value);
  const keys = [
    "id", "created_at", "subject", "question", "judgment", "status", "confidence",
    "confidence_basis", "review_at", "methodology_version", "scenarios", "assumptions",
    "evidence_refs", "triggers", "reviews", "human_signoff_required", "disclaimer",
  ];
  if (!item || !exact(item, keys) || !text(item.id) || !date(item.created_at) ||
      !text(item.question) || !text(item.judgment) || item.status !== "COMPLETED" ||
      !CONFIDENCES.has(item.confidence as QintianConfidence) || !text(item.confidence_basis) ||
      !date(item.review_at) || !text(item.methodology_version) || !Array.isArray(item.scenarios) ||
      item.scenarios.length !== 3 || !Array.isArray(item.assumptions) || !Array.isArray(item.evidence_refs) ||
      !Array.isArray(item.triggers) || !Array.isArray(item.reviews) ||
      typeof item.human_signoff_required !== "boolean" ||
      !text(item.disclaimer)) return null;
  const subject = parseSubject(item.subject);
  const scenarios = item.scenarios.map(parseScenario);
  const assumptions = item.assumptions.map(parseAssumption);
  const evidenceRefs = item.evidence_refs.map(parseEvidence);
  const triggers = item.triggers.map(parseTrigger);
  const reviews = item.reviews.map(parseQintianReview);
  if (!subject || scenarios.some((entry) => entry === null) ||
      scenarios.map((entry) => entry?.kind).join(",") !== "OPTIMISTIC,BASELINE,PESSIMISTIC" ||
      assumptions.some((entry) => entry === null) || evidenceRefs.some((entry) => entry === null) ||
      triggers.some((entry) => entry === null) || reviews.some((entry) => entry === null)) return null;
  return {
    id: item.id, createdAt: item.created_at, subject, question: item.question, judgment: item.judgment,
    status: "COMPLETED", confidence: item.confidence as QintianConfidence,
    confidenceBasis: item.confidence_basis, reviewAt: item.review_at,
    methodologyVersion: item.methodology_version,
    scenarios: scenarios as [QintianScenario, QintianScenario, QintianScenario],
    assumptions: assumptions as QintianAssumption[], evidenceRefs: evidenceRefs as QintianEvidenceRef[],
    triggers: triggers as QintianTrigger[], reviews: reviews as QintianReview[],
    humanSignoffRequired: item.human_signoff_required,
    disclaimer: item.disclaimer,
  };
}

export function parseQintianForecastList(value: unknown): { items: QintianForecast[] } | null {
  const item = record(value);
  if (!item || !exact(item, ["items"]) || !Array.isArray(item.items)) return null;
  const items = item.items.map(parseQintianForecast);
  return items.some((entry) => entry === null) ? null : { items: items as QintianForecast[] };
}

export function parseQintianPendingTriggers(value: unknown): { items: QintianPendingTrigger[] } | null {
  const container = record(value);
  if (!container || !exact(container, ["items"]) || !Array.isArray(container.items)) return null;
  const items: QintianPendingTrigger[] = [];
  for (const valueItem of container.items) {
    const item = record(valueItem);
    if (!item || !exact(item, [
      "id", "signal", "threshold", "window", "review_at", "status",
      "forecast_id", "forecast_summary", "is_due", "subject", "context_ref",
    ]) || !text(item.forecast_id) || !text(item.forecast_summary) || typeof item.is_due !== "boolean") return null;
    const subject = parseSubject(item.subject);
    const contextRef = record(item.context_ref);
    if (!subject || !contextRef || !exact(contextRef, ["kind", "id"]) ||
        !SUBJECT_KINDS.has(contextRef.kind as QintianSubjectKind) || !text(contextRef.id) ||
        contextRef.kind !== subject.kind || contextRef.id !== subject.id) return null;
    const triggerRaw = {
      id: item.id,
      signal: item.signal,
      threshold: item.threshold,
      window: item.window,
      review_at: item.review_at,
      status: item.status,
    };
    const trigger = parseTrigger(triggerRaw);
    if (!trigger || trigger.status !== "PENDING") return null;
    items.push({
      ...trigger,
      forecastId: item.forecast_id,
      forecastSummary: item.forecast_summary,
      isDue: item.is_due,
      subject,
      contextRef: {
        kind: contextRef.kind as QintianSubjectKind,
        id: contextRef.id,
      },
    });
  }
  return { items };
}

export function parseQintianReview(value: unknown): QintianReview | null {
  const item = record(value);
  if (!item || !exact(item, [
    "id", "forecast_id", "trigger_id", "decision", "observation",
    "judgment_invalidated", "created_at",
  ]) || !text(item.id) || !text(item.forecast_id) || !text(item.trigger_id) ||
      !REVIEW_DECISIONS.has(item.decision as QintianReviewDecision) ||
      !text(item.observation) || typeof item.judgment_invalidated !== "boolean" ||
      !date(item.created_at)) return null;
  return {
    id: item.id, forecastId: item.forecast_id, triggerId: item.trigger_id,
    decision: item.decision as QintianReviewDecision, observation: item.observation,
    judgmentInvalidated: item.judgment_invalidated, createdAt: item.created_at,
  };
}

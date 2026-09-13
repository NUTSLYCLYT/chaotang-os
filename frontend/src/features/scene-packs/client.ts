import type { SceneMission, SceneMissionStage, ScenePack, SceneRiskGrade, SceneRun } from "./types";
import { isSceneId } from "./sceneBoardController.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class SceneRequestError extends Error {
  status: number;
  constructor(status = 0) { super("scene_request_unavailable"); this.status = status; }
}

// Applies only to board reads/updates, not scene generation. A deadline reports
// an unknown write result; it never retries or claims to cancel server work.
async function readBoardResponse(url: string, init: RequestInit = {}): Promise<{response: Response; body: unknown}> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const parent = init.signal;
  parent?.addEventListener("abort", abort, {once: true});
  const timer = setTimeout(abort, 15_000);
  let rejectOnAbort: () => void = () => {};
  try {
    return await new Promise((resolve, reject) => {
      rejectOnAbort = () => reject(new SceneRequestError());
      controller.signal.addEventListener("abort", rejectOnAbort, {once: true});
      if (parent?.aborted) controller.abort();
      if (controller.signal.aborted) return;
      void fetch(url, {...init, signal: controller.signal})
        .then(async response => ({response, body: response.ok ? await readJson(response) : null}))
        .then(resolve, () => reject(new SceneRequestError()));
    });
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", rejectOnAbort);
  }
}

const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text);
const grade = (v: unknown) => v === "low" || v === "medium" || v === "high";
const stage = (v: unknown) => ["todo", "in_progress", "awaiting_input", "blocked", "done"].includes(String(v));
const TARGET_TRUTH_PACK = "single-product-export-diagnosis";
const TARGET_DETAIL_KEYS = new Set(["demo", "canProceed", "truthContract", "verificationGaps", "blockedReason"]);
const TARGET_FORBIDDEN_FIELDS = [
  "leadScore", "authenticityScore", "fitScore", "urgencyScore", "paymentRiskScore",
  "conflicts", "recommendedReply", "followUpPlan", "recommendedMarkets",
] as const;
const exactObjectKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));

function targetTruthValue(v: Record<string, unknown>): boolean {
  if (v.packSlug !== TARGET_TRUTH_PACK) return true;
  if (!isRecord(v.boardMission) || typeof v.boardMission.stage !== "string"
    || !isRecord(v.details) || Object.keys(v.details).some(key => !TARGET_DETAIL_KEYS.has(key))
    || TARGET_FORBIDDEN_FIELDS.some(key => key in v)) return false;
  const common = v.confidence === null && v.opportunityGrade === "low" && v.canProceed === false;
  const currentDetails = exactObjectKeys(v.details, ["demo", "canProceed", "truthContract", "verificationGaps", "blockedReason"])
    && typeof v.details.demo === "boolean" && v.details.canProceed === false
    && v.details.truthContract === "mingshuo.scene.precheck.v1"
    && strings(v.details.verificationGaps);
  return common && (
    (currentDetails && v.status === "completed" && v.verdict === "PRECHECK_ONLY"
      && v.riskGrade === "medium" && v.boardMission.stage === "awaiting_input"
      && v.details.blockedReason === "verification_required")
    || (currentDetails && v.status === "blocked" && v.verdict === "BLOCKED"
      && v.riskGrade === "high" && v.boardMission.stage === "blocked"
      && v.details.blockedReason === "missing_or_placeholder_inputs")
    || (exactObjectKeys(v.details, ["demo", "canProceed", "blockedReason"])
      && v.details.demo === false && v.details.canProceed === false
      && v.details.blockedReason === "legacy_unverified"
      && v.status === "blocked" && v.verdict === "LEGACY_UNVERIFIED"
      && v.riskGrade === "high" && v.boardMission.stage === "blocked")
  );
}

function missionValue(v: unknown): v is SceneMission {
  return isRecord(v) && isSceneId(v.missionId) && isSceneId(v.runId) && isSceneId(v.packSlug)
    && [v.packName, v.title, v.owner, v.nextMilestone, v.dueAt, v.createdAt, v.updatedAt].every(text)
    && typeof v.stage === "string" && stage(v.stage) && grade(v.riskGrade) && typeof v.pinned === "boolean";
}
function runValue(v: unknown, requireS4Metadata = false): v is SceneRun {
  return isRecord(v) && isSceneId(v.runId) && isSceneId(v.missionId) && isSceneId(v.packSlug)
    && typeof v.status === "string" && ["created", "running", "completed", "blocked", "failed"].includes(v.status)
    && [v.verdict, v.verdictText, v.summaryForUser].every(text)
    && ((v.packSlug === "single-product-export-diagnosis" && v.confidence === null)
      || (v.packSlug !== "single-product-export-diagnosis" && typeof v.confidence === "number"
        && Number.isFinite(v.confidence) && v.confidence >= 0 && v.confidence <= 100))
    && grade(v.riskGrade) && grade(v.opportunityGrade) && typeof v.canProceed === "boolean" && typeof v.demo === "boolean"
    && strings(v.missingItems) && isRecord(v.details)
    && Array.isArray(v.nextActions) && v.nextActions.every(a => isRecord(a) && [a.title, a.ownerDept, a.dueHint].every(text)
      && typeof a.priority === "string" && ["P0", "P1", "P2"].includes(a.priority))
    && Array.isArray(v.evidenceRefs) && v.evidenceRefs.every(e => isRecord(e)
      && [e.claim, e.sourceLabel, e.sourceType, e.capturedAt].every(text) && grade(e.reliability))
    && targetTruthValue(v)
    && (!requireS4Metadata || v.packSlug !== S4_PACK_SLUG || v.status !== "completed"
      || parseS4RuleAnalysis(v).state === "available");
}

export const S4_PACK_SLUG = "proposal-quotation-tender";
const S4_CATEGORIES = ["warranty", "penalty", "bond", "custom", "acceptance"] as const;
type S4Category = typeof S4_CATEGORIES[number];
type S4Anchor = { category: S4Category; field: "customerRequirement" | "rfqFile"; excerpt: string };

export function s4CategoryText(category: S4Category) {
  return ({warranty: "质保/保修提示", penalty: "违约/罚则提示", bond: "保证金/保函提示", custom: "定制/非标提示", acceptance: "验收提示"} as const)[category];
}
export function s4FieldText(field: S4Anchor["field"]) {
  return field === "customerRequirement" ? "客户需求" : "询价资料";
}
export type S4RuleAnalysis =
  | { state: "not-s4" | "unavailable" | "legacy-stub" }
  | { state: "available"; ruleVersion: "s4-keyword-v1"; matchedCategories: S4Category[]; anchors: S4Anchor[] };

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
}
function isS4Category(value: unknown): value is S4Category {
  return typeof value === "string" && S4_CATEGORIES.includes(value as S4Category);
}
function codePointLength(value: string) {
  return Array.from(value).length;
}

/** Parses only persisted S4 keyword metadata; it never derives a rule conclusion from material text. */
export function parseS4RuleAnalysis(value: unknown): S4RuleAnalysis {
  if (!isRecord(value) || value.packSlug !== S4_PACK_SLUG) return { state: "not-s4" };
  if (value.status === "blocked" && value.verdict === "STUBBED") return { state: "legacy-stub" };
  if (value.status !== "completed") return { state: "unavailable" };
  const details = value.details;
  if (!isRecord(details) || !isRecord(details.ruleAnalysis)) return { state: "unavailable" };
  const ruleAnalysis = details.ruleAnalysis;
  if (!exactKeys(ruleAnalysis, ["ruleVersion", "matchedCategories", "anchors"])
    || ruleAnalysis.ruleVersion !== "s4-keyword-v1"
    || !Array.isArray(ruleAnalysis.matchedCategories)
    || !Array.isArray(ruleAnalysis.anchors)) return { state: "unavailable" };
  const matchedCategories = ruleAnalysis.matchedCategories;
  if (!matchedCategories.every(isS4Category)
    || new Set(matchedCategories).size !== matchedCategories.length
    || matchedCategories.some((category, index) => index > 0
      && S4_CATEGORIES.indexOf(category) <= S4_CATEGORIES.indexOf(matchedCategories[index - 1] as S4Category))) return { state: "unavailable" };
  const anchors: S4Anchor[] = [];
  for (const anchor of ruleAnalysis.anchors) {
    if (!isRecord(anchor) || !exactKeys(anchor, ["category", "field", "excerpt"])
      || !isS4Category(anchor.category)
      || (anchor.field !== "customerRequirement" && anchor.field !== "rfqFile")
      || !text(anchor.excerpt) || codePointLength(anchor.excerpt) > 240) return { state: "unavailable" };
    anchors.push({category: anchor.category, field: anchor.field, excerpt: anchor.excerpt});
  }
  if (anchors.length > 10
    || new Set(anchors.map(anchor => anchor.category + ":" + anchor.field)).size !== anchors.length
    || new Set(anchors.map(anchor => anchor.category)).size !== matchedCategories.length
    || anchors.some(anchor => !matchedCategories.includes(anchor.category))) return { state: "unavailable" };
  const expectedRisk = matchedCategories.length >= 3 ? "high" : matchedCategories.length ? "medium" : "low";
  if (value.riskGrade !== expectedRisk) return { state: "unavailable" };
  return {state: "available", ruleVersion: "s4-keyword-v1", matchedCategories: [...matchedCategories], anchors};
}

export async function fetchScenePacks(): Promise<ScenePack[]> {
  const response = await fetch("/api/court/scene-packs", { cache: "no-store" });
  const body = await readJson(response);
  if (!response.ok || !isRecord(body) || !Array.isArray(body.scenePacks)) {
    throw new Error("scene_packs_unavailable");
  }
  return body.scenePacks as ScenePack[];
}

export async function fetchScenePack(slug: string): Promise<ScenePack> {
  const response = await fetch(`/api/court/scene-packs/${encodeURIComponent(slug)}`, { cache: "no-store" });
  const body = await readJson(response);
  if (!response.ok || !isRecord(body) || !isRecord(body.scenePack)) {
    throw new Error("scene_pack_unavailable");
  }
  return body.scenePack as unknown as ScenePack;
}

function normalizeNfc(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC");
  if (Array.isArray(value)) return value.map(normalizeNfc);
  if (isRecord(value)) return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, normalizeNfc(value[key])]),
  );
  return value;
}

export function canonicalSceneRequest(
  packSlug: string,
  inputs: Record<string, unknown>,
  demo: boolean,
): string {
  return JSON.stringify(normalizeNfc({
    operation: "create_scene_run",
    packSlug,
    demo,
    inputs,
    attachments: [],
    canonicalizationVersion: "scene-request-v1",
  }));
}

export async function sceneRequestFingerprint(
  packSlug: string,
  inputs: Record<string, unknown>,
  demo: boolean,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalSceneRequest(packSlug, inputs, demo)),
  );
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function fetchScenePrincipalMarker(): Promise<string> {
  const response = await fetch("/api/auth/me", {cache: "no-store"});
  const body = response.ok ? await readJson(response) : null;
  if (!isRecord(body) || !isRecord(body.user) || !text(body.user.id)) {
    throw new SceneRequestError(response.status);
  }
  return body.user.id;
}

export function scenePrincipalUnchanged(
  submittedPrincipal: string,
  currentPrincipal: string | null,
  responsePrincipal: string,
): boolean {
  return submittedPrincipal === currentPrincipal && submittedPrincipal === responsePrincipal;
}

export async function runScenePack(
  packSlug: string,
  inputs: Record<string, unknown>,
  demo: boolean,
  requestKey: string,
): Promise<SceneRun> {
  const response = await fetch("/api/court/scene-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ packSlug, inputs, attachments: [], demo, requestKey }),
  });
  if (!response.ok) throw new SceneRequestError(response.status);
  const body = await readJson(response);
  if (!isRecord(body) || !runValue(body.sceneRun, true)
    || body.sceneRun.packSlug !== packSlug || body.sceneRun.demo !== demo) {
    throw new SceneRequestError(response.status);
  }
  return body.sceneRun;
}

export async function fetchSceneRun(runId: string, signal?: AbortSignal): Promise<SceneRun> {
  if (!isSceneId(runId)) throw new SceneRequestError();
  const {response, body} = await readBoardResponse(`/api/court/scene-runs/${encodeURIComponent(runId)}`, { cache: "no-store", signal });
  if (!response.ok || !isRecord(body) || !runValue(body.sceneRun) || body.sceneRun.runId !== runId) {
    throw new SceneRequestError(response.status);
  }
  return body.sceneRun;
}

export async function fetchSceneMissions(filter: {
  stage?: SceneMissionStage;
  riskGrade?: SceneRiskGrade;
  packSlug?: string;
} = {}, signal?: AbortSignal): Promise<SceneMission[]> {
  const params = new URLSearchParams();
  if (filter.stage) params.set("stage", filter.stage);
  if (filter.riskGrade) params.set("risk_grade", filter.riskGrade);
  if (filter.packSlug) params.set("pack_slug", filter.packSlug);
  const query = params.toString();
  const {response, body} = await readBoardResponse(`/api/court/military-office/missions${query ? `?${query}` : ""}`, { cache: "no-store", signal });
  if (!response.ok || !isRecord(body) || !Array.isArray(body.missions) || !body.missions.every(missionValue)
    || new Set(body.missions.map(m => m.missionId)).size !== body.missions.length) {
    throw new SceneRequestError(response.status);
  }
  return body.missions;
}

export async function updateSceneMission(
  missionId: string,
  patch: Partial<Pick<SceneMission, "stage" | "nextMilestone" | "owner" | "pinned">>,
): Promise<SceneMission> {
  if (!isSceneId(missionId)) throw new SceneRequestError();
  const {response, body} = await readBoardResponse(`/api/court/military-office/missions/${encodeURIComponent(missionId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok || !isRecord(body) || !missionValue(body.mission) || body.mission.missionId !== missionId
    || (patch.stage !== undefined && body.mission.stage !== patch.stage)) {
    throw new SceneRequestError(response.status);
  }
  return body.mission;
}

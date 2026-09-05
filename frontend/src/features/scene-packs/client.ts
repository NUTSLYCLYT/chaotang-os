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
function missionValue(v: unknown): v is SceneMission {
  return isRecord(v) && isSceneId(v.missionId) && isSceneId(v.runId) && isSceneId(v.packSlug)
    && [v.packName, v.title, v.owner, v.nextMilestone, v.dueAt, v.createdAt, v.updatedAt].every(text)
    && typeof v.stage === "string" && stage(v.stage) && grade(v.riskGrade) && typeof v.pinned === "boolean";
}
function runValue(v: unknown): v is SceneRun {
  return isRecord(v) && isSceneId(v.runId) && isSceneId(v.missionId) && isSceneId(v.packSlug)
    && typeof v.status === "string" && ["created", "running", "completed", "blocked", "failed"].includes(v.status)
    && [v.verdict, v.verdictText, v.summaryForUser].every(text)
    && typeof v.confidence === "number" && Number.isFinite(v.confidence) && v.confidence >= 0 && v.confidence <= 100
    && grade(v.riskGrade) && grade(v.opportunityGrade) && typeof v.canProceed === "boolean" && typeof v.demo === "boolean"
    && strings(v.missingItems) && isRecord(v.details)
    && Array.isArray(v.nextActions) && v.nextActions.every(a => isRecord(a) && [a.title, a.ownerDept, a.dueHint].every(text)
      && typeof a.priority === "string" && ["P0", "P1", "P2"].includes(a.priority))
    && Array.isArray(v.evidenceRefs) && v.evidenceRefs.every(e => isRecord(e)
      && [e.claim, e.sourceLabel, e.sourceType, e.capturedAt].every(text) && grade(e.reliability));
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

export async function runScenePack(
  packSlug: string,
  inputs: Record<string, unknown>,
  demo = false,
): Promise<SceneRun> {
  const response = await fetch("/api/court/scene-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ packSlug, inputs, attachments: [], demo }),
  });
  const body = await readJson(response);
  if (!response.ok || !isRecord(body) || !isRecord(body.sceneRun)) {
    throw new Error("scene_run_failed");
  }
  return body.sceneRun as unknown as SceneRun;
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

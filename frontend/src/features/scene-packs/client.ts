import type { SceneMission, SceneMissionStage, ScenePack, SceneRiskGrade, SceneRun } from "./types";

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

function expectArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
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

export async function fetchSceneRun(runId: string): Promise<SceneRun> {
  const response = await fetch(`/api/court/scene-runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
  const body = await readJson(response);
  if (!response.ok || !isRecord(body) || !isRecord(body.sceneRun)) {
    throw new Error("scene_run_unavailable");
  }
  return body.sceneRun as unknown as SceneRun;
}

export async function fetchSceneMissions(filter: {
  stage?: SceneMissionStage;
  riskGrade?: SceneRiskGrade;
  packSlug?: string;
} = {}): Promise<SceneMission[]> {
  const params = new URLSearchParams();
  if (filter.stage) params.set("stage", filter.stage);
  if (filter.riskGrade) params.set("risk_grade", filter.riskGrade);
  if (filter.packSlug) params.set("pack_slug", filter.packSlug);
  const query = params.toString();
  const response = await fetch(`/api/court/military-office/missions${query ? `?${query}` : ""}`, { cache: "no-store" });
  const body = await readJson(response);
  if (!response.ok || !isRecord(body) || !Array.isArray(body.missions)) {
    throw new Error("scene_missions_unavailable");
  }
  return expectArray<SceneMission>(body.missions);
}

export async function updateSceneMission(
  missionId: string,
  patch: Partial<Pick<SceneMission, "stage" | "nextMilestone" | "owner" | "pinned">>,
): Promise<SceneMission> {
  const response = await fetch(`/api/court/military-office/missions/${encodeURIComponent(missionId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await readJson(response);
  if (!response.ok || !isRecord(body) || !isRecord(body.mission)) {
    throw new Error("scene_mission_update_failed");
  }
  return body.mission as unknown as SceneMission;
}

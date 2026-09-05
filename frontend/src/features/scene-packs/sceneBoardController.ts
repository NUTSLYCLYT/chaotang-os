import type { SceneMission, SceneRun } from "./types.ts";

export const BOARD_PATH = "/junjichu/scene-board";
export type BoardPath = typeof BOARD_PATH | `${typeof BOARD_PATH}?${string}`;
export type BoardFilter = "all" | "awaiting" | "high" | "done";
export type BoardNavigation = { mission: string | null; filter: BoardFilter; panel: "list" | "detail" };
export function isSceneId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
export function parseBoardPath(value: unknown): BoardNavigation | null {
  if (typeof value !== "string" || value.length > 512 || value.includes("#") || value.includes("\\")
    || (value !== BOARD_PATH && !value.startsWith(BOARD_PATH + "?"))) return null;
  const query = value.slice(BOARD_PATH.length);
  if (query === "?") return null;
  try { decodeURIComponent(query); } catch { return null; }
  const params = new URLSearchParams(query);
  for (const key of params.keys()) {
    if (!["mission", "filter", "panel"].includes(key) || params.getAll(key).length !== 1 || !params.get(key)) return null;
  }
  const mission = params.get("mission");
  const filter = params.get("filter") ?? "all";
  const panel = params.get("panel") ?? (mission ? "detail" : "list");
  if (mission !== null && !isSceneId(mission)) return null;
  if (filter !== "all" && filter !== "awaiting" && filter !== "high" && filter !== "done") return null;
  if (panel !== "list" && panel !== "detail") return null;
  if (panel === "detail" && !mission) return null;
  return {mission, filter, panel};
}
export function buildBoardPath(nav: BoardNavigation): BoardPath {
  const params = new URLSearchParams();
  if (nav.mission) params.set("mission", nav.mission);
  if (nav.mission || nav.filter !== "all" || nav.panel !== "list") {
    params.set("filter", nav.filter); params.set("panel", nav.panel);
  }
  const result: BoardPath = params.size ? `${BOARD_PATH}?${params}` : BOARD_PATH;
  if (!parseBoardPath(result)) throw new Error("invalid_board_navigation");
  return result;
}
export function boardPathFromQuery(query: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) return "invalid";
    if (value !== undefined) params.append(key, value);
  }
  return params.size ? BOARD_PATH + "?" + params : BOARD_PATH;
}
export function resultTaskPath(result: SceneRun | null, slug: string, demo: boolean, running: boolean): BoardPath | null {
  if (running || !result || !isSceneId(result.missionId) || result.packSlug !== slug || result.demo !== demo) return null;
  return buildBoardPath({mission: result.missionId, filter: "all", panel: "detail"});
}
export function visibleMissions(missions: SceneMission[], filter: BoardFilter): SceneMission[] {
  return missions.filter(m => filter === "awaiting" ? m.stage === "awaiting_input" || m.stage === "blocked"
    : filter === "high" ? m.riskGrade === "high" : filter === "done" ? m.stage === "done" : true);
}
type LoadState = "idle" | "loading" | "ready" | "error" | "unavailable";
export type BoardState = {
  navigation: BoardNavigation | null;
  missions: SceneMission[];
  selected: SceneMission | null;
  run: SceneRun | null;
  list: LoadState;
  detail: LoadState;
  write: "idle" | "pending" | "unconfirmed" | "saved";
  busy: boolean;
  authExpired: boolean;
};
export type BoardIO = {
  list: (signal: AbortSignal) => Promise<SceneMission[]>;
  detail: (id: string, signal: AbortSignal) => Promise<SceneRun>;
  patch: (id: string, patch: {stage: SceneMission["stage"]}) => Promise<SceneMission>;
};
export function createSceneBoardController(io: BoardIO) {
  let state: BoardState = {navigation: null, missions: [], selected: null, run: null, list: "idle",
    detail: "idle", write: "idle", busy: false, authExpired: false};
  let alive = true, epoch = 0, writeToken: object | null = null;
  let reading: AbortController | null = null;
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<BoardState>) => {
    if (!alive) return;
    state = {...state, ...patch};
    for (const listener of listeners) listener();
  };
  const expired = (error: unknown) => typeof error === "object" && error !== null && "status" in error && error.status === 401;
  function failAccess() {
    epoch++; reading?.abort();
    emit({missions: [], selected: null, run: null, list: "unavailable", detail: "unavailable"});
  }
  function failAuth() {
    epoch++; reading?.abort();
    emit({missions: [], selected: null, run: null, list: "unavailable", detail: "unavailable", authExpired: true});
  }
  async function load(path: string) {
    const ticket = ++epoch;
    reading?.abort();
    reading = new AbortController();
    const signal = reading.signal;
    const navigation = parseBoardPath(path);
    emit({navigation, missions: [], selected: null, run: null, list: navigation ? "loading" : "unavailable",
      detail: "idle", write: writeToken ? "pending" : "idle", authExpired: false});
    if (!navigation || !alive) return;
    try {
      const missions = await io.list(signal);
      if (!alive || ticket !== epoch) return;
      if (new Set(missions.map(m => m.missionId)).size !== missions.length) throw new Error("duplicate_mission");
      const selected = navigation.mission ? missions.find(m => m.missionId === navigation.mission) ?? null : null;
      emit({missions, selected, list: "ready", detail: navigation.panel === "detail" ? selected ? "loading" : "unavailable" : "idle"});
      if (!selected || navigation.panel !== "detail") return;
      try {
        const run = await io.detail(selected.runId, signal);
        if (!alive || ticket !== epoch) return;
        if (run.runId !== selected.runId || run.missionId !== selected.missionId || run.packSlug !== selected.packSlug) {
          emit({run: null, detail: "unavailable"});
          return;
        }
        emit({run, detail: "ready"});
      } catch (error) {
        if (!alive || ticket !== epoch) return;
        if (expired(error)) failAuth();
        else {
          const denied = typeof error === "object" && error !== null && "status" in error
            && (error.status === 403 || error.status === 404);
          if (denied) failAccess();
          else emit({run: null, detail: "error"});
        }
      }
    } catch (error) {
      if (!alive || ticket !== epoch) return;
      if (expired(error)) failAuth(); else emit({missions: [], selected: null, run: null, list: "error", detail: "unavailable"});
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start(path: string) { alive = true; return load(path); },
    navigate: load,
    refresh() { return load(state.navigation ? buildBoardPath(state.navigation) : "invalid"); },
    async mark(stage: SceneMission["stage"]) {
      const selected = state.selected;
      if (!alive || writeToken || state.write === "unconfirmed" || !selected || state.detail !== "ready" || !state.run || state.authExpired
        || !["todo", "in_progress", "awaiting_input", "blocked", "done"].includes(stage)) return;
      const ticket = epoch, token = {};
      writeToken = token;
      emit({busy: true, write: "pending"});
      try {
        const updated = await io.patch(selected.missionId, {stage});
        if (!alive || ticket !== epoch) return;
        if (updated.missionId !== selected.missionId || updated.runId !== selected.runId || updated.packSlug !== selected.packSlug
          || updated.stage !== stage) throw new Error("identity_mismatch");
        emit({selected: updated, missions: state.missions.map(m => m.missionId === updated.missionId ? updated : m), write: "saved"});
      } catch (error) {
        if (!alive || ticket !== epoch) return;
        if (expired(error)) failAuth();
        else if (typeof error === "object" && error !== null && "status" in error
          && (error.status === 403 || error.status === 404)) {
          // The session may have changed in another tab. None of this read's
          // cached identities remain safe to display after access is denied.
          failAccess();
        }
        emit({write: "unconfirmed"});
      } finally {
        if (writeToken === token) {
          writeToken = null;
          // Releasing the per-instance lock must not overwrite a newer view's message.
          emit({busy: false, ...(ticket !== epoch && state.write === "pending" ? {write: "idle" as const} : {})});
        }
      }
    },
    // React owns each subscription's cleanup. Effects may stop/restart on a
    // route change while useSyncExternalStore retains the same subscription.
    dispose() { alive = false; epoch++; reading?.abort(); },
  };
}

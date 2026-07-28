import type { ShiguanArchive } from "../../lib/backendClient.ts";
import { parseArchivesPayload } from "../shiguan/shiguanPayload.ts";

export type StudyRecentRepliesResult =
  | { ok: true; archives: ShiguanArchive[] }
  | {
      ok: false;
      kind: "unauthenticated" | "network" | "unknown";
      message: string;
    };

export type StudyRecentRepliesPhase =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error";

export interface StudyRecentRepliesState {
  phase: StudyRecentRepliesPhase;
  archives: ShiguanArchive[];
  stale: boolean;
  generation: number;
  selectedArchiveId: string | null;
  message: string | null;
}

export const EMPTY_STUDY_RECENT_REPLIES_STATE: StudyRecentRepliesState = {
  phase: "idle",
  archives: [],
  stale: true,
  generation: 0,
  selectedArchiveId: null,
  message: null,
};

export interface StudyRecentRepliesLoad {
  state: StudyRecentRepliesState;
  shouldRequest: boolean;
  generation: number | null;
}

const UNKNOWN_RESULT: StudyRecentRepliesResult = {
  ok: false,
  kind: "unknown",
  message: "最近回奏响应不完整，请稍后重试",
};

export async function requestStudyRecentReplies(
  fetchImpl: typeof fetch = fetch,
): Promise<StudyRecentRepliesResult> {
  let response: Response;
  try {
    response = await fetchImpl(
      "/api/shiguan/archives?type=REPLY&limit=3",
      { method: "GET" },
    );
  } catch {
    return {
      ok: false,
      kind: "network",
      message: "无法读取最近回奏，请稍后重试",
    };
  }

  if (response.status === 401) {
    return {
      ok: false,
      kind: "unauthenticated",
      message: "会话已过期，请重新登录",
    };
  }
  if (response.status !== 200) return UNKNOWN_RESULT;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return UNKNOWN_RESULT;
  }

  const archives = parseArchivesPayload(body);
  if (
    archives === null ||
    archives.length > 3 ||
    archives.some((archive) => archive.type !== "REPLY")
  ) {
    return UNKNOWN_RESULT;
  }
  return { ok: true, archives };
}

export function beginStudyRecentRepliesLoad(
  state: StudyRecentRepliesState,
): StudyRecentRepliesLoad {
  if (!state.stale || state.phase === "loading") {
    return { state, shouldRequest: false, generation: null };
  }
  return {
    shouldRequest: true,
    generation: state.generation,
    state: { ...state, phase: "loading", message: null },
  };
}

export function resolveStudyRecentReplies(
  state: StudyRecentRepliesState,
  result: StudyRecentRepliesResult,
  generation: number | null,
): StudyRecentRepliesState {
  if (generation !== state.generation) return state;
  if (!result.ok) {
    return { ...state, phase: "error", message: result.message };
  }
  return {
    ...state,
    phase: result.archives.length === 0 ? "empty" : "ready",
    archives: result.archives,
    stale: false,
    message: null,
  };
}

export function invalidateStudyRecentReplies(
  state: StudyRecentRepliesState,
): StudyRecentRepliesState {
  return {
    ...state,
    phase: state.phase === "loading"
      ? state.archives.length === 0 ? "idle" : "ready"
      : state.phase,
    stale: true,
    generation: state.generation + 1,
  };
}

export function toggleStudyRecentReply(
  state: StudyRecentRepliesState,
  archiveId: string,
): StudyRecentRepliesState {
  return {
    ...state,
    selectedArchiveId: state.selectedArchiveId === archiveId
      ? null
      : archiveId,
  };
}

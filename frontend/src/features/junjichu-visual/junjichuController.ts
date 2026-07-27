import {
  filterReplyCasesByDepartment,
  toReplyCaseView,
  type ReplyCaseView,
} from "../court-replies/replyFeed.ts";

const READ_ERROR = "军机处暂时无法读取史馆真实回奏，请稍后重试。";
const LOGIN_LOCATION = "/login?next=%2Fjunjichu";
const REPLY_ARCHIVES_URL = "/api/shiguan/archives?type=REPLY&limit=100";

type FetchReplies = (
  input: string,
  init: { cache: RequestCache; signal: AbortSignal },
) => Promise<Response>;
type Listener = (state: JunjichuControllerState) => void;

export interface JunjichuControllerState {
  status: "loading" | "empty" | "ready" | "error";
  cases: ReplyCaseView[] | null;
  departments: string[];
  department: string;
  selectedId: string | null;
  error: string | null;
}

export interface JunjichuController {
  readonly state: JunjichuControllerState;
  connect(listener: Listener): () => void;
  start(): void;
  retry(): void;
  selectDepartment(department: string): void;
  selectCase(id: string): void;
}

export function decodeReplyCasesPayload(value: unknown): ReplyCaseView[] | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.status !== "ok" || !Array.isArray(record.archives)) return null;
  const cases: ReplyCaseView[] = [];
  for (const archive of record.archives) {
    const decoded = toReplyCaseView(archive);
    if (decoded === null) return null;
    cases.push(decoded);
  }
  return cases;
}

function initialState(): JunjichuControllerState {
  return {
    status: "loading",
    cases: null,
    departments: [],
    department: "",
    selectedId: null,
    error: null,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function createJunjichuController({
  fetch,
  redirect,
  schedule = queueMicrotask,
}: {
  fetch: FetchReplies;
  redirect(location: string): void;
  schedule?(task: () => void): void;
}): JunjichuController {
  let state = initialState();
  let allCases: ReplyCaseView[] = [];
  let activeRequest: AbortController | null = null;
  let generation = 0;
  let lifecycleVersion = 0;
  let started = false;
  let active = true;
  let disposed = false;
  const listeners = new Set<Listener>();

  const publish = (next: JunjichuControllerState) => {
    if (!active || disposed) return;
    state = next;
    for (const listener of listeners) listener(state);
  };
  const isCurrent = (requestGeneration: number) =>
    active && !disposed && generation === requestGeneration;
  const dispose = () => {
    if (disposed) return;
    active = false;
    disposed = true;
    generation += 1;
    activeRequest?.abort();
    activeRequest = null;
    listeners.clear();
    allCases = [];
  };
  const load = () => {
    if (!active || disposed) return;
    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    const requestGeneration = ++generation;
    publish({ ...state, status: "loading", cases: null, selectedId: null, error: null });

    void (async () => {
      try {
        const response = await fetch(REPLY_ARCHIVES_URL, {
          cache: "no-store",
          signal: request.signal,
        });
        if (!isCurrent(requestGeneration) || request.signal.aborted) return;
        if (response.status === 401) {
          schedule(() => {
            if (isCurrent(requestGeneration) && !request.signal.aborted) redirect(LOGIN_LOCATION);
          });
          return;
        }
        const body: unknown = await response.json();
        if (!isCurrent(requestGeneration) || request.signal.aborted) return;
        const decoded = response.ok ? decodeReplyCasesPayload(body) : null;
        if (decoded === null) throw new Error(READ_ERROR);
        allCases = decoded;
        const cases = filterReplyCasesByDepartment(allCases, state.department);
        const departments = [...new Set(allCases.flatMap((item) => item.departments))];
        publish({
          ...state,
          status: cases.length === 0 ? "empty" : "ready",
          cases,
          departments,
          selectedId: cases[0]?.id ?? null,
          error: null,
        });
      } catch (error) {
        if (!isCurrent(requestGeneration) || request.signal.aborted || isAbortError(error)) return;
        publish({ ...state, status: "error", cases: null, selectedId: null, error: READ_ERROR });
      }
    })();
  };

  return {
    get state() {
      return state;
    },
    connect(listener) {
      if (disposed) return () => undefined;
      lifecycleVersion += 1;
      active = true;
      listeners.add(listener);
      listener(state);
      let connected = true;
      return () => {
        if (!connected) return;
        connected = false;
        listeners.delete(listener);
        if (listeners.size > 0) return;
        active = false;
        const pendingVersion = ++lifecycleVersion;
        schedule(() => {
          if (!disposed && listeners.size === 0 && lifecycleVersion === pendingVersion) dispose();
        });
      };
    },
    start() {
      if (started || !active || disposed) return;
      started = true;
      load();
    },
    retry: load,
    selectDepartment(department) {
      if (!active || disposed) return;
      const cases = filterReplyCasesByDepartment(allCases, department);
      publish({
        ...state,
        status: cases.length === 0 ? "empty" : "ready",
        cases,
        department,
        selectedId: cases[0]?.id ?? null,
        error: null,
      });
    },
    selectCase(id) {
      if (!active || disposed || !state.cases?.some((item) => item.id === id)) return;
      publish({ ...state, selectedId: id });
    },
  };
}

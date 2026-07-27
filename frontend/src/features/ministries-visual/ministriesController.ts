import { toReplyCaseView, type ReplyCaseView } from "../court-replies/replyFeed.ts";

const REPLY_ARCHIVES_URL = "/api/shiguan/archives?type=REPLY&limit=100";
const READ_ERROR = "六部暂时无法读取史馆真实回奏，请稍后重试。";

type FetchReplies = (
  input: string,
  init: { cache: RequestCache; signal: AbortSignal },
) => Promise<Response>;

export interface MinistriesControllerState {
  status: "loading" | "ready" | "empty" | "error";
  cases: ReplyCaseView[] | null;
  error: string | null;
}

export interface MinistriesController {
  readonly state: MinistriesControllerState;
  connect(listener: (state: MinistriesControllerState) => void): () => void;
  start(): void;
  retry(): void;
}

export function decodeReplyCasesPayload(value: unknown): ReplyCaseView[] | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.status !== "ok" || !Array.isArray(record.archives)) return null;
  const cases = record.archives.map(toReplyCaseView);
  return cases.every((item): item is ReplyCaseView => item !== null) ? cases : null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function createMinistriesController({
  fetch,
  redirect,
  schedule = queueMicrotask,
}: {
  fetch: FetchReplies;
  redirect(location: string): void;
  schedule?(task: () => void): void;
}): MinistriesController {
  let state: MinistriesControllerState = { status: "loading", cases: null, error: null };
  let request: AbortController | null = null;
  let generation = 0;
  let lifecycleVersion = 0;
  let started = false;
  let active = true;
  let disposed = false;
  const listeners = new Set<(state: MinistriesControllerState) => void>();

  const publish = (next: MinistriesControllerState) => {
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
    request?.abort();
    request = null;
    listeners.clear();
  };
  const load = () => {
    if (!active || disposed) return;
    request?.abort();
    request = new AbortController();
    const currentRequest = request;
    const requestGeneration = ++generation;
    publish({ status: "loading", cases: null, error: null });
    void (async () => {
      try {
        const result = await fetch(REPLY_ARCHIVES_URL, {
          cache: "no-store",
          signal: currentRequest.signal,
        });
        if (!isCurrent(requestGeneration) || currentRequest.signal.aborted) return;
        if (result.status === 401) {
          schedule(() => {
            if (isCurrent(requestGeneration) && !currentRequest.signal.aborted) redirect("/login");
          });
          return;
        }
        const payload: unknown = await result.json();
        if (!isCurrent(requestGeneration) || currentRequest.signal.aborted) return;
        const cases = result.ok ? decodeReplyCasesPayload(payload) : null;
        if (cases === null) throw new Error(READ_ERROR);
        publish({ status: cases.length === 0 ? "empty" : "ready", cases, error: null });
      } catch (error) {
        if (!isCurrent(requestGeneration) || currentRequest.signal.aborted || isAbortError(error)) return;
        publish({ status: "error", cases: null, error: READ_ERROR });
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
  };
}

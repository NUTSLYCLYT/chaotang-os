import {
  SUBMITTING_UI_STATE,
  mapSubmitDecreeResultToUiState,
  parseChancellorSuccessResponse,
  type DecreeErrorKind,
  type DecreeUiState,
} from "./decreeStatus.ts";
import {
  clearActiveJob,
  clearPendingSubmission,
  loadPendingSubmission,
  nextPollDelayMs,
  saveActiveJob,
  savePendingSubmission,
} from "./decreeJobPolling.ts";

export type StudyFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface StudySubmissionDependencies {
  fetchImpl: StudyFetch;
  scheduleRedirect(path: string): void;
  draftVersion?: number;
  draftFingerprint?: string;
  idempotencyKey?: string;
  wait?(milliseconds: number): Promise<void>;
  onProgress?(phase: "queued" | "running", jobId: string): void;
  storage?: Storage;
  userId?: string;
  isCurrent?(): boolean;
}

const KNOWN_ERROR_KINDS: readonly DecreeErrorKind[] = [
  "validation",
  "draft_not_current",
  "source_not_current",
  "idempotency_conflict",
  "config",
  "model",
  "timeout",
  "network",
  "unknown",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKnownErrorKind(value: unknown): value is DecreeErrorKind {
  return (
    typeof value === "string" &&
    (KNOWN_ERROR_KINDS as readonly string[]).includes(value)
  );
}

function defaultWait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isCurrent(dependencies: StudySubmissionDependencies): boolean {
  return dependencies.isCurrent?.() !== false;
}

function acceptedJobId(body: unknown): string | null {
  if (!isRecord(body) || body.state !== "QUEUED") return null;
  return typeof body.jobId === "string" && /^[0-9a-f]{32}$/.test(body.jobId)
    ? body.jobId
    : null;
}

async function requestHash(
  decreeText: string,
  draftVersion?: number,
  draftFingerprint?: string,
): Promise<string> {
  const canonical = JSON.stringify({
    decreeText: decreeText.trim(),
    draftVersion,
    draftFingerprint,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function waitWhileCurrent(
  dependencies: StudySubmissionDependencies,
  milliseconds: number,
): Promise<boolean> {
  await (dependencies.wait ?? defaultWait)(milliseconds);
  return isCurrent(dependencies);
}

async function pollDecreeJob(
  jobId: string,
  dependencies: StudySubmissionDependencies,
): Promise<DecreeUiState> {
  let attempt = 0;
  let transientFailures = 0;
  for (;;) {
    if (!isCurrent(dependencies)) return { phase: "idle" };
    let response: Response;
    try {
      response = await dependencies.fetchImpl(`/api/decree-jobs/${jobId}`);
    } catch {
      if (!isCurrent(dependencies)) return { phase: "idle" };
      transientFailures += 1;
      if (transientFailures > 3) {
        return mapSubmitDecreeResultToUiState({ ok: false, kind: "network", error: "" });
      }
      if (!await waitWhileCurrent(dependencies, [1000, 2000, 3000][transientFailures - 1])) {
        return { phase: "idle" };
      }
      continue;
    }
    if (!isCurrent(dependencies)) return { phase: "idle" };
    if (response.status === 401) {
      if (dependencies.storage && dependencies.userId) {
        clearActiveJob(dependencies.storage, dependencies.userId);
      }
      dependencies.scheduleRedirect("/login?next=%2Fstudy");
      return { phase: "error", message: "会话已过期，正在返回登录页。" };
    }
    if ([502, 503, 504].includes(response.status)) {
      transientFailures += 1;
      if (transientFailures > 3) {
        return mapSubmitDecreeResultToUiState({ ok: false, kind: "model", error: "" });
      }
      if (!await waitWhileCurrent(dependencies, [1000, 2000, 3000][transientFailures - 1])) {
        return { phase: "idle" };
      }
      continue;
    }
    transientFailures = 0;
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return mapSubmitDecreeResultToUiState({ ok: false, kind: "unknown", error: "" });
    }
    if (!isCurrent(dependencies)) return { phase: "idle" };
    if (!response.ok || !isRecord(body) || body.jobId !== jobId) {
      if (response.status === 404 && dependencies.storage && dependencies.userId) {
        clearActiveJob(dependencies.storage, dependencies.userId);
      }
      return mapSubmitDecreeResultToUiState({ ok: false, kind: "unknown", error: "" });
    }
    if (body.state === "SUCCEEDED") {
      if (dependencies.storage && dependencies.userId) {
        clearActiveJob(dependencies.storage, dependencies.userId);
      }
      const success = parseChancellorSuccessResponse(body.result);
      return success === null
        ? mapSubmitDecreeResultToUiState({ ok: false, kind: "unknown", error: "" })
        : mapSubmitDecreeResultToUiState({ ok: true, data: success });
    }
    if (body.state === "FAILED" || body.state === "CANCELLED") {
      if (dependencies.storage && dependencies.userId) {
        clearActiveJob(dependencies.storage, dependencies.userId);
      }
      const failure = isRecord(body.error) ? body.error : {};
      const kind: DecreeErrorKind = failure.code === "deadline_exceeded" ? "timeout" : "model";
      return mapSubmitDecreeResultToUiState({ ok: false, kind, error: "" });
    }
    if (body.state !== "QUEUED" && body.state !== "RUNNING") {
      return mapSubmitDecreeResultToUiState({ ok: false, kind: "unknown", error: "" });
    }
    dependencies.onProgress?.(body.state === "QUEUED" ? "queued" : "running", jobId);
    if (!await waitWhileCurrent(
      dependencies,
      nextPollDelayMs(response.headers.get("retry-after"), attempt),
    )) {
      return { phase: "idle" };
    }
    attempt += 1;
  }
}

export async function resumeStudySubmission(
  jobId: string,
  dependencies: StudySubmissionDependencies,
): Promise<DecreeUiState> {
  if (!isCurrent(dependencies)) return { phase: "idle" };
  dependencies.onProgress?.("queued", jobId);
  return pollDecreeJob(jobId, dependencies);
}

export async function requestStudySubmission(
  decreeText: string,
  dependencies: StudySubmissionDependencies,
): Promise<DecreeUiState> {
  const pendingHash = await requestHash(
    decreeText,
    dependencies.draftVersion,
    dependencies.draftFingerprint,
  );
  if (!isCurrent(dependencies)) return { phase: "idle" };
  const persisted = dependencies.storage && dependencies.userId
    ? loadPendingSubmission(dependencies.storage, dependencies.userId)
    : null;
  const idempotencyKey = dependencies.idempotencyKey ?? (
    persisted?.requestHash === pendingHash
      ? persisted.idempotencyKey
      : crypto.randomUUID()
  );
  if (dependencies.storage && dependencies.userId) {
    savePendingSubmission(dependencies.storage, dependencies.userId, {
      idempotencyKey,
      requestHash: pendingHash,
    });
  }
  let response: Response;
  try {
    response = await dependencies.fetchImpl("/api/decrees/chancellor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        decreeText,
        draftVersion: dependencies.draftVersion,
        draftFingerprint: dependencies.draftFingerprint,
        idempotencyKey,
      }),
    });
  } catch (error) {
    return mapSubmitDecreeResultToUiState({
      ok: false,
      kind: "network",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (!isCurrent(dependencies)) return { phase: "idle" };

  if (response.status === 401) {
    dependencies.scheduleRedirect("/login?next=%2Fstudy");
    return {
      phase: "error",
      message: "会话已过期，正在返回登录页。",
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return mapSubmitDecreeResultToUiState({
      ok: false,
      kind: "unknown",
      error: "响应体不是合法 JSON",
    });
  }

  if (!isCurrent(dependencies)) return { phase: "idle" };

  if (response.status === 202) {
    const jobId = acceptedJobId(body);
    if (jobId === null) {
      return mapSubmitDecreeResultToUiState({ ok: false, kind: "unknown", error: "" });
    }
    dependencies.onProgress?.("queued", jobId);
    if (dependencies.storage && dependencies.userId) {
      saveActiveJob(dependencies.storage, dependencies.userId, { jobId, idempotencyKey });
      clearPendingSubmission(dependencies.storage, dependencies.userId);
    }
    return pollDecreeJob(jobId, dependencies);
  }

  if (response.ok) {
    const success = parseChancellorSuccessResponse(body);
    if (success !== null) {
      if (dependencies.storage && dependencies.userId) {
        clearPendingSubmission(dependencies.storage, dependencies.userId);
      }
      return mapSubmitDecreeResultToUiState({
        ok: true,
        data: success,
      });
    }
    return mapSubmitDecreeResultToUiState({
      ok: false,
      kind: "unknown",
      error: "响应体不符合预期契约",
    });
  }

  const error = isRecord(body) ? body : {};
  const kind: DecreeErrorKind = isKnownErrorKind(error.reason)
    ? error.reason
    : "unknown";
  return mapSubmitDecreeResultToUiState({
    ok: false,
    kind,
    error: typeof error.message === "string" ? error.message : "",
  });
}

interface SubmitStudyDecreeInput {
  decreeText: string;
  canSubmit: boolean;
  setUiState(state: DecreeUiState): void;
  requestSubmission(decreeText: string): Promise<DecreeUiState>;
}

export async function submitStudyDecree({
  decreeText,
  canSubmit,
  setUiState,
  requestSubmission,
}: SubmitStudyDecreeInput): Promise<void> {
  if (!canSubmit) {
    return;
  }

  setUiState(SUBMITTING_UI_STATE);
  setUiState(await requestSubmission(decreeText));
}

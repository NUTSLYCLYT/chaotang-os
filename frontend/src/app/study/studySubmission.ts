import {
  SUBMITTING_UI_STATE,
  mapSubmitDecreeResultToUiState,
  mapDecreeJobFailure,
  parseChancellorSuccessResponse,
  type DecreeErrorKind,
  type DecreeJobProgress,
  type DecreeProgressFreshness,
  type DecreeRecoveryMode,
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
  initialProgress?: DecreeJobProgress;
  wait?(milliseconds: number): Promise<void>;
  onProgress?(
    phase: "queued" | "running",
    jobId: string,
    jobProgress?: DecreeJobProgress,
  ): void;
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

const ACCOUNTING_SOURCE_BLOCKED_MESSAGE = "回奏受阻：系统内财务数据当前无法通过格式或主体身份校验。请管理员修正受控财务数据源后重新下旨；本次未生成 Excel 文件。";

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

const PUBLIC_JOB_STATES: readonly DecreeJobProgress["state"][] = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
];

// Mirrors the public state/stage projection enforced by backendClient.parseDecreeJob.
const PUBLIC_JOB_STAGES: Readonly<
  Record<DecreeJobProgress["state"], ReadonlySet<string>>
> = {
  QUEUED: new Set(["QUEUED", "RETRY_WAIT"]),
  RUNNING: new Set(["RUNNING", "RESULT_READY", "ARCHIVING", "PUBLISHING"]),
  SUCCEEDED: new Set(["SUCCEEDED"]),
  FAILED: new Set(["FAILED"]),
  CANCELLED: new Set(["CANCELLED"]),
};

function isTimezoneAwareRfc3339(value: unknown): value is string {
  if (typeof value !== "string") return false;
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
    month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59 ||
    offsetHour > 23 || offsetMinute > 59
  ) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

function parsePublicJobProgress(
  body: Record<string, unknown>,
  expectedJobId: string,
): DecreeJobProgress | null {
  if (
    body.jobId !== expectedJobId ||
    typeof body.state !== "string" ||
    !(PUBLIC_JOB_STATES as readonly string[]).includes(body.state) ||
    typeof body.stage !== "string" ||
    !Number.isInteger(body.attemptCount) ||
    (body.attemptCount as number) < 0 ||
    !Number.isInteger(body.providerRequestCount) ||
    (body.providerRequestCount as number) < 0 ||
    !isTimezoneAwareRfc3339(body.createdAt) ||
    !isTimezoneAwareRfc3339(body.updatedAt)
  ) {
    return null;
  }
  const state = body.state as DecreeJobProgress["state"];
  if (!PUBLIC_JOB_STAGES[state].has(body.stage)) return null;
  return {
    jobId: expectedJobId,
    state,
    stage: body.stage,
    attemptCount: body.attemptCount as number,
    providerRequestCount: body.providerRequestCount as number,
    createdAt: body.createdAt,
    updatedAt: body.updatedAt,
  };
}

function withProgressContext(
  state: DecreeUiState,
  progress: DecreeJobProgress | undefined,
  progressFreshness: DecreeProgressFreshness,
  recoveryMode: DecreeRecoveryMode,
): DecreeUiState {
  if (state.phase !== "error") return state;
  return {
    ...state,
    ...(progress ? { lastVerifiedProgress: progress } : {}),
    progressFreshness,
    recoveryMode,
  };
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
  let lastVerifiedProgress = dependencies.initialProgress?.jobId === jobId
    ? dependencies.initialProgress
    : undefined;
  for (;;) {
    if (!isCurrent(dependencies)) return { phase: "idle" };
    let response: Response;
    try {
      response = await dependencies.fetchImpl(`/api/decree-jobs/${jobId}`);
    } catch {
      if (!isCurrent(dependencies)) return { phase: "idle" };
      transientFailures += 1;
      if (transientFailures > 3) {
        return withProgressContext(
          mapSubmitDecreeResultToUiState({ ok: false, kind: "network", error: "" }),
          lastVerifiedProgress,
          "stale",
          "resume",
        );
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
      return withProgressContext(
        { phase: "error", message: "会话已过期，正在返回登录页。" },
        lastVerifiedProgress,
        lastVerifiedProgress ? "stale" : "current",
        "redraft",
      );
    }
    if ([502, 503, 504].includes(response.status)) {
      transientFailures += 1;
      if (transientFailures > 3) {
        return withProgressContext(
          mapSubmitDecreeResultToUiState({ ok: false, kind: "model", error: "" }),
          lastVerifiedProgress,
          "stale",
          "resume",
        );
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
      return withProgressContext(
        mapSubmitDecreeResultToUiState({ ok: false, kind: "unknown", error: "" }),
        lastVerifiedProgress,
        "stale",
        "resume",
      );
    }
    if (!isCurrent(dependencies)) return { phase: "idle" };
    if (!response.ok || !isRecord(body) || body.jobId !== jobId) {
      if (response.status === 404 && dependencies.storage && dependencies.userId) {
        clearActiveJob(dependencies.storage, dependencies.userId);
      }
      return withProgressContext(
        mapSubmitDecreeResultToUiState({ ok: false, kind: "unknown", error: "" }),
        lastVerifiedProgress,
        "stale",
        response.status === 404 ? "redraft" : "resume",
      );
    }
    const jobProgress = parsePublicJobProgress(body, jobId);
    if (jobProgress === null) {
      return withProgressContext(
        mapSubmitDecreeResultToUiState({ ok: false, kind: "unknown", error: "" }),
        lastVerifiedProgress,
        "stale",
        "resume",
      );
    }
    lastVerifiedProgress = jobProgress;
    if (body.state === "SUCCEEDED") {
      if (dependencies.storage && dependencies.userId) {
        clearActiveJob(dependencies.storage, dependencies.userId);
      }
      if (
        isRecord(body.result) &&
        body.result.status === "blocked" &&
        body.result.deliveryKind === "accounting_report" &&
        Array.isArray(body.result.departments) &&
        body.result.departments.length === 1 &&
        body.result.departments[0] === "户部" &&
        Array.isArray(body.result.artifacts) &&
        body.result.artifacts.length === 0
      ) {
        return {
          phase: "error",
          message: ACCOUNTING_SOURCE_BLOCKED_MESSAGE,
          lastVerifiedProgress: jobProgress,
          progressFreshness: "current",
          recoveryMode: "redraft",
        };
      }
      const success = parseChancellorSuccessResponse(body.result);
      return success === null
        ? withProgressContext(
            mapSubmitDecreeResultToUiState({ ok: false, kind: "unknown", error: "" }),
            jobProgress,
            "current",
            "redraft",
          )
        : mapSubmitDecreeResultToUiState({ ok: true, data: success }, jobProgress);
    }
    if (body.state === "FAILED" || body.state === "CANCELLED") {
      if (dependencies.storage && dependencies.userId) {
        clearActiveJob(dependencies.storage, dependencies.userId);
      }
      const failure = isRecord(body.error) ? body.error : {};
      if (failure.code === "accounting_source_unavailable") {
        return {
          phase: "error",
          message: ACCOUNTING_SOURCE_BLOCKED_MESSAGE,
          lastVerifiedProgress: jobProgress,
          progressFreshness: "current",
          recoveryMode: "redraft",
        };
      }
      if (
        typeof failure.stage === "string" &&
        typeof failure.category === "string" &&
        typeof failure.code === "string"
      ) {
        return withProgressContext(
          mapDecreeJobFailure({
            errorStage: failure.stage,
            errorCategory: failure.category,
            errorCode: failure.code,
          }),
          jobProgress,
          "current",
          "redraft",
        );
      }
      return withProgressContext(
        mapSubmitDecreeResultToUiState({ ok: false, kind: "unknown", error: "" }),
        jobProgress,
        "current",
        "redraft",
      );
    }
    if (body.state !== "QUEUED" && body.state !== "RUNNING") {
      return withProgressContext(
        mapSubmitDecreeResultToUiState({ ok: false, kind: "unknown", error: "" }),
        jobProgress,
        "stale",
        "resume",
      );
    }
    dependencies.onProgress?.(
      body.state === "QUEUED" ? "queued" : "running",
      jobId,
      jobProgress,
    );
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
  const initialProgress = dependencies.initialProgress?.jobId === jobId
    ? dependencies.initialProgress
    : undefined;
  dependencies.onProgress?.("queued", jobId, initialProgress);
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
      progressFreshness: "current",
      recoveryMode: "redraft",
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
  const errorState = mapSubmitDecreeResultToUiState({
    ok: false,
    kind,
    error: typeof error.message === "string" ? error.message : "",
  });
  return response.status >= 500
    ? withProgressContext(errorState, undefined, "stale", "redraft")
    : errorState;
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

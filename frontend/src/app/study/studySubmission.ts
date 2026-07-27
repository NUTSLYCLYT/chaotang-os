import {
  SUBMITTING_UI_STATE,
  mapSubmitDecreeResultToUiState,
  parseChancellorSuccessResponse,
  type DecreeErrorKind,
  type DecreeUiState,
} from "./decreeStatus.ts";

export type StudyFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface StudySubmissionDependencies {
  fetchImpl: StudyFetch;
  scheduleRedirect(path: string): void;
}

const KNOWN_ERROR_KINDS: readonly DecreeErrorKind[] = [
  "validation",
  "config",
  "model",
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

export async function requestStudySubmission(
  decreeText: string,
  dependencies: StudySubmissionDependencies,
): Promise<DecreeUiState> {
  let response: Response;
  try {
    response = await dependencies.fetchImpl("/api/decrees/chancellor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decreeText }),
    });
  } catch (error) {
    return mapSubmitDecreeResultToUiState({
      ok: false,
      kind: "network",
      error: error instanceof Error ? error.message : String(error),
    });
  }

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

  if (response.ok) {
    const success = parseChancellorSuccessResponse(body);
    if (success !== null) {
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


import type {
  DailyMemorialConfirmation,
  DailyMemorialDraft,
  DailyMemorialError,
  DailyMemorialLatest,
} from "../../lib/backendClient";

export type DailyMemorialPhase =
  | "idle"
  | "loading"
  | "generating"
  | "no_facts"
  | "ready"
  | "confirming"
  | "confirmed"
  | "failed"
  | "error";

export interface DailyMemorialUiState {
  phase: DailyMemorialPhase;
  draft: DailyMemorialDraft | null;
  memorialId: string | null;
  message: string;
}

export type DailyMemorialBrowserResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: DailyMemorialError };

export const EMPTY_DAILY_MEMORIAL_STATE: DailyMemorialUiState = {
  phase: "idle",
  draft: null,
  memorialId: null,
  message: "尚无每日奏折草稿。",
};

const LOAD_MESSAGES: Record<DailyMemorialPhase, string> = {
  idle: "尚无每日奏折草稿。",
  loading: "正在读取每日奏折草稿。",
  generating: "39司与6部正在汇总受控事实。",
  no_facts: "报告期内没有可用的受控事实，未生成草稿。",
  ready: "草稿已就绪，请审阅后确认。",
  confirming: "正在确认并归档为奏折。",
  confirmed: "已按本次确认归档为奏折。",
  failed: "草稿生成失败，可重新读取状态。",
  error: "每日奏折暂时不可用。",
};

const PHASE_LABELS: Record<DailyMemorialPhase, string> = {
  idle: "未生成",
  loading: "读取中",
  generating: "汇总中",
  no_facts: "无事实",
  ready: "待审",
  confirming: "确认中",
  confirmed: "已归档",
  failed: "失败",
  error: "不可用",
};

export function dailyMemorialPhaseLabel(phase: DailyMemorialPhase): string {
  return PHASE_LABELS[phase];
}

const STATUSES = new Set([
  "PENDING",
  "GENERATING",
  "SKIPPED_NO_FACTS",
  "READY_FOR_REVIEW",
  "CONFIRMED",
  "FAILED",
]);
const OPAQUE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:+-]{0,198}[A-Za-z0-9])?$/;
const FINGERPRINT = /^[0-9a-f]{64}$/;
const FAILURE_CODE = /^[a-z][a-z0-9_]{0,127}$/;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && keys.slice().sort().every((key, index) => key === actual[index]);
}

function isOpaqueId(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_ID.test(value);
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = CALENDAR_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isRfc3339(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = RFC3339.exec(value);
  if (!match) return false;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (!isCalendarDate(date) || hour > 23 || minute > 59 || second > 59) return false;
  if (match[7]) {
    const offsetHour = Number(match[8]);
    const offsetMinute = Number(match[9]);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return !Number.isNaN(Date.parse(value));
}

function isDraft(value: unknown): value is DailyMemorialDraft {
  if (!isRecord(value) || !hasExactKeys(value, [
    "id", "reportDate", "sourceWindowStart", "sourceWindowEnd", "version",
    "fingerprint", "bureauResultCount", "ministryResultCount", "content", "factRefs",
  ])) return false;
  if (!isOpaqueId(value.id) ||
    !isCalendarDate(value.reportDate) ||
    !isRfc3339(value.sourceWindowStart) ||
    !isRfc3339(value.sourceWindowEnd) ||
    Date.parse(value.sourceWindowEnd) <= Date.parse(value.sourceWindowStart) ||
    !Number.isSafeInteger(value.version) || (value.version as number) < 1 ||
    typeof value.fingerprint !== "string" || !FINGERPRINT.test(value.fingerprint)) return false;
  if (value.bureauResultCount !== 39 || value.ministryResultCount !== 6 ||
    typeof value.content !== "string" || value.content.trim().length === 0 ||
    !Array.isArray(value.factRefs) || value.factRefs.length === 0) return false;
  const seen = new Set<string>();
  for (const factRef of value.factRefs) {
    if (!isOpaqueId(factRef) || factRef !== factRef.trim() || seen.has(factRef)) return false;
    seen.add(factRef);
  }
  return true;
}

function isLatest(value: unknown): value is DailyMemorialLatest | null {
  if (value === null) return true;
  if (!isRecord(value) || !hasExactKeys(value, ["status", "draft", "memorialId", "failureCode"])) return false;
  if (typeof value.status !== "string" || !STATUSES.has(value.status)) return false;
  const reviewable = value.status === "READY_FOR_REVIEW" || value.status === "CONFIRMED";
  if (reviewable ? !isDraft(value.draft) : value.draft !== null) return false;
  if (value.status === "CONFIRMED" ? !isOpaqueId(value.memorialId) : value.memorialId !== null) return false;
  if (value.status === "FAILED"
    ? typeof value.failureCode !== "string" || !FAILURE_CODE.test(value.failureCode)
    : value.failureCode !== null) return false;
  return true;
}

function isConfirmation(value: unknown): value is DailyMemorialConfirmation {
  return isRecord(value) &&
    hasExactKeys(value, ["status", "draftId", "memorialId"]) &&
    value.status === "CONFIRMED" &&
    isOpaqueId(value.draftId) &&
    isOpaqueId(value.memorialId);
}

function failureKind(status: number): DailyMemorialError {
  if (status === 401) return "unauthenticated";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 503) return "storage";
  return "unknown";
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function requestLatestDailyMemorial(
  fetchImpl: typeof fetch,
): Promise<DailyMemorialBrowserResult<DailyMemorialLatest | null>> {
  try {
    const response = await fetchImpl("/api/daily-memorial-drafts/latest", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, kind: failureKind(response.status) };
    const body = await readJson(response);
    if (!isRecord(body) || !hasExactKeys(body, ["status", "latest"]) || body.status !== "ok" || !isLatest(body.latest)) {
      return { ok: false, kind: "unknown" };
    }
    return { ok: true, data: body.latest };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function requestDailyMemorialConfirmation(
  draft: DailyMemorialDraft,
  fetchImpl: typeof fetch,
): Promise<DailyMemorialBrowserResult<DailyMemorialConfirmation>> {
  try {
    const response = await fetchImpl(
      `/api/daily-memorial-drafts/${encodeURIComponent(draft.id)}/confirm`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: draft.version, fingerprint: draft.fingerprint }),
      },
    );
    if (!response.ok) return { ok: false, kind: failureKind(response.status) };
    const body = await readJson(response);
    if (!isRecord(body) || !hasExactKeys(body, ["status", "confirmation"]) || body.status !== "ok" || !isConfirmation(body.confirmation)) {
      return { ok: false, kind: "unknown" };
    }
    return { ok: true, data: body.confirmation };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export function resolveDailyMemorialLoad(latest: DailyMemorialLatest | null): DailyMemorialUiState {
  if (latest === null) return EMPTY_DAILY_MEMORIAL_STATE;
  const phase: DailyMemorialPhase = latest.status === "PENDING"
    ? "loading"
    : latest.status === "GENERATING"
      ? "generating"
      : latest.status === "SKIPPED_NO_FACTS"
        ? "no_facts"
        : latest.status === "READY_FOR_REVIEW"
          ? "ready"
          : latest.status === "CONFIRMED"
            ? "confirmed"
            : "failed";
  return {
    phase,
    draft: latest.draft,
    memorialId: latest.memorialId,
    message: LOAD_MESSAGES[phase],
  };
}

export function canConfirmDailyMemorial(state: DailyMemorialUiState): boolean {
  return state.phase === "ready" && state.draft !== null && state.memorialId === null;
}

export function beginDailyMemorialLoad(): DailyMemorialUiState {
  return { phase: "loading", draft: null, memorialId: null, message: LOAD_MESSAGES.loading };
}

export function beginDailyMemorialConfirmation(state: DailyMemorialUiState): DailyMemorialUiState {
  return canConfirmDailyMemorial(state)
    ? { ...state, phase: "confirming", message: LOAD_MESSAGES.confirming }
    : state;
}

export function failDailyMemorial(message = LOAD_MESSAGES.error): DailyMemorialUiState {
  return { phase: "error", draft: null, memorialId: null, message };
}

export function confirmDailyMemorialSuccess(
  state: DailyMemorialUiState,
  confirmation: DailyMemorialConfirmation,
): DailyMemorialUiState {
  if (state.draft === null || confirmation.draftId !== state.draft.id) return failDailyMemorial();
  return { ...state, phase: "confirmed", memorialId: confirmation.memorialId, message: LOAD_MESSAGES.confirmed };
}

interface DailyMemorialConfirmationRunnerOptions {
  state: DailyMemorialUiState;
  getCurrentState(): DailyMemorialUiState;
  commit(state: DailyMemorialUiState): void;
  request(draft: DailyMemorialDraft): Promise<DailyMemorialBrowserResult<DailyMemorialConfirmation>>;
  refresh(message: string): Promise<void>;
  scheduleRedirect(path: string): void;
}

export async function runDailyMemorialConfirmation({
  state,
  getCurrentState,
  commit,
  request,
  refresh,
  scheduleRedirect,
}: DailyMemorialConfirmationRunnerOptions): Promise<boolean> {
  if (!canConfirmDailyMemorial(state) || state.draft === null) return false;
  const draft = state.draft;
  commit(beginDailyMemorialConfirmation(state));
  const result = await request(draft);
  const current = getCurrentState();
  if (current.draft?.id !== draft.id ||
    current.draft.fingerprint !== draft.fingerprint ||
    current.draft.version !== draft.version) return false;
  if (!result.ok) {
    if (result.kind === "unauthenticated") {
      scheduleRedirect("/login?next=%2Fstudy");
      commit(failDailyMemorial());
    } else if (result.kind === "conflict") {
      await refresh("草稿已更新，请重新审阅");
    } else {
      commit(failDailyMemorial());
    }
    return true;
  }
  commit(confirmDailyMemorialSuccess(current, result.data));
  return true;
}

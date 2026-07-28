const READ_ERROR = "军机处案卷暂时无法读取，请稍后重试。";
const LOGIN_LOCATION = "/login?next=%2Fjunjichu";
const CASES_URL = "/api/junjichu/cases";

const CASE_STATUSES = [
  "MINISTRY_REVIEWING",
  "COUNCIL_REVIEWING",
  "CHANCELLOR_FINALIZING",
  "ARCHIVED",
  "FAILED",
] as const;

export type JunjichuCaseStatus = (typeof CASE_STATUSES)[number];

export interface JunjichuCaseView {
  id: string;
  decreeText: string;
  departments: string[];
  status: JunjichuCaseStatus;
  processingPath: string[];
  completedMinistryOpinions: Array<{
    department: string;
    bureauOpinions: Array<{ bureau: string; opinion: string }>;
    opinion: string;
  }>;
  councilVerdict: string | null;
  replyId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

type FetchCases = (
  input: string,
  init: { cache: RequestCache; signal: AbortSignal },
) => Promise<Response>;
type Listener = (state: JunjichuControllerState) => void;

export interface JunjichuControllerState {
  status: "loading" | "empty" | "ready" | "error";
  activeCases: JunjichuCaseView[] | null;
  archivedCases: JunjichuCaseView[] | null;
  failedCases: JunjichuCaseView[] | null;
  departments: string[];
  department: string;
  caseStatus: JunjichuCaseStatus | "";
  keyword: string;
  selectedId: string | null;
  error: string | null;
}

export interface JunjichuController {
  readonly state: JunjichuControllerState;
  connect(listener: Listener): () => void;
  start(): void;
  retry(): void;
  selectDepartment(department: string): void;
  selectStatus(status: JunjichuCaseStatus | ""): void;
  selectKeyword(keyword: string): void;
  selectCase(id: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim());
}

function isNullableString(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.trim().length > 0);
}

function decodeOpinion(value: unknown): JunjichuCaseView["completedMinistryOpinions"][number] | null {
  if (!isRecord(value) || !hasKeys(value, ["department", "bureauOpinions", "opinion"]) ||
    typeof value.department !== "string" || !value.department.trim() ||
    typeof value.opinion !== "string" || !value.opinion.trim() || !Array.isArray(value.bureauOpinions)) return null;
  const bureauOpinions = value.bureauOpinions.map((bureau) => {
    if (!isRecord(bureau) || !hasKeys(bureau, ["bureau", "opinion"]) ||
      typeof bureau.bureau !== "string" || !bureau.bureau.trim() ||
      typeof bureau.opinion !== "string" || !bureau.opinion.trim()) return null;
    return { bureau: bureau.bureau, opinion: bureau.opinion };
  });
  return bureauOpinions.every((item): item is { bureau: string; opinion: string } => item !== null)
    ? { department: value.department, bureauOpinions, opinion: value.opinion }
    : null;
}

function decodeCase(value: unknown): JunjichuCaseView | null {
  if (!isRecord(value) || !hasKeys(value, [
    "id", "decreeText", "departments", "status", "processingPath", "completedMinistryOpinions",
    "councilVerdict", "replyId", "failureReason", "createdAt", "updatedAt",
  ]) || typeof value.id !== "string" || !value.id.trim() || typeof value.decreeText !== "string" ||
    !value.decreeText.trim() || typeof value.status !== "string" ||
    !(CASE_STATUSES as readonly string[]).includes(value.status) || !isStringArray(value.departments) ||
    !isStringArray(value.processingPath) || !Array.isArray(value.completedMinistryOpinions) ||
    !isNullableString(value.councilVerdict) || !isNullableString(value.replyId) ||
    !isNullableString(value.failureReason) || typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string") return null;
  const completedMinistryOpinions = value.completedMinistryOpinions.map(decodeOpinion);
  if (!completedMinistryOpinions.every((item): item is JunjichuCaseView["completedMinistryOpinions"][number] => item !== null)) return null;
  return {
    id: value.id,
    decreeText: value.decreeText,
    departments: value.departments,
    status: value.status as JunjichuCaseStatus,
    processingPath: value.processingPath,
    completedMinistryOpinions,
    councilVerdict: value.councilVerdict,
    replyId: value.replyId,
    failureReason: value.failureReason,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function decodeJunjichuCasesPayload(value: unknown): JunjichuCaseView[] | null {
  if (!isRecord(value) || !hasKeys(value, ["status", "cases"]) || value.status !== "ok" || !Array.isArray(value.cases)) return null;
  const cases = value.cases.map(decodeCase);
  return cases.every((item): item is JunjichuCaseView => item !== null) ? cases : null;
}

function initialState(): JunjichuControllerState {
  return {
    status: "loading", activeCases: null, archivedCases: null, failedCases: null, departments: [], department: "",
    caseStatus: "", keyword: "", selectedId: null, error: null,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function caseMatches(item: JunjichuCaseView, state: JunjichuControllerState): boolean {
  return (!state.department || item.departments.includes(state.department)) &&
    (!state.caseStatus || item.status === state.caseStatus) &&
    (!state.keyword || `${item.decreeText} ${item.departments.join(" ")}`.includes(state.keyword.trim()));
}

function projectCases(allCases: JunjichuCaseView[], state: JunjichuControllerState): JunjichuControllerState {
  const matching = allCases.filter((item) => caseMatches(item, state));
  const activeCases = matching.filter((item) => item.status !== "ARCHIVED" && item.status !== "FAILED");
  const archivedCases = matching.filter((item) => item.status === "ARCHIVED");
  const failedCases = matching.filter((item) => item.status === "FAILED");
  const visible = [...activeCases, ...archivedCases, ...failedCases];
  const selectedId = visible.some((item) => item.id === state.selectedId) ? state.selectedId : visible[0]?.id ?? null;
  return { ...state, status: visible.length ? "ready" : "empty", activeCases, archivedCases, failedCases, selectedId, error: null };
}

export function createJunjichuController({
  fetch,
  redirect,
  schedule = queueMicrotask,
}: {
  fetch: FetchCases;
  redirect(location: string): void;
  schedule?(task: () => void): void;
}): JunjichuController {
  let state = initialState();
  let allCases: JunjichuCaseView[] = [];
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
  const isCurrent = (requestGeneration: number) => active && !disposed && generation === requestGeneration;
  const dispose = () => {
    if (disposed) return;
    active = false; disposed = true; generation += 1; activeRequest?.abort(); activeRequest = null;
    listeners.clear(); allCases = [];
  };
  const load = () => {
    if (!active || disposed) return;
    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    const requestGeneration = ++generation;
    publish({ ...state, status: "loading", activeCases: null, archivedCases: null, failedCases: null, selectedId: null, error: null });
    void (async () => {
      try {
        const response = await fetch(CASES_URL, { cache: "no-store", signal: request.signal });
        if (!isCurrent(requestGeneration) || request.signal.aborted) return;
        if (response.status === 401) {
          schedule(() => { if (isCurrent(requestGeneration) && !request.signal.aborted) redirect(LOGIN_LOCATION); });
          return;
        }
        const decoded = response.ok ? decodeJunjichuCasesPayload(await response.json()) : null;
        if (!isCurrent(requestGeneration) || request.signal.aborted) return;
        if (decoded === null) throw new Error(READ_ERROR);
        allCases = decoded;
        const departments = [...new Set(allCases.flatMap((item) => item.departments))];
        publish(projectCases(allCases, { ...state, departments }));
      } catch (error) {
        if (!isCurrent(requestGeneration) || request.signal.aborted || isAbortError(error)) return;
        publish({ ...state, status: "error", activeCases: null, archivedCases: null, failedCases: null, selectedId: null, error: READ_ERROR });
      }
    })();
  };

  return {
    get state() { return state; },
    connect(listener) {
      if (disposed) return () => undefined;
      lifecycleVersion += 1; active = true; listeners.add(listener); listener(state);
      let connected = true;
      return () => {
        if (!connected) return;
        connected = false; listeners.delete(listener);
        if (listeners.size > 0) return;
        active = false;
        const pendingVersion = ++lifecycleVersion;
        schedule(() => { if (!disposed && listeners.size === 0 && lifecycleVersion === pendingVersion) dispose(); });
      };
    },
    start() { if (!started && active && !disposed) { started = true; load(); } },
    retry: load,
    selectDepartment(department) { if (active && !disposed) publish(projectCases(allCases, { ...state, department })); },
    selectStatus(caseStatus) { if (active && !disposed) publish(projectCases(allCases, { ...state, caseStatus })); },
    selectKeyword(keyword) { if (active && !disposed) publish(projectCases(allCases, { ...state, keyword })); },
    selectCase(id) {
      if (active && !disposed && [...(state.activeCases ?? []), ...(state.archivedCases ?? []), ...(state.failedCases ?? [])].some((item) => item.id === id)) {
        publish({ ...state, selectedId: id });
      }
    },
  };
}

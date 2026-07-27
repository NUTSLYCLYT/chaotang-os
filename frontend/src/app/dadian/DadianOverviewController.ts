import type { DadianOverview } from "../../lib/backendClient";

const OVERVIEW_ERROR = "大殿概览暂时不可用，请稍后重试。";
const LOGIN_LOCATION = "/login?next=%2Fdadian";

type FetchOverview = (
  input: string,
  init?: { cache?: RequestCache; signal?: AbortSignal },
) => Promise<Response>;

export interface DadianOverviewViewState {
  department: string;
  overview: DadianOverview | null;
  error: string | null;
}

export interface DadianOverviewController {
  getState(): DadianOverviewViewState;
  loadInitial(): Promise<void>;
  selectDepartment(department: string): Promise<void>;
  retry(): Promise<void>;
  dispose(): void;
}

export const INITIAL_DADIAN_OVERVIEW_STATE: DadianOverviewViewState = {
  department: "",
  overview: null,
  error: null,
};

function buildOverviewUrl(department: string): string {
  return department
    ? `/api/dadian/overview?department=${encodeURIComponent(department)}`
    : "/api/dadian/overview";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(record);
  return actual.length === keys.length && keys.every((key) => key in record);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isFinite(value) && Number.isInteger(value) && Number(value) >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDateTime(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function parseOverviewResponse(value: unknown): DadianOverview | null {
  if (!isRecord(value) || !hasExactKeys(value, ["status", "overview"])) {
    return null;
  }
  if (value.status !== "ok" || !isRecord(value.overview)) {
    return null;
  }
  const overview = value.overview;
  if (
    !hasExactKeys(overview, [
      "replyCount",
      "departmentCounts",
      "recentReplies",
      "pendingReviewCount",
      "todayFocus",
    ]) ||
    !isNonNegativeInteger(overview.replyCount) ||
    !isNonNegativeInteger(overview.pendingReviewCount) ||
    !isNonEmptyString(overview.todayFocus) ||
    !Array.isArray(overview.departmentCounts) ||
    !Array.isArray(overview.recentReplies)
  ) {
    return null;
  }

  const departmentCounts: DadianOverview["departmentCounts"] = [];
  for (const item of overview.departmentCounts) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["department", "count"]) ||
      !isNonEmptyString(item.department) ||
      !isNonNegativeInteger(item.count)
    ) {
      return null;
    }
    departmentCounts.push({ department: item.department, count: item.count });
  }

  const recentReplies: DadianOverview["recentReplies"] = [];
  for (const item of overview.recentReplies) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, [
        "id",
        "title",
        "participatingDepartments",
        "replyConclusion",
        "replyTime",
        "createdAt",
        "respondent",
      ]) ||
      !isNonEmptyString(item.id) ||
      !isNonEmptyString(item.title) ||
      !isNonEmptyStringArray(item.participatingDepartments) ||
      !isNonEmptyString(item.replyConclusion) ||
      !isIsoDateTime(item.replyTime) ||
      !isIsoDateTime(item.createdAt) ||
      !isNonEmptyString(item.respondent)
    ) {
      return null;
    }
    recentReplies.push({
      id: item.id,
      title: item.title,
      participatingDepartments: [...item.participatingDepartments],
      replyConclusion: item.replyConclusion,
      replyTime: item.replyTime,
      createdAt: item.createdAt,
      respondent: item.respondent,
    });
  }

  return {
    replyCount: overview.replyCount,
    departmentCounts,
    recentReplies,
    pendingReviewCount: overview.pendingReviewCount,
    todayFocus: overview.todayFocus,
  };
}

export function createDadianOverviewController({
  fetch,
  navigate,
  onStateChange,
}: {
  fetch: FetchOverview;
  navigate(location: string): void;
  onStateChange(state: DadianOverviewViewState): void;
}): DadianOverviewController {
  let state = INITIAL_DADIAN_OVERVIEW_STATE;
  let availableDepartments: DadianOverview["departmentCounts"] = [];
  let activeRequest: AbortController | null = null;
  let requestSequence = 0;

  const publish = (nextState: DadianOverviewViewState) => {
    state = nextState;
    onStateChange(state);
  };

  const load = async (department: string, publishLoading: boolean) => {
    const lastKnownGood = state.overview;
    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    requestSequence += 1;
    const sequence = requestSequence;

    if (publishLoading) {
      publish({ department, overview: lastKnownGood, error: null });
    }

    try {
      const response = await fetch(buildOverviewUrl(department), {
        cache: "no-store",
        signal: request.signal,
      });
      if (sequence !== requestSequence || request.signal.aborted) return;
      if (response.status === 401) {
        navigate(LOGIN_LOCATION);
        return;
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error(OVERVIEW_ERROR);
      }
      const overview = response.ok ? parseOverviewResponse(body) : null;
      if (overview === null) throw new Error(OVERVIEW_ERROR);
      if (sequence !== requestSequence || request.signal.aborted) return;

      if (!department) {
        availableDepartments = overview.departmentCounts;
      }
      publish({
        department,
        overview: {
          ...overview,
          departmentCounts:
            availableDepartments.length > 0
              ? availableDepartments
              : overview.departmentCounts,
        },
        error: null,
      });
    } catch {
      if (sequence !== requestSequence || request.signal.aborted) return;
      publish({ department, overview: lastKnownGood, error: OVERVIEW_ERROR });
    }
  };

  return {
    getState: () => state,
    loadInitial: () => load("", false),
    selectDepartment: (department) => load(department, true),
    retry: () => load(state.department, true),
    dispose: () => {
      requestSequence += 1;
      activeRequest?.abort();
      activeRequest = null;
    },
  };
}

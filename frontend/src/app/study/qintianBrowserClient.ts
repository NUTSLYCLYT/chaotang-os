import {
  parseQintianConsultResponse,
  parseQintianForecast,
  parseQintianPendingTriggers,
  parseQintianReview,
  type QintianEvidenceRef,
  type QintianForecast,
  type QintianPendingTrigger,
  type QintianReview,
  type QintianReviewDecision,
  type QintianSubject,
} from "./qintianContracts.ts";

export type QintianBrowserResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "unauthenticated" | "validation" | "provider_unavailable" | "unknown"; message: string };

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function read(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return object(await response.json());
  } catch {
    return null;
  }
}

function failure(response: Response, body: Record<string, unknown> | null): QintianBrowserResult<never> {
  const reason = typeof body?.reason === "string" ? body.reason : "";
  const message = typeof body?.message === "string" && body.message.trim()
    ? body.message
    : "钦天监服务暂不可用";
  if (response.status === 401) return { ok: false, kind: "unauthenticated", message };
  if (response.status === 400 || response.status === 422) return { ok: false, kind: "validation", message };
  if (reason === "model_unavailable" || reason === "config_unavailable" || response.status === 502) {
    return { ok: false, kind: "provider_unavailable", message };
  }
  return { ok: false, kind: "unknown", message };
}

async function post<T>(
  url: string,
  body: unknown,
  select: (value: Record<string, unknown>) => unknown,
  parse: (value: unknown) => T | null,
  fetchImpl: FetchLike,
): Promise<QintianBrowserResult<T>> {
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await read(response);
    if (!response.ok || !payload) return failure(response, payload);
    const parsed = parse(select(payload));
    return parsed
      ? { ok: true, data: parsed }
      : { ok: false, kind: "unknown", message: "钦天监返回了无法识别的结果" };
  } catch {
    return { ok: false, kind: "unknown", message: "钦天监服务暂不可用" };
  }
}

export interface QintianForecastInput {
  idempotencyKey: string;
  subject: QintianSubject;
  question: string;
  evidenceRefs: QintianEvidenceRef[];
  reviewAt: string;
}

export function createQintianForecastFromBrowser(
  input: QintianForecastInput,
  fetchImpl: FetchLike = fetch,
): Promise<QintianBrowserResult<QintianForecast>> {
  return post(
    "/api/qintianjian/forecasts",
    input,
    (value) => value.forecast,
    parseQintianForecast,
    fetchImpl,
  );
}

export function consultQintianFromBrowser(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  fetchImpl: FetchLike = fetch,
) {
  return post(
    "/api/qintianjian/consult",
    { messages },
    (value) => value,
    parseQintianConsultResponse,
    fetchImpl,
  );
}

export async function loadPendingQintianTriggersFromBrowser(
  fetchImpl: FetchLike = fetch,
): Promise<QintianBrowserResult<QintianPendingTrigger[]>> {
  try {
    const response = await fetchImpl("/api/qintianjian/triggers/pending", { method: "GET" });
    const payload = await read(response);
    if (!response.ok || !payload) return failure(response, payload);
    const parsed = parseQintianPendingTriggers({ items: payload.triggers });
    return parsed
      ? { ok: true, data: parsed.items }
      : { ok: false, kind: "unknown", message: "钦天监返回了无法识别的触发器" };
  } catch {
    return { ok: false, kind: "unknown", message: "钦天监服务暂不可用" };
  }
}

export function reviewQintianForecastFromBrowser(
  forecastId: string,
  input: {
    triggerId: string;
    decision: QintianReviewDecision;
    observation: string;
    judgmentInvalidated: boolean;
  },
  fetchImpl: FetchLike = fetch,
): Promise<QintianBrowserResult<QintianReview>> {
  return post(
    `/api/qintianjian/forecasts/${encodeURIComponent(forecastId)}/reviews`,
    input,
    (value) => value.review,
    parseQintianReview,
    fetchImpl,
  );
}

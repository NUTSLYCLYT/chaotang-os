import { readSessionId } from "../../../lib/session.ts";
import type {
  QintianClientError,
  QintianClientResult,
  QintianConsultRequest,
  QintianCreateForecastRequest,
  QintianReviewRequest,
} from "../../../lib/backendClient.ts";

type ObjectValue = Record<string, unknown>;
const SUBJECT_KINDS = new Set(["DECREE", "DRAFT", "REPLY"]);
const REVIEW_DECISIONS = new Set(["KEEP", "INVALIDATE", "REQUEST_RERUN", "ESCALATE_TO_CHANCELLOR"]);

function object(value: unknown): ObjectValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : null;
}
function exact(value: ObjectValue, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && [...keys].sort().every((key, index) => key === actual[index]);
}
function text(value: unknown, max = 4000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
function isoDate(value: unknown): value is string {
  return text(value, 64) && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
export function requireSession(request: Request): string | Response {
  return readSessionId(request) ?? json({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
}
export function hasNoQuery(request: Request): boolean {
  return [...new URL(request.url).searchParams.keys()].length === 0;
}
export async function readJson(request: Request): Promise<unknown | null> {
  try { return await request.json(); } catch { return null; }
}
export function parseConsultBody(value: unknown): QintianConsultRequest | null {
  const item = object(value);
  if (!item || !exact(item, ["messages"]) || !Array.isArray(item.messages) ||
      item.messages.length < 1 || item.messages.length > 20) return null;
  const messages: QintianConsultRequest["messages"] = [];
  for (const raw of item.messages) {
    const message = object(raw);
    if (!message || !exact(message, ["role", "content"]) ||
        (message.role !== "user" && message.role !== "assistant") || !text(message.content, 4000)) return null;
    messages.push({ role: message.role, content: message.content });
  }
  if (messages[0].role !== "user" || messages.at(-1)?.role !== "user" ||
      messages.some((message, index) => index > 0 && message.role === messages[index - 1].role)) return null;
  return { messages };
}
export function parseCreateBody(value: unknown): QintianCreateForecastRequest | null {
  const item = object(value);
  if (!item || !exact(item, ["idempotencyKey", "subject", "question", "evidenceRefs", "reviewAt"]) ||
      !text(item.idempotencyKey, 128) || item.idempotencyKey.length < 8 || !text(item.question, 4000) ||
      !isoDate(item.reviewAt) || !Array.isArray(item.evidenceRefs) || item.evidenceRefs.length > 50) return null;
  const rawSubject = object(item.subject);
  if (!rawSubject || !exact(rawSubject, ["kind", "id", "title", "content"]) ||
      !SUBJECT_KINDS.has(rawSubject.kind as string) || !text(rawSubject.id, 200) ||
      !text(rawSubject.title, 500) || !text(rawSubject.content, 20000)) return null;
  const evidenceRefs: QintianCreateForecastRequest["evidenceRefs"] = [];
  for (const raw of item.evidenceRefs) {
    const evidence = object(raw);
    if (!evidence || !exact(evidence, ["id", "summary", "source", "asOf"]) ||
        !text(evidence.id, 200) || !text(evidence.summary, 2000) || !text(evidence.source, 500) ||
        !(evidence.asOf === null || isoDate(evidence.asOf))) return null;
    evidenceRefs.push({ id: evidence.id, summary: evidence.summary, source: evidence.source, asOf: evidence.asOf });
  }
  return {
    idempotencyKey: item.idempotencyKey,
    subject: {
      kind: rawSubject.kind as QintianCreateForecastRequest["subject"]["kind"],
      id: rawSubject.id, title: rawSubject.title, content: rawSubject.content,
    },
    question: item.question, evidenceRefs, reviewAt: item.reviewAt,
  };
}
export function parseReviewBody(value: unknown): QintianReviewRequest | null {
  const item = object(value);
  if (!item || !exact(item, ["triggerId", "decision", "observation", "judgmentInvalidated"]) ||
      !text(item.triggerId, 200) || !REVIEW_DECISIONS.has(item.decision as string) ||
      !text(item.observation, 4000) || typeof item.judgmentInvalidated !== "boolean") return null;
  return {
    triggerId: item.triggerId,
    decision: item.decision as QintianReviewRequest["decision"],
    observation: item.observation,
    judgmentInvalidated: item.judgmentInvalidated,
  };
}
export function decodeRouteId(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return text(decoded, 256) ? decoded : null;
  } catch {
    return null;
  }
}

const SAFE_ERRORS: Record<QintianClientError, { status: number; message: string }> = {
  unauthenticated: { status: 401, message: "authentication required" },
  validation: { status: 400, message: "请求格式无效" },
  not_found: { status: 404, message: "未找到对应的钦天监记录" },
  config_unavailable: { status: 503, message: "钦天监服务尚未配置" },
  model_unavailable: { status: 502, message: "钦天监模型暂不可用" },
  network: { status: 503, message: "钦天监服务暂不可用" },
  unknown: { status: 503, message: "钦天监服务暂不可用" },
};
export function safeFailure(result: Extract<QintianClientResult<unknown>, { ok: false }>): Response {
  const error = SAFE_ERRORS[result.kind];
  return json({ status: "error", reason: result.kind, message: error.message }, error.status);
}
export function validationFailure(): Response {
  return json({ status: "error", reason: "validation", message: "请求格式无效" }, 400);
}

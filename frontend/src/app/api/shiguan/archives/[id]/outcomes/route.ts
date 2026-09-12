// Lands at frontend/src/app/api/shiguan/archives/[id]/outcomes/route.ts
import {
  type CreateShiguanOutcomeInput,
  type ShiguanOutcomeValue,
  createShiguanOutcome,
  listShiguanArchiveOutcomes,
} from "../../../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../../../lib/session.ts";

const OUTCOMES = new Set<ShiguanOutcomeValue>([
  "ACHIEVED",
  "PARTIAL",
  "NOT_ACHIEVED",
  "OBSERVING",
]);

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/u;
const EVENT_ID_RE = /^[0-9a-f]{32}$/u;

const FRIENDLY_MESSAGE_BY_KIND = {
  validation: "结果记录未通过校验，请确认结果类型与发生时间后重试。",
  not_found: "未找到对应史馆档案。",
  conflict: "记录条件、幂等请求或更正目标存在冲突，请刷新并核对回奏采纳状态、证据和最新记录。",
  storage: "史馆暂时不可用，请稍后重试。",
  network: "无法连接朝堂后端，请稍后重试。",
  unknown: "史馆服务暂时不可用，请稍后重试。",
  unauthenticated: "authentication required",
} as const;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorStatus(kind: keyof typeof FRIENDLY_MESSAGE_BY_KIND): number {
  if (kind === "unauthenticated") return 401;
  if (kind === "validation") return 422;
  if (kind === "not_found") return 404;
  if (kind === "conflict") return 409;
  return 503;
}

function validationError(message: string): Response {
  return jsonResponse({ status: "error", reason: "validation", message }, 400);
}

function unauthenticated(): Response {
  return jsonResponse(
    { status: "error", reason: "unauthenticated", message: "authentication required" },
    401,
  );
}

function backendError(kind: keyof typeof FRIENDLY_MESSAGE_BY_KIND): Response {
  return jsonResponse(
    { status: "error", reason: kind, message: FRIENDLY_MESSAGE_BY_KIND[kind] },
    errorStatus(kind),
  );
}

function readArchiveId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || value.length > 200) return null;
  return value;
}

/**
 * 结果记录是闭合契约：恰好三个必填键，外加可选的 supersedesEventId。
 * 幂等键必须由调用方给出并原样透传——BFF 自行生成会破坏后端的幂等语义。
 */
function readCreateInput(value: unknown): CreateShiguanOutcomeInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const hasSupersedes = "supersedesEventId" in record;
  const expected = hasSupersedes ? 4 : 3;
  if (keys.length !== expected) return null;
  if (
    typeof record.outcome !== "string" ||
    !OUTCOMES.has(record.outcome as ShiguanOutcomeValue) ||
    typeof record.occurredAt !== "string" ||
    record.occurredAt.trim().length === 0 ||
    typeof record.idempotencyKey !== "string" ||
    !IDEMPOTENCY_KEY_RE.test(record.idempotencyKey)
  ) {
    return null;
  }
  if (hasSupersedes) {
    if (typeof record.supersedesEventId !== "string" || !EVENT_ID_RE.test(record.supersedesEventId)) {
      return null;
    }
    return {
      outcome: record.outcome as ShiguanOutcomeValue,
      occurredAt: record.occurredAt,
      idempotencyKey: record.idempotencyKey,
      supersedesEventId: record.supersedesEventId,
    };
  }
  return {
    outcome: record.outcome as ShiguanOutcomeValue,
    occurredAt: record.occurredAt,
    idempotencyKey: record.idempotencyKey,
  };
}

function readPaging(request: Request): { limit?: number; cursor?: string } | null {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const rawCursor = url.searchParams.get("cursor");
  const paging: { limit?: number; cursor?: string } = {};
  if (rawLimit !== null) {
    if (!/^\d+$/u.test(rawLimit)) return null;
    const limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return null;
    paging.limit = limit;
  }
  if (rawCursor !== null) {
    if (rawCursor.trim().length === 0 || rawCursor.length > 256) return null;
    paging.cursor = rawCursor;
  }
  return paging;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return unauthenticated();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return validationError("请求体不是合法 JSON。");
  }

  const input = readCreateInput(payload);
  if (input === null) {
    return validationError("结果记录必须且只能包含合法的 outcome、occurredAt 与 idempotencyKey。");
  }

  const { id } = await context.params;
  const archiveId = readArchiveId(id);
  if (archiveId === null) return validationError("档案标识不合法。");

  const result = await createShiguanOutcome(archiveId, input, { sessionId });
  if (result.ok) {
    return jsonResponse({ status: "ok", outcome: result.data }, 201);
  }
  return backendError(result.kind);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return unauthenticated();

  const paging = readPaging(request);
  if (paging === null) return validationError("分页参数不合法：limit 需在 1 到 100 之间。");

  const { id } = await context.params;
  const archiveId = readArchiveId(id);
  if (archiveId === null) return validationError("档案标识不合法。");

  const result = await listShiguanArchiveOutcomes(archiveId, { sessionId, ...paging });
  if (result.ok) {
    return jsonResponse({ status: "ok", page: result.data }, 200);
  }
  return backendError(result.kind);
}

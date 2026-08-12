
import {
  confirmDailyMemorialDraft,
  type DailyMemorialConfirmInput,
} from "../../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../../lib/session.ts";

const SAFE_DRAFT_ID = /^[0-9a-f]{32}$/;
const FINGERPRINT = /^[0-9a-f]{64}$/;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function failure(kind: "unauthenticated" | "not_found" | "conflict" | "storage" | "network" | "unknown"): Response {
  const status = kind === "unauthenticated" ? 401 : kind === "not_found" ? 404 : kind === "conflict" ? 409 : 503;
  const message = kind === "unauthenticated"
    ? "需要登录"
    : kind === "not_found"
      ? "未找到每日奏报"
      : kind === "conflict"
        ? "每日奏报草稿已更新"
        : "每日奏报暂时不可用";
  return json({ status: "error", reason: kind, message }, status);
}

function parseBody(value: unknown): DailyMemorialConfirmInput | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 2 ||
    !("version" in record) ||
    !("fingerprint" in record) ||
    !Number.isSafeInteger(record.version) ||
    (record.version as number) < 1 ||
    typeof record.fingerprint !== "string" ||
    !FINGERPRINT.test(record.fingerprint)
  ) return null;
  return { version: record.version as number, fingerprint: record.fingerprint };
}

export function createConfirmHandler(confirm: typeof confirmDailyMemorialDraft = confirmDailyMemorialDraft) {
  return async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    const sessionId = readSessionId(request);
    if (!sessionId) return failure("unauthenticated");
    if ([...new URL(request.url).searchParams.keys()].length !== 0) {
      return json({ status: "error", reason: "validation", message: "请求格式无效" }, 400);
    }
    const { id } = await context.params;
    if (!SAFE_DRAFT_ID.test(id)) return json({ status: "error", reason: "validation", message: "请求格式无效" }, 400);
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json({ status: "error", reason: "validation", message: "请求格式无效" }, 400);
    }
    const input = parseBody(raw);
    if (input === null) return json({ status: "error", reason: "validation", message: "请求格式无效" }, 400);
    try {
      const result = await confirm(id, input, { sessionId });
      return result.ok ? json({ status: "ok", confirmation: result.data }, 200) : failure(result.kind);
    } catch {
      return failure("unknown");
    }
  };
}

export const POST = createConfirmHandler();

import { NextResponse } from "next/server";

import { chancellorDraft } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

export async function POST(request: Request) {
  const sessionId = readSessionId(request);
  if (!sessionId) {
    return NextResponse.json({ status: "error", message: "请先登录" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "请求格式无效" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ status: "error", message: "请求格式无效" }, { status: 400 });
  }
  const payload = body as { messages?: unknown; version?: unknown };
  if (!Array.isArray(payload.messages) || !Number.isInteger(payload.version)) {
    return NextResponse.json({ status: "error", message: "请求格式无效" }, { status: 400 });
  }
  const result = await chancellorDraft(
    payload.messages as Array<{ role: "user" | "assistant"; content: string }>,
    payload.version as number,
    { sessionId },
  );
  if (result.ok) return NextResponse.json(result.draft);
  const status = result.kind === "unauthenticated" ? 401 :
    result.kind === "validation" ? 422 :
    result.kind === "config" ? 503 :
    result.kind === "model" ? 502 : 502;
  return NextResponse.json(
    { status: "error", message: "丞相（拟旨）暂时无法回应，请稍后再试" },
    { status },
  );
}

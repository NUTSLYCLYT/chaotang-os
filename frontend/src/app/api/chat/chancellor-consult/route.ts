import { NextResponse } from "next/server";

import { chancellorConsult } from "../../../../lib/backendClient";
import { readSessionId } from "../../../../lib/session";

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
  if (!body || typeof body !== "object" || !Array.isArray((body as { messages?: unknown }).messages)) {
    return NextResponse.json({ status: "error", message: "请求格式无效" }, { status: 400 });
  }
  const result = await chancellorConsult(
    (body as { messages: Array<{ role: "user" | "assistant"; content: string }> }).messages,
    { sessionId },
  );
  if (result.ok) return NextResponse.json({ status: "ok", consultant: result.consultant, reply: result.reply });
  const status = result.kind === "unauthenticated" ? 401 :
    result.kind === "validation" ? 422 :
    result.kind === "config" ? 503 :
    result.kind === "model" ? 502 : 502;
  return NextResponse.json(
    { status: "error", message: "丞相（咨询）暂时无法回应，请稍后再试" },
    { status },
  );
}

import { getCapability } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

const FRIENDLY = {
  unauthenticated: "authentication required",
  validation: "能力编号未通过校验。",
  not_found: "能力不存在。",
  storage: "能力总账暂时不可用，请稍后重试。",
  network: "无法连接朝堂后端，请稍后重试。",
  unknown: "能力总账只读服务暂时不可用，请稍后重试。",
} as const;

function reply(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function statusFor(kind: keyof typeof FRIENDLY): number {
  if (kind === "unauthenticated") return 401;
  if (kind === "validation") return 400;
  if (kind === "not_found") return 404;
  return 503;
}

async function readCapabilityId(context: { params: Promise<{ id: string }> | { id: string } }): Promise<string> {
  return (await context.params).id;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return reply({ status: "error", reason: "unauthenticated", message: FRIENDLY.unauthenticated }, 401);
  const id = await readCapabilityId(context);
  if (!id || id.trim().length < 3) return reply({ status: "error", reason: "validation", message: FRIENDLY.validation }, 400);

  const result = await getCapability(id, { sessionId });
  if (result.ok) return reply({ status: "ok", capability: result.data }, 200);
  return reply({ status: "error", reason: result.kind, message: FRIENDLY[result.kind] }, statusFor(result.kind));
}

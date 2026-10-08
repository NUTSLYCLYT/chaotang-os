import { getCrmProviderPassport } from "../../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../../lib/session.ts";

const FRIENDLY = {
  unauthenticated: "authentication required",
  not_found: "该 CRM 尚未获得鸿胪寺能力护照。",
  storage: "鸿胪寺能力护照暂时不可用，请稍后重试。",
  validation: "CRM provider 不符合护照查询格式。",
  network: "无法连接鸿胪寺能力服务，请稍后重试。",
  unknown: "鸿胪寺能力护照暂时不可用，请稍后重试。",
} as const;

function reply(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function statusFor(kind: keyof typeof FRIENDLY): number {
  if (kind === "unauthenticated") return 401;
  if (kind === "not_found") return 404;
  if (kind === "validation") return 400;
  return 503;
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return reply({ status: "error", reason: "unauthenticated", message: FRIENDLY.unauthenticated }, 401);
  const { provider } = await context.params;
  if (!provider || provider.length > 128 || !/^[a-z0-9][a-z0-9._-]*$/i.test(provider)) {
    return reply({ status: "error", reason: "validation", message: FRIENDLY.validation }, 400);
  }
  const result = await getCrmProviderPassport(provider, { sessionId });
  if (result.ok) return reply({ status: "ok", passport: result.data }, 200);
  return reply({ status: "error", reason: result.kind, message: FRIENDLY[result.kind] }, statusFor(result.kind));
}

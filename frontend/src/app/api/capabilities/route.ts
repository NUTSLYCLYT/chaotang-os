import { listCapabilities, type CapabilityListOptions } from "../../../lib/backendClient.ts";
import { readSessionId } from "../../../lib/session.ts";

const ALLOWED_QUERY = new Set(["type", "home", "source", "status", "risk"]);
const FRIENDLY = {
  unauthenticated: "authentication required",
  validation: "能力筛选条件未通过校验。",
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

function validateQuery(url: URL): boolean {
  return [...url.searchParams.keys()].every((key) => ALLOWED_QUERY.has(key) && url.searchParams.getAll(key).length === 1);
}

export async function GET(request: Request): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return reply({ status: "error", reason: "unauthenticated", message: FRIENDLY.unauthenticated }, 401);

  const url = new URL(request.url);
  if (!validateQuery(url)) return reply({ status: "error", reason: "validation", message: FRIENDLY.validation }, 400);

  const options: CapabilityListOptions = {
    sessionId,
    ...(url.searchParams.get("type") ? { type: url.searchParams.get("type") as CapabilityListOptions["type"] } : {}),
    ...(url.searchParams.get("home") ? { home: url.searchParams.get("home") ?? undefined } : {}),
    ...(url.searchParams.get("source") ? { source: url.searchParams.get("source") as CapabilityListOptions["source"] } : {}),
    ...(url.searchParams.get("status") ? { status: url.searchParams.get("status") as CapabilityListOptions["status"] } : {}),
    ...(url.searchParams.get("risk") ? { risk: url.searchParams.get("risk") as CapabilityListOptions["risk"] } : {}),
  };
  const result = await listCapabilities(options);
  if (result.ok) return reply({ status: "ok", registry: result.data }, 200);
  return reply({ status: "error", reason: result.kind, message: FRIENDLY[result.kind] }, statusFor(result.kind));
}

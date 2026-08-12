import {
  type JunjichuCaseStatus,
  listJunjichuCases,
} from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

const STATUSES = new Set<JunjichuCaseStatus>([
  "MINISTRY_REVIEWING", "COUNCIL_REVIEWING", "CHANCELLOR_FINALIZING", "ARCHIVED", "FAILED",
]);
const FRIENDLY = {
  validation: "查询条件未通过校验。",
  not_found: "未找到对应军机处案卷。",
  storage: "军机处案卷暂时不可用，请稍后重试。",
  network: "无法连接朝堂后端，请稍后重试。",
  unknown: "军机处案卷服务暂时不可用，请稍后重试。",
  unauthenticated: "authentication required",
} as const;

function reply(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function createCasesHandler(readCases: typeof listJunjichuCases = listJunjichuCases) {
  return async function GET(request: Request): Promise<Response> {
    const sessionId = readSessionId(request);
    if (!sessionId) return reply({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
    const params = new URL(request.url).searchParams;
    const allowed = ["status", "department", "keyword"];
    if ([...params.keys()].some((key) => !allowed.includes(key)) || allowed.some((key) => params.getAll(key).length > 1)) {
      return reply({ status: "error", reason: "validation", message: FRIENDLY.validation }, 400);
    }
    const status = params.get("status");
    if (status !== null && (!status || !STATUSES.has(status as JunjichuCaseStatus))) {
      return reply({ status: "error", reason: "validation", message: FRIENDLY.validation }, 400);
    }
    const result = await readCases({
      status: status === null ? undefined : status as JunjichuCaseStatus,
      department: params.get("department") ?? undefined,
      keyword: params.get("keyword") ?? undefined,
      sessionId,
    });
    if (result.ok) return reply({ status: "ok", cases: result.data }, 200);
    const responseStatus = result.kind === "unauthenticated" ? 401 : result.kind === "validation" ? 400 : result.kind === "not_found" ? 404 : 503;
    return reply({ status: "error", reason: result.kind, message: FRIENDLY[result.kind] }, responseStatus);
  };
}

export const GET = createCasesHandler();

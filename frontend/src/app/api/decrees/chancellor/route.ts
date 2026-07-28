import { submitDecree } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

/**
 * `POST /api/decrees/chancellor` —— Next.js 服务端边界。
 *
 * 浏览器只能同源相对路径调用本 Route Handler，绝不直接获取 `BACKEND_BASE_URL` 或
 * 请求 FastAPI；本文件在服务端调用 `src/lib/backendClient.ts` 的 `submitDecree()`，
 * 再把其稳定结果（`SubmitDecreeResult`）映射为真实 HTTP 状态码与脱敏 JSON 响应体
 * 返回给浏览器。
 *
 * 刻意使用相对路径（而非 `@/lib/backendClient` 路径别名）导入，并显式带上 `.ts`
 * 扩展名：这样 `route.test.ts` 才能在纯 `node --test` 环境（不经过 Next.js/webpack
 * 打包）里直接 `import { POST } from "./route.ts"` 并让其内部依赖被正确解析——
 * `tsconfig.json` 的 `paths` 别名只在 Next.js 自身构建时生效，Node 原生 ESM 加载器
 * 不理解它（与 `src/lib/backendClient.test.ts` 采用相对路径导入被测模块的原因一致，
 * 详见 `frontend/AGENTS.md`「Test」章节）。
 */

/** `/study` 页面提交给本 Route Handler 的请求体形状。 */
interface ChancellorRequestBody {
  decreeText?: unknown;
}

interface ChancellorBureauOpinion {
  bureau: string;
  opinion: string;
}

/** 一个被军机处/单部门咨询的部门及其分层办理意见，保序。 */
interface ChancellorMinistryOpinion {
  department: string;
  bureauOpinions: ChancellorBureauOpinion[];
  opinion: string;
}

/**
 * 成功时返回给浏览器的响应体：原样透传 `submitDecree()` 映射出的新契约字段
 * （见 `docs/decisions/0012-decree-six-ministries-joint-review.md`），不新增字段、
 * 不做二次转换。
 */
interface ChancellorSuccessResponseBody {
  status: string;
  chancellor: string;
  routeType: string;
  rationale: string;
  processingPath: string[];
  departments: string[];
  ministryOpinions: ChancellorMinistryOpinion[];
  councilVerdict: string | null;
  finalVerdict: string;
  recommendations: string[];
}

/** 与 `submitDecree` 的 `kind` 保持一致的稳定错误分类，供浏览器区分场景展示。 */
type ChancellorErrorReason = "validation" | "config" | "model" | "timeout" | "network" | "unauthenticated" | "unknown";

/** 失败时返回给浏览器的脱敏响应体：不包含 key、路径、traceback 或异常原文。 */
interface ChancellorErrorResponseBody {
  status: "error";
  reason: ChancellorErrorReason;
  message: string;
}

/** `submitDecree` 的 `kind` -> 返回给浏览器的 HTTP 状态码。 */
const HTTP_STATUS_BY_KIND: Record<ChancellorErrorReason, number> = {
  validation: 422,
  config: 503,
  model: 502,
  timeout: 504,
  unauthenticated: 401,
  // 后端不可达 / 未识别的响应形状：统一映射为「服务暂时不可用」，不额外区分。
  network: 503,
  unknown: 503,
};

/** 每种错误分类对应的用户可读中文文案（脱敏，不透传后端/网络原始错误描述）。 */
const FRIENDLY_MESSAGE_BY_KIND: Record<ChancellorErrorReason, string> = {
  validation: "旨意校验未通过：请确认内容非空且不超过 2000 字后重试。",
  config: "朝堂后端配置暂不可用，请稍后重试或联系管理员。",
  model: "丞相暂时无法给出回奏，请稍后重试。",
  timeout: "下旨处理超时，请稍后重试。",
  unauthenticated: "authentication required",
  network: "无法连接朝堂后端，请稍后重试。",
  unknown: "服务暂时不可用，请稍后重试。",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function malformedRequestResponse(message: string): Response {
  const body: ChancellorErrorResponseBody = { status: "error", reason: "validation", message };
  return jsonResponse(body, 400);
}

export function createPostHandler(
  submit: typeof submitDecree = submitDecree,
  readSession: typeof readSessionId = readSessionId,
): (request: Request) => Promise<Response> {
  return async function handlePost(request: Request): Promise<Response> {
  const sessionId = readSession(request);
  if (!sessionId) {
    return jsonResponse({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return malformedRequestResponse("请求体不是合法的 JSON。");
  }

  if (typeof payload !== "object" || payload === null) {
    return malformedRequestResponse("请求体必须是一个 JSON 对象。");
  }

  const decreeText = (payload as ChancellorRequestBody).decreeText;
  if (typeof decreeText !== "string") {
    return malformedRequestResponse("请求体缺少字符串类型的 decreeText 字段。");
  }

  let result: Awaited<ReturnType<typeof submitDecree>>;
  try {
    result = await submit(decreeText, { sessionId });
  } catch {
    const body: ChancellorErrorResponseBody = {
      status: "error",
      reason: "unknown",
      message: FRIENDLY_MESSAGE_BY_KIND.unknown,
    };
    return jsonResponse(body, HTTP_STATUS_BY_KIND.unknown);
  }

  if (result.ok) {
    const body: ChancellorSuccessResponseBody = {
      status: result.data.status,
      chancellor: result.data.chancellor,
      routeType: result.data.routeType,
      rationale: result.data.rationale,
      processingPath: result.data.processingPath,
      departments: result.data.departments,
      ministryOpinions: result.data.ministryOpinions,
      councilVerdict: result.data.councilVerdict,
      finalVerdict: result.data.finalVerdict,
      recommendations: result.data.recommendations,
    };
    return jsonResponse(body, 200);
  }

  const body: ChancellorErrorResponseBody = {
    status: "error",
    reason: result.kind,
    message: FRIENDLY_MESSAGE_BY_KIND[result.kind],
  };
    return jsonResponse(body, HTTP_STATUS_BY_KIND[result.kind]);
  };
}

export const POST = createPostHandler();

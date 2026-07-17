import { getShiguanStatistics } from "../../../../lib/backendClient.ts";

const FRIENDLY_MESSAGE_BY_KIND = {
  validation: "史馆统计请求未通过校验。",
  not_found: "未找到对应史馆统计。",
  storage: "史馆暂时不可用，请稍后重试。",
  network: "无法连接朝堂后端，请稍后重试。",
  unknown: "史馆服务暂时不可用，请稍后重试。",
} as const;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(): Promise<Response> {
  const result = await getShiguanStatistics();

  if (result.ok) {
    return jsonResponse({ status: "ok", statistics: result.data }, 200);
  }

  return jsonResponse(
    {
      status: "error",
      reason: result.kind,
      message: FRIENDLY_MESSAGE_BY_KIND[result.kind],
    },
    result.kind === "validation" ? 422 : 503,
  );
}

import {
  forwardCourtSceneRequest,
  safeOpaqueId,
} from "../../sceneSupport.ts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const runId = safeOpaqueId((await context.params).runId);
  if (runId === null) {
    return new Response(JSON.stringify({ status: "error", reason: "validation" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return forwardCourtSceneRequest(
    request,
    `/api/v1/court/scene-runs/${encodeURIComponent(runId)}`,
    "GET",
  );
}

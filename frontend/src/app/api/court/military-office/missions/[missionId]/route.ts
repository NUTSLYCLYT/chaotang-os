import {
  forwardCourtSceneRequest,
  safeOpaqueId,
} from "../../../sceneSupport.ts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ missionId: string }> },
): Promise<Response> {
  const missionId = safeOpaqueId((await context.params).missionId);
  if (missionId === null) {
    return new Response(JSON.stringify({ status: "error", reason: "validation" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return forwardCourtSceneRequest(
    request,
    `/api/v1/court/military-office/missions/${encodeURIComponent(missionId)}`,
    "PATCH",
  );
}

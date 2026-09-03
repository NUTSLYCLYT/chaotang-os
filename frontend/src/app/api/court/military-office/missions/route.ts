import { forwardCourtSceneRequest } from "../../sceneSupport.ts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_QUERY = new Set(["stage", "risk_grade", "pack_slug"]);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((key) => !ALLOWED_QUERY.has(key))) {
    return new Response(JSON.stringify({ status: "error", reason: "validation" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return forwardCourtSceneRequest(
    request,
    `/api/v1/court/military-office/missions${url.search}`,
    "GET",
  );
}

import {
  forwardCourtSceneRequest,
  safeSceneSlug,
} from "../../sceneSupport.ts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const slug = safeSceneSlug((await context.params).slug);
  if (slug === null) {
    return new Response(JSON.stringify({ status: "error", reason: "validation" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return forwardCourtSceneRequest(
    request,
    `/api/v1/court/scene-packs/${encodeURIComponent(slug)}`,
    "GET",
  );
}

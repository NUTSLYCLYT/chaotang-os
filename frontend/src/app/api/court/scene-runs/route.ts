import { forwardCourtSceneRequest } from "../sceneSupport.ts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request): Promise<Response> {
  return forwardCourtSceneRequest(request, "/api/v1/court/scene-runs", "POST");
}

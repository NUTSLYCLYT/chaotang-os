import { getArchiveResponse } from "./handler.ts";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return getArchiveResponse(request, id);
}

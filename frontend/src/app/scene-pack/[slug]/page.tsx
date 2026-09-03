import { requireUser } from "../../../lib/requireUser";
import { ScenePackWorkspace } from "../../../features/scene-packs/ScenePackWorkspace";

export default async function ScenePackPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireUser(`/scene-pack/${slug}`);
  return <ScenePackWorkspace slug={slug} />;
}

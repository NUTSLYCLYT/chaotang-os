import { SceneBoard } from "../../../features/scene-packs/SceneBoard";
import { requireUser } from "../../../lib/requireUser";

export default async function SceneBoardPage() {
  await requireUser("/junjichu/scene-board");
  return <SceneBoard />;
}

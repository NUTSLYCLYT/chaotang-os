import { SceneBoard } from "../../../features/scene-packs/SceneBoard";
import { requireUser } from "../../../lib/requireUser";
import { boardPathFromQuery, buildBoardPath, parseBoardPath } from "../../../features/scene-packs/sceneBoardController";

export default async function SceneBoardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const path = boardPathFromQuery(await searchParams);
  const navigation = parseBoardPath(path);
  await requireUser(navigation ? buildBoardPath(navigation) : "/dadian");
  return <SceneBoard initialPath={path} />;
}

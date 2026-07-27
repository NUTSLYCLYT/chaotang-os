import { JunjichuClient } from "../../features/junjichu-visual/JunjichuClient";
import { requireUser } from "../../lib/requireUser";

export default async function JunjichuPage() {
  await requireUser("/junjichu");
  return <JunjichuClient />;
}

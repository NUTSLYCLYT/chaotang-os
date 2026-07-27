import { CourtPlaceholderPage } from "../../components/chaotang/CourtPlaceholderPage";
import { CourtShell } from "../../components/chaotang/CourtShell";
import { requireUser } from "../../lib/requireUser";

export default async function JunjichuPage() {
  await requireUser("/junjichu");
  return <CourtShell currentLabel="军机处" currentPath="/junjichu"><CourtPlaceholderPage variant="junjichu" title="军机处" description="军国机务统筹入口。" /></CourtShell>;
}

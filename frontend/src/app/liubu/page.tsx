import { CourtPlaceholderPage } from "../../components/chaotang/CourtPlaceholderPage";
import { CourtShell } from "../../components/chaotang/CourtShell";
import { requireUser } from "../../lib/requireUser";

export default async function LiubuPage() {
  await requireUser("/liubu");
  return <CourtShell currentLabel="六部" currentPath="/liubu"><CourtPlaceholderPage variant="liubu" title="六部" description="六部政务分域入口。" /></CourtShell>;
}

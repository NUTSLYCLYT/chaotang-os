import { CourtPlaceholderPage } from "../../components/chaotang/CourtPlaceholderPage";
import { CourtShell } from "../../components/chaotang/CourtShell";
import { requireUser } from "../../lib/requireUser";

export default async function CommandCenterPage() {
  await requireUser("/command-center");
  return <CourtShell currentLabel="指挥中心" currentPath="/command-center"><CourtPlaceholderPage variant="junjichu" title="指挥中心" description="朝堂全局态势入口。" /></CourtShell>;
}

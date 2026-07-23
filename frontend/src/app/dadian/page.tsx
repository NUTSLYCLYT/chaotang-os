import { CourtPlaceholderPage } from "../../components/chaotang/CourtPlaceholderPage";
import { CourtShell } from "../../components/chaotang/CourtShell";
import { requireUser } from "../../lib/requireUser";

export default async function DadianPage() {
  await requireUser("/dadian");
  return <CourtShell currentLabel="大殿" currentPath="/dadian"><CourtPlaceholderPage variant="dadian" title="大殿" description="朝堂议政总览入口。" /></CourtShell>;
}

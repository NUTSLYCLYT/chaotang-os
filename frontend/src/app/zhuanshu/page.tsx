import { CourtPlaceholderPage } from "../../components/chaotang/CourtPlaceholderPage";
import { CourtShell } from "../../components/chaotang/CourtShell";
import { requireUser } from "../../lib/requireUser";

export default async function ZhuanshuPage() {
  await requireUser("/zhuanshu");
  return <CourtShell currentLabel="专署" currentPath="/zhuanshu"><CourtPlaceholderPage variant="zhuanshu" title="专署" description="朝堂专门机构入口。" /></CourtShell>;
}

import { CourtShell } from "../../components/chaotang/CourtShell";
import { ZhuanshuEntryPage } from "../../features/zhuanshu-visual/ZhuanshuEntryPage";
import { requireUser } from "../../lib/requireUser";

export default async function ZhuanshuPage() {
  await requireUser("/zhuanshu");
  return <CourtShell currentLabel="专署" currentPath="/zhuanshu"><ZhuanshuEntryPage variant="zhuanshu" /></CourtShell>;
}

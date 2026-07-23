import { CourtPlaceholderPage } from "../../../components/chaotang/CourtPlaceholderPage";
import { CourtShell } from "../../../components/chaotang/CourtShell";
import { requireUser } from "../../../lib/requireUser";

export default async function JinyiweiPage() {
  await requireUser("/zhuanshu/jinyiwei");
  return <CourtShell currentLabel="锦衣卫" currentPath="/zhuanshu"><CourtPlaceholderPage variant="zhuanshu" title="锦衣卫" description="朝堂情报专署入口。" /></CourtShell>;
}

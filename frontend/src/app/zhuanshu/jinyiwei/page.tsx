import { CourtShell } from "../../../components/chaotang/CourtShell";
import { JinyiweiScrollDesk } from "../../../features/jinyiwei-visual/JinyiweiScrollDesk";
import { requireUser } from "../../../lib/requireUser";

export default async function JinyiweiPage() {
  await requireUser("/zhuanshu/jinyiwei");
  return <CourtShell currentLabel="锦衣卫" currentPath="/zhuanshu"><JinyiweiScrollDesk /></CourtShell>;
}

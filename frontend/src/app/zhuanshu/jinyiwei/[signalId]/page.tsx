import { CourtPlaceholderPage } from "../../../../components/chaotang/CourtPlaceholderPage";
import { CourtShell } from "../../../../components/chaotang/CourtShell";
import { requireUser } from "../../../../lib/requireUser";

export default async function JinyiweiSignalPage({ params }: { params: Promise<{ signalId: string }> }) {
  const { signalId } = await params;
  const routeSegment: `/zhuanshu/jinyiwei/${string}` = `/zhuanshu/jinyiwei/${encodeURIComponent(signalId)}`;
  await requireUser(routeSegment);
  return <CourtShell currentLabel="锦衣卫" currentPath="/zhuanshu"><CourtPlaceholderPage variant="zhuanshu" title="锦衣卫" description="情报条目入口。" routeSegment={routeSegment} /></CourtShell>;
}

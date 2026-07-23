import { CourtPlaceholderPage } from "../../../components/chaotang/CourtPlaceholderPage";
import { CourtShell } from "../../../components/chaotang/CourtShell";
import { requireUser } from "../../../lib/requireUser";

export default async function LiubuDepartmentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const routeSegment: `/liubu/${string}` = `/liubu/${encodeURIComponent(code)}`;
  await requireUser(routeSegment);
  return <CourtShell currentLabel="六部" currentPath="/liubu"><CourtPlaceholderPage variant="liubu" title="六部" description="六部部门入口。" routeSegment={routeSegment} /></CourtShell>;
}

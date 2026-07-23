import { CourtPlaceholderPage } from "../../../../components/chaotang/CourtPlaceholderPage";
import { CourtShell } from "../../../../components/chaotang/CourtShell";
import { requireUser } from "../../../../lib/requireUser";

export default async function LiubuOfficePage({ params }: { params: Promise<{ code: string; office: string }> }) {
  const { code, office } = await params;
  const routeSegment: `/liubu/${string}` = `/liubu/${encodeURIComponent(code)}/${encodeURIComponent(office)}`;
  await requireUser(routeSegment);
  return <CourtShell currentLabel="六部" currentPath="/liubu"><CourtPlaceholderPage variant="liubu" title="六部" description="六部属署入口。" routeSegment={routeSegment} /></CourtShell>;
}

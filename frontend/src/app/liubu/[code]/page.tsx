import { CourtShell } from "../../../components/chaotang/CourtShell";
import { DepartmentOverview } from "../../../features/department-demo/DepartmentDemoViews";
import { getDepartmentDemo } from "../../../features/department-demo/departmentDemoData";
import { requireUser } from "../../../lib/requireUser";
import { notFound } from "next/navigation";

export default async function LiubuDepartmentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const routeSegment: `/liubu/${string}` = `/liubu/${encodeURIComponent(code)}`;
  await requireUser(routeSegment);
  const department = getDepartmentDemo(code);
  if (!department) notFound();
  return <CourtShell currentLabel="六部" currentPath="/liubu"><DepartmentOverview department={department} /></CourtShell>;
}

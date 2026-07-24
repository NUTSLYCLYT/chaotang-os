import { CourtShell } from "../../../../components/chaotang/CourtShell";
import { DepartmentOfficeView } from "../../../../features/department-demo/DepartmentDemoViews";
import { getDepartmentDemo, getDepartmentOfficeDemo } from "../../../../features/department-demo/departmentDemoData";
import { requireUser } from "../../../../lib/requireUser";
import { notFound } from "next/navigation";

export default async function LiubuOfficePage({ params }: { params: Promise<{ code: string; office: string }> }) {
  const { code, office } = await params;
  const routeSegment: `/liubu/${string}` = `/liubu/${encodeURIComponent(code)}/${encodeURIComponent(office)}`;
  await requireUser(routeSegment);
  const department = getDepartmentDemo(code);
  const officeDemo = getDepartmentOfficeDemo(code, office);
  if (!department || !officeDemo) notFound();
  return <CourtShell currentLabel="六部" currentPath="/liubu"><DepartmentOfficeView department={department} office={officeDemo} /></CourtShell>;
}
